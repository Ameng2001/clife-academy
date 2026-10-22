// 大课堂的应用壳：沿用上游的 store（状态、同步、登录）、主题、Toast、Modals、SyncBanner，
// 路由、底栏、设置、同步状态条都是大课堂自己的；上游健身视图已删。
// 壳分两套：手机底部五个 tab（Tabs），桌面 ≥ 1000px 顶部导航（TopNav）；哪套显示由 academy.css 的断点定。没登录时是 Landing（桌面左介绍右登录卡）。
import { useEffect, useState } from 'react'
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
import SyncBanner from './components/SyncBanner.jsx'
import Landing from './views/Landing.jsx'
import TopNav from './components/TopNav.jsx'
import Settings from './views/Settings.jsx'
import Home from './views/Home.jsx'
import Paths from './views/Paths.jsx'
import Level from './views/Level.jsx'
import Me from './views/Me.jsx'
import Director from './views/Director.jsx'
import Review from './views/Review.jsx'
import CapabilityMap from './views/CapabilityMap.jsx'
import Resources from './views/Resources.jsx'
import Cases from './views/Cases.jsx'
import Works from './views/Works.jsx'
import Community from './views/Community.jsx'
import Lectures from './views/Lectures.jsx'
import Forms from './views/Forms.jsx'
import Policy from './views/Policy.jsx'
import Collections from './views/Collections.jsx'
import Drills from './views/Drills.jsx'
import Honors from './views/Honors.jsx'
import Contests from './views/Contests.jsx'
import Checkup from './views/Checkup.jsx'
import District from './views/District.jsx'
import Certificates from './views/Certificates.jsx'
import Questions from './views/Questions.jsx'
import Studios from './views/Studios.jsx'
import Portfolio from './views/Portfolio.jsx'
import ReviewStats from './views/ReviewStats.jsx'
import Library from './views/Library.jsx'
import SelfReview from './views/SelfReview.jsx'
import Camps from './views/Camps.jsx'
import StudyGroups from './views/StudyGroups.jsx'
import Programs from './views/Programs.jsx'
import ShareDays from './views/ShareDays.jsx'
import Coach from './views/Coach.jsx'
import Admin from './views/Admin.jsx'
import './academy.css'
import './brand.js'

bindUI(useUI)

const resolveTheme = theme => theme === 'light' || theme === 'dark'
  ? theme : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

function Tab({ active, icon, label, onClick }) {
  return <button className={active ? 'on' : ''} onClick={onClick}><span className="tab-ic"><Icon name={icon} /></span><span>{label}</span></button>
}

function Tabs() {
  const nav = useNavigate(), loc = useLocation()
  const cur = loc.pathname.split('/')[1] || 'home'
  const ugc = new Set(['community', 'cases', 'works', 'forms', 'resources', 'collections', 'sharedays', 'studios'])
  const on = k => cur === k || (k === 'paths' && cur === 'level') || (k === 'home' && cur === 'settings') || (k === 'community' && ugc.has(cur))
  return <nav id="tabbar">
    <Tab active={on('home')} icon="house" label="首页" onClick={() => nav('/home')} />
    <Tab active={on('paths')} icon="list" label="学习路径" onClick={() => nav('/paths')} />
    <Tab active={on('library')} icon="magnifier" label="精品微课" onClick={() => nav('/library')} />
    <Tab active={on('community')} icon="share" label="共同体" onClick={() => nav('/community')} />
    <Tab active={on('me')} icon="personCircle" label="我的" onClick={() => nav('/me')} />
  </nav>
}

function Shell() {
  const navigate = useNavigate(), loc = useLocation()
  const { S, user, ready, setGuest } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const syncStatus = useStore(s => s.sync?.status)
  // SyncBanner 的「登录」指到大课堂登录页，不走上游的 passkey：访客退出访客态；
  // 已登录但服务端不认这个浏览器（status 'auth'，开机时 store 已清掉 user，会话中途失效则还留着）
  // 就临时让出页面给 Login，登上去 status 离开 'auth' 自动回到应用。
  const [relogin, setRelogin] = useState(false)
  useEffect(() => { if (syncStatus !== 'auth') setRelogin(false) }, [syncStatus])
  const toLogin = () => { if (isGuest) setGuest(false); else if (user) setRelogin(true) }
  useEffect(() => { setNav(navigate) }, [navigate])
  const accent = accentValue(S)
  useEffect(() => {
    const de = document.documentElement
    de.dataset.theme = resolveTheme(S.theme)
    applyAccent(de, accent, de.dataset.theme)
  }, [S.theme, accent])
  useEffect(() => { document.documentElement.lang = 'zh' }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])

  const authed = (user || isGuest) && !(relogin && syncStatus === 'auth')
  if (!ready && !authed) return <div id="app"><div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}><Icon name="clipboard" /></div></div>
  return <>
    <div id="app" className="vfade" key={loc.pathname}>
      <ErrorBoundary>
        {!authed ? <Landing relogin={syncStatus === 'auth'} /> : <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/paths" element={<Paths />} />
          <Route path="/paths/:path" element={<Paths />} />
          <Route path="/level/:id" element={<Level />} />
          <Route path="/me" element={<Me />} />
          <Route path="/org" element={<Director />} />
          <Route path="/review" element={<Review />} />
          <Route path="/map" element={<CapabilityMap />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/works" element={<Works />} />
          <Route path="/community" element={<Community />} />
          <Route path="/lectures" element={<Lectures />} />
          <Route path="/forms/:caseId" element={<Forms />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/drills" element={<Drills />} />
          <Route path="/honors" element={<Honors />} />
          <Route path="/contests" element={<Contests />} />
          <Route path="/checkup" element={<Checkup />} />
          <Route path="/district" element={<District />} />
          <Route path="/certs" element={<Certificates />} />
          <Route path="/questions" element={<Questions />} />
          <Route path="/studios" element={<Studios />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/ops" element={<ReviewStats />} />
          <Route path="/portfolio/hours/:id" element={<Portfolio />} />
          <Route path="/certs/:id" element={<Certificates />} />
          <Route path="/library" element={<Library />} />
          <Route path="/selfreview" element={<SelfReview />} />
          <Route path="/camps" element={<Camps />} />
          <Route path="/groups" element={<StudyGroups />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/sharedays" element={<ShareDays />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>}
      </ErrorBoundary>
    </div>
    <SyncBanner signIn={toLogin} />
    {authed && <Tabs />}
    {authed && <TopNav />}
    <Modals />
    <Toast />
  </>
}

export default function AcademyApp() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  return <HashRouter><Shell /></HashRouter>
}
