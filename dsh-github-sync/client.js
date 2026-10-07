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
    function Status({ ctx, scope }) {
      const [state, setState] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [repoName, setRepoName] = useState(''); const [publicRepo, setPublicRepo] = useState(false)
      const sessionId = scope.sessionId
      const refresh = useCallback(async () => { try { setError(''); setState(await callFrom(ctx, sessionId, 'status')) } catch (e) { setError(e.message) } }, [ctx, sessionId])
      useEffect(() => { refresh(); const id = setInterval(() => callFrom(ctx, sessionId, 'status').then(setState).catch(() => {}), 30000); return () => clearInterval(id) }, [refresh, sessionId])
      const run = async (action, extra) => { setBusy(true); setError(''); try { await callFrom(ctx, sessionId, action, extra); await refresh() } catch (e) { setError(e.message) } finally { setBusy(false) } }
      const publish = () => run('publish', { name: repoName.trim() || 'project', public: publicRepo })
      const suggest = async () => { setBusy(true); try { const value = await callFrom(ctx, sessionId, 'suggest'); setMessage(value.message) } catch (e) { setError(e.message) } finally { setBusy(false) } }
      if (!state) return h('div', { style: styles.root }, h('div', { style: styles.title }, h(Icon, null, '◉'), 'GitHub'), h('div', { style: styles.card }, error || '正在读取项目状态…'))
      if (!state.isRepo) return h('div', { style: styles.root }, h('div', { style: styles.title }, h(Icon, null, '◉'), 'GitHub'), h('div', { style: styles.card }, h('div', { style: styles.row }, h('strong', null, '还不是 Git 仓库'), h(Icon, null, '○')), h('p', { style: styles.muted }, '初始化后可以发布到 GitHub。'), h('button', { style: { ...styles.button, ...styles.primary }, disabled: busy, onClick: () => run('init') }, '初始化仓库')), h('div', { style: styles.card }, h('strong', null, '发布到 GitHub'), h('input', { style: { ...styles.input, marginTop: 8 }, value: repoName, placeholder: '仓库名称', onChange: e => setRepoName(e.target.value) }), h('label', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 } }, h('input', { type: 'checkbox', checked: publicRepo, onChange: e => setPublicRepo(e.target.checked) }), '公开仓库（默认私有）'), h('button', { style: { ...styles.button, ...styles.primary, marginTop: 8 }, disabled: busy || !repoName.trim(), onClick: publish }, '创建并推送')))
      const changed = state.entries?.length || 0
      const statusText = !state.remote ? (changed ? `有 ${changed} 个文件未提交` : '已初始化，尚未发布') : state.behind ? `远程落后 ${state.behind} 个提交` : state.ahead ? `有 ${state.ahead} 个提交未推送` : changed ? `有 ${changed} 个文件未提交` : '已同步'
      const statusStyle = state.behind || changed || state.ahead ? styles.warn : styles.good
      return h('div', { style: styles.root },
        h('div', { style: styles.title }, h(Icon, null, '◉'), 'GitHub', h('span', { style: { ...styles.muted, marginLeft: 'auto', fontWeight: 400 } }, state.branch)),
        h('div', { style: styles.card }, h('div', { style: { ...styles.row, ...statusStyle } }, h('strong', null, statusText), h(Icon, null, '⑂')),
          h('div', { style: styles.muted }, `${changed} 个改动 · ↑${state.ahead || 0} ↓${state.behind || 0}`), state.remote && h('div', { style: { ...styles.muted, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis' } }, state.remote)),
        !state.remote && h('div', { style: styles.card }, h('strong', null, '发布到 GitHub'), h('input', { style: { ...styles.input, marginTop: 8 }, value: repoName, placeholder: '仓库名称', onChange: e => setRepoName(e.target.value) }), h('label', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 } }, h('input', { type: 'checkbox', checked: publicRepo, onChange: e => setPublicRepo(e.target.checked) }), '公开仓库（默认私有）'), h('button', { style: { ...styles.button, ...styles.primary, marginTop: 8 }, disabled: busy || !repoName.trim(), onClick: publish }, '创建并推送')),
        h('div', { style: styles.card }, h('div', { style: styles.row }, h('strong', null, '操作'), h('button', { style: styles.button, disabled: busy, onClick: refresh }, h(Icon, null, '↻'))),
          h('div', { style: { display: 'flex', gap: 7, flexWrap: 'wrap' } }, h('button', { style: styles.button, disabled: busy, onClick: () => run('sync') }, '同步'), h('button', { style: { ...styles.button, ...styles.primary }, disabled: busy, onClick: () => run('push') }, h(Icon, null, '↑'), ' 推送'))),
        h('div', { style: styles.card }, h('strong', null, '提交'), h('div', { style: { marginTop: 8 } }, h('input', { style: styles.input, value: message, placeholder: '提交信息（可让 AI 生成）', onChange: e => setMessage(e.target.value) })), h('div', { style: { display: 'flex', gap: 7, marginTop: 8 } }, h('button', { style: styles.button, disabled: busy, onClick: suggest }, 'AI 生成提交信息'), h('button', { style: { ...styles.button, ...styles.primary }, disabled: busy || !message.trim(), onClick: () => run('commit-push', { message }) }, '提交并推送'))),
        error && h('div', { style: { ...styles.card, ...styles.warn } }, h(Icon, null, '⚠'), ' ', error),
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
