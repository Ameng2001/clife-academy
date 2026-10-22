// 课程成果（/works）：教师在教研工坊做出来、班里用过的课，分享到幼师学坊（docs/POSITIONING.md：工坊是研究工具，学坊是 PGC 学习＋UGC 社区）。
// 专家案例是「一件事怎么做」，课程成果是「一门课怎么来的」。每条必须写「在起草稿上改了什么」：工坊起草不算成果，用过并改过才算。
// 流程同案例：教师交 → 园长同意 → 审核人入库；实名、不显示人数、不排名；「用过，有效」只给分享者本人看。
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const STATUS = { draft: ['草稿', 'var(--label-2)'], consent: ['待园长同意', 'var(--orange)'], pending: ['待审核', 'var(--orange)'], approved: ['已入库', 'var(--green)'], rejected: ['退回', 'var(--red)'] }
const PIPES = [['theme', '主题式课程'], ['pbl', '项目式课程'], ['activity', '单节活动']]
const FIVE = [['lang', '语言'], ['social', '社会'], ['health', '健康'], ['art', '艺术'], ['sci', '科学']]
const AGES = ['小班', '中班', '大班', '混龄']
const SCOPES = [['all', '全平台'], ['community', '本共同体'], ['org', '本园']]
const EMPTY = { id: null, title: '', pipeline: 'theme', age: '', weeks: '', domains: [], summary: '', changes: [''], files: [], source: { courseId: '', url: '' }, message: '', allowAdapt: true, filesScope: 'all', adaptedFrom: null }

