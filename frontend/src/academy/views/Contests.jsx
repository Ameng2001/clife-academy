// 斗课——同课异构擂台：园内赛与共同体赛（区县管理员面向一个跨园共同体出题，跨园编组互评）。主持人（园长、点评人）出题；教师自愿应战交活动设计＋≤3 分钟片段；截止后同园互评（量表五项＋一句话，实名）；
// 主持人编组、写对照点评、定入选、收官——全部作品进案例库。分数不公开：作者看自己的，主持人看平均分，别人看不到。
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { uploadMedia } from '../../lib/upload.js'
import { DOMAINS } from '../../lib/capability.js'
import { fmtDay } from './common.jsx'

const toast = m => useUI.getState().toast(m)
const AGES = ['小班', '中班', '大班', '混龄']
const PHASE = { open: '应战中', review: '互评与点评', done: '已收官' }
const pad = n => String(n).padStart(2, '0')
const toLocal = at => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const EMPTY = () => ({ id: null, month: new Date().toISOString().slice(0, 7), title: '', age: '中班', activity: '', goal: '', guide: '', domain: 'plan', due: toLocal(Date.now() + 14 * 86400000), review: toLocal(Date.now() + 21 * 86400000) })

function Stars({ v, onChange }) { return <span style={{ display: 'inline-flex', gap: 2 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} className="tap" style={{ color: n <= (v || 0) ? 'var(--orange)' : 'var(--label-3)', fontSize: 18 }} onClick={() => onChange?.(n)}>★</span>)}</span> }

