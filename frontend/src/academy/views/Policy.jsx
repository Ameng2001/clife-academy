// 平台口径（/policy，GET /api/policy，不登录也能看）：十条红线，每条写清是什么、为什么、管哪里。改口径在 api/academy/policy.js，这页只读。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { api } from '../../lib/api.js'

export default function Policy() {
  const nav = useNavigate()
  const [d, setD] = useState(null)
  useEffect(() => { api('/api/policy').then(setD).catch(() => setD(null)) }, [])
  return <div className="narrow wide">
    <div className="hdr"><div><h1>平台口径</h1><div className="sub">十条红线 · 各模块与模型提示都从同一份出{d ? ` · ${d.version}` : ''}</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!d && <div className="card small muted">没取到。</div>}
    <div className="grid2">{d?.rules.map((r, i) => <div key={r.id} className="card" style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 17 }}>{i + 1}. {r.title}</div>
      <div style={{ marginTop: 4, lineHeight: 1.6 }}>{r.text}</div>
      <div className="small muted" style={{ marginTop: 6 }}>为什么：{r.why}</div>
      <div className="chips" style={{ marginTop: 6 }}>{r.where.map(w => <span key={w} className="chip nocap">{w}</span>)}</div>
    </div>)}</div>
    <div className="small muted" style={{ marginTop: 14 }}>这页只读。改口径要改代码里的那一份，改了这里、登录前页、模型提示一起变。</div>
  </div>
}
