// 案例库：实践关与研讨关的优秀作品（园长同意后）、种子园做法。实名、登录可见、全平台共享。
// 教师自荐 → 园长同意 → 审核人入库；园长从已通过的作品推荐直接进待审核。每个案例标「可直接用 / 需改编 / 只看思路」。
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { uploadMedia } from '../../lib/upload.js'
import { DOMAINS } from '../../lib/capability.js'
import { titleOf } from '../../lib/lessons.js'
import { fmtDay } from './common.jsx'

const STATUS = { consent: ['待园长同意', 'var(--orange)'], pending: ['待审核', 'var(--orange)'], approved: ['已入库', 'var(--green)'], rejected: ['退回', 'var(--red)'] }
const USE_ORDER = ['direct', 'adapt', 'idea']
const AGES = ['小班', '中班', '大班', '混龄']
const EMPTY = { id: null, title: '', domain: 'obs', age: '', use: 'adapt', text: '', files: [] }
const dname = k => DOMAINS.find(d => d.key === k)?.name || k

function CaseCard({ c, uses, onOpen, open, actions, onUsed }) {
  const [useNote, setUseNote] = useState('')
  const [t, col] = STATUS[c.status] || [c.status, 'var(--label-2)']
  return <div className="card" style={{ marginTop: 10 }}>
    <div className="ac-row tap" onClick={onOpen} style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, lineHeight: 1.4 }}>{c.title}</div>
        <div className="small muted" style={{ marginTop: 4 }}>{dname(c.domain)}{c.age ? ' · ' + c.age : ''} · <span style={{ color: 'var(--acc)' }}>{uses[c.use] || c.use}</span> · {c.byName}{c.byTitles?.length ? '（' + c.byTitles.join('、') + '）' : ''}{c.orgName ? ' · ' + c.orgName : ''}{c.source?.levelId ? ' · 出自「' + (titleOf(c.source.levelId) || c.source.levelId) + '」' : ''}</div>
      </div>
      {c.status !== 'approved' || c.mine ? <span className="small" style={{ color: col, flex: 'none' }}>{t}</span> : <Icon name={open ? 'chevronUp' : 'chevronDown'} />}
    </div>
    {open && <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.text}</div>}
    {open && c.files?.length > 0 && <div className="ac-row" style={{ justifyContent: 'flex-start', marginTop: 10, flexWrap: 'wrap' }}>{c.files.map(f => <a key={f.hash} href={`api/cases/file?id=${c.id}&hash=${f.hash}`} target="_blank" rel="noreferrer"><img alt={f.name} src={`api/cases/file?id=${c.id}&hash=${f.hash}`} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} /></a>)}</div>}
    {c.note && (c.status === 'rejected' || c.mine) && <div className="small" style={{ marginTop: 8, color: 'var(--label-2)' }}>审核意见：{c.note}</div>}
    {open && c.curated && <div className="small muted" style={{ marginTop: 6 }}>{c.curated.byName} 于 {fmtDay(c.curated.at)} 入库{c.consent ? ` · ${c.consent.byName} 同意` : ''}</div>}
    {open && c.status === 'approved' && !c.mine && onUsed && <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {c.usedByMe ? <span className="small" style={{ color: 'var(--green)' }}><Icon name="checkCircle" /> 你标过「用过，有效」</span> : <><TextField placeholder="怎么改的，一句话（可不填）" value={useNote} onChange={e => setUseNote(e.target.value)} style={{ flex: 1, minWidth: 160 }} /><Button size="sm" icon="check" onClick={() => onUsed(c, useNote)}>用过，有效</Button></>}
    </div>}
    {open && c.used !== undefined && <div className="small muted" style={{ marginTop: 8 }}>被用过 {c.used} 次（只给你和园长看）{c.uses?.length > 0 && <>：{c.uses.slice(0, 5).map((u, i) => <span key={i}>{i ? '；' : ''}{u.name}{u.note ? '「' + u.note + '」' : ''}</span>)}</>}</div>}
    {actions && <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{actions}</div>}
  </div>
}

