// 设置：外观、账号、同步、关于。上游 1,500 行的 Settings.jsx（健身偏好、器材、导入导出、passkey）已删。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import Icon from '../../components/Icon.jsx'
import { Section, Row, Segmented, Switch, Button } from '../../components/ui.jsx'
import { pathNameOf, pathOfRole } from '../../lib/lessons.js'
import { confirmSheet } from '../sheets.jsx'
import { connectionView, syncNowWithToast, showsConnection, useOnline } from '../components/SyncBanner.jsx'
import { useS, update } from './common.jsx'
import { api } from '../../lib/api.js'

const THEMES = [{ value: 'auto', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]

// 只读接口令牌：给 mcp/ 里的桥用，园长、教育局拿自己的 LLM 客户端问进度。令牌只在新建那一次显示；只能读，能看什么仍按账号。
function Tokens() {
  const toast = useUI.getState().toast
  const [d, setD] = useState(null), [fresh, setFresh] = useState(null), [busy, setBusy] = useState(false)
  const load = () => api('/api/me/tokens').then(setD).catch(() => setD(null))
  useEffect(() => { load() }, [])
  const make = async scope => {
    const label = prompt(scope === 'submit' ? '这枚投稿令牌给哪个系统用？（标签会写在它投来的案例上）' : '这枚令牌给哪个客户端用？（标签，便于日后撤）', scope === 'submit' ? '教研工坊' : 'Claude Desktop'); if (label === null) return
    setBusy(true)
    try { const r = await api('/api/me/tokens', { method: 'POST', body: JSON.stringify({ label, scope }) }); setFresh(r.token); load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  const revoke = async t => { if (!confirm(`撤「${t.label}」？用它的客户端立刻失效。`)) return; try { await api('/api/me/tokens/revoke', { method: 'POST', body: JSON.stringify({ id: t.id }) }); load() } catch (e) { toast('没成') } }
  const copy = async () => { try { await navigator.clipboard.writeText(fresh); toast('已复制') } catch { toast('复制失败，手动选中复制') } }
  return <>
    {fresh && <div className="card" style={{ background: 'color-mix(in srgb,var(--acc) 10%,transparent)' }}><div className="small muted">新令牌，只显示这一次，现在复制走</div><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, wordBreak: 'break-all', margin: '6px 0' }}>{fresh}</div><div className="row" style={{ gap: 8 }}><Button size="sm" variant="primary" onClick={copy}>复制</Button><Button size="sm" onClick={() => setFresh(null)}>收起</Button></div></div>}
    {(d?.tokens || []).map(t => <Row key={t.id} icon="key" title={`${t.label} · ${t.scopeName || '只读'}`} subtitle={`建于 ${new Date(t.at).toLocaleDateString('zh-CN')}${t.lastUsedAt ? ' · 最近用 ' + new Date(t.lastUsedAt).toLocaleString('zh-CN', { hour12: false }) : ' · 还没用过'}`} accessory="chevron" onClick={() => revoke(t)} />)}
    <Row icon="plus" title="新建一枚只读令牌" subtitle={d ? `${d.tokens.length}/${d.max} 枚在用 · 填进 LLM 客户端的 ACADEMY_TOKEN` : ''} onClick={() => !busy && make('read')} accessory="chevron" />
    <Row icon="plus" title="新建一枚投稿令牌" subtitle="给教研工坊、第三方往案例库投稿用：只放三条案例库写接口，署名是你，仍走园长同意与审核" onClick={() => !busy && make('submit')} accessory="chevron" />
  </>
}

export default function Settings() {
  const nav = useNavigate(), S = useS()
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  const isGuest = useStore(s => s.isGuest())
  const online = useOnline()
  const view = connectionView(sync, { online })
  const academy = user?.academy || {}
  const roleName = pathNameOf(pathOfRole(academy.role || S.role))
  const sourceName = { wechat: '微信', platform: '平台账号', dev: '开发桩' }[academy.source] || ''

  const signOut = async () => {
    const st = useStore.getState()
    const r = await st.signOut()
    if (!r.owed) return
    confirmSheet({
      title: '还有改动没同步', danger: true,
      message: `这台设备上还有 ${r.count || '一些'} 条改动没传到服务器。现在退出，改动会留在这台设备上，下次用同一账号登录时再传。`,
      confirmText: '仍然退出', cancelText: '先不退',
      onConfirm: async () => { const r2 = await st.signOut({ force: true }); if (r2.owed && r2.stashed === false) useUI.getState().toast('退出失败，请再试一次') }
    })
  }

  return <div className="narrow">
    <div className="hdr"><div><h1>设置</h1><div className="sub">外观 · 账号 · 同步 · 接口令牌</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>

    <Section title="外观">
      <div className="card"><Segmented options={THEMES} value={S.theme === 'light' || S.theme === 'dark' ? S.theme : 'auto'} onChange={v => update(s => { s.theme = v })} /></div>
    </Section>

    <Section title="账号">
      {user ? <>
        <Row icon="person" title={user.name} subtitle={[roleName, academy.org?.name, sourceName].filter(Boolean).join(' · ')} />
        <Row icon="signOut" title="退出登录" subtitle="进度已在账号里，换台设备登录照样有" onClick={signOut} danger accessory="chevron" />
      </> : <>
        <Row icon="person" title="访客" subtitle="进度只在这个浏览器里，登录后会记到账号" />
        <Row icon="key" title="去登录" onClick={() => useStore.getState().setGuest(false)} accessory="chevron" />
      </>}
    </Section>

    <Section title="同步" footer={isGuest ? '访客不同步。' : '进度随账号整体同步到服务器，草稿只留在这台设备上。'}>
      {view && <Row icon={view.icon} title={view.line} subtitle={sync?.lastSynced ? '上次同步 ' + new Date(sync.lastSynced).toLocaleString('zh-CN', { hour12: false }) : null} />}
      {user && <Row icon="reset" title="立即同步" onClick={() => syncNowWithToast()} accessory="chevron" />}
      <Row icon="cloud" title="顶部显示连接状态"><Switch checked={showsConnection(S)} onChange={v => update(s => { s.connStatus = v })} aria-label="顶部显示连接状态" /></Row>
    </Section>

    {user && <Section title="只读接口令牌" footer="给 mcp/ 里的桥用：在自己的 LLM 客户端（Claude Desktop、Cursor）里问本园、本区的进度。令牌只能读，能看什么仍按账号；点一枚可撤。接法见仓库 mcp/README.md。">
      <Tokens />
    </Section>}

    <Section title="关于" footer="基于 openGym（AGPL-3.0）改造，见仓库 NOTICE.md。">
      <Row icon="info" title="C-Life 学前大课堂" subtitle={'版本 ' + (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev')} />
    </Section>
    <div style={{ height: 24 }} />
    {user && <Button variant="ghost" className="dim" onClick={() => nav('/home')}>返回首页</Button>}
  </div>
}
