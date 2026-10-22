// 答疑：问种子教师 ＋ 答疑助手（GET/POST /api/questions …）。每关底部「问一问」进来；助手只整理与起草，不聊天；
// 种子教师确认草稿或自己答，提问人采纳；两个工作日没人答转本地讲师。同园或共同体可见已答的，不做公共广场。
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const toast = m => useUI.getState().toast(m)
const STATUS = { open: '等回答', answered: '已采纳', closed: '已解决' }

/** 助手整理卡：归类、概括、草稿（标把握与引用）、材料。 */
export function AssistantCard({ q, sources, onConfirm }) {
  const a = q.assistant
  const [edit, setEdit] = useState(null)
  if (!a) return null
  const src = sources || a.sources || []
  return <div className="card" style={{ marginTop: 10, padding: 12, background: 'color-mix(in srgb,var(--acc) 7%,transparent)' }}>
    <div className="ac-row"><span className="small" style={{ fontWeight: 600 }}><Icon name="sparkles" /> 答疑助手整理{a.categoryLabel ? ' · ' + a.categoryLabel : ''}</span>{a.confidence && <span className="tag" style={{ color: a.confidence === 'high' ? 'var(--acc)' : 'var(--orange)' }}>{a.confidence === 'high' ? '把握较大' : '把握不大'}</span>}</div>
    {a.summary && <div className="small" style={{ marginTop: 4, color: 'var(--label-2)' }}>概括：{a.summary}</div>}
    {a.draft && <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{a.draft}</div>}
    {a.note && <div className="small muted" style={{ marginTop: 6 }}>{a.note}</div>}
    {src.length > 0 && <div style={{ marginTop: 8 }}>
      <div className="small muted">材料</div>
      {src.map((s, i) => <details key={s.kind + s.id} className="small" style={{ marginTop: 4 }}><summary className="tap">[{i + 1}] {s.title}</summary>{s.text && <div style={{ whiteSpace: 'pre-wrap', color: 'var(--label-2)', marginTop: 4 }}>{s.text}</div>}</details>)}
    </div>}
    {onConfirm && a.draft && (edit == null
      ? <div className="row" style={{ gap: 8, marginTop: 8 }}><Button size="sm" variant="tinted" onClick={() => onConfirm(a.draft)}>确认这条草稿为我的回答</Button><Button size="sm" onClick={() => setEdit(a.draft)}>改一改再确认</Button></div>
      : <div style={{ marginTop: 8 }}><TextArea rows={4} value={edit} onChange={e => setEdit(e.target.value)} /><div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setEdit(null)}>取消</Button><Button size="sm" variant="primary" onClick={() => onConfirm(edit)}>确认</Button></div></div>)}
  </div>
}

