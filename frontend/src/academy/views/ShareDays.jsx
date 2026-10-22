// 园所分享日（/api/sharedays）：区县管理员为一个共同体办一场；各园园长交一页（≤ 8 条本园入库案例＋一段话）；共同体内交流。是展示，不是评比。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const toLocal = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

function Day({ s, max, onChange }) {
  const toast = useUI.getState().toast
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [editing, setEditing] = useState(false), [ids, setIds] = useState(s.mine?.caseIds || []), [note, setNote] = useState(s.mine?.note || ''), [mine, setMine] = useState([]), [busy, setBusy] = useState(false)
  useEffect(() => { if (editing && !mine.length) api('/api/cases').then(r => setMine(r.cases.filter(c => c.orgName && c.orgName === user?.academy?.org?.name))).catch(() => {}) }, [editing])
  const save = async () => { setBusy(true); try { await api('/api/sharedays/page', { method: 'POST', body: JSON.stringify({ id: s.id, caseIds: ids, note }) }); toast('已交'); setEditing(false); onChange() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  const close = async () => { if (!confirm('收官？之后各园不能再改。')) return; try { await api('/api/sharedays/close', { method: 'POST', body: JSON.stringify({ id: s.id }) }); onChange() } catch (e) { toast('没成') } }
  return <div className="card" style={{ marginTop: 12 }}>
    <div className="small muted">{s.communityName} · {fmtDay(s.at)}{s.place ? ' · ' + s.place : ''} · {s.orgs} 园 · 交了 {s.pages.length} 页{s.closedAt ? ' · 已收官' : ''}</div>
    <div style={{ fontWeight: 700, fontSize: 18, margin: '4px 0' }}>{s.theme || '园所分享日'}</div>
    <div className="small muted">{s.byName} 办 · 各园一页 · 是展示，不是评比</div>
    {s.canPage && !editing && <div style={{ marginTop: 10 }}><Button size="sm" variant={s.mine ? undefined : 'primary'} onClick={() => setEditing(true)}>{s.mine ? '改本园的一页' : '交本园的一页'}</Button></div>}
    {editing && <div style={{ marginTop: 10 }}>
      <div className="small muted">挑本园入库案例（最多 {max} 条）</div>
      <div className="chips" style={{ marginTop: 4 }}>{mine.map(c => <button key={c.id} className={'chip' + (ids.includes(c.id) ? ' on' : '')} onClick={() => setIds(ids.includes(c.id) ? ids.filter(x => x !== c.id) : ids.length < max ? [...ids, c.id] : ids)}>{c.title.slice(0, 16)} · {c.byName}</button>)}{!mine.length && <span className="small muted">本园还没有入库案例</span>}</div>
      <TextArea rows={3} style={{ marginTop: 8 }} placeholder="园长的一段话：这学期我们在做什么、想借什么" value={note} onChange={e => setNote(e.target.value)} />
      <div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setEditing(false)}>取消</Button><Button size="sm" variant="primary" disabled={busy} onClick={save}>交</Button></div>
    </div>}
    {s.pages.map((p, i) => <div key={i} className="card" style={{ marginTop: 10, padding: 12 }}>
      <div style={{ fontWeight: 600 }}>{p.orgName}<span className="small muted" style={{ marginInlineStart: 8 }}>{p.byName} · {fmtDay(p.at)}</span></div>
      {p.note && <div className="small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{p.note}</div>}
      {p.cases.length > 0 && <div className="chips" style={{ marginTop: 6 }}>{p.cases.map(c => <button key={c.id} className="chip" onClick={() => nav('/cases?q=' + encodeURIComponent(c.title))}>{c.title} · {c.byName}</button>)}</div>}
    </div>)}
    {s.canHost && !s.closedAt && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><Button size="sm" onClick={close}>收官</Button></div>}
  </div>
}

export default function ShareDays() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI.getState().toast
  const [data, setData] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false)
  const load = () => { if (user) api('/api/sharedays').then(setData).catch(() => setData(null)) }
  useEffect(load, [user?.id])
  const save = async () => {
    if (!form.communityId) return toast('选一个共同体')
    setBusy(true)
    try { await api('/api/sharedays', { method: 'POST', body: JSON.stringify({ communityId: form.communityId, at: new Date(form.at + 'T14:00').getTime(), place: form.place, theme: form.theme }) }); toast('已办'); setForm(null); load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  return <div className="narrow wide">
    <div className="hdr"><div><h1>园所分享日</h1><div className="sub">每学期一次 · 各园一页 · 共同体内交流 · 不评比</div></div><div className="hdr-actions"><button className="chip" onClick={() => nav('/community')}><Icon name="share" /> 教研共同体</button>{data?.communities.length > 0 && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ communityId: data.communities[0].id, at: toLocal(Date.now() + 14 * 86400000), place: '', theme: '' })}>办一场</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后在这里看。</div>}
    {form && <div className="card">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="ac-sel" value={form.communityId} onChange={e => setForm({ ...form, communityId: e.target.value })}>{data.communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input className="ac-sel" type="date" value={form.at} onChange={e => setForm({ ...form, at: e.target.value })} />
        <TextField placeholder="地点" value={form.place} onChange={e => setForm({ ...form, place: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
      </div>
      <TextField style={{ marginTop: 8 }} placeholder="主题（可不填）" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} />
      <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>办</Button></div></div>
    </div>}
    {data && !data.sharedays.length && <div className="card small muted">还没有分享日。{data.communities.length ? '点右上角「办一场」。' : '区县管理员为共同体办了会在这里出现。'}</div>}
    <div className="grid2">{data?.sharedays.map(s => <Day key={s.id} s={s} max={data.maxCases} onChange={load} />)}</div>
  </div>
}
