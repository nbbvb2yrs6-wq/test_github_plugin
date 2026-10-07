window.__ModuleLoader__.load({
  id: 'dsh-github-sync',
  factory: (require) => {
    const React = require('react')
    const { useCallback, useEffect, useState } = React
    const { createElement: h } = React
    const Icon = ({ children }) => h('span', { 'aria-hidden': true, style: { marginRight: 5 } }, children)
    const endpoint = '/_dsh/github-sync/status'
    const call = async (sessionId, action, extra = {}) => { const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, action, ...extra }) }); const body = await response.json(); if (!body.ok) throw new Error(body.error || 'GitHub operation failed'); return body.value }
    const callFrom = (ctx, sessionId, action, extra = {}) => call(sessionId, action, extra)
    const styles = {
      root: { height: '100%', overflow: 'auto', padding: 14, color: 'var(--dsw-alias-label-primary)', font: 'var(--dsw-font-xxs-12)' },
      title: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 12 },
      card: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, padding: 10, marginBottom: 10 },
      row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
      button: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 6, background: 'var(--dsw-alias-bg-layer-1)', color: 'inherit', padding: '6px 9px', cursor: 'pointer' },
      primary: { background: 'var(--dsw-alias-state-business-primary)', color: 'white', border: 0 },
      input: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 6, background: 'var(--dsw-alias-bg-layer-1)', color: 'inherit', padding: 7 },
      muted: { color: 'var(--dsw-alias-label-tertiary)' },
      warn: { color: 'var(--dsw-alias-state-warn-label)' },
      good: { color: 'var(--dsw-alias-state-success-primary)' },
    }
    const BUSY_TEXT = { init: '正在初始化仓库…', publish: '正在创建仓库并推送…', push: '正在推送到 GitHub…', sync: '正在与 GitHub 同步…', 'commit-push': '正在提交并推送…', suggest: '正在生成提交信息…' }
    function Status({ ctx, scope }) {
      const [state, setState] = useState(null); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [repoName, setRepoName] = useState(''); const [publicRepo, setPublicRepo] = useState(false)
      const sessionId = scope.sessionId
      const refresh = useCallback(async () => { try { setError(''); setState(await callFrom(ctx, sessionId, 'status')) } catch (e) { setError(e.message) } }, [ctx, sessionId])
      useEffect(() => { refresh(); const id = setInterval(() => callFrom(ctx, sessionId, 'status').then(setState).catch(() => {}), 30000); return () => clearInterval(id) }, [refresh, sessionId])
      const run = async (action, extra) => { if (busy) return; setBusy(action); setError(''); try { await callFrom(ctx, sessionId, action, extra); if (action === 'commit-push') setMessage(''); await refresh() } catch (e) { setError(e.message) } finally { setBusy('') } }
      const publish = () => run('publish', { name: repoName.trim() || 'project', public: publicRepo })
      const suggest = async () => { if (busy) return; setBusy('suggest'); setError(''); try { const value = await callFrom(ctx, sessionId, 'suggest'); setMessage(value.message) } catch (e) { setError(e.message) } finally { setBusy('') } }
      const spinner = (key) => h('span', { key, style: { display: 'inline-block', animation: 'ghsync-spin 1s linear infinite', marginRight: 6 } }, '◌')
      const keyframes = h('style', null, '@keyframes ghsync-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }')
      const btn = (label, opts = {}) => { const active = busy !== '' && busy === opts.action; return h('button', { style: { ...styles.button, ...(opts.primary ? styles.primary : {}), ...(busy !== '' || opts.disabled ? { opacity: active ? 0.85 : 0.4, cursor: active ? 'wait' : 'not-allowed' } : {}), ...(opts.style || {}) }, disabled: busy !== '' || Boolean(opts.disabled), onClick: opts.onClick }, active ? spinner('s') : null, active ? (opts.busyLabel || label) : label) }
      const busyCard = busy !== '' ? h('div', { style: { ...styles.card, display: 'flex', alignItems: 'center' } }, spinner('b'), BUSY_TEXT[busy] || '正在执行…', h('span', { style: { ...styles.muted, marginLeft: 6 } }, '网络慢时请耐心等待，不用重复点击')) : null
      const errorCard = error ? h('div', { style: { ...styles.card, ...styles.warn } }, h(Icon, null, '⚠'), ' ', error) : null
      if (!state) return h('div', { style: styles.root }, keyframes, h('div', { style: styles.title }, h(Icon, null, '◉'), 'GitHub'), h('div', { style: styles.card }, error || '正在读取项目状态…'))
      if (!state.isRepo) return h('div', { style: styles.root }, keyframes,
        h('div', { style: styles.title }, h(Icon, null, '◉'), 'GitHub'),
        h('div', { style: styles.card }, h('div', { style: styles.row }, h('strong', null, '还不是 Git 仓库'), h(Icon, null, '○')), h('p', { style: styles.muted }, '初始化后可以发布到 GitHub。'), btn('初始化仓库', { action: 'init', primary: true, busyLabel: '初始化中…', onClick: () => run('init') })),
        h('div', { style: styles.card }, h('strong', null, '发布到 GitHub'), h('input', { style: { ...styles.input, marginTop: 8 }, value: repoName, placeholder: '仓库名称', onChange: e => setRepoName(e.target.value) }), h('label', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 } }, h('input', { type: 'checkbox', checked: publicRepo, onChange: e => setPublicRepo(e.target.checked) }), '公开仓库（默认私有）'), btn('创建并推送', { action: 'publish', primary: true, busyLabel: '创建推送中…', disabled: !repoName.trim(), style: { marginTop: 8 }, onClick: publish })),
        busyCard, errorCard)
      const changed = state.entries?.length || 0
      const statusText = !state.remote ? (changed ? `有 ${changed} 个文件未提交` : '已初始化，尚未发布') : state.behind ? `远程落后 ${state.behind} 个提交` : state.ahead ? `有 ${state.ahead} 个提交未推送` : changed ? `有 ${changed} 个文件未提交` : '已同步'
      const statusStyle = state.behind || changed || state.ahead ? styles.warn : styles.good
      return h('div', { style: styles.root }, keyframes,
        h('div', { style: styles.title }, h(Icon, null, '◉'), 'GitHub', h('span', { style: { ...styles.muted, marginLeft: 'auto', fontWeight: 400 } }, state.branch)),
        h('div', { style: styles.card }, h('div', { style: { ...styles.row, ...statusStyle } }, h('strong', null, statusText), h(Icon, null, '⑂')),
          h('div', { style: styles.muted }, `${changed} 个改动 · ↑${state.ahead || 0} ↓${state.behind || 0}`), state.remote && h('div', { style: { ...styles.muted, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis' } }, state.remote)),
        !state.remote && h('div', { style: styles.card }, h('strong', null, '发布到 GitHub'), h('input', { style: { ...styles.input, marginTop: 8 }, value: repoName, placeholder: '仓库名称', onChange: e => setRepoName(e.target.value) }), h('label', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 } }, h('input', { type: 'checkbox', checked: publicRepo, onChange: e => setPublicRepo(e.target.checked) }), '公开仓库（默认私有）'), btn('创建并推送', { action: 'publish', primary: true, busyLabel: '创建推送中…', disabled: !repoName.trim(), style: { marginTop: 8 }, onClick: publish })),
        h('div', { style: styles.card }, h('div', { style: styles.row }, h('strong', null, '操作'), btn('↻', { onClick: refresh })),
          h('div', { style: { display: 'flex', gap: 7, flexWrap: 'wrap' } }, btn('同步', { action: 'sync', busyLabel: '同步中…', onClick: () => run('sync') }), btn('↑ 推送', { action: 'push', primary: true, busyLabel: '推送中…', onClick: () => run('push') }))),
        h('div', { style: styles.card }, h('strong', null, '提交'), h('div', { style: { marginTop: 8 } }, h('input', { style: styles.input, value: message, placeholder: '提交信息（可让 AI 生成）', onChange: e => setMessage(e.target.value) })), h('div', { style: { display: 'flex', gap: 7, marginTop: 8 } }, btn('AI 生成提交信息', { action: 'suggest', busyLabel: '生成中…', onClick: suggest }), btn('提交并推送', { action: 'commit-push', primary: true, busyLabel: '提交推送中…', disabled: !message.trim(), onClick: () => run('commit-push', { message }) }))),
        busyCard, errorCard,
      )
    }
    function apply(ctx) {
      const better = ctx.betterSidebar || ctx.get('betterSidebar'); if (!better) throw new Error('dsh-github-sync: betterSidebar service unavailable')
      const disposeTab = better.registerTab({ id: 'github-sync', title: 'GitHub', description: '初始化、提交、推送和同步 GitHub 项目', icon: size => h(Icon, null, '◉'), single: true, badge: (_ctx, scope) => undefined, component: props => h(Status, { ctx: props.ctx, scope: props.scope }) })
      return () => { disposeTab() }
    }
    return { apply, inject: ['betterSidebar'] }
  },
})
