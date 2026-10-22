// 园内教研组（/api/studytasks）：教研主任发课例研讨任务（可挂一条入库案例），组员交反思；先交再看别人的。记进「反思与发展」领域证据。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const toLocal = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

function Task({ t, min, onChange }) {
  const toast = useUI.getState().toast
  const nav = useNavigate()
  const [text, setText] = useState(t.mine?.text || ''), [editing, setEditing] = useState(!t.mine), [busy, setBusy] = useState(false)
  const reply = async () => {
    if (text.trim().length < min) return toast(`至少 ${min} 字`)
    setBusy(true)
    try { await api('/api/studytasks/reply', { method: 'POST', body: JSON.stringify({ id: t.id, text }) }); toast(t.mine ? '已改' : '已交'); setEditing(false); onChange() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  const close = async () => { if (!confirm('收任务？之后不能再交。')) return; try { await api('/api/studytasks/close', { method: 'POST', body: JSON.stringify({ id: t.id }) }); onChange() } catch (e) { toast('没成') } }
  return <div className="card" style={{ marginTop: 12 }}>
    <div className="small muted">{t.byName} 发 · {fmtDay(t.at)} · {t.open ? `${fmtDay(t.dueAt)} 前交` : '已收'} · {t.replies} 人交了</div>
    <div style={{ fontWeight: 700, fontSize: 18, margin: '4px 0' }}>{t.title}</div>
    <div style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.prompt}</div>
    {t.case && <div className="small tap" style={{ marginTop: 6, color: 'var(--acc)' }} onClick={() => nav('/cases?q=' + encodeURIComponent(t.case.title))}>看这条案例：{t.case.title} · {t.case.byName} ›</div>}
    {t.open && editing && <div style={{ marginTop: 10 }}>
      <TextArea rows={5} placeholder={`写你的反思（≥ ${min} 字）：看到了什么、换你会怎么做、下周试哪一处。不写幼儿姓名。`} value={text} onChange={e => setText(e.target.value)} />
      <div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>{t.mine && <Button size="sm" onClick={() => setEditing(false)}>取消</Button>}<Button size="sm" variant="primary" disabled={busy} onClick={reply}>交</Button></div>
    </div>}
    {t.mine && !editing && <div className="card" style={{ marginTop: 10, padding: 12 }}><div className="ac-row"><span className="small muted">我的反思 · {fmtDay(t.mine.at)}</span>{t.open && <Button size="sm" onClick={() => setEditing(true)}>改</Button>}</div><div style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5 }}>{t.mine.text}</div></div>}
    {t.list && t.list.filter(r => !r.mine).length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">组里其他人的</div>{t.list.filter(r => !r.mine).map((r, i) => <div key={i} className="small" style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'var(--surface-3)', whiteSpace: 'pre-wrap' }}><span className="muted">{r.name} · {fmtDay(r.at)}</span><br />{r.text}</div>)}</div>}
    {!t.mine && !t.canHost && t.replies > 0 && <div className="small muted" style={{ marginTop: 8 }}>交了自己的才能看别人的。</div>}
    {t.canHost && <div className="small muted" style={{ marginTop: 8 }}>{t.missing?.length ? `还没交：${t.missing.join('、')}（只有你看得到，不推送催交）` : '都交了。'}{t.open && <span className="tap" style={{ color: 'var(--acc)', marginInlineStart: 8 }} onClick={close}>收任务</span>}</div>}
  </div>
}

export default function StudyGroups() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI.getState().toast
  const [data, setData] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false), [cases, setCases] = useState([])
  const load = () => { if (user) api('/api/studytasks').then(setData).catch(() => setData(null)) }
  useEffect(load, [user?.id])
  useEffect(() => { if (form && !cases.length) api('/api/cases').then(r => setCases(r.cases.slice(0, 40))).catch(() => {}) }, [form])
  const save = async () => {
    if (form.title.trim().length < 4 || form.prompt.trim().length < 10) return toast('标题与题都要写')
    setBusy(true)
    try { await api('/api/studytasks', { method: 'POST', body: JSON.stringify({ title: form.title, prompt: form.prompt, caseId: form.caseId || undefined, dueAt: new Date(form.due + 'T23:59').getTime() }) }); toast('已发'); setForm(null); load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  return <div className="narrow wide">
    <div className="hdr"><div><h1>园内教研组</h1><div className="sub">课例研讨任务 · 先交再看 · 记进「反思与发展」</div></div><div className="hdr-actions">{data?.canHost && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ title: '', prompt: '', caseId: '', due: toLocal(Date.now() + 7 * 86400000) })}>发任务</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后在这里看。</div>}
    {form && <div className="card">
      <TextField placeholder="任务，如「看这节中班科学课，写三点你会改的」" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <TextArea rows={3} style={{ marginTop: 8 }} placeholder="题：看什么、写什么、几点" value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="ac-sel" value={form.caseId} onChange={e => setForm({ ...form, caseId: e.target.value })} style={{ flex: 1, minWidth: 160 }}><option value="">不挂案例</option>{cases.map(c => <option key={c.id} value={c.id}>{c.title} · {c.byName}</option>)}</select>
        <span className="small muted">交到</span><input className="ac-sel" type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
      </div>
      <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>发</Button></div></div>
    </div>}
    {data && !data.tasks.length && <div className="card small muted">还没有任务。{data.canHost ? '点右上角「发任务」。' : '教研主任发了会在这里出现。'}</div>}
    <div className="grid2">{data?.tasks.map(t => <Task key={t.id} t={t} min={data.minReply} onChange={load} />)}</div>
  </div>
}