export function Question({ q, onChange, open: open0 }) {
  const nav = useNavigate()
  const [open, setOpen] = useState(!!open0), [detail, setDetail] = useState(null), [text, setText] = useState(''), [busy, setBusy] = useState(false), [note, setNote] = useState('')
  useEffect(() => { if (open) api('/api/questions/one?id=' + q.id).then(setDetail).catch(() => setDetail(null)) }, [open, q.answers.length, q.status])
  const post = async (p, body, ok) => { setBusy(true); try { await api(p, { method: 'POST', body: JSON.stringify({ id: q.id, ...body }) }); toast(ok); onChange() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  const d = detail?.question || q
  return <div className="card" style={{ marginTop: 10, padding: 12, ...(q.escalated && q.status === 'open' ? { borderInlineStart: '3px solid var(--orange)' } : {}) }}>
    <div className="ac-row tap" onClick={() => setOpen(!open)}>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 600, lineHeight: 1.4 }}>{q.text}</div><div className="small muted" style={{ marginTop: 2 }}>{q.mine ? '我' : q.name + (q.orgName ? ' · ' + q.orgName : '')} · {fmtDay(q.at)} · <span className="tap" style={{ color: 'var(--acc)' }} onClick={e => { e.stopPropagation(); nav('/level/' + q.levelId) }}>{q.pathName} 第 {Number(q.levelId.split(/-(?=\d+$)/)[1]) + 1} 关「{q.levelTitle}」</span> · {STATUS[q.status]}{q.escalated && q.status === 'open' ? ' · 已转本地讲师' : ''}{q.answers.length ? ` · ${q.answers.length} 条回答` : ''}</div></div>
      <Icon name={open ? 'chevronUp' : 'chevronDown'} />
    </div>
    {open && <>
      <AssistantCard q={d} sources={detail?.sources} onConfirm={d.canAnswer ? t => post('/api/questions/confirm', { text: t }, '已确认，署你的名') : null} />
      {d.answers.map(a => <div key={a.id} className="card" style={{ marginTop: 8, padding: 12, ...(a.accepted ? { borderInlineStart: '3px solid var(--acc)' } : {}) }}>
        <div className="ac-row"><span className="small muted">{a.byName} · {a.roleLabel}{a.fromAssistant ? ' · 据助手草稿确认' : ''} · {fmtDay(a.at)}</span>{a.accepted ? <span className="tag" style={{ color: 'var(--acc)' }}>已采纳</span> : d.mine && d.status !== 'closed' ? <Button size="sm" variant="tinted" disabled={busy} onClick={() => post('/api/questions/accept', { answerId: a.id }, '已采纳')}>采纳</Button> : null}</div>
        <div style={{ marginTop: 6, fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{a.text}</div>
      </div>)}
      {d.canAnswer && <div style={{ marginTop: 10 }}><TextArea rows={3} placeholder="写回答：先说做法，再说依据；不出现幼儿姓名" value={text} onChange={e => setText(e.target.value)} /><div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}><Button size="sm" variant="primary" disabled={busy || text.trim().length < 5} onClick={() => post('/api/questions/answer', { text }, '已回答').then(() => setText(''))}>回答</Button></div></div>}
      {d.mine && d.status === 'open' && <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'center' }}><TextField placeholder="已解决？写一句怎么解决的（可空）" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} /><Button size="sm" disabled={busy} onClick={() => post('/api/questions/close', { note }, '已标已解决')}>已解决</Button></div>}
      {d.resolvedNote && <div className="small muted" style={{ marginTop: 6 }}>提问人：{d.resolvedNote}</div>}
    </>}
  </div>
}

export default function Questions() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [sp] = useSearchParams()
  const [data, setData] = useState(null), [tab, setTab] = useState(sp.get('tab') || 'mine')
  const load = () => { if (user) api('/api/questions').then(setData).catch(() => setData(null)); else setData(null) }
  useEffect(() => { load() }, [user?.id])
  useEffect(() => { if (data?.canAnswer && !sp.get('tab') && !sp.get('id') && data.queue.length && !data.mine.length) setTab('queue') }, [data?.canAnswer])
  const list = data ? (tab === 'queue' ? data.queue : data.mine) : []
  return <div className="narrow wide">
    <div className="hdr"><div><h1>答疑</h1><div className="sub">每关底部问 · 助手整理，种子教师回答 · 两个工作日没人答转本地讲师</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!user && <div className="card small muted">登录后在关卡页底部提问。</div>}
    {data && <>
      <div className="chips" style={{ marginBottom: 10 }}><button className={'chip' + (tab === 'mine' ? ' on' : '')} onClick={() => setTab('mine')}>我的提问 {data.mine.length}</button>{data.canAnswer && <button className={'chip' + (tab === 'queue' ? ' on' : '')} onClick={() => setTab('queue')}>待我回答 {data.queue.length}{data.escalated ? ` · 转讲师 ${data.escalated}` : ''}</button>}</div>
      {!data.assistantConfigured && <div className="small muted" style={{ marginBottom: 8 }}>这台服务器没接模型：助手只做整理（相似问题、本关要点、相关案例），回答由种子教师写。</div>}
      {!list.length && <div className="card small muted">{tab === 'queue' ? '没有待答的。' : '还没提问。打开任一关，底部「问一问」。'}</div>}
      {list.map(q => <Question key={q.id} q={q} onChange={load} open={sp.get('id') === q.id} />)}
      <div className="small muted" style={{ marginTop: 14 }}>全部实名；本园与共同体内可见已答的问题；助手不聊天、不生成观察记录、不评价幼儿。</div>
    </>}
  </div>
}

