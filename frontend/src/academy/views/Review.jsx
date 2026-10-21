// 点评队列：本园实践关的待点评提交，按量表打分、写意见、给「通过 / 需修改」。给园长、管理员、academy.reviewer。
// 评作品不评人：页面上只有这一条提交与量表，没有这位老师的测验分与排名（docs/ROADMAP.md 第七、八节）。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import Icon from '../../components/Icon.jsx'
import { Button, TextArea } from '../../components/ui.jsx'
import { fmtDay } from './common.jsx'
import { StatusTag } from './SubmissionBox.jsx'

export const canReview = u => !!u && (u.academy?.role === 'director' || u.academy?.reviewer === true || !!u.admin)

function Card({ s, onReviewed }) {
  const [scores, setScores] = useState(() => s.rubric.map(() => 0)), [comment, setComment] = useState(''), [busy, setBusy] = useState(false), [open, setOpen] = useState(false)
  const send = async verdict => {
    if (verdict === 'revise' && !comment.trim()) return useUI.getState().toast('需修改要写清楚改哪里')
    setBusy(true)
    try { await api('/api/submissions/review', { method: 'POST', body: JSON.stringify({ id: s.id, verdict, scores: scores.map(x => x || null), comment: comment.trim() }) }); useUI.getState().toast(verdict === 'pass' ? '已通过' : '已退回修改'); onReviewed() }
    catch (e) { useUI.getState().toast('没提交成功' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const done = s.status !== 'pending'
  return <div className="card" style={{ marginTop: 10 }}>
    <div className="ac-row"><div><div style={{ fontWeight: 600 }}>{s.title}</div><div className="small muted">{s.name}{s.role ? ' · ' + ({ nurse: '保健医', teacher: '班级教师', care: '保育员', it: '信息接口人', director: '园长' }[s.role] || s.role) : ''} · {fmtDay(s.at)}</div></div><StatusTag status={s.status} /></div>
    {s.text && <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{s.text}</div>}
    {s.files?.length > 0 && <div className="ac-row" style={{ justifyContent: 'flex-start', marginTop: 10, flexWrap: 'wrap' }}>{s.files.map(f => <a key={f.hash} href={`api/submissions/file?id=${s.id}&hash=${f.hash}`} target="_blank" rel="noreferrer"><img alt={f.name} src={`api/submissions/file?id=${s.id}&hash=${f.hash}`} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} /></a>)}</div>}
    {done && s.review && <div className="small" style={{ marginTop: 10, color: 'var(--label-2)' }}>{s.review.byName} · {fmtDay(s.review.at)}{s.review.comment ? ' · ' + s.review.comment : ''}</div>}
    {!done && (open ? <div style={{ marginTop: 12, paddingTop: 12, borderTop: 'var(--hair) solid var(--sep)' }}>
      {s.rubric.map((r, i) => <div key={i} className="ac-row" style={{ marginTop: 6 }}>
        <span style={{ fontSize: 14, flex: 1 }}>{r}</span>
        <span className="row" style={{ gap: 4 }}>{[1, 2, 3, 4, 5].map(n => <button key={n} className={'chip' + (scores[i] === n ? ' on' : '')} style={{ minWidth: 30, padding: '4px 0', textAlign: 'center' }} onClick={() => setScores(sc => sc.map((x, k) => k === i ? n : x))}>{n}</button>)}</span>
      </div>)}
      <TextArea rows={3} style={{ marginTop: 10 }} placeholder="一两句具体意见。需修改时必填：改哪里、怎么改。" value={comment} onChange={e => setComment(e.target.value)} />
      <div className="ac-row" style={{ marginTop: 10 }}>
        <Button size="sm" onClick={() => setOpen(false)}>收起</Button>
        <div className="row" style={{ gap: 8 }}><Button variant="tinted" disabled={busy} onClick={() => send('revise')}>需修改</Button><Button variant="primary" icon="checkCircle" disabled={busy} onClick={() => send('pass')}>通过</Button></div>
      </div>
    </div> : <div style={{ marginTop: 10 }}><Button size="sm" variant="tinted" onClick={() => setOpen(true)}>点评</Button></div>)}
  </div>
}

export default function Review() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [data, setData] = useState(null), [err, setErr] = useState(null)
  const load = async () => { try { setData(await api('/api/review/queue')); setErr(null) } catch (e) { setErr(e) } }
  useEffect(() => { if (user) load() }, [user?.id])
  const head = <div className="hdr"><div><h1>点评</h1><div className="sub">本园实践关的提交 · 评作品不评人</div></div><div className="hdr-actions"><button className="iconbtn" onClick={load}><Icon name="repeat" /></button><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
  if (!user) return <div className="narrow">{head}<div className="card small muted">登录后可用。</div></div>
  if (err) return <div className="narrow">{head}<div className="card small">{err.status === 403 ? '这页给园长与被指定的点评人。' : '没取到数据' + (err.message ? '：' + err.message : '')}</div></div>
  if (!data) return <div className="narrow">{head}<div className="card small muted">正在取数…</div></div>
  return <div className="narrow">
    {head}
    <div className="sect"><div className="sect-t">待点评 · {data.pending.length}</div>
      {!data.pending.length && <div className="card small muted">现在没有待点评的提交。</div>}
      {data.pending.map(s => <Card key={s.id} s={s} onReviewed={load} />)}
    </div>
    {data.done.length > 0 && <div className="sect"><div className="sect-t">最近点评过</div>{data.done.map(s => <Card key={s.id} s={s} onReviewed={load} />)}</div>}
  </div>
}
