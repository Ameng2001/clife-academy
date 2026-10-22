// 每周一题：一道情景题，答了才能看同园别人怎么答；园长、点评人给一句意见，可标精选。没有分数、没有排名。
// 出题：管理员面向全平台，园长面向本园。
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { DOMAINS } from '../../lib/capability.js'
import { ROLES } from '../../lib/lessons.js'
import { fmtDay } from './common.jsx'

const pad = n => String(n).padStart(2, '0')
const toLocal = at => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const EMPTY = { id: null, title: '', context: '', role: '', domain: 'comm', open: toLocal(Date.now()), close: toLocal(Date.now() + 7 * 86400000) }
const dname = k => DOMAINS.find(d => d.key === k)?.name || k

const toCase = (nav, d, a) => nav('/cases?from=' + encodeURIComponent(JSON.stringify({ answerId: a.id, title: d.title.slice(0, 40), domain: d.domain || 'comm', text: `题：${d.title}\n\n答：${a.text}` })))
function Answers({ d, user }) {
  const nav = useNavigate()
  const [data, setData] = useState(null), [notes, setNotes] = useState({}), [busy, setBusy] = useState(false)
  const load = () => api('/api/drills/answers?id=' + d.id).then(setData).catch(() => setData(null))
  useEffect(() => { load() }, [d.id, d.mine?.updatedAt])
  const review = async (a, featured) => {
    const comment = (notes[a.id] ?? a.review?.comment ?? '').trim()
    if (!comment) return useUI.getState().toast('写一句意见')
    setBusy(true)
    try { await api('/api/drills/review', { method: 'POST', body: JSON.stringify({ answerId: a.id, comment, featured }) }); useUI.getState().toast(featured ? '已点评并精选' : '已点评'); setNotes(n => ({ ...n, [a.id]: '' })); load() }
    catch (e) { useUI.getState().toast('没成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  if (!data) return null
  if (data.locked) return <div className="small muted" style={{ marginTop: 12 }}>答了才能看同园老师怎么答。</div>
  const others = data.answers.filter(a => !a.mine)
  return <div style={{ marginTop: 14 }}>
    <div className="small muted">{d.scope === 'community' ? '共同体各园' : '同园'}老师的回答 · {others.length}{d.featured ? ` · 精选 ${d.featured}` : ''}</div>
    {!others.length && <div className="small muted" style={{ marginTop: 6 }}>还没有别人答。</div>}
    {others.map(a => <div key={a.id} className="card" style={{ marginTop: 8, padding: 12, ...(a.review?.featured ? { borderInlineStart: '3px solid var(--acc)' } : {}) }}>
      <div className="ac-row"><span className="small muted">{a.name}{a.titles?.length ? '（' + a.titles.join('、') + '）' : ''}{a.orgName && a.orgName !== user.academy?.org?.name ? ' · ' + a.orgName : ''} · {fmtDay(a.at)}</span>{a.review?.featured && <span className="tag" style={{ color: 'var(--acc)' }}>精选</span>}</div>
      <div style={{ marginTop: 4, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.text}</div>
      {a.review && <div className="small" style={{ marginTop: 6, color: 'var(--label-2)' }}>{a.review.byName}：{a.review.comment}</div>}
      {a.canReview && <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <TextField placeholder={a.review ? '改一句意见' : '一句意见'} value={notes[a.id] ?? ''} onChange={e => setNotes({ ...notes, [a.id]: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
        <Button size="sm" disabled={busy} onClick={() => review(a, false)}>点评</Button>
        <Button size="sm" variant="tinted" icon="starFill" disabled={busy} onClick={() => review(a, true)}>精选</Button>
        {a.review?.featured && (user.academy?.role === 'director' || user.admin) && <Button size="sm" icon="sparkles" onClick={() => toCase(nav, d, a)}>推荐入案例库</Button>}
      </div>}
    </div>)}
  </div>
}

function Drill({ d, user, first, onChange, onEdit, onDelete }) {
  const nav = useNavigate()
  const [text, setText] = useState(''), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [open, setOpen] = useState(!!first)
  const canAnswer = d.phase !== 'upcoming' && (!d.mine || editing)
  const send = async () => {
    const t = text.trim(); if (t.length < 20) return useUI.getState().toast('再写具体一点，至少 20 字')
    setBusy(true)
    try { await api('/api/drills/answer', { method: 'POST', body: JSON.stringify({ id: d.id, text: t }) }); setText(''); setEditing(false); useUI.getState().toast('已提交，现在能看同园老师怎么答了'); onChange() }
    catch (e) { useUI.getState().toast('没交成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  return <div className="card" style={{ marginTop: 10 }}>
    <div className="ac-row tap" onClick={() => setOpen(!open)} style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="small muted">{first ? '本周一题 · ' : ''}{d.phase === 'closed' ? '已收题 · ' : ''}{fmtDay(d.openAt)} 开放{d.phase === 'open' ? ` · ${fmtDay(d.closeAt)} 收` : ''} · {dname(d.domain)}{d.role ? ' · ' + (ROLES[d.role]?.label || d.role) : ''}{d.scope === 'org' ? ' · 本园' : d.scope === 'community' ? ' · 共同体 ' + (d.communityName || '') : ''}</div>
        <div style={{ fontWeight: 600, fontSize: first ? 17 : 15, lineHeight: 1.45, marginTop: 4 }}>{d.title}</div>
      </div>
      <span className="small muted" style={{ flex: 'none', marginInlineStart: 8 }}>{d.answered} 人答</span>
    </div>
    {open && <>
      {d.context && <div className="small" style={{ marginTop: 8, color: 'var(--label-2)', whiteSpace: 'pre-wrap' }}>{d.context}</div>}
      {d.mine && !editing && <div className="card" style={{ marginTop: 12, padding: 12 }}>
        <div className="ac-row"><span className="small muted">我的回答 · {fmtDay(d.mine.updatedAt)}</span>{d.mine.review?.featured && <span className="tag" style={{ color: 'var(--acc)' }}>精选</span>}</div>
        <div style={{ marginTop: 6, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{d.mine.text}</div>
        {d.mine.review && <div className="small" style={{ marginTop: 8, paddingTop: 8, borderTop: 'var(--hair) solid var(--sep)', color: 'var(--label-2)' }}>{d.mine.review.byName} 的点评：{d.mine.review.comment}</div>}
        {d.mine.review && <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}><Button size="sm" variant={d.mine.review.helpful ? 'tinted' : 'plain'} onClick={async () => { try { await api('/api/drills/helpful', { method: 'POST', body: JSON.stringify({ answerId: d.mine.id, on: !d.mine.review.helpful }) }); load() } catch (e) { useUI.getState().toast('没标成') } }}>{d.mine.review.helpful ? '已标「有帮助」' : '这条点评有帮助'}</Button><span className="small muted">只有你能标；计点评人的贡献勋章</span></div>}
        <div className="row" style={{ gap: 8, marginTop: 8 }}><Button size="sm" onClick={() => { setText(d.mine.text); setEditing(true) }}>再写一版</Button><Button size="sm" icon="sparkles" onClick={() => toCase(nav, d, d.mine)}>分享到案例库</Button></div>
      </div>}
      {canAnswer && <div style={{ marginTop: 12 }}>
        <TextArea rows={5} placeholder="先写你会怎么做或怎么说，再写为什么。50–150 字" value={text} onChange={e => setText(e.target.value)} />
        <div className="ac-row" style={{ marginTop: 8 }}><span className="small muted">{text.trim().length} 字</span><div className="row" style={{ gap: 8 }}>{editing && <Button size="sm" onClick={() => setEditing(false)}>取消</Button>}<Button variant="primary" disabled={busy} onClick={send}>提交</Button></div></div>
      </div>}
      <Answers d={d} user={user} />
      {onEdit && <div className="row" style={{ gap: 8, marginTop: 12 }}><Button size="sm" onClick={() => onEdit(d)}>改题</Button><Button size="sm" onClick={() => onDelete(d)}>删题</Button></div>}
    </>}
  </div>
}

export default function Drills() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [sp] = useSearchParams()
  const [data, setData] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false), [showPast, setShowPast] = useState(!!sp.get('past'))
  const [communities, setCommunities] = useState(null)
  const load = () => { if (user) api('/api/drills').then(setData).catch(() => setData(null)); else setData(null) }
  useEffect(() => { load() }, [user?.id])
  useEffect(() => { if (data?.postScope === 'community') api('/api/district/communities').then(r => setCommunities(r.communities)).catch(() => setCommunities([])) }, [data?.postScope])
  const edit = d => setForm({ id: d.id, title: d.title, context: d.context, role: d.role, domain: d.domain, open: toLocal(d.openAt), close: toLocal(d.closeAt) })
  const del = async d => { if (!confirm('删掉这题？大家的作答也一起删。')) return; try { await api('/api/drills/delete', { method: 'POST', body: JSON.stringify({ id: d.id }) }); load() } catch (e) { useUI.getState().toast('没删成' + (e.message ? '：' + e.message : '')) } }
  const save = async () => {
    if (form.title.trim().length < 10) return useUI.getState().toast('题干至少 10 字')
    if (data?.postScope === 'community' && !form.id && !form.communityId) return useUI.getState().toast('选一个共同体')
    const openAt = new Date(form.open + 'T00:00').getTime(), closeAt = new Date(form.close + 'T23:59').getTime()
    setBusy(true)
    try { await api('/api/drills', { method: 'POST', body: JSON.stringify({ id: form.id || undefined, title: form.title, context: form.context, role: form.role, domain: form.domain, openAt, closeAt, communityId: form.communityId || undefined }) }); useUI.getState().toast(form.id ? '已改' : '已出题'); setForm(null); load() }
    catch (e) { useUI.getState().toast('没存成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  return <div className="narrow wide">
    <div className="hdr"><div><h1>每周一题</h1><div className="sub">一道情景题 · 答了看同园老师怎么答 · 园长给一句意见</div></div><div className="hdr-actions">{data?.canPost && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ ...EMPTY })}>出一题</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后作答。同园可见，不做公共广场。</div>}

    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>{form.id ? '改题' : '出一题'} · {data?.postScope === 'all' ? '面向全平台' : data?.postScope === 'community' ? '面向本区一个共同体（联合研讨题，组内各园互相看得到作答）' : '只面向本园'} · 真实情境改编，不出现幼儿姓名</div>
      {data?.postScope === 'community' && !form.id && <select className="ac-sel" value={form.communityId || ''} onChange={e => setForm({ ...form, communityId: e.target.value })} style={{ marginBottom: 8, width: '100%' }}><option value="">选共同体</option>{(communities || []).map(c => <option key={c.id} value={c.id}>{c.name} · {c.orgs.map(o => o.name).join('、')}</option>)}</select>}
      <TextArea rows={3} placeholder="题干：一个具体情境，问「你第一句话 / 第一步会怎么做」" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <TextArea rows={2} style={{ marginTop: 8 }} placeholder="背景（可不填）：班级、时间、前因" value={form.context} onChange={e => setForm({ ...form, context: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <select className="ac-sel" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} style={{ flex: 2, minWidth: 140 }}>{DOMAINS.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}</select>
        <select className="ac-sel" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ flex: 1 }}><option value="">全部岗位</option>{Object.keys(ROLES).map(k => <option key={k} value={k}>{ROLES[k].label}</option>)}</select>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="small muted">开放</span><input className="ac-sel" type="date" value={form.open} onChange={e => setForm({ ...form, open: e.target.value })} />
        <span className="small muted">收题</span><input className="ac-sel" type="date" value={form.close} onChange={e => setForm({ ...form, close: e.target.value })} />
      </div>
      <div className="ac-row" style={{ marginTop: 10 }}><span className="small muted">收题后还能晚答，只是不再算本周。</span><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>存</Button></div></div>
    </div>}

    {data && !data.current.length && <div className="card small muted">本周还没出题。{data.canPost ? '点右上角「出一题」。' : '出了会在这里和首页出现。'}</div>}
    {data?.current.map((d, i) => <Drill key={d.id} d={d} user={user} first={i === 0} onChange={load} onEdit={d.canEdit ? edit : null} onDelete={del} />)}
    {data?.upcoming.length > 0 && <div className="sect" style={{ marginTop: 18 }}><div className="sect-t">还没开放 · {data.upcoming.length}</div>{data.upcoming.map(d => <Drill key={d.id} d={d} user={user} onChange={load} onEdit={d.canEdit ? edit : null} onDelete={del} />)}</div>}
    {data?.past.length > 0 && <div className="sect" style={{ marginTop: 18 }}>
      <div className="sect-t tap" onClick={() => setShowPast(!showPast)}>往期 · {data.past.length} <Icon name={showPast ? 'chevronUp' : 'chevronDown'} /></div>
      {showPast && data.past.map(d => <Drill key={d.id} d={d} user={user} onChange={load} onEdit={d.canEdit ? edit : null} onDelete={del} />)}
    </div>}
  </div>
}