/** 关卡底部的「问一问」：本关我的提问、本园已答的、输入时的相似提示。 */
export function AskBox({ levelId }) {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [d, setD] = useState(null), [text, setText] = useState(''), [similar, setSimilar] = useState([]), [busy, setBusy] = useState(false)
  const load = () => { if (user) api('/api/questions?level=' + levelId).then(setD).catch(() => setD(null)) }
  useEffect(() => { load() }, [user?.id, levelId])
  useEffect(() => { if (!user || text.trim().length < 4) { setSimilar([]); return } const t = setTimeout(() => api(`/api/questions/similar?levelId=${levelId}&q=${encodeURIComponent(text.trim())}`).then(r => setSimilar(r.sources)).catch(() => setSimilar([])), 350); return () => clearTimeout(t) }, [text])
  const ask = async () => {
    setBusy(true)
    try { const r = await api('/api/questions', { method: 'POST', body: JSON.stringify({ levelId, text }) }); toast(r.question.assistant?.draft ? '助手起了草稿，种子教师确认后回复你' : '已提交，助手整理了材料，等种子教师回答'); setText(''); nav('/questions?id=' + r.question.id) }
    catch (e) { toast(e.code === 'limit' ? '开放中的提问已有五条，先等回答' : '没提交成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  if (!user) return <div className="sect"><div className="sect-t">问一问</div><div className="card small muted">登录后可以就本关提问，本园种子教师回答。</div></div>
  return <div className="sect"><div className="sect-t">问一问 <span className="small muted">本关疑问 · 助手整理 · 种子教师回答</span></div>
    <div className="card">
      {d?.mine.map(q => <div key={q.id} className="lrow tap" onClick={() => nav('/questions?id=' + q.id)}><div style={{ flex: 1 }}><div className="lrow-t">{q.text}</div><div className="small muted">{STATUS[q.status]}{q.answers.length ? ` · ${q.answers.length} 条回答` : q.assistant?.draft ? ' · 助手有草稿，等确认' : ''}</div></div><Icon name="chevronRight" /></div>)}
      {d?.faq.map(q => <div key={q.id} className="lrow tap" onClick={() => nav('/questions?id=' + q.id)}><div style={{ flex: 1 }}><div className="lrow-t">{q.text}</div><div className="small muted">{q.name} 问过 · {q.answers.find(a => a.accepted)?.text.slice(0, 60)}</div></div><Icon name="chevronRight" /></div>)}
      <TextArea rows={2} placeholder="对本关有疑问？写具体一点：在哪一步、看到什么" value={text} onChange={e => setText(e.target.value)} style={{ marginTop: d?.mine.length || d?.faq.length ? 8 : 0 }} />
      {similar.length > 0 && <div className="small" style={{ marginTop: 6 }}><span className="muted">先看看这些：</span>{similar.map(s => <div key={s.kind + s.id} className="tap" style={{ marginTop: 4, color: 'var(--acc)' }} onClick={() => s.kind === 'question' ? nav('/questions?id=' + s.id) : nav('/cases?q=' + encodeURIComponent(s.title.replace(/^案例：/, '')))}>{s.title}</div>)}</div>}
      <div className="ac-row" style={{ marginTop: 8 }}><span className="small muted">{d?.assistantConfigured ? '助手会先按本关要点与相似问题起草，种子教师确认后回复。' : '助手整理材料，本园种子教师回答。'}</span><Button size="sm" variant="primary" disabled={busy || text.trim().length < 5} onClick={ask}>提问</Button></div>
    </div>
  </div>
}
