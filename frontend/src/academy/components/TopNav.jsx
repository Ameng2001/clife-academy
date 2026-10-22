// 桌面壳的顶部导航（≥ 1000px 才显示，见 academy.css）：手机上是底部四个 tab，桌面上换成这一条。
// 入口按角色给：园长看板 / 区县看板 / 运营后台 只给对应的人。
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../../lib/api.js'
import Icon from '../../components/Icon.jsx'
import { useStore } from '../../store/useStore.js'
import { useBrand } from '../brand.js'

// 左四项是「学」（PGC），最右一项「教研共同体」是「分享」（UGC：专家案例、课程成果、合集、分享日、工作室）。
const ITEMS = [['home', '首页'], ['paths', '学习路径'], ['library', '精品微课'], ['lectures', '名师讲堂'], ['community', '教研共同体']]
const UGC = new Set(['community', 'cases', 'works', 'forms', 'resources', 'collections', 'sharedays', 'studios'])
export default function TopNav() {
  const brand = useBrand()
  const nav = useNavigate(), loc = useLocation()
  const user = useStore(s => s.user)
  const cur = loc.pathname.split('/')[1] || 'home'
  // 积分常驻在导航右侧（参照懂了鸭左栏底部的「鸭蛋」），点了直接进物料商城；换页、换完物料都刷新
  const [pts, setPts] = useState(null)
  useEffect(() => { if (!user) { setPts(null); return } api('/api/me/points').then(r => setPts(r.points)).catch(() => setPts(null)) }, [user?.id, loc.pathname])
  const on = k => cur === k || (k === 'paths' && cur === 'level') || (k === 'community' && UGC.has(cur))
  const role = user?.admin ? ['admin', '运营后台', 'gear'] : user?.academy?.role === 'district' ? ['district', '区县看板', 'gauge'] : user?.academy?.role === 'director' ? ['org', '园长看板', 'gauge'] : null
  return <nav id="topnav" aria-label="主导航">
    <div className="topnav-in">
      <button className="brand" onClick={() => nav('/home')}><Icon name="clipboard" /> {brand.short}</button>
      <div className="links">
        {ITEMS.map(([k, t]) => <button key={k} className={on(k) ? 'on' : ''} onClick={() => nav('/' + k)}>{t}</button>)}
        {role && <button className={on(role[0]) ? 'on' : ''} onClick={() => nav('/' + role[0])}><Icon name={role[2]} /> {role[1]}</button>}
      </div>
      <div className="right">
        {user && pts !== null && <button className={'pts' + (cur === 'mall' ? ' on' : '')} title="积分，点了换教学物料" onClick={() => nav('/mall')}><Icon name="star" /> {pts} 积分 · 换物料</button>}
        <button className={cur === 'me' ? 'on' : ''} onClick={() => nav('/me')}><Icon name="personCircle" /> {user?.name || '我的'}</button>
        <button className="iconbtn" aria-label="设置" onClick={() => nav('/settings')}><Icon name="gear" /></button>
      </div>
    </div>
  </nav>
}
