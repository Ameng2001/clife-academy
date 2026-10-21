// 自评问卷与三方评（GET/POST /api/me/selfreview，GET /api/selfreview/others，POST /api/selfreview/comment）。
// 每学期一次：七领域各选一档、一件想练的事、一段反思；带教教师看作品写一段，园长看参与与反思写一段。平台只并置，不合成总分。
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const ROLE = { mentor: '带教教师', director: '园长' }

function Form({ d, onSaved }) {
  const toast = useUI.getState().toast
  const [levels, setLevels] = useState(d.mine?.levels || {}), [focus, setFocus] = useState(d.mine?.focus || ''), [reflection, setReflection] = useState(d.mine?.reflection || ''), [busy, setBusy] = useState(false)
  const save = async () => {
    if (d.items.some(i => levels[i.key] == null)) return toast('七个领域每个选一档')
    if (focus.trim().length < 2) return toast('写一件下学期想练的事')
    setBusy(true)
    try { await api('/api/me/selfreview', { method: 'POST', body: JSON.stringify({ levels, focus, reflection }) }); toast(d.mine ? '已改' : '已交'); onSaved() }
    catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  return <div className="card">
    <div className="small muted">每个领域选一档。这是你对自己的判断，别人看得到但改不了；不算分，不排名。</div>
    {d.items.map(it => <div key={it.key} style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600 }}>{it.name}</div><div className="small muted">{it.text}</div>
      <div className="chips" style={{ marginTop: 6 }}>{d.scale.map((s, n) => <button key={n} className={'chip' + (levels[it.key] === n ? ' on' : '')} onClick={() => setLevels({ ...levels, [it.key]: n })}>{s}</button>)}</div>
    </div>)}
    <TextField style={{ marginTop: 12 }} placeholder="下学期想练的一件事（只写一件）" value={focus} onChange={e => setFocus(e.target.value)} />
    <TextArea rows={4} style={{ marginTop: 8 }} placeholder="这学期的反思：做到了什么、卡在哪（不写幼儿姓名）" value={reflection} onChange={e => setReflection(e.target.value)} />
    <div className="ac-row" style={{ marginTop: 10 }}><span className="small muted">{d.mine ? `上次 ${fmtDay(d.mine.updatedAt)}` : ''}</span><Button variant="primary" disabled={busy} onClick={save}>{d.mine ? '改' : '交'}</Button></div>
  </div>
}

function Person({ p, d, onChange }) {
  const toast = useUI.getState().toast
  const [text, setText] = useState(p.myComment || ''), [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const write = async () => {
    if (text.trim().length < 20) return toast('至少 20 字')
    setBusy(true)
    try { await api('/api/selfreview/comment', { method: 'POST', body: JSON.stringify({ uid: p.uid, text }) }); toast('已写'); setOpen(false); onChange() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  return <div className="card" style={{ marginTop: 10 }}>
    <div className="ac-row"><div style={{ fontWeight: 700 }}>{p.name}<span className="small muted" style={{ marginInlineStart: 8 }}>{p.done ? '已自评' : '还没自评'}</span></div>{!open && <Button size="sm" onClick={() => setOpen(true)}>{p.myComment ? '改我写的' : '写一段'}</Button>}</div>
    {p.self && <div style={{ marginTop: 8 }}>
      <div className="chips">{d.items.map(it => <span key={it.key} className="chip" style={{ cursor: 'default' }}>{it.name.replace(/、/g, '').slice(0, 4)} · {d.scale[p.self.levels[it.key]]}</span>)}</div>
      <div className="small" style={{ marginTop: 6 }}>想练：{p.self.focus}</div>
      {p.self.reflection && <div className="small" style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: 'var(--label-2)' }}>{p.self.reflection}</div>}
    </div>}
    {p.comments.map((c, i) => <div key={i} className="small" style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'var(--surface-3)' }}><span className="muted">{ROLE[c.role]} {c.byName} · {fmtDay(c.at)}</span><br />{c.text}</div>)}
    {open && <div style={{ marginTop: 8 }}>
      <TextArea rows={3} placeholder={d.as === 'mentor' ? '看她的实践关作品写：哪一份做到了什么、下一步练什么' : '看参与与反思写：教研、每周一题、作品，不写分数'} value={text} onChange={e => setText(e.target.value)} />
      <div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setOpen(false)}>取消</Button><Button size="sm" variant="primary" disabled={busy} onClick={write}>存</Button></div>
    </div>}
  </div>
}

export default function SelfReview() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const user = useStore(s => s.user)
  const [d, setD] = useState(null), [others, setOthers] = useState(null), [tab, setTab] = useState(sp.get('tab') === 'others' ? 'others' : 'mine')
  const load = () => { if (!user) return; api('/api/me/selfreview').then(setD).catch(() => setD(null)); api('/api/selfreview/others').then(setOthers).catch(() => setOthers(null)) }
  useEffect(load, [user?.id])
  return <div className="narrow">
    <div className="hdr"><div><h1>自评与三方评</h1><div className="sub">{d?.term.label || '本学期'} · 本人、带教教师、园长各一段 · 不合成总分</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!user && <div className="card small muted">登录后在这里填。</div>}
    {others && <div className="chips" style={{ marginBottom: 10 }}><button className={'chip' + (tab === 'mine' ? ' on' : '')} onClick={() => setTab('mine')}>我的自评</button><button className={'chip' + (tab === 'others' ? ' on' : '')} onClick={() => setTab('others')}>{others.as === 'director' ? '本园' : '我带的'} · 已自评 {others.done}/{others.people.length}</button></div>}
    {d && tab === 'mine' && <>
      <Form d={d} onSaved={load} />
      {d.comments.length > 0 && <div className="sect"><div className="sect-t">别人给我的</div><div className="sect-b">{d.comments.map((c, i) => <div key={i} className="lrow"><div style={{ flex: 1 }}><div className="small muted">{ROLE[c.role]} {c.byName} · {fmtDay(c.at)}</div><div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.text}</div></div></div>)}</div></div>}
      {d.previous.length > 0 && <div className="sect"><div className="sect-t">往期</div><div className="sect-b">{d.previous.map(p => <div key={p.term} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{p.term.replace('-autumn', ' 秋').replace('-spring', ' 春')}</div><div className="small muted">想练：{p.focus}{p.comments.length ? ` · ${p.comments.length} 段评` : ''}</div></div></div>)}</div></div>}
      <div className="small muted" style={{ marginTop: 10 }}>自评进发展档案，随人走。园长与带教教师看得到你的档次与反思，看不到别人怎么评你以外的东西；管理员只看人数。</div>
    </>}
    {others && tab === 'others' && <>
      {!others.people.length && <div className="card small muted">还没有人。</div>}
      {others.people.map(p => <Person key={p.uid} p={p} d={others} onChange={load} />)}
    </>}
  </div>
}
