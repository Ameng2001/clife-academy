// 自愿练习营（/api/camps）：报名、每天一个小任务、营内互看、营末讲师总评；中途退出无任何记录；结营发成长勋章。不做打卡。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const PHASE = { upcoming: '报名中', running: '进行中', ended: '已结束，等总评', done: '已结营' }
const toLocal = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

function Camp({ c, user, onChange }) {
  const toast = useUI.getState().toast
  const [day, setDay] = useState(c.today), [text, setText] = useState(''), [summary, setSummary] = useState(''), [busy, setBusy] = useState(false)
  const post = async (p, body, ok) => { setBusy(true); try { await api(p, { method: 'POST', body: JSON.stringify({ id: c.id, ...body }) }); toast(ok); onChange() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  const mineToday = (c.posts || []).find(p => p.mine && p.day === day)
  return <div className="card" style={{ marginTop: 12 }}>
    <div className="small muted">{c.scope === 'all' ? '全平台' : c.orgName || '本园'} · {PHASE[c.phase]} · {fmtDay(c.startAt)} 开营 · {c.days.length} 天 · {c.members} 人{c.graduated ? ' · 我已结营' : ''}</div>
    <div style={{ fontWeight: 700, fontSize: 18, margin: '4px 0' }}>{c.title}</div>
    {c.intro && <div className="small" style={{ color: 'var(--label-2)', whiteSpace: 'pre-wrap' }}>{c.intro}</div>}
    <div className="small muted" style={{ marginTop: 6 }}>{c.byName} 办 · 自愿参加 · 没发的那天不记、不提醒 · 中途退出不留任何记录</div>
    {!c.mine && c.phase !== 'done' && c.phase !== 'ended' && <div style={{ marginTop: 10 }}><Button size="sm" variant="primary" disabled={busy} onClick={() => post('/api/camps/join', {}, '已报名')}>报名</Button></div>}
    {c.mine && c.phase !== 'done' && <div style={{ marginTop: 10 }}>
      <div className="chips">{c.days.map((t, i) => <button key={i} className={'chip' + (i === day ? ' on' : '')} disabled={i > c.today && c.phase === 'running'} onClick={() => setDay(i)}>第 {i + 1} 天{(c.posts || []).some(p => p.mine && p.day === i) ? ' ✓' : ''}</button>)}</div>
      <div style={{ marginTop: 8, fontSize: 15 }}>今天的小任务：{c.days[day]}</div>
      {c.phase !== 'upcoming' && day <= c.today && <>
        <TextArea rows={3} style={{ marginTop: 6 }} placeholder={mineToday ? '改一改' : '写下你今天做的（不写幼儿姓名，用 A、B 代替）'} value={text || mineToday?.text || ''} onChange={e => setText(e.target.value)} />
        <div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}><Button size="sm" onClick={() => confirm('退营后你的帖子一起删，不留记录。确定？') && post('/api/camps/leave', {}, '已退营')}>退营</Button><Button size="sm" variant="primary" disabled={busy} onClick={() => post('/api/camps/post', { day, text: text || mineToday?.text || '' }, mineToday ? '已改' : '已发')}>发</Button></div>
      </>}
    </div>}
    {(c.posts || []).filter(p => p.day === day).length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">第 {day + 1} 天 · 营内互看</div>{c.posts.filter(p => p.day === day).map(p => <div key={p.id} className="small" style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'var(--surface-3)', whiteSpace: 'pre-wrap' }}><span className="muted">{p.name}{p.mine ? '（我）' : ''} · {fmtDay(p.at)}</span><br />{p.text}</div>)}</div>}
    {c.phase === 'done' && c.summary && <div className="card" style={{ marginTop: 10, padding: 12, background: 'color-mix(in srgb,var(--acc) 8%,transparent)' }}><div className="small muted">讲师总评 · {fmtDay(c.closedAt)}</div><div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.summary}</div></div>}
    {c.canHost && c.phase !== 'done' && <div style={{ marginTop: 10 }}>
      <TextArea rows={2} placeholder="结营总评（发过帖的营员记为结营，得成长勋章）" value={summary} onChange={e => setSummary(e.target.value)} />
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}><Button size="sm" disabled={busy || summary.trim().length < 20} onClick={() => confirm('结营？之后不能再发帖。') && post('/api/camps/close', { summary }, '已结营')}>结营</Button></div>
    </div>}
  </div>
}

export default function Camps() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI.getState().toast
  const [data, setData] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false)
  const load = () => { if (user) api('/api/camps').then(setData).catch(() => setData(null)) }
  useEffect(load, [user?.id])
  const save = async () => {
    const days = form.days.split('\n').map(s => s.trim()).filter(Boolean)
    if (form.title.trim().length < 4) return toast('标题至少 4 个字'); if (days.length < 3) return toast('至少 3 天，每行一个小任务')
    setBusy(true)
    try { await api('/api/camps', { method: 'POST', body: JSON.stringify({ title: form.title, intro: form.intro, days, startAt: new Date(form.start + 'T06:00').getTime(), scope: form.scope }) }); toast('已办'); setForm(null); load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  return <div className="narrow wide">
    <div className="hdr"><div><h1>练习营</h1><div className="sub">自愿、短期、营内互看 · 不打卡、不排名</div></div><div className="hdr-actions">{data?.canHost && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ title: '', intro: '', days: '', start: toLocal(Date.now() + 86400000), scope: 'org' })}>办一个</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后在这里看。</div>}
    {form && <div className="card">
      <TextField placeholder="营名，如「21 天观察记录练习营」" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <TextArea rows={2} style={{ marginTop: 8 }} placeholder="一句话说清练什么" value={form.intro} onChange={e => setForm({ ...form, intro: e.target.value })} />
      <TextArea rows={6} style={{ marginTop: 8 }} placeholder={'每行一天的小任务（3–30 行），如：\n挑一个幼儿看五分钟，只写事实\n把昨天那段的推断另起一段\n…'} value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}><span className="small muted">开营</span><input className="ac-sel" type="date" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />{user?.admin && <select className="ac-sel" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}><option value="org">本园</option><option value="all">全平台</option></select>}</div>
      <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>办</Button></div></div>
    </div>}
    {data && !data.camps.length && <div className="card small muted">还没有练习营。{data.canHost ? '点右上角「办一个」。' : ''}</div>}
    <div className="grid2">{data?.camps.map(c => <Camp key={c.id} c={c} user={user} onChange={load} />)}</div>
  </div>
}
