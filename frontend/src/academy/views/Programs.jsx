// 研修项目期次（/api/programs）：运营方建期次（时间、地点、名额、学时），教师报名，运营方定名单、记完成；完成的学时进发展档案与学时证明。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const PHASE = { upcoming: '报名中', running: '进行中', ended: '已结束', done: '已收' }
const STATUS = { applied: '已报名', accepted: '已录取', declined: '未录取', completed: '已完成' }
const toLocal = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

function Program({ p, onChange }) {
  const toast = useUI.getState().toast
  const [busy, setBusy] = useState(false)
  const post = async (path, body, ok) => { setBusy(true); try { await api(path, { method: 'POST', body: JSON.stringify({ id: p.id, ...body }) }); if (ok) toast(ok); onChange() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  return <div className="card" style={{ marginTop: 12 }}>
    <div className="small muted">{p.kind}{p.term ? ' · ' + p.term : ''} · {PHASE[p.phase]} · {fmtDay(p.from)}{p.to !== p.from ? ' 至 ' + fmtDay(p.to) : ''}{p.place ? ' · ' + p.place : ''} · {p.hours} 学时{p.capacity ? ` · 名额 ${p.capacity}` : ''}</div>
    <div style={{ fontWeight: 700, fontSize: 18, margin: '4px 0' }}>{p.title}</div>
    {p.note && <div className="small" style={{ color: 'var(--label-2)', whiteSpace: 'pre-wrap' }}>{p.note}</div>}
    <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      {p.mine ? <span className="tag">{STATUS[p.mine.status]}</span> : null}
      {p.canApply && <Button size="sm" variant="primary" disabled={busy} onClick={() => post('/api/programs/apply', {}, '已报名，名单定了会在这里显示')}>报名</Button>}
      {p.mine && p.mine.status !== 'completed' && p.phase === 'upcoming' && <Button size="sm" disabled={busy} onClick={() => post('/api/programs/apply', { withdraw: true }, '已撤回')}>撤回</Button>}
      <span className="small muted">报名 {p.applied} · 录取 {p.accepted}</span>
    </div>
    {p.roster && <div style={{ marginTop: 10 }}><div className="small muted">名单（只有运营方与本人看得到）</div>
      {p.roster.map(a => <div key={a.uid} className="ac-row small" style={{ marginTop: 4 }}><span>{a.name}{a.orgName ? ' · ' + a.orgName : ''} · {STATUS[a.status]}</span><span className="row" style={{ gap: 4 }}>
        {a.status === 'applied' && <><button className="chip" disabled={busy} onClick={() => post('/api/programs/roster', { uid: a.uid, status: 'accepted' })}>录取</button><button className="chip" disabled={busy} onClick={() => post('/api/programs/roster', { uid: a.uid, status: 'declined' })}>不录</button></>}
        {a.status === 'accepted' && <button className="chip" disabled={busy} onClick={() => post('/api/programs/roster', { uid: a.uid, status: 'completed' })}>记完成</button>}
      </span></div>)}
      {!p.closedAt && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}><Button size="sm" disabled={busy} onClick={() => confirm('收期次？') && post('/api/programs/close', {}, '已收')}>收期次</Button></div>}
    </div>}
  </div>
}

export default function Programs() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI.getState().toast
  const [data, setData] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false)
  const load = () => { if (user) api('/api/programs').then(setData).catch(() => setData(null)) }
  useEffect(load, [user?.id])
  const save = async () => {
    if (form.title.trim().length < 4) return toast('标题至少 4 个字')
    setBusy(true)
    try { await api('/api/programs', { method: 'POST', body: JSON.stringify({ title: form.title, kind: form.kind, term: form.term, from: new Date(form.from + 'T09:00').getTime(), to: new Date(form.to + 'T17:00').getTime(), place: form.place, hours: Number(form.hours) || 0, capacity: Number(form.capacity) || 0, note: form.note }) }); toast('已建'); setForm(null); load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  return <div className="narrow">
    <div className="hdr"><div><h1>研修项目</h1><div className="sub">寒暑假研修、园长研修、专题培训 · 报名、名单、学时</div></div><div className="hdr-actions">{data?.canHost && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ title: '', kind: data.kinds[0], term: '', from: toLocal(Date.now() + 14 * 86400000), to: toLocal(Date.now() + 16 * 86400000), place: '', hours: 8, capacity: 0, note: '' })}>建期次</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后在这里看。</div>}
    {form && <div className="card">
      <TextField placeholder="项目名，如「2027 寒假观察记录研修」" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <select className="ac-sel" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{data.kinds.map(k => <option key={k}>{k}</option>)}</select>
        <TextField placeholder="学期，如 2026 秋" value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} style={{ width: 120 }} />
        <TextField placeholder="地点" value={form.place} onChange={e => setForm({ ...form, place: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="small muted">从</span><input className="ac-sel" type="date" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} /><span className="small muted">到</span><input className="ac-sel" type="date" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} />
        <span className="small muted">学时</span><input className="ac-sel" type="number" step="0.5" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} style={{ width: 70 }} />
        <span className="small muted">名额</span><input className="ac-sel" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} style={{ width: 70 }} />
      </div>
      <TextArea rows={2} style={{ marginTop: 8 }} placeholder="说明：对象、内容、带什么" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
      <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>建</Button></div></div>
    </div>}
    {data && !data.programs.length && <div className="card small muted">还没有期次。{data.canHost ? '点右上角「建期次」。' : ''}</div>}
    {data?.programs.map(p => <Program key={p.id} p={p} onChange={load} />)}
    <div className="small muted" style={{ marginTop: 10 }}>完成的期次按学时记进发展档案与学时证明。名单只给运营方与本人看，不公布谁没录取。</div>
  </div>
}
