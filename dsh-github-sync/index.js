import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'

const GH_CANDIDATES = [
  join(process.cwd(), 'tools', 'gh-cli', 'bin', 'gh'),
  join(homedir(), 'Desktop', '懂球帝', 'DSH', '插件_Git', 'tools', 'gh-cli', 'bin', 'gh'),
  join(homedir(), 'bin', 'gh'),
]
const MAX_OUTPUT = 256 * 1024

function commandExists(path) { return access(path).then(() => true, () => false) }
async function ghPath() {
  for (const candidate of GH_CANDIDATES) if (await commandExists(candidate)) return candidate
  return 'gh'
}
function run(command, args, cwd, signal) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: process.env, signal })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk.toString(); if (stdout.length > MAX_OUTPUT) child.kill() })
    child.stderr.on('data', chunk => { stderr += chunk.toString(); if (stderr.length > MAX_OUTPUT) child.kill() })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolvePromise({ stdout, stderr }) : reject(new Error((stderr || stdout || `command exited ${code}`).trim())))
  })
}
async function git(args, cwd, signal) { return run('git', args, cwd, signal) }
async function gh(args, cwd, signal) { return run(await ghPath(), args, cwd, signal) }
function clean(text) { return text.trim().replaceAll(/\x1b\[[0-?]*[ -/]*[@-~]/g, '') }
function parsePorcelain(text) {
  return text.split('\0').filter(Boolean).map(row => {
    const xy = row.slice(0, 2); const raw = row.slice(3)
    const path = raw.includes(' -> ') ? raw.split(' -> ').at(-1) : raw
    return { path, xy }
  })
}
async function repoRoot(cwd, signal) {
  try { return clean((await git(['rev-parse', '--show-toplevel'], cwd, signal)).stdout) } catch { return null }
}
async function status(cwd, signal) {
  const root = await repoRoot(cwd, signal)
  if (!root) return { isRepo: false, entries: [], cwd }
  const [porcelain, branch, remote, upstream, counts] = await Promise.all([
    git(['status', '--porcelain=v1', '-z'], root, signal),
    git(['branch', '--show-current'], root, signal),
    git(['remote', 'get-url', 'origin'], root, signal).catch(() => ({ stdout: '' })),
    git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], root, signal).catch(() => ({ stdout: '' })),
    git(['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], root, signal).catch(() => ({ stdout: '0\t0' })),
  ])
  const [behind, ahead] = clean(counts.stdout).split(/\s+/).map(Number)
  return { isRepo: true, root, branch: clean(branch.stdout) || 'HEAD', remote: clean(remote.stdout), entries: parsePorcelain(porcelain.stdout), ahead: ahead || 0, behind: behind || 0, hasUpstream: Boolean(clean(upstream.stdout)) }
}
async function ghAuth(cwd, signal) {
  try { const result = await gh(['auth', 'status', '--hostname', 'github.com'], cwd, signal); return { loggedIn: true, detail: clean(result.stderr || result.stdout) } } catch { return { loggedIn: false } }
}
function output(schemaOrRender, maybeRender) { return { schema: { type: 'json' }, render: maybeRender || schemaOrRender } }
function textRender(value) { return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] }
function requireAgent(exec) { if (!exec.agent) throw new Error('GitHub tools require an active agent session'); return exec.agent.session.id }
async function sessionCwd(ctx, sessionId) {
  const session = ctx.sessions.get(sessionId)
  return session?.header?.cwd || process.cwd()
}

