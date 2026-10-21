// 大课堂登录页：平台账号（跳平台登录，带 ticket 回来）、微信（小程序内由小程序自己换 code；网页端提示）、
// 开发桩（DEV_LOGIN=1 时的名字＋岗位表单）。三条路都落到 setUser ＋ adoptProfile，与上游一致。
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { askAddDeviceData } from '../../sheets.jsx'
import { guestAllowed } from '../../lib/guest.js'
import Icon from '../../components/Icon.jsx'
import { Button, TextField } from '../../components/ui.jsx'
import { ROLES } from '../../lib/lessons.js'

export default function Login() {
  const nav = useNavigate(), loc = useLocation()
  const { setUser, adoptProfile, setGuest } = useStore()
  const config = useStore(s => s.config)
  const auth = config?.auth || {}
  const canGuest = guestAllowed(config)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('nurse')
  const [org, setOrg] = useState('柳北区示例幼儿园')

  const signedIn = async u => {
    setUser(u, { adopt: true })
    await adoptProfile(askAddDeviceData)
    // 岗位以服务端为准（平台登录每次刷新；微信登录默认教师，园长可改）
    if (u.academy?.role) useStore.getState().update(s => { s.role = u.academy.role }, false)
    useUI.getState().toast(`欢迎，${u.name}`)
  }
  const login = async (path, body, fail) => {
    setBusy(true)
    try { const r = await api(path, { method: 'POST', body: JSON.stringify(body) }); await signedIn(r.user) }
    catch (e) { useUI.getState().toast(fail + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }

  // 平台登录完跳回 #/login/platform?ticket=…：拿票据换会话，然后回首页
  useEffect(() => {
    if (!loc.pathname.startsWith('/login/platform')) return
    const ticket = new URLSearchParams(loc.search).get('ticket')
    nav('/home', { replace: true })
    if (ticket) login('/api/login/platform', { ticket }, '平台登录失败')
  }, [loc.pathname])

  const toPlatform = () => {
    if (!auth.platform_login_url) { useUI.getState().toast('平台登录地址未配置'); return }
    const back = location.origin + location.pathname + '#/login/platform'
    location.href = auth.platform_login_url + (auth.platform_login_url.includes('?') ? '&' : '?') + 'redirect=' + encodeURIComponent(back)
  }

  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }
  return <div className="narrow" style={wrap}>
    <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="clipboard" /></div>
    <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>学前大课堂</h1>
    <div className="muted" style={{ marginBottom: 30 }}>按岗位走关，在平台上做一次就算一次。</div>

    {auth.platform && <><Button variant="primary" icon="key" disabled={busy} onClick={toPlatform}>平台账号登录</Button><div style={{ height: 10 }} /></>}
    {auth.wechat && <div className="card small muted" style={{ textAlign: 'start', marginBottom: 10 }}>微信登录请在「柳州智投」小程序里打开大课堂；网页端用平台账号。</div>}

    {auth.dev && <div className="card" style={{ textAlign: 'start' }}>
      <div className="small muted" style={{ marginBottom: 8 }}>开发桩登录（DEV_LOGIN）</div>
      <TextField placeholder="姓名" value={name} onChange={e => setName(e.target.value)} />
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <select className="ac-sel" value={role} onChange={e => setRole(e.target.value)} style={{ flex: 1 }}>{Object.keys(ROLES).map(k => <option key={k} value={k}>{ROLES[k].label}</option>)}</select>
        <TextField placeholder="园所" value={org} onChange={e => setOrg(e.target.value)} style={{ flex: 2 }} />
      </div>
      <div style={{ height: 10 }} />
      <Button variant="tinted" disabled={busy || !name.trim()} onClick={() => login('/api/login/dev', { name: name.trim(), role, org }, '登录失败')}>进入</Button>
    </div>}

    {!auth.platform && !auth.wechat && !auth.dev && <div className="card small muted" style={{ textAlign: 'start' }}>这台服务器还没有配置登录方式。设置 PLATFORM_AUTH_URL 或 WX_APPID / WX_SECRET，本机开发可设 DEV_LOGIN=1。</div>}
    {canGuest && <><div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => setGuest(true)}>不登录，先看看</Button></>}
  </div>
}