function WorkCard({ w, open, onOpen, actions, onUsed, onAdapt, onAdaptHere, nav }) {
  const [note, setNote] = useState('')
  const [t, col] = STATUS[w.status] || [w.status, 'var(--label-2)']
  return <div className={'card' + (open ? ' open' : '')} style={{ marginTop: 10, ...(w.status === 'draft' ? { background: 'var(--surface-2)', borderStyle: 'dashed' } : {}) }}>
    <div className="ac-row tap" onClick={onOpen} style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, lineHeight: 1.4 }}>{w.title}</div>
        <div className="small muted" style={{ marginTop: 4 }}><span style={{ color: 'var(--acc)' }}>{w.pipelineName}</span>{w.age ? ' · ' + w.age : ''}{w.weeks ? ` · ${w.weeks} 周` : ''} · {w.domainNames.join('、')} · {w.byName}{w.byTitles?.length ? ' · ' + w.byTitles.join('、') : ''}{w.orgName ? ' · ' + w.orgName : ''}</div>
        <div className="small muted" style={{ marginTop: 2 }}>{w.status === 'draft' ? `草稿 · ${w.source.via ? `经「${w.source.via}」导入` : '自己存的'}` : w.source.via ? `经「${w.source.via}」投稿` : w.source.kind === 'workshop' ? '来自教研工坊' : '自己交的'} · {fmtDay(w.at)}{w.allowAdapt === false ? ' · 只看不改编' : ''}{w.status !== 'approved' ? <> · <span style={{ color: col }}>{t}</span></> : null}</div>
        {w.status === 'draft' && <div className="small" style={{ marginTop: 4, color: 'var(--orange)' }}>{w.changes?.length ? '补齐后交给园长' : '还没写「在起草稿上改了什么」'} · 没动的话 {fmtDay(w.expiresAt)} 自动删</div>}
        {w.message && <div className="small" style={{ marginTop: 6, paddingInlineStart: 10, borderInlineStart: '3px solid var(--acc)', lineHeight: 1.5 }}>{w.byName}：{w.message}</div>}
      </div>
      <Icon name={open ? 'chevronUp' : 'chevronDown'} />
    </div>
    {open && <div style={{ marginTop: 10 }}>
      <div className="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{w.summary}</div>
      <div className="card" style={{ marginTop: 10, padding: 10, background: 'color-mix(in srgb,var(--acc) 8%,transparent)' }}>
        <div className="small" style={{ fontWeight: 600 }}><Icon name="pencil" /> 在起草稿上改了什么</div>
        <ul className="small" style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>{w.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </div>
      {w.filesHidden && <div className="small muted" style={{ marginTop: 8 }}><Icon name="lock" /> 文件只给{w.filesScopeName}看，简介与改动说明全平台可见。</div>}
      {w.files.length > 0 && <div className="chips" style={{ marginTop: 8 }}>{w.filesScope !== 'all' && <span className="small muted" style={{ alignSelf: 'center' }}>文件 · {w.filesScopeName}可见</span>}{w.files.map((f, i) => <a key={i} className="chip" href={f.url} target="_blank" rel="noreferrer"><Icon name="download" /> {f.name}</a>)}</div>}
      {w.source.url && <div className="small" style={{ marginTop: 6 }}><a href={w.source.url} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)' }}><Icon name="link" /> 在教研工坊里打开这门课</a></div>}
      {w.note && w.status === 'rejected' && <div className="small" style={{ marginTop: 8, color: 'var(--red)' }}>退回原因：{w.note}</div>}
      {w.uses && <div className="small muted" style={{ marginTop: 8 }}>{w.uses.length ? `用过，有效：${w.uses.map(u => u.name + (u.orgName ? '（' + u.orgName + '）' : '') + (u.note ? '：' + u.note : '')).join('；')}` : '还没有人标「用过，有效」。'}</div>}
      {w.status === 'approved' && !w.mine && onUsed && <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {w.usedByMe ? <span className="small muted"><Icon name="check" /> 你标过「用过，有效」</span> : <><TextField placeholder="怎么改到自己班的（可不填）" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1, minWidth: 160 }} /><Button size="sm" variant="tinted" icon="check" onClick={() => onUsed(w, note)}>用过，有效</Button></>}
      </div>}
      {w.adaptedFrom && <div className="small" style={{ marginTop: 8, color: 'var(--label-2)' }}><Icon name="link" /> 改自 {w.adaptedFrom.byName}{w.adaptedFrom.orgName ? '（' + w.adaptedFrom.orgName + '）' : ''}的{w.adaptedFrom.available && nav ? <span className="tap" style={{ textDecoration: 'underline' }} onClick={e => { e.stopPropagation(); nav('/works?q=' + encodeURIComponent(w.adaptedFrom.title)) }}>《{w.adaptedFrom.title}》</span> : `《${w.adaptedFrom.title}》`}{w.chain?.length > 1 && <span className="muted">，再往上：{w.chain.slice(1).map(x => `${x.byName}《${x.title}》`).join(' ← ')}</span>}</div>}
      {w.adaptations?.length > 0 && <div className="small" style={{ marginTop: 6, color: 'var(--label-2)' }}><Icon name="sparkles" /> 被改编：{w.adaptations.map((x, i) => <span key={x.id}>{i ? '；' : ''}{x.byName}{x.orgName ? '（' + x.orgName + '）' : ''}{nav ? <span className="tap" style={{ textDecoration: 'underline' }} onClick={e => { e.stopPropagation(); nav('/works?q=' + encodeURIComponent(x.title)) }}>《{x.title}》</span> : `《${x.title}》`}{x.changes?.length ? '，改了：' + x.changes[0] : ''}</span>)}</div>}
      {w.canAdapt && onAdapt && <div className="small" style={{ marginTop: 8 }}><span className="tap" style={{ color: 'var(--acc)' }} onClick={e => { e.stopPropagation(); onAdapt(w) }}><Icon name="pencil" /> {onAdaptHere ? '改编这门课：到教研工坊照它开一门新课，用过再分享回来 ›' : '改编这门课：按我们班的情况改一版，原作者与你都署名 ›'}</span>{onAdaptHere && <span className="tap muted" style={{ marginInlineStart: 10 }} onClick={e => { e.stopPropagation(); onAdaptHere(w) }}>不用工坊，在这里手填</span>}</div>}
      {actions && <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{actions}</div>}
    </div>}
  </div>
}

