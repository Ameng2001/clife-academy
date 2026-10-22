// 点评时效看板（GET /api/review/stats）。园长看本园，管理员看全平台与各园一行。看队列与时效，不列点评人各自点了多少，不排名。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { useStore } from '../../store/useStore.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const ago = (at, now) => { const h = Math.round((now - at) / 3600000); return h < 24 ? `${h} 小时前` : `${Math.round(h / 24)} 天前` }
function Tiles({ d }) {
  return <div className="tiles">
    <div className="tile"><div className="l">待点评</div><div className="v">{d.pending}</div><div className="small muted">{d.oldestAt ? '最久 ' + ago(d.oldestAt, d.at) : '队列空'}</div></div>
    <div className="tile" style={d.overdue ? { borderInlineStart: '3px solid var(--orange)' } : {}}><div className="l">超两个工作日</div><div className="v">{d.overdue}</div><div className="small muted">交了两个工作日还没人点评</div></div>
    <div className="tile"><div className="l">近 30 天点评</div><div className="v">{d.done30}</div><div className="small muted">{d.medianHours != null ? `中位 ${d.medianHours} 小时 · ${d.within2d}% 在两个工作日内` : '还没有'}</div></div>
    <div className="tile"><div className="l">点评队伍</div><div className="v">{d.reviewers}</div><div className="small muted">近 30 天动过手 {d.active30} 人 · 在学 {d.members} 人</div></div>
  </div>
}

export default function ReviewStats() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [d, setD] = useState(null), [err, setErr] = useState(null), [w, setW] = useState(null)
  useEffect(() => { if (!user) return; api('/api/review/stats').then(setD).catch(e => setErr(e.code === 'director' ? '园长与管理员看。' : '没取到。')); api('/api/ops/weekly').then(setW).catch(() => setW(null)) }, [user?.id])
  return <div className="narrow wide">
    <div className="hdr"><div><h1>点评时效</h1><div className="sub">{d?.scope === 'all' ? '全平台' : d?.orgName || '本园'} · 每周看一次 · 队列与时效，不排名</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {err && <div className="card small muted">{err}</div>}
    {d && <>
      <Tiles d={d} />
      <div className="sect"><div className="sect-t">答疑队列</div><div className="sect-b">
        <div className="lrow tap" onClick={() => nav('/questions?tab=queue')}><div style={{ flex: 1 }}><div className="lrow-t">开放中 {d.questions.open} 条{d.questions.escalated ? ` · 已转讲师 ${d.questions.escalated}` : ''}</div><div className="small muted">近 30 天答了 {d.questions.answered30} 条{d.questions.medianHours != null ? ` · 首答中位 ${d.questions.medianHours} 小时` : ''} · 每周清零</div></div><Icon name="chevronRight" /></div>
      </div></div>
      {d.scope === 'org' && d.queue.length > 0 && <div className="sect"><div className="sect-t">待点评 <span className="small muted">最久的在前</span></div><div className="sect-b">
        {d.queue.map(q => <div key={q.id} className="lrow tap" onClick={() => nav('/review')}><div style={{ flex: 1 }}><div className="lrow-t">{q.levelTitle}{q.overdue ? <span className="tag" style={{ marginInlineStart: 6, color: 'var(--orange)' }}>超期</span> : null}</div><div className="small muted">交于 {fmtDay(q.at)} · {ago(q.at, d.at)}</div></div><Icon name="chevronRight" /></div>)}
      </div></div>}
      {d.scope === 'all' && <div className="sect"><div className="sect-t">各园 <span className="small muted">超期多的在前，是工作队列不是名次</span></div><div className="sect-b">
        {!d.orgs.length && <div className="lrow small muted">还没有园所。</div>}
        {d.orgs.map(o => <div key={o.key} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{o.name}{o.overdue ? <span className="tag" style={{ marginInlineStart: 6, color: 'var(--orange)' }}>超期 {o.overdue}</span> : null}</div><div className="small muted">待点评 {o.pending} · 近 30 天 {o.done30} 次{o.medianHours != null ? ` · 中位 ${o.medianHours} 小时` : ''} · 点评队伍 {o.reviewers}/{o.members} · 答疑开放 {o.questions.open}{o.questions.escalated ? `（转讲师 ${o.questions.escalated}）` : ''}</div></div></div>)}
      </div></div>}
      {w && <div className="sect"><div className="sect-t">运营周报 · {w.week.label} <span className="small muted">周一 09:00 后推一次</span></div><div className="sect-b">
        <div className="lrow"><div style={{ flex: 1, fontSize: 15, lineHeight: 1.55 }}>{w.text}</div></div>
        {w.scope === 'all' && w.orgs.map(o => <div key={o.key} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{o.name}{o.overdue ? <span className="tag" style={{ marginInlineStart: 6, color: 'var(--orange)' }}>超期 {o.overdue}</span> : null}</div><div className="small muted">{o.text}</div></div></div>)}
      </div></div>}
      <div className="small muted" style={{ marginTop: 10 }}>超期口径同答疑：两个工作日，跳过周末。点评人各自点了多少只有本人在荣誉页看，这里不列。</div>
    </>}
  </div>
}
