// 设置：外观、账号、同步、关于。上游 1,500 行的 Settings.jsx（健身偏好、器材、导入导出、passkey）已删。
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import Icon from '../../components/Icon.jsx'
import { Section, Row, Segmented, Switch, Button } from '../../components/ui.jsx'
import { pathNameOf, pathOfRole } from '../../lib/lessons.js'
import { confirmSheet } from '../sheets.jsx'
import { connectionView, syncNowWithToast, showsConnection, useOnline } from '../components/SyncBanner.jsx'
import { useS, update } from './common.jsx'

const THEMES = [{ value: 'auto', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]

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
    <div className="hdr"><button className="iconbtn" onClick={() => nav(-1)}><Icon name="chevronLeft" /></button><div><h1>设置</h1></div></div>

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

    <Section title="关于" footer="基于 openGym（AGPL-3.0）改造，见仓库 NOTICE.md。">
      <Row icon="info" title="C-Life 学前大课堂" subtitle={'版本 ' + (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev')} />
    </Section>
    <div style={{ height: 24 }} />
    {user && <Button variant="ghost" className="dim" onClick={() => nav('/home')}>返回首页</Button>}
  </div>
}