export default function Works() {
  const nav = useNavigate()
  const user = useStore(s => s.user), config = useStore(s => s.config)
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || 'all'
  const [q, setQ] = useState(sp.get('q') || '')
  const pipeline = sp.get('pipeline') || '', domain = sp.get('domain') || '', age = sp.get('age') || ''
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }
  const [data, setData] = useState(null), [mine, setMine] = useState(null), [queue, setQueue] = useState(null)
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [openId, setOpenId] = useState(null), [notes, setNotes] = useState({})
  const toast = useUI.getState().toast
  const load = async () => {
    if (!user) { setData(null); return }
    const p = new URLSearchParams(); if (q.trim()) p.set('q', q.trim()); if (pipeline) p.set('pipeline', pipeline); if (domain) p.set('domain', domain); if (age) p.set('age', age)
    try { setData(await api('/api/works?' + p.toString())) } catch (e) { toast('没取到课程成果' + (e.message ? '：' + e.message : '')) }
    api('/api/works/mine').then(setMine).catch(() => setMine(null))
    api('/api/works/queue').then(setQueue).catch(() => setQueue(null))
  }
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') || '') !== q) setParam('q', q) }, 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { load() }, [sp.toString(), user?.id])
  // Agent 落的草稿给教师的地址是 /works?tab=mine&id=…：到了就把那条打开成表
  useEffect(() => { const id = sp.get('id'); if (!id || !mine || form) return; const w = mine.works.find(x => x.id === id); if (w && w.status !== 'approved') { edit(w); setParam('id', '') } }, [mine, sp.get('id')])

  const save = async () => {
    if (!form.title.trim()) return toast('写个标题')
    if (form.summary.trim().length < 50) return toast('课程简介至少 50 字：怎么来的、几周、做了什么、效果如何')
    const changes = form.changes.map(x => x.trim()).filter(Boolean)
    if (!changes.length) return toast('写一条「在起草稿上改了什么」。工坊起草不算成果，用过并改过才算')
    if (!form.domains.length) return toast('选至少一个领域')
    setBusy(true)
    try {
      const body = { id: form.id || undefined, title: form.title, pipeline: form.pipeline, age: form.age || undefined, weeks: form.weeks ? +form.weeks : undefined, domains: form.domains, summary: form.summary, changes, files: form.files.filter(f => f.name && f.url), source: { courseId: form.source.courseId || undefined, url: form.source.url || undefined }, message: form.message.trim(), allowAdapt: form.allowAdapt, filesScope: form.filesScope, adaptedFrom: form.adaptedFrom ? form.adaptedFrom.id : null }
      const r = await api('/api/works', { method: 'POST', body: JSON.stringify(body) })
      toast(r.work.status === 'consent' ? '已交，等园长同意' : r.work.status === 'pending' ? '已交，等审核' : '已保存'); setForm(null); await load()
    } catch (e) { toast('没交成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const decide = async (w, action) => {
    const note = (notes[w.id] || '').trim()
    if (action === 'reject' && !note) return toast('退回要写原因')
    setBusy(true)
    try { await api('/api/works/decide', { method: 'POST', body: JSON.stringify({ id: w.id, action, note }) }); toast(action === 'consent' ? '已同意，转审核' : action === 'approve' ? '已入库，分享者记积分' : '已退回'); await load() }
    catch (e) { toast('没办成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const used = async (w, note) => { try { await api('/api/works/used', { method: 'POST', body: JSON.stringify({ id: w.id, note }) }); toast('已记，分享者看得到'); await load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } }
  const del = async w => { if (!confirm(`删掉「${w.title}」？`)) return; try { await api('/api/works/delete', { method: 'POST', body: JSON.stringify({ id: w.id }) }); await load() } catch (e) { toast('没删成') } }
  const edit = w => setForm({ id: w.id, draft: w.status === 'draft', title: w.title, pipeline: w.pipeline, age: w.age || '', weeks: w.weeks || '', domains: w.domains, summary: w.summary, changes: w.changes.length ? w.changes : [''], files: w.files, source: { courseId: '', url: w.source.url || '' }, message: w.message || '', allowAdapt: w.allowAdapt !== false, filesScope: w.filesScope || 'all', adaptedFrom: w.adaptedFrom ? { id: w.adaptedFrom.id, title: w.adaptedFrom.title, byName: w.adaptedFrom.byName } : null })
  // 改编：预填管线、年龄班、周数、领域与简介当底稿，标题前加「改编：」，文件与工坊地址不带（是自己做出来的新一版）；「改了什么」自己写
  // 工坊接了 ?from=（服务端配 WORKSHOP_ADAPT_URL）且这门课来自工坊：跳工坊照它开新课，交回来时工坊带 adaptedFrom；否则在这里开预填表
  const adaptUrlOf = w => { const t = config?.workshop?.adaptUrl; return t && w.source?.courseId ? t.replace('{courseId}', encodeURIComponent(w.source.courseId)).replace('{workId}', encodeURIComponent(w.id)) : null }
  const adaptHere = w => { setForm({ ...EMPTY, title: '改编：' + w.title, pipeline: w.pipeline, age: w.age || '', weeks: w.weeks || '', domains: w.domains, summary: w.summary, adaptedFrom: { id: w.id, title: w.title, byName: w.byName, url: w.source?.url || null } }); setOpenId(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const adapt = w => { const u = adaptUrlOf(w); if (u) window.open(u, '_blank', 'noopener'); else adaptHere(w) }
  const queueCount = (queue?.consent?.length || 0) + (queue?.pending?.length || 0)
  const card = (w, extra) => <WorkCard key={w.id} w={w} open={openId === w.id} onOpen={() => setOpenId(openId === w.id ? null : w.id)} onUsed={used} onAdapt={adapt} onAdaptHere={adaptUrlOf(w) ? adaptHere : null} nav={nav} actions={extra} />

  return <div className="narrow wide">
    <div className="hdr"><div><h1>课程成果</h1><div className="sub">在教研工坊做出来、班里用过的课 · 实名共享 · 每门写明改了什么</div></div><div className="hdr-actions"><button className="chip" onClick={() => nav('/community')}><Icon name="share" /> 教研共同体</button><button className="chip" onClick={() => nav('/cases')}><Icon name="sparkles" /> 专家案例</button>{user && !form && <button className="chip" onClick={() => nav('/works/agent')}><Icon name="sparkles" /> 用 Agent 整理</button>}{user && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ ...EMPTY })}>分享一门课</Button>}</div></div>
    {!user && <div className="card small muted">课程成果实名共享，登录后可见。</div>}
    {user && <div className="ac-tabs" style={{ marginBottom: 12 }}>
      <button className={tab === 'all' ? 'on' : ''} onClick={() => setParam('tab', null)}>全部{data ? ` ${data.total}` : ''}</button>
      <button className={tab === 'mine' ? 'on' : ''} onClick={() => setParam('tab', 'mine')}>我交的{mine ? ` ${mine.works.length}` : ''}</button>
      {queue && (queue.director || queue.curator) && <button className={tab === 'queue' ? 'on' : ''} onClick={() => setParam('tab', 'queue')}>待办{queueCount ? ` ${queueCount}` : ''}</button>}
    </div>}

    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>{form.draft ? '补齐这份草稿 · 「改了什么」只能你自己写，Agent 填的不算' : form.id ? '改这门' : '分享一门课'} · 在教研工坊里点「分享到幼师学坊」会自动填好；手填也行；也可以<span className="tap" style={{ color: 'var(--acc)' }} onClick={() => nav('/works/agent')}>让 Agent 先整理成草稿</span>。不出现幼儿姓名与正脸；交了以后园长同意、审核人入库，入库记积分</div>
      {form.adaptedFrom && <div className="card" style={{ marginBottom: 8, padding: 10, background: 'color-mix(in srgb,var(--acc) 8%,transparent)' }}><div className="small"><Icon name="link" /> 改自 {form.adaptedFrom.byName} 的《{form.adaptedFrom.title}》<span className="tap muted" style={{ marginInlineStart: 8 }} onClick={() => setForm({ ...form, adaptedFrom: null })}>不是改编 ×</span></div><div className="small muted" style={{ marginTop: 4 }}>简介已复制来当底稿，照你们班的情况改；「在起草稿上改了什么」写你在这门课上改的。原作者与你都署名；入库后给原成果记一次「用过，有效」。{form.adaptedFrom.url && <> 想在教研工坊里重做一版，<a href={form.adaptedFrom.url} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)' }}>先打开原课</a>。</>}</div></div>}
      <TextField placeholder="课程名，如「运动：下肢力量锻炼」" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <select className="ac-sel" value={form.pipeline} onChange={e => setForm({ ...form, pipeline: e.target.value })} style={{ flex: 2, minWidth: 140 }}>{PIPES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        <select className="ac-sel" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} style={{ flex: 1 }}><option value="">年龄班</option>{AGES.map(a => <option key={a} value={a}>{a}</option>)}</select>
        <TextField type="number" min="1" max="20" placeholder="周数" value={form.weeks} onChange={e => setForm({ ...form, weeks: e.target.value })} style={{ width: 90 }} />
      </div>
      <div className="chips" style={{ marginTop: 8 }}>{FIVE.map(([k, t]) => <button key={k} className={'chip' + (form.domains.includes(k) ? ' on' : '')} onClick={() => setForm({ ...form, domains: form.domains.includes(k) ? form.domains.filter(x => x !== k) : [...form.domains, k] })}>{t}</button>)}</div>
      <TextArea rows={6} style={{ marginTop: 8 }} placeholder="课程简介：主题怎么来的、几周、每周做什么、班里用下来效果如何、别人用时要注意什么。至少 50 字。" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
      <div className="small" style={{ marginTop: 10, fontWeight: 600 }}>在起草稿上改了什么（至少一条，这是这门课里「你」的部分）</div>
      {form.changes.map((c, i) => <div key={i} className="row" style={{ gap: 6, marginTop: 6 }}><TextField placeholder={i === 0 ? '如：户外跳箱改成跨跳垫，小班跳不上去' : '再写一条'} value={c} onChange={e => setForm({ ...form, changes: form.changes.map((x, j) => j === i ? e.target.value : x) })} style={{ flex: 1 }} />{form.changes.length > 1 && <button className="iconbtn" onClick={() => setForm({ ...form, changes: form.changes.filter((_, j) => j !== i) })}><Icon name="xmark" /></button>}</div>)}
      {form.changes.length < 10 && <div style={{ marginTop: 6 }}><Button size="sm" icon="plus" onClick={() => setForm({ ...form, changes: [...form.changes, ''] })}>再加一条</Button></div>}
      <div className="small" style={{ marginTop: 10, fontWeight: 600 }}>文件外链（工坊的下载地址或园所网盘，https）</div>
      {form.files.map((f, i) => <div key={i} className="row" style={{ gap: 6, marginTop: 6 }}><TextField placeholder="文件名" value={f.name} onChange={e => setForm({ ...form, files: form.files.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} style={{ flex: 1 }} /><TextField placeholder="https://…" value={f.url} onChange={e => setForm({ ...form, files: form.files.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} style={{ flex: 2 }} /><button className="iconbtn" onClick={() => setForm({ ...form, files: form.files.filter((_, j) => j !== i) })}><Icon name="xmark" /></button></div>)}
      {form.files.length < 20 && <div style={{ marginTop: 6 }}><Button size="sm" icon="link" onClick={() => setForm({ ...form, files: [...form.files, { name: '', url: '' }] })}>加一个文件链接</Button></div>}
      <TextField style={{ marginTop: 10 }} placeholder="教研工坊里这门课的地址（可不填）" value={form.source.url} onChange={e => setForm({ ...form, source: { ...form.source, url: e.target.value } })} />
      <div className="small" style={{ marginTop: 10, fontWeight: 600 }}>给同行留一句话（可不填，80 字内）</div>
      <TextField style={{ marginTop: 6 }} maxLength={80} placeholder="如：第二周换成本班儿歌以后，幼儿自己会唱着做了" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
      <div className="row" style={{ gap: 14, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="small row" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={form.allowAdapt} onChange={e => setForm({ ...form, allowAdapt: e.target.checked })} /> 允许别的老师改编这门课</label>
        <span className="small muted">文件对谁可见</span>
        <div className="chips">{SCOPES.map(([k, t]) => <button key={k} className={'chip' + (form.filesScope === k ? ' on' : '')} onClick={() => setForm({ ...form, filesScope: k })}>{t}</button>)}</div>
      </div>
      {form.filesScope !== 'all' && <div className="small muted" style={{ marginTop: 4 }}>简介与「改了什么」仍是全平台可见，只有文件链接收到{SCOPES.find(([k]) => k === form.filesScope)[1]}。</div>}
      <div className="ac-row" style={{ marginTop: 10 }}><span className="small muted">{form.summary.trim().length} 字</span><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button size="sm" variant="primary" disabled={busy} onClick={save}>{form.draft ? '交给园长' : '交'}</Button></div></div>
    </div>}

    {user && tab === 'all' && <>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <TextField placeholder="搜课程名、简介、改了什么、园所、作者" value={q} onChange={e => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} />
        <span style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--label-3)', display: 'flex' }}><Icon name="magnifier" /></span>
      </div>
      <div className="chips" style={{ marginBottom: 6 }}><button className={'chip' + (!pipeline ? ' on' : '')} onClick={() => setParam('pipeline', null)}>全部管线</button>{PIPES.map(([k, t]) => <button key={k} className={'chip' + (k === pipeline ? ' on' : '')} onClick={() => setParam('pipeline', k === pipeline ? null : k)}>{t}</button>)}</div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {FIVE.map(([k, t]) => <button key={k} className={'chip' + (k === domain ? ' on' : '')} onClick={() => setParam('domain', k === domain ? null : k)}>{t}</button>)}
        <span style={{ width: 8 }} />
        {AGES.map(a => <button key={a} className={'chip' + (a === age ? ' on' : '')} onClick={() => setParam('age', a === age ? null : a)}>{a}</button>)}
      </div>
      {data && !data.works.length && <div className="card small muted">还没有入库的课程成果。{data.total ? '换个筛选试试。' : '在教研工坊做过、班里用过的课，点右上角「分享一门课」交上来；入库记积分，别人用了你看得到。'}</div>}
      <div className="grid2">{data?.works.map(w => card(w))}</div>
    </>}

    {user && tab === 'mine' && <>
      {mine && !mine.works.length && <div className="card small muted">还没交过。退回的可以改了再交。用 Claude 等 Agent 整理的课会先落成草稿到这里，你补「改了什么」再交给园长。</div>}
      <div className="grid2">{mine?.works.map(w => card(w, w.status !== 'approved' && <><Button size="sm" variant={w.status === 'draft' ? 'primary' : undefined} onClick={() => edit(w)}>{w.status === 'draft' ? '补齐并交给园长' : '改'}</Button><Button size="sm" onClick={() => del(w)}>删</Button></>))}</div>
    </>}

    {user && tab === 'queue' && queue && <>
      {queue.director && <div className="sect"><div className="sect-t">本园待同意 · {queue.consent.length}</div>
        {!queue.consent.length && <div className="card small muted">没有待同意的。老师交的课程成果会先到这里，你同意后才进审核。</div>}
        <div className="grid2">{queue.consent.map(w => card(w, <><TextField placeholder="不同意时写一句原因" value={notes[w.id] || ''} onChange={e => setNotes({ ...notes, [w.id]: e.target.value })} style={{ flex: 1, minWidth: 160 }} /><Button size="sm" variant="primary" disabled={busy} onClick={() => decide(w, 'consent')}>同意</Button></>))}</div>
      </div>}
      {queue.curator && <div className="sect"><div className="sect-t">待审核 · {queue.pending.length}</div>
        {!queue.pending.length && <div className="card small muted">没有待审核的。</div>}
        <div className="grid2">{queue.pending.map(w => card(w, <><TextField placeholder="意见（退回必填）" value={notes[w.id] || ''} onChange={e => setNotes({ ...notes, [w.id]: e.target.value })} style={{ flex: 1, minWidth: 160 }} /><Button size="sm" variant="primary" disabled={busy} onClick={() => decide(w, 'approve')}>入库</Button><Button size="sm" disabled={busy} onClick={() => decide(w, 'reject')}>退回</Button></>))}</div>
      </div>}
    </>}
  </div>
}