function Entry({ e, c, onRated, onToggleSelect }) {
  const [scores, setScores] = useState(e.myRating?.scores || [0, 0, 0, 0, 0]), [comment, setComment] = useState(e.myRating?.comment || ''), [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const rate = async () => {
    if (scores.some(s => !s)) return toast('五项都打分')
    if (!comment.trim()) return toast('写一句对作品的话')
    setBusy(true)
    try { await api('/api/contests/rate', { method: 'POST', body: JSON.stringify({ entryId: e.id, scores, comment }) }); toast(e.myRating ? '已改' : '已评，只有作者和主持人看得到'); onRated() } catch (err) { toast('没成' + (err.message ? '：' + err.message : '')) } finally { setBusy(false) }
  }
  return <div className="card" style={{ marginTop: 8, padding: 12, ...(e.selected ? { borderInlineStart: '3px solid var(--acc)' } : {}) }}>
    <div className="ac-row tap" onClick={() => setOpen(!open)}>
      <div><span style={{ fontWeight: 600 }}>{e.name}</span>{e.orgName && <span className="small muted"> · {e.orgName}</span>}{e.mine && <span className="small muted"> · 我的</span>}{e.group && <span className="small muted"> · 第 {e.group} 组</span>}{e.selected && <span className="tag" style={{ marginInlineStart: 6, color: 'var(--acc)' }}>入选</span>}{c.phase === 'done' && e.caseId && <span className="small muted"> · 已进案例库</span>}</div>
      <span className="small muted">{e.ratingsCount ? `${e.ratingsCount} 人评 · ` : ''}{e.avg != null ? `均 ${e.avg} · ` : ''}{fmtDay(e.updatedAt)} <Icon name={open ? 'chevronUp' : 'chevronDown'} /></span>
    </div>
    {open && e.design && <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{e.design}</div>}
    {open && e.note && <div className="small" style={{ marginTop: 6, color: 'var(--label-2)' }}>反思：{e.note}</div>}
    {open && e.video && <div style={{ marginTop: 8 }}><video controls preload="metadata" src={`api/contests/file?id=${e.id}`} style={{ width: '100%', maxHeight: 280, borderRadius: 8, background: '#000' }} /></div>}
    {open && e.mine && e.ratings?.length > 0 && <div style={{ marginTop: 10, paddingTop: 8, borderTop: 'var(--hair) solid var(--sep)' }}>
      <div className="small muted">{c.level === 'community' ? '共同体同行' : '同事'}的评价（只有你看得到）</div>
      {e.ratings.map((r, i) => <div key={i} className="small" style={{ marginTop: 4 }}>{r.byName}：{c.rubric.map((k, j) => `${k} ${r.scores[j]}`).join(' · ')}<br /><span style={{ color: 'var(--label-2)' }}>{r.comment}</span></div>)}
    </div>}
    {open && e.canRate && <div style={{ marginTop: 10, paddingTop: 8, borderTop: 'var(--hair) solid var(--sep)' }}>
      <div className="small muted">{e.myRating ? '我的评价（可改）' : '评这份作品 · 每一项对作品不对人 · 实名'}</div>
      {c.rubric.map((k, j) => <div key={k} className="ac-row" style={{ marginTop: 4 }}><span className="small">{k}</span><Stars v={scores[j]} onChange={n => setScores(s => s.map((x, i) => i === j ? n : x))} /></div>)}
      <div className="row" style={{ gap: 8, marginTop: 8 }}><TextField placeholder="一句话：好在哪、可以怎么调" value={comment} onChange={ev => setComment(ev.target.value)} style={{ flex: 1 }} /><Button size="sm" variant="primary" disabled={busy} onClick={rate}>交</Button></div>
    </div>}
    {open && onToggleSelect && c.phase === 'review' && <div style={{ marginTop: 8 }}><Button size="sm" variant={e.selected ? 'tinted' : undefined} icon={e.selected ? 'checkCircle' : 'star'} onClick={() => onToggleSelect(e)}>{e.selected ? '已入选，取消' : '定为入选'}</Button></div>}
  </div>
}

function Contest({ c, user, onChange }) {
  const [design, setDesign] = useState(c.mine?.design || ''), [note, setNote] = useState(c.mine?.note || ''), [video, setVideo] = useState(null), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false)
  const [reviewText, setReviewText] = useState({}), [summary, setSummary] = useState('')
  const fileRef = useRef()
  const dname = DOMAINS.find(d => d.key === c.domain)?.name || c.domain
  const enter = async () => {
    if (design.trim().length < 100) return toast('活动设计至少 100 字：目标、环节、材料')
    setBusy(true)
    try { await api('/api/contests/enter', { method: 'POST', body: JSON.stringify({ id: c.id, design, note, video: video ? { hash: video.hash, name: video.name, type: video.type } : undefined }) }); toast(c.mine ? '已改' : '已应战'); setEditing(false); setVideo(null); onChange() }
    catch (e) { toast('没交成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  const pick = async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); try { setVideo(await uploadMedia(f)) } catch (err) { toast(err.status === 413 || err.code === 'too-large' ? '片段太大，压到 3 分钟以内再传' : '上传失败' + (err.message ? '：' + err.message : '')) } finally { setBusy(false) } }
  const host = async (p, body, ok) => { setBusy(true); try { await api(p, { method: 'POST', body: JSON.stringify({ id: c.id, ...body }) }); toast(ok); onChange() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  const toggleSelect = e => host('/api/contests/select', { entryIds: e.selected ? c.list.filter(x => x.selected && x.id !== e.id).map(x => x.id) : [...c.list.filter(x => x.selected).map(x => x.id), e.id] }, e.selected ? '已取消' : '已定为入选')
  const groups = c.groups.length ? c.groups : (c.list?.length ? [{ n: 0, entryIds: c.list.map(e => e.id), review: null }] : [])
  return <div className="card" style={{ marginTop: 12 }}>
    <div className="small muted">{c.level === 'community' ? '共同体赛 · ' + (c.communityName || '') + ' · ' : ''}{c.month} · {dname} · {c.age} · {PHASE[c.phase]} · {c.phase === 'open' ? `${fmtDay(c.dueAt)} 截止` : c.phase === 'review' ? `${fmtDay(c.reviewAt)} 前互评` : fmtDay(c.closedAt)} · {c.entries} 人应战{c.selectedCount ? ` · 入选 ${c.selectedCount}` : ''}</div>
    <div style={{ fontWeight: 700, fontSize: 18, margin: '4px 0', lineHeight: 1.35 }}>{c.title}</div>
    <div style={{ fontSize: 15, lineHeight: 1.5 }}>活动：{c.activity}<br />目标：{c.goal}</div>
    {c.guide && <div className="small" style={{ marginTop: 4, color: 'var(--label-2)' }}>《指南》：{c.guide}</div>}
    <div className="small muted" style={{ marginTop: 6 }}>{c.byName} 出题 · 自愿参加 · 评作品不评人 · 票数与分数不公开，只公布入选作品与点评 · 不与考核挂钩</div>

    {c.phase === 'open' && c.canEnter === false && !c.mine && <div className="small muted" style={{ marginTop: 10 }}>{c.level === 'community' ? '主持人不应战；共同体各园老师在这里交作品。' : '这场不面向你的园。'}</div>}
    {c.phase === 'open' && c.canEnter !== false && <div style={{ marginTop: 12 }}>
      {c.mine && !editing ? <div className="card" style={{ padding: 12 }}>
        <div className="ac-row"><span className="small muted">我的作品 · {fmtDay(c.mine.updatedAt)}{c.mine.video ? ' · 有片段' : ''}</span><Button size="sm" onClick={() => setEditing(true)}>改</Button></div>
        <div style={{ marginTop: 6, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.mine.design}</div>
      </div> : <>
        <div className="small muted">应战：一份活动设计（目标、环节、材料、≥100 字）＋ 一段 ≤ 3 分钟实施片段（幼儿不露脸，拍教师与材料）。截止前别人看不到你的设计。</div>
        <TextArea rows={8} style={{ marginTop: 8 }} placeholder="活动设计" value={design} onChange={e => setDesign(e.target.value)} />
        <TextField style={{ marginTop: 8 }} placeholder="一句反思（可不填）" value={note} onChange={e => setNote(e.target.value)} />
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {video ? <span className="chip" onClick={() => setVideo(null)}><Icon name="play" /> {video.name || '片段'} ×</span> : <Button size="sm" icon="camera" disabled={busy} onClick={() => fileRef.current?.click()}>{c.mine?.video ? '换片段' : '传片段'}</Button>}
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={pick} />
          <span style={{ flex: 1 }} /><span className="small muted">{design.trim().length} 字</span>
          {editing && <Button size="sm" onClick={() => setEditing(false)}>取消</Button>}<Button variant="primary" disabled={busy} onClick={enter}>{c.mine ? '保存' : '应战'}</Button>
        </div>
      </>}
    </div>}

    {c.phase !== 'open' && c.list && <div style={{ marginTop: 12 }}>
      {groups.map(g => <div key={g.n} style={{ marginTop: g.n ? 12 : 0 }}>
        {g.n > 0 && <div className="small muted">第 {g.n} 组 · {g.entryIds.length} 份</div>}
        {g.entryIds.map(id => c.list.find(e => e.id === id)).filter(Boolean).map(e => <Entry key={e.id} e={e} c={c} onRated={onChange} onToggleSelect={c.canHost ? toggleSelect : null} />)}
        {g.review && <div className="card" style={{ marginTop: 8, padding: 12, background: 'color-mix(in srgb,var(--acc) 8%,transparent)' }}><div className="small muted">同课异构对照 · {g.review.byName} · {fmtDay(g.review.at)}</div><div style={{ marginTop: 4, fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{g.review.text}</div></div>}
        {c.canHost && c.phase === 'review' && g.n > 0 && <div className="row" style={{ gap: 8, marginTop: 8 }}><TextArea rows={3} placeholder="这一组的对照：三份设计各自好在哪、换一个班怎么调（≥50 字）" value={reviewText[g.n] ?? g.review?.text ?? ''} onChange={e => setReviewText({ ...reviewText, [g.n]: e.target.value })} style={{ flex: 1 }} /><Button size="sm" disabled={busy} onClick={() => host('/api/contests/review', { group: g.n, text: reviewText[g.n] ?? g.review?.text ?? '' }, '已写对照')}>存</Button></div>}
      </div>)}
      {c.summary && <div className="small" style={{ marginTop: 10, color: 'var(--label-2)', whiteSpace: 'pre-wrap' }}>收官：{c.summary}</div>}
    </div>}

    {c.canHost && c.phase !== 'done' && <div style={{ marginTop: 12, paddingTop: 10, borderTop: 'var(--hair) solid var(--sep)' }}>
      <div className="small muted">主持人</div>
      <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {c.phase === 'open' && <Button size="sm" disabled={busy} onClick={() => confirm('现在截止应战？之后进入互评。') && host('/api/contests', { month: c.month, title: c.title, age: c.age, activity: c.activity, goal: c.goal, guide: c.guide, domain: c.domain, dueAt: Date.now() - 1 }, '已截止')}>提前截止</Button>}
        {c.phase === 'review' && <Button size="sm" disabled={busy} onClick={() => host('/api/contests/group', {}, c.level === 'community' ? '已跨园编组，每组 3–4 人、不同园搭配' : '已按报名顺序编组，每组 3–4 人')}>{c.groups.length ? '重新编组' : c.level === 'community' ? '跨园编组' : '编组'}</Button>}
        {c.phase === 'review' && <><TextField placeholder="收官一句话（可不填）" value={summary} onChange={e => setSummary(e.target.value)} style={{ flex: 1, minWidth: 160 }} /><Button size="sm" variant="primary" icon="trophy" disabled={busy} onClick={() => confirm(`收官？${c.entries} 份作品全部进案例库（入选 ${c.selectedCount}），每份 +2 学分。`) && host('/api/contests/close', { summary }, '已收官，作品都在案例库了')}>收官</Button></>}
        {c.phase === 'open' && <Button size="sm" disabled={busy} onClick={() => confirm('删掉这场？报名的作品也一起删。') && host('/api/contests/delete', {}, '已删')}>删</Button>}
      </div>
    </div>}
  </div>
}

export default function Contests() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [sp] = useSearchParams()
  const [data, setData] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false), [openId, setOpenId] = useState(sp.get('id'))
  const [communityId, setCommunityId] = useState('')
  const [detail, setDetail] = useState({})
  const load = async () => { if (!user) return setData(null); try { const d = await api('/api/contests'); setData(d); const ids = [...d.current, ...d.past].map(c => c.id); const got = {}; for (const id of ids) got[id] = (await api('/api/contests/one?id=' + id)).contest; setDetail(got) } catch { setData(null) } }
  useEffect(() => { load() }, [user?.id])
  const save = async () => {
    if (!form.title.trim() || !form.activity.trim() || !form.goal.trim()) return toast('主题、活动名、目标都要写')
    if (data?.hostScope === 'community' && !communityId) return toast('选一个共同体')
    setBusy(true)
    try { await api('/api/contests', { method: 'POST', body: JSON.stringify({ month: form.month, title: form.title, age: form.age, activity: form.activity, goal: form.goal, guide: form.guide, domain: form.domain, dueAt: new Date(form.due + 'T23:59').getTime(), reviewAt: new Date(form.review + 'T23:59').getTime(), communityId: communityId || undefined }) }); toast(data?.hostScope === 'community' ? '已发布，共同体各园老师能看到' : '已发布，本园老师能看到了'); setForm(null); load() }
    catch (e) { toast('没存成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  const all = data ? [...data.current, ...data.past] : []
  return <div className="narrow">
    <div className="hdr"><div><h1>斗课</h1><div className="sub">同课异构擂台 · {data?.hostScope === 'community' ? '共同体赛' : '园内赛与共同体赛'} · 自愿参加，评作品不评人</div></div><div className="hdr-actions">{data?.canHost && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm(EMPTY())}>出题</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后参加。园内可见。</div>}

    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>出题 · {data?.hostScope === 'community' ? '共同体赛：面向本区一个共同体，各园教师应战，截止后跨园编组互评 · ' : ''}每月一个主题，按年龄班给定活动名与目标，附《指南》条目 · 第 1 周发布、第 3 周截止、第 4 周互评与点评</div>
      {data?.hostScope === 'community' && <select className="ac-sel" value={communityId} onChange={e => setCommunityId(e.target.value)} style={{ marginBottom: 8, width: '100%' }}><option value="">选共同体</option>{(data.communities || []).map(x => <option key={x.id} value={x.id}>{x.name} · {x.orgs.join('、')}</option>)}</select>}
      <TextField placeholder="主题，如「中班科学：影子从哪来」" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <TextField placeholder="活动名" value={form.activity} onChange={e => setForm({ ...form, activity: e.target.value })} style={{ flex: 2, minWidth: 140 }} />
        <select className="ac-sel" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })}>{AGES.map(a => <option key={a}>{a}</option>)}</select>
        <select className="ac-sel" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>{DOMAINS.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}</select>
      </div>
      <TextArea rows={2} style={{ marginTop: 8 }} placeholder="活动目标" value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} />
      <TextField style={{ marginTop: 8 }} placeholder="《指南》对应条目（可不填）" value={form.guide} onChange={e => setForm({ ...form, guide: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="small muted">月份</span><input className="ac-sel" type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} />
        <span className="small muted">截止</span><input className="ac-sel" type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
        <span className="small muted">互评到</span><input className="ac-sel" type="date" value={form.review} onChange={e => setForm({ ...form, review: e.target.value })} />
      </div>
      <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>发布</Button></div></div>
    </div>}

    {data && !all.length && <div className="card small muted">{data.hostScope === 'community' ? '本区还没办过共同体赛。' : '本园还没办过斗课。'}{data.canHost ? '点右上角「出题」。' : data.hostScope === 'community' ? '先在区县看板建共同体。' : '园长或教研主任出题后在这里应战。'}</div>}
    {all.map(c => { const d = detail[c.id] || c; return <div key={c.id}>
      {openId === c.id || all.length === 1 ? <Contest c={d} user={user} onChange={load} /> : <div className="card tap" style={{ marginTop: 12 }} onClick={() => setOpenId(c.id)}><div className="ac-row"><div><div className="small muted">{c.month} · {PHASE[c.phase]} · {c.entries} 人应战{c.selectedCount ? ` · 入选 ${c.selectedCount}` : ''}</div><div style={{ fontWeight: 600, marginTop: 2 }}>{c.title}</div></div><Icon name="chevronRight" /></div></div>}
    </div> })}
  </div>
}