export default function Cases() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || 'all'
  const [q, setQ] = useState(sp.get('q') || '')
  const domain = sp.get('domain') || '', use = sp.get('use') || '', age = sp.get('age') || ''
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }
  const [data, setData] = useState(null), [mine, setMine] = useState(null), [queue, setQueue] = useState(null)
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [openId, setOpenId] = useState(null), [notes, setNotes] = useState({})
  const fileRef = useRef()
  const load = async () => {
    if (!user) { setData(null); return }
    const p = new URLSearchParams(); if (q.trim()) p.set('q', q.trim()); if (domain) p.set('domain', domain); if (use) p.set('use', use); if (age) p.set('age', age)
    try { setData(await api('/api/cases?' + p.toString())) } catch (e) { useUI.getState().toast('没取到案例' + (e.message ? '：' + e.message : '')) }
    api('/api/cases/mine').then(setMine).catch(() => setMine(null))
    api('/api/cases/queue').then(setQueue).catch(() => setQueue(null))
  }
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') || '') !== q) setParam('q', q) }, 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { load() }, [sp.toString(), user?.id])
  // 从点评页「推荐入案例库」带来的作品：预填表单
  useEffect(() => {
    const raw = sp.get('from'); if (!raw) return
    try { const f = JSON.parse(raw); setForm({ ...EMPTY, submissionId: f.submissionId, answerId: f.answerId, title: f.title || '', domain: f.domain || 'obs', use: 'adapt', text: f.text || '' }) } catch { /* 无妨 */ }
    setParam('from', null)
  }, [])
  const uses = data?.uses || { direct: '可直接用', adapt: '需改编', idea: '只看思路' }

  const save = async () => {
    if (!form.title.trim()) return useUI.getState().toast('写个标题')
    if (form.text.trim().length < 50) return useUI.getState().toast('正文至少 50 字：做了什么、怎么做的、效果如何')
    setBusy(true)
    try {
      const r = await api('/api/cases', { method: 'POST', body: JSON.stringify({ ...form, age: form.age || undefined, files: form.files.map(({ hash, name, type }) => ({ hash, name, type })) }) })
      useUI.getState().toast(r.case.status === 'consent' ? '已交，等园长同意' : r.case.status === 'pending' ? '已交，等审核' : '已保存'); setForm(null); await load()
    } catch (e) { useUI.getState().toast('没交成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const decide = async (c, action) => {
    const note = (notes[c.id] || '').trim()
    if (action === 'reject' && !note) return useUI.getState().toast('退回要写原因')
    setBusy(true)
    try { await api('/api/cases/decide', { method: 'POST', body: JSON.stringify({ id: c.id, action, note }) }); useUI.getState().toast(action === 'consent' ? '已同意，转审核' : action === 'approve' ? '已入库' : '已退回'); await load() }
    catch (e) { useUI.getState().toast('没办成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const used = async (c, note) => {
    try { await api('/api/cases/used', { method: 'POST', body: JSON.stringify({ id: c.id, note }) }); useUI.getState().toast('已记，分享者看得到'); await load() } catch (e) { useUI.getState().toast('没成' + (e.message ? '：' + e.message : '')) }
  }
  const del = async c => {
    if (!confirm(`删掉「${c.title}」？`)) return
    try { await api('/api/cases/delete', { method: 'POST', body: JSON.stringify({ id: c.id }) }); await load() } catch (e) { useUI.getState().toast('没删成' + (e.message ? '：' + e.message : '')) }
  }
  const pick = async e => {
    const list = [...(e.target.files || [])].slice(0, 6 - form.files.length); e.target.value = ''
    setBusy(true)
    try { for (const f of list) { const m = await uploadMedia(f); setForm(x => x.files.some(y => y.hash === m.hash) ? x : { ...x, files: [...x.files, m] }) } }
    catch (err) { useUI.getState().toast('上传失败' + (err.message ? '：' + err.message : '')) }
    finally { setBusy(false) }
  }
  const queueCount = (queue?.consent?.length || 0) + (queue?.pending?.length || 0)

  return <div className="narrow">
    <div className="hdr"><div><h1>案例库</h1><div className="sub">园里真实做过的事 · 实名共享 · 每条标明怎么用</div></div><div className="hdr-actions">{user && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ ...EMPTY })}>分享一个</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">案例库实名共享，登录后可见。</div>}
    {user && <div className="ac-tabs" style={{ marginBottom: 12 }}>
      <button className={tab === 'all' ? 'on' : ''} onClick={() => setParam('tab', null)}>全部{data ? ` ${data.total}` : ''}</button>
      <button className={tab === 'mine' ? 'on' : ''} onClick={() => setParam('tab', 'mine')}>我交的{mine ? ` ${mine.cases.length}` : ''}</button>
      {queue && (queue.director || queue.curator) && <button className={tab === 'queue' ? 'on' : ''} onClick={() => setParam('tab', 'queue')}>待办{queueCount ? ` ${queueCount}` : ''}</button>}
    </div>}

    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>{form.id ? '改这条' : '分享一个案例'} · 不出现幼儿姓名与正脸；交了以后园长同意、审核人入库</div>
      <TextField placeholder="标题：一句话说清做了什么" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <select className="ac-sel" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} style={{ flex: 2, minWidth: 140 }}>{DOMAINS.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}</select>
        <select className="ac-sel" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} style={{ flex: 1 }}><option value="">年龄班</option>{AGES.map(a => <option key={a} value={a}>{a}</option>)}</select>
        <select className="ac-sel" value={form.use} onChange={e => setForm({ ...form, use: e.target.value })} style={{ flex: 1 }}>{USE_ORDER.map(u => <option key={u} value={u}>{uses[u]}</option>)}</select>
      </div>
      <TextArea rows={8} style={{ marginTop: 8 }} placeholder="背景、做了什么、怎么做的、效果如何、别人用时要注意什么。至少 50 字。" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
      <div className="ac-row" style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
        {form.files.map(f => <span key={f.hash} className="chip" onClick={() => setForm({ ...form, files: form.files.filter(x => x.hash !== f.hash) })} title="点一下移除"><Icon name="image" /> {f.name || '图'} ×</span>)}
        {form.files.length < 6 && <Button size="sm" icon="camera" disabled={busy} onClick={() => fileRef.current?.click()}>加照片</Button>}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />
      </div>
      <div className="ac-row" style={{ marginTop: 10 }}><span className="small muted">{form.text.trim().length} 字</span><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>交</Button></div></div>
    </div>}

    {user && tab === 'all' && <>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <TextField placeholder="搜标题、正文、园所、作者" value={q} onChange={e => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} />
        <span style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--label-3)', display: 'flex' }}><Icon name="magnifier" /></span>
      </div>
      <div className="chips" style={{ marginBottom: 6 }}><button className={'chip' + (!domain ? ' on' : '')} onClick={() => setParam('domain', null)}>全部领域</button>{DOMAINS.map(d => <button key={d.key} className={'chip' + (d.key === domain ? ' on' : '')} onClick={() => setParam('domain', d.key === domain ? null : d.key)}>{d.name}</button>)}</div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {USE_ORDER.map(u => <button key={u} className={'chip' + (u === use ? ' on' : '')} onClick={() => setParam('use', u === use ? null : u)}>{uses[u]}</button>)}
        <span style={{ width: 8 }} />
        {AGES.map(a => <button key={a} className={'chip' + (a === age ? ' on' : '')} onClick={() => setParam('age', a === age ? null : a)}>{a}</button>)}
      </div>
      {data && !data.cases.length && <div className="card small muted">还没有入库的案例。{data.total ? '换个筛选试试。' : '做过的好事值得写下来：点右上角「分享一个」。'}</div>}
      {data?.cases.map(c => <CaseCard key={c.id} c={c} uses={uses} open={openId === c.id} onOpen={() => setOpenId(openId === c.id ? null : c.id)} onUsed={used} />)}
    </>}

    {user && tab === 'mine' && <>
      {mine && !mine.cases.length && <div className="card small muted">还没交过。退回的可以改了再交。</div>}
      {mine?.cases.map(c => <CaseCard key={c.id} c={c} uses={uses} open={openId === c.id} onOpen={() => setOpenId(openId === c.id ? null : c.id)}
        actions={c.canEdit && <><Button size="sm" onClick={() => setForm({ id: c.id, title: c.title, domain: c.domain, age: c.age || '', use: c.use, text: c.text, files: c.files })}>{c.status === 'rejected' ? '改了再交' : '改'}</Button><Button size="sm" onClick={() => del(c)}>删</Button></>} />)}
    </>}

    {user && tab === 'queue' && queue && <>
      {queue.director && <div className="sect"><div className="sect-t">本园待同意 · {queue.consent.length}</div>
        {!queue.consent.length && <div className="card small muted">没有待同意的。老师自荐的案例会先到这里，你同意后才进审核。</div>}
        {queue.consent.map(c => <CaseCard key={c.id} c={c} uses={uses} open={openId === c.id} onOpen={() => setOpenId(openId === c.id ? null : c.id)}
          actions={<><TextField placeholder="不同意时写一句原因" value={notes[c.id] || ''} onChange={e => setNotes({ ...notes, [c.id]: e.target.value })} style={{ flex: 1, minWidth: 160 }} /><Button size="sm" onClick={() => decide(c, 'reject')}>不同意</Button><Button size="sm" variant="primary" disabled={busy} onClick={() => decide(c, 'consent')}>同意，转审核</Button></>} />)}
      </div>}
      {queue.curator && <div className="sect"><div className="sect-t">待审核 · {queue.pending.length}</div>
        {!queue.pending.length && <div className="card small muted">没有待审核的。</div>}
        {queue.pending.map(c => <CaseCard key={c.id} c={c} uses={uses} open={openId === c.id} onOpen={() => setOpenId(openId === c.id ? null : c.id)}
          actions={<><TextField placeholder="意见（退回必填）" value={notes[c.id] || ''} onChange={e => setNotes({ ...notes, [c.id]: e.target.value })} style={{ flex: 1, minWidth: 160 }} /><Button size="sm" onClick={() => decide(c, 'reject')}>退回</Button><Button size="sm" variant="primary" icon="checkCircle" disabled={busy} onClick={() => decide(c, 'approve')}>入库</Button></>} />)}
      </div>}
    </>}
  </div>
}
