// 大课堂的应用壳：沿用上游的 store（状态、同步、登录）、主题、Toast、Modals、SyncBanner，
// 路由与底栏换成大课堂的。上游 App.jsx 留作对照，等视图替换完再删。
import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { accentValue, applyAccent } from '../lib/accent.js'
import { setNav } from '../lib/nav.js'
import Icon from '../components/Icon.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import Modals from '../components/Modals.jsx'
import Toast from '../components/Toast.jsx'
import SyncBanner from '../components/SyncBanner.jsx'
import Login from '../views/Login.jsx'
import { SettingsRoute } from '../views/Settings.jsx'
import Home from './views/Home.jsx'
import Paths from './views/Paths.jsx'
import Level from './views/Level.jsx'
import Me from './views/Me.jsx'
import './academy.css'

bindUI(useUI)

const resolveTheme = theme => theme === 'light' || theme === 'dark'
  ? theme : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

function Tab({ active, icon, label, onClick }) {
  return <button className={active ? 'on' : ''} onClick={onClick}><span className="tab-ic"><Icon name={icon} /></span><span>{label}</span></button>
}

function Tabs() {
  const nav = useNavigate(), loc = useLocation()
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (k === 'paths' && cur === 'level') || (k === 'home' && cur === 'settings')
  return <nav id="tabbar">
    <Tab active={on('home')} icon="house" label="首页" onClick={() => nav('/home')} />
    <Tab active={on('paths')} icon="list" label="学习路径" onClick={() => nav('/paths')} />
    <Tab active={on('me')} icon="personCircle" label="我的" onClick={() => nav('/me')} />
  </nav>
}

function Shell() {
  const navigate = useNavigate(), loc = useLocation()
  const { S, user, ready } = useStore()
  const isGuest = useStore(s => s.isGuest())
  useEffect(() => { setNav(navigate) }, [navigate])
  const accent = accentValue(S)
  useEffect(() => {
    const de = document.documentElement
    de.dataset.theme = resolveTheme(S.theme)
    applyAccent(de, accent, de.dataset.theme)
  }, [S.theme, accent])
  useEffect(() => { document.documentElement.lang = 'zh' }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])

  const authed = user || isGuest
  if (!ready && !authed) return <div id="app"><div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}><Icon name="clipboard" /></div></div>
  return <>
    <div id="app" className="vfade" key={loc.pathname}>
      <ErrorBoundary>
        {!authed ? <Login /> : <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/paths" element={<Paths />} />
          <Route path="/paths/:path" element={<Paths />} />
          <Route path="/level/:id" element={<Level />} />
          <Route path="/me" element={<Me />} />
          <Route path="/settings" element={<SettingsRoute />} />
          <Route path="/settings/:page" element={<SettingsRoute />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>}
      </ErrorBoundary>
    </div>
    <SyncBanner />
    {authed && <Tabs />}
    <Modals />
    <Toast />
  </>
}

export default function AcademyApp() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  return <HashRouter><Shell /></HashRouter>
}