export const name = 'dsh-github-sync'
export const inject = ['sessions', 'tools', 'llm', 'webServer', 'systemPrompt', 'clientModules']
export function apply(ctx) {
  const routeDisposer = ctx.webServer.register({
    kind: 'exact', path: '/_dsh/github-sync/status',
    handler: async (req, res) => {
      if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
      let body = ''; for await (const chunk of req) body += chunk.toString()
      try {
        const payload = JSON.parse(body || '{}'); const sessionId = String(payload.sessionId || '')
        if (!sessionId) throw new Error('missing sessionId')
        const session = ctx.sessions.get(sessionId)
        if (!session) throw new Error('session not found')
        const cwd = session.header?.cwd || process.cwd()
        if (payload.cwd && resolve(payload.cwd) !== resolve(cwd)) throw new Error('requested cwd does not match session workspace')
        let value
        if (payload.action === 'debug-client') {
           const graph = ctx.clientModules.graph()
           value = { entries: graph.entries.map(entry => ({ id: entry.id, url: entry.url, rev: entry.rev, inject: entry.inject, immediately: entry.immediately })) }
         }
         else if (!payload.action || payload.action === 'status') value = await status(cwd)
        else if (payload.action === 'auth') value = await ghAuth(cwd)
        else if (payload.action === 'init') { await git(['init', '-b', 'main'], cwd); value = await status(cwd) }
        else if (payload.action === 'commit') { await git(['add', '-A'], cwd); await git(['commit', '-m', String(payload.message || 'Update project')], cwd); value = await status(cwd) }
        else if (payload.action === 'commit-push') { await git(['add', '-A'], cwd); await git(['commit', '-m', String(payload.message || 'Update project')], cwd); await git(['push'], cwd); value = await status(cwd) }
        else if (payload.action === 'publish') {
          await git(['init', '-b', 'main'], cwd).catch(() => {}); await git(['add', '-A'], cwd); await git(['commit', '-m', 'Initial commit'], cwd).catch(() => {})
          await gh(['repo', 'create', String(payload.name || basename(cwd)), payload.public === true ? '--public' : '--private', '--source=.', '--remote=origin', '--push'], cwd)
          value = await status(cwd)
        }
        else if (payload.action === 'push') { await git(['push'], cwd); value = await status(cwd) }
        else if (payload.action === 'sync') { await git(['pull', '--rebase'], cwd); await git(['push'], cwd); value = await status(cwd) }
        else if (payload.action === 'suggest') {
          const diff = (await git(['diff', '--stat'], cwd)).stdout + '\n' + (await git(['diff', '--cached', '--stat'], cwd)).stdout
          const route = ctx.get('agentDefaultModel')?.currentSelection()
          if (!route?.provider || !route?.model) throw new Error('No default model is configured')
          const { BlockAssembler, createUserMessage } = await import('@deepseek-ai/dsh-llm')
          const assembler = new BlockAssembler()
          for await (const chunk of ctx.llm.stream({ provider: route.provider, model: route.model, messages: [createUserMessage({ content: [{ type: 'text', text: `Write one concise Git commit message for these changes. Return only the message, no quotes or markdown.\n${diff}` }], source: { kind: 'plugin', plugin: 'dsh-github-sync' } })], maxTokens: 80, purpose: 'github-commit-message', sessionId })) assembler.push(chunk)
          const text = assembler.blocks().filter(block => block.type === 'text').map(block => block.text).join('').trim()
          value = { message: text || 'Update project' }
        }
        else throw new Error(`unknown action: ${payload.action}`)
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, value }))
      } catch (error) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: error.message })) }
    },
  })
  const register = definition => ctx.tools.register(defineTool(definition))
  const resolveForExec = exec => sessionCwd(ctx, requireAgent(exec))
  const readStatus = async (exec) => status(await resolveForExec(exec), exec.signal)

  const statusTool = register({
    name: 'github_status',
    description: 'Show GitHub/Git status for the current DSH project: branch, changed files, ahead/behind and remote.',
    parameters: {},
    output: output(textRender),
    execute: async (_args, exec) => readStatus(exec),
  })
  const initTool = register({
    name: 'github_init', description: 'Initialize Git in the current DSH project and set the main branch.', parameters: {},
    output: output(textRender),
    execute: async (_args, exec) => { const cwd = await resolveForExec(exec); await git(['init', '-b', 'main'], cwd, exec.signal); return { root: clean((await git(['rev-parse', '--show-toplevel'], cwd, exec.signal)).stdout) } },
  })
  const publishTool = register({
    name: 'github_publish', description: 'Create a GitHub repository, commit all current project files and push. Default visibility is private; use public=true only when explicitly requested.',
    parameters: { name: { type: 'string', required: true, description: 'Repository name.' }, public: { type: 'boolean', description: 'Create a public repository instead of private.' } },
    output: output(textRender),
    execute: async (args, exec) => { const cwd = await resolveForExec(exec); await git(['init', '-b', 'main'], cwd, exec.signal).catch(() => {}); await git(['add', '-A'], cwd, exec.signal); await git(['commit', '-m', 'Initial commit'], cwd, exec.signal).catch(() => {}); const flags = args.public === true ? ['--public'] : ['--private']; const r = await gh(['repo', 'create', args.name, ...flags, '--source=.', '--remote=origin', '--push'], cwd, exec.signal); const url = clean(r.stdout).split('\n').find(x => x.startsWith('http')) || `https://github.com/${args.name}`; return { url, name: args.name } },
  })
  const pushTool = register({
    name: 'github_push', description: 'Push committed local changes to GitHub. Never force-pushes.', parameters: { setUpstream: { type: 'boolean', description: 'Set upstream for the current branch.' } },
    output: output(textRender),
    execute: async (args, exec) => { const cwd = await resolveForExec(exec); const branch = clean((await git(['branch', '--show-current'], cwd, exec.signal)).stdout) || 'main'; const pushArgs = args.setUpstream ? ['push', '-u', 'origin', branch] : ['push']; await git(pushArgs, cwd, exec.signal); return { pushed: true, message: `Pushed ${branch} to GitHub` } },
  })
  const commitTool = register({
    name: 'github_commit', description: 'Stage all project changes and create a local Git commit. Does not push.', parameters: { message: { type: 'string', required: true, description: 'Commit message.' } },
    output: output(textRender),
    execute: async (args, exec) => { const cwd = await resolveForExec(exec); await git(['add', '-A'], cwd, exec.signal); await git(['commit', '-m', args.message], cwd, exec.signal); return { committed: true, message: args.message } },
  })
  const syncTool = register({
    name: 'github_sync', description: 'Synchronize the current branch with GitHub using pull --rebase followed by push. Stops safely on conflicts.', parameters: {},
    output: output(textRender),
    execute: async (_args, exec) => { const cwd = await resolveForExec(exec); await git(['pull', '--rebase'], cwd, exec.signal); await git(['push'], cwd, exec.signal); return { synced: true, message: 'Repository synchronized' } },
  })
  const authTool = register({
    name: 'github_auth_status', description: 'Check whether GitHub CLI authentication is available.', parameters: {},
    output: output(textRender),
    execute: async (_args, exec) => ghAuth(await resolveForExec(exec), exec.signal),
  })

  ctx.systemPrompt.context({ name: 'github-sync:workflow', order: 130, text: () => 'GitHub workflow: use github_status to check project state. Before any push or publish, make the intended commit and remote operation clear to the user. Never force-push. GitHub repositories are private by default; only create public repositories when explicitly requested.' })
  ctx.on('agent/turn-stopping', async (payload) => {
    try { const s = await status(await sessionCwd(ctx, payload.agent.session.id), payload.signal); if (s.isRepo && (s.entries.length || s.ahead)) payload.agent.session.append('github-sync/status-reminder', { branch: s.branch, changed: s.entries.length, ahead: s.ahead }) } catch {}
  })
  return () => { routeDisposer(); statusTool(); initTool(); publishTool(); pushTool(); commitTool(); syncTool(); authTool() }
}
