// 桌面壳的顶部导航（≥ 1000px 才显示，见 academy.css）：手机上是底部四个 tab，桌面上换成这一条。
// 入口按角色给：园长看板 / 区县看板 / 运营后台 只给对应的人。
import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { useStore } from '../../store/useStore.js'

const ITEMS = [['home', '首页'], ['paths', '学习路径'], ['library', '微课库'], ['cases', '案例库'], ['lectures', '大讲堂'], ['resources', '资源库']]
export default function TopNav() {
  const nav = useNavigate(), loc = useLocation()
  const user = useStore(s => s.user)
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (k === 'paths' && cur === 'level') || (k === 'cases' && cur === 'forms') || (k === 'library' && cur === 'collections')
  const role = user?.admin ? ['admin', '运营后台', 'gear'] : user?.academy?.role === 'district' ? ['district', '区县看板', 'gauge'] : user?.academy?.role === 'director' ? ['org', '园长看板', 'gauge'] : null
  return <nav id="topnav" aria-label="主导航">
    <div className="topnav-in">
      <button className="brand" onClick={() => nav('/home')}><Icon name="clipboard" /> 学前大课堂</button>
      <div className="links">
        {ITEMS.map(([k, t]) => <button key={k} className={on(k) ? 'on' : ''} onClick={() => nav('/' + k)}>{t}</button>)}
        {role && <button className={on(role[0]) ? 'on' : ''} onClick={() => nav('/' + role[0])}><Icon name={role[2]} /> {role[1]}</button>}
      </div>
      <div className="right">
        <button className={cur === 'me' ? 'on' : ''} onClick={() => nav('/me')}><Icon name="personCircle" /> {user?.name || '我的'}</button>
        <button className="iconbtn" aria-label="设置" onClick={() => nav('/settings')}><Icon name="gear" /></button>
      </div>
    </div>
  </nav>
}
