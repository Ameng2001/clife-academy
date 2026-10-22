// 名师讲堂：每月一场。直播在第三方，这里只做预约、回放列表、讲义，加一个讲堂包（讲前预习卡、讲后微课切片与知识海报）。排场与讲堂包是管理员（本地运营方）的事。
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { uploadMedia } from '../../lib/upload.js'

const pad = n => String(n).padStart(2, '0')
const WD = ['日', '一', '二', '三', '四', '五', '六']
export const fmtWhen = (at, minutes) => { const d = new Date(at), e = new Date(at + (minutes || 60) * 60000); return `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${WD[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}—${pad(e.getHours())}:${pad(e.getMinutes())}` }
const toLocal = at => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
const A = { display: 'inline-flex', width: 'auto' }
const EMPTY = { id: null, title: '', desc: '', who: '园长', speaker: '', when: '', minutes: 60, liveUrl: '', replayUrl: '', slidesUrl: '', slidesFile: null, notes: '', caseIds: [], titleIds: [] }

// 讲堂包（管理员）：贴讲稿→生成草稿（预习卡要点、微课切片、海报）→改定→存。规则切段，接了模型只改措辞。
const lines = v => String(v || '').split('\n').map(x => x.trim()).filter(Boolean)
function PackEditor({ l, onDone }) {
  const toast = useUI.getState().toast
  const p = l.pack
  const [script, setScript] = useState(p?.script || ''), [busy, setBusy] = useState(false)
  const [points, setPoints] = useState((p?.preview?.points || []).join('\n')), [clips, setClips] = useState(p?.clips || []), [headline, setHeadline] = useState(p?.poster?.headline || l.title), [plines, setPlines] = useState((p?.poster?.lines || []).join('\n'))
  useEffect(() => { if (p) { setPoints((p.preview?.points || []).join('\n')); setClips(p.clips || []); setHeadline(p.poster?.headline || l.title); setPlines((p.poster?.lines || []).join('\n')); setScript(p.script || '') } }, [p?.draftedAt, p?.updatedAt])
  const draft = async () => { if (script.trim().length < 40) return toast('讲稿至少 40 字'); setBusy(true); try { await api('/api/lectures/pack/draft', { method: 'POST', body: JSON.stringify({ id: l.id, script }) }); toast('草稿出来了，改完存'); onDone() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  const save = async () => { setBusy(true); try { await api('/api/lectures/pack', { method: 'POST', body: JSON.stringify({ id: l.id, pack: { preview: { points: lines(points) }, clips: clips.filter(c => c.title.trim()), poster: { headline, lines: lines(plines) } } }) }); toast('已存'); onDone(true) } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  const remove = async () => { if (!confirm('删掉这场的讲堂包？')) return; try { await api('/api/lectures/pack', { method: 'POST', body: JSON.stringify({ id: l.id, pack: null }) }); onDone(true) } catch (e) { toast('没成') } }
  const setClip = (i, k, v) => setClips(cs => cs.map((c, j) => j === i ? { ...c, [k]: v } : c))
  return <div className="card" style={{ marginTop: 8, padding: 12, background: 'var(--bg-2, var(--card))', color: 'var(--label)' }}>
    <div className="small muted">讲堂包 · 讲稿贴进来，规则切出预习卡、微课切片、海报{p ? (p.model ? ' · 模型改过措辞' : ' · 规则草稿') : ''}。只搬讲稿里的话，不加内容。</div>
    <TextArea rows={5} style={{ marginTop: 6 }} placeholder="讲稿或提纲：小标题单独一行，段落之间空一行，切得准" value={script} onChange={e => setScript(e.target.value)} />
    <div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}><Button size="sm" variant={p ? undefined : 'primary'} disabled={busy} onClick={draft}>{busy ? '在切…' : p ? '重新生成草稿' : '生成讲堂包草稿'}</Button></div>
    {p && <>
      <div className="small muted" style={{ marginTop: 8 }}>讲前 · 预习卡要点（一行一条，最多 5 条）</div>
      <TextArea rows={4} style={{ marginTop: 4 }} value={points} onChange={e => setPoints(e.target.value)} />
      <div className="small muted" style={{ marginTop: 8 }}>讲后 · 微课切片（最多 6 条，讲完才对外；回放里的起点秒数可不填）</div>
      {clips.map((c, i) => <div key={c.id || i} className="row" style={{ gap: 6, marginTop: 4, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField placeholder="切片标题" value={c.title} onChange={e => setClip(i, 'title', e.target.value)} style={{ flex: 1, minWidth: 140 }} />
        <TextField type="number" placeholder="起点秒" value={c.start ?? ''} onChange={e => setClip(i, 'start', e.target.value === '' ? null : Number(e.target.value))} style={{ width: 90 }} />
        <TextArea rows={2} placeholder="一句话简介" value={c.desc} onChange={e => setClip(i, 'desc', e.target.value)} style={{ flexBasis: '100%' }} />
      </div>)}
      {clips.length < 6 && <div style={{ marginTop: 4 }}><Button size="sm" onClick={() => setClips([...clips, { id: 'c' + (clips.length + 1), title: '', desc: '', start: null }])}>加一条切片</Button></div>}
      <div className="small muted" style={{ marginTop: 8 }}>讲后 · 知识海报（标题＋几行字，讲完才对外）</div>
      <TextField style={{ marginTop: 4 }} placeholder="海报标题" value={headline} onChange={e => setHeadline(e.target.value)} />
      <TextArea rows={4} style={{ marginTop: 4 }} placeholder="一行一条，最多 6 条" value={plines} onChange={e => setPlines(e.target.value)} />
      <div className="row" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><Button size="sm" onClick={remove}>删包</Button><Button size="sm" onClick={() => onDone(true)}>收起</Button><Button size="sm" variant="primary" disabled={busy} onClick={save}>存</Button></div>
    </>}
  </div>
}

// 知识海报：一张卡，讲完才有
function Poster({ poster, lecture }) {
  if (!poster?.headline) return null
  return <div style={{ marginTop: 10, borderRadius: 14, padding: '14px 16px', background: 'linear-gradient(135deg, var(--acc), color-mix(in srgb, var(--acc) 55%, #1c3b33))', color: '#fff' }}>
    <div className="small" style={{ opacity: .8 }}>名师讲堂 · 知识海报</div>
    <div style={{ fontWeight: 800, fontSize: 19, margin: '4px 0 8px', lineHeight: 1.3 }}>{poster.headline}</div>
    {poster.lines?.map((x, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.6 }}>· {x}</div>)}
    <div className="small" style={{ opacity: .7, marginTop: 8 }}>{lecture.speaker ? lecture.speaker + ' 主讲 · ' : ''}{fmtWhen(lecture.at, lecture.minutes).split(' 周')[0]}</div>
  </div>
}

function Card({ l, first, user, onBook, onEdit, onDelete, onChange }) {
  const toast = useUI.getState().toast
  const nav = useNavigate()
  const [packOpen, setPackOpen] = useState(false)
  const tone = first ? { background: 'var(--acc)', color: '#fff' } : {}
  const sub = first ? { opacity: .85 } : { color: 'var(--label-2)' }
  const pk = l.pack
  return <div className="card" style={{ marginTop: 10, ...tone }}>
    <div className="small" style={sub}>{first ? '下一场 · ' : ''}{fmtWhen(l.at, l.minutes)}{l.phase === 'live' ? ' · 正在直播' : ''}</div>
    <div style={{ fontWeight: 700, fontSize: 18, margin: '4px 0', lineHeight: 1.35 }}>{l.title}</div>
    {l.desc && <div className="small" style={{ ...sub, whiteSpace: 'pre-wrap' }}>{l.desc}</div>}
    <div className="small" style={{ ...sub, marginTop: 6 }}>{l.speaker ? l.speaker + ' 主讲 · ' : ''}适合：{l.who || '园长'}{l.bookings ? ` · ${l.bookings} 人预约` : ''}</div>
    <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
      {l.phase === 'done'
        ? (l.replayUrl ? <a className="btn btn-sm" style={A} href={l.replayUrl} target="_blank" rel="noreferrer"><Icon name="play" /> 看回放</a> : <span className="small" style={sub}>回放整理中</span>)
        : <>
          <Button size="sm" variant={first ? undefined : 'primary'} style={first ? { background: '#fff', color: 'var(--acc)' } : {}} icon={l.booked ? 'bellSlash' : 'bell'} onClick={() => user ? onBook(l, !l.booked) : toast('登录后才能预约')}>{l.booked ? '已预约 · 开播前提醒' : '预约直播'}</Button>
          {l.phase === 'live' && l.liveUrl && <a className="btn btn-sm" style={A} href={l.liveUrl} target="_blank" rel="noreferrer"><Icon name="play" /> 进直播</a>}
          {l.phase === 'upcoming' && l.liveUrl && l.booked && <a className="small" style={sub} href={l.liveUrl} target="_blank" rel="noreferrer">直播链接</a>}
        </>}
      {l.slides?.url && <a className="btn btn-sm" style={A} href={l.slides.url} target="_blank" rel="noreferrer"><Icon name="clipboard" /> 讲义</a>}
      {l.slides?.file && <a className="btn btn-sm" style={A} href={`api/lectures/file?id=${l.id}`} target="_blank" rel="noreferrer"><Icon name="clipboard" /> 讲义</a>}
      {onEdit && <><Button size="sm" style={first ? { background: 'rgba(255,255,255,.18)', color: '#fff' } : {}} onClick={() => onEdit(l)}>改</Button><Button size="sm" style={first ? { background: 'rgba(255,255,255,.18)', color: '#fff' } : {}} onClick={() => onDelete(l)}>删</Button><Button size="sm" style={first ? { background: 'rgba(255,255,255,.18)', color: '#fff' } : {}} onClick={() => setPackOpen(o => !o)}>{pk ? '讲堂包' : '做讲堂包'}</Button></>}
    </div>
    {pk?.preview?.points?.length > 0 && <div className="small" style={{ marginTop: 10, ...sub }}><div style={{ fontWeight: 600 }}>{l.phase === 'done' ? '这场讲了' : '讲前先看'}</div>{pk.preview.points.map((x, i) => <div key={i} style={{ lineHeight: 1.6 }}>{i + 1}. {x}</div>)}</div>}
    {l.phase === 'done' && pk?.clips?.length > 0 && <div className="small" style={{ marginTop: 10, ...sub }}><div style={{ fontWeight: 600 }}>微课切片 · {pk.clips.length} 条<span className="tap" style={{ marginInlineStart: 8, textDecoration: 'underline', fontWeight: 400 }} onClick={() => nav('/library?q=' + encodeURIComponent(l.title.slice(0, 8)))}>精品微课里也有</span></div>
      {pk.clips.map(c => <div key={c.id} style={{ marginTop: 4 }}>{l.replayUrl ? <a href={l.replayUrl + (c.start ? '#t=' + c.start : '')} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{c.title}</a> : <span>{c.title}</span>}{c.start ? <span style={{ opacity: .7 }}> · {Math.floor(c.start / 60)}′{String(c.start % 60).padStart(2, '0')}″</span> : null}{c.desc ? <div style={{ opacity: .85 }}>{c.desc}</div> : null}</div>)}
    </div>}
    {l.phase === 'done' && <Poster poster={pk?.poster} lecture={l} />}
    {packOpen && onEdit && <PackEditor l={l} onDone={close => { onChange(); if (close === true) setPackOpen(false) }} />}
    {l.sharers?.length > 0 && <div className="small" style={{ marginTop: 8, ...sub }}>分享者：{l.sharers.map(s => s.name + (s.orgName ? '（' + s.orgName + '）' : '') + (s.caseTitle ? '《' + s.caseTitle + '》' : '')).join('、')} · 各 10 分钟</div>}
    {l.notes && l.phase === 'done' && <div className="small" style={{ marginTop: 10, whiteSpace: 'pre-wrap', ...sub }}>{l.notes}</div>}
    {l.showcase?.length > 0 && <div className="small" style={{ marginTop: 10, ...sub }}><Icon name="sparkles" /> 展示案例：{l.showcase.map(c => <span key={c.id} className="tap" style={{ textDecoration: 'underline', marginInlineEnd: 8 }} onClick={e => { e.stopPropagation(); nav('/cases?q=' + encodeURIComponent(c.title)) }}>《{c.title}》{c.byName}</span>)}</div>}
    {l.honors?.length > 0 && <div className="small" style={{ marginTop: 6, ...sub }}><Icon name="crown" /> 颁发：{l.honors.map(h => `${h.name} · ${h.label}`).join('；')}</div>}
    {l.bookedBy?.length > 0 && <div className="small" style={{ marginTop: 8, ...sub }}>预约：{l.bookedBy.join('、')}</div>}
  </div>
}

export default function Lectures() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [data, setData] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false)
  const fileRef = useRef()
  // 排场时可选：展示哪些入库案例、颁哪些称号（管理员才拿得到这两张表）
  const [pool, setPool] = useState({ cases: [], titles: [] })
  useEffect(() => { if (form && data?.canEdit && !pool.cases.length && !pool.titles.length) Promise.all([api('/api/cases').catch(() => ({ cases: [] })), api('/api/org/titles').catch(() => ({ titles: [] }))]).then(([c, t]) => setPool({ cases: c.cases || [], titles: t.titles || [] })) }, [form, data?.canEdit])
  const toggleId = (k, id) => setForm(f => ({ ...f, [k]: f[k].includes(id) ? f[k].filter(x => x !== id) : [...f[k], id] }))
  const load = () => api('/api/lectures').then(setData).catch(() => useUI.getState().toast('没取到场次'))
  useEffect(() => { load() }, [user?.id])
  const [sharers, setSharers] = useState(null), [inviteTo, setInviteTo] = useState('')
  useEffect(() => { if (user?.admin) api('/api/lectures/sharers').then(setSharers).catch(() => setSharers(null)) }, [user?.id])
  const invite = async (s, caseId) => { const id = inviteTo || data?.upcoming[0]?.id; if (!id) return useUI.getState().toast('先排一场'); try { await api('/api/lectures/invite', { method: 'POST', body: JSON.stringify({ id, uid: s.uid, caseId: caseId || undefined }) }); useUI.getState().toast(`已邀 ${s.name} 上讲堂，授「年度分享者」`); load(); api('/api/lectures/sharers').then(setSharers) } catch (e) { useUI.getState().toast('没成' + (e.message ? '：' + e.message : '')) } }
  const book = async (l, on) => {
    try { const r = await api('/api/lectures/book', { method: 'POST', body: JSON.stringify({ id: l.id, on }) }); useUI.getState().toast(on ? (r.remind ? '已预约，开播前 30 分钟提醒' : '已预约，开播前提醒在小程序里打开') : '已取消预约'); load() }
    catch (e) { useUI.getState().toast('没成' + (e.message ? '：' + e.message : '')) }
  }
  const edit = l => setForm({ id: l.id, title: l.title, desc: l.desc, who: l.who, speaker: l.speaker, when: toLocal(l.at), minutes: l.minutes, liveUrl: l.liveUrl || '', replayUrl: l.replayUrl || '', slidesUrl: l.slides?.url || '', slidesFile: l.slides?.file ? { ...l.slides.file, keep: true } : null, notes: l.notes || '', caseIds: (l.showcase || []).map(c => c.id), titleIds: (l.honors || []).map(h => h.id) })
  const del = async l => { if (!confirm(`删掉「${l.title}」？`)) return; try { await api('/api/lectures/delete', { method: 'POST', body: JSON.stringify({ id: l.id }) }); load() } catch (e) { useUI.getState().toast('没删成' + (e.message ? '：' + e.message : '')) } }
  const save = async () => {
    if (!form.title.trim()) return useUI.getState().toast('写个标题')
    const at = new Date(form.when).getTime()
    if (!at) return useUI.getState().toast('选开播时间')
    const body = { id: form.id || undefined, title: form.title, desc: form.desc, who: form.who, speaker: form.speaker, at, minutes: Number(form.minutes) || 60, liveUrl: form.liveUrl, replayUrl: form.replayUrl, notes: form.notes, caseIds: form.caseIds, titleIds: form.titleIds }
    if (form.slidesUrl.trim()) body.slides = { url: form.slidesUrl.trim() }
    else if (form.slidesFile && !form.slidesFile.keep) body.slides = { file: { hash: form.slidesFile.hash, name: form.slidesFile.name, type: form.slidesFile.type, size: form.slidesFile.size } }
    else if (!form.slidesFile) body.slides = null
    setBusy(true)
    try { await api('/api/lectures', { method: 'POST', body: JSON.stringify(body) }); useUI.getState().toast(form.id ? '已改' : '已排上'); setForm(null); load() }
    catch (e) { useUI.getState().toast('没存成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const pick = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    setBusy(true)
    try { const m = await uploadMedia(f); setForm(x => ({ ...x, slidesFile: m, slidesUrl: '' })) } catch (err) { useUI.getState().toast('上传失败' + (err.message ? '：' + err.message : '')) } finally { setBusy(false) }
  }
  return <div className="narrow wide">
    <div className="hdr"><div><h1>名师讲堂</h1><div className="sub">每月一场 · 安排在午睡时段 · 直播后有回放与讲义</div></div><div className="hdr-actions">{data?.canEdit && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ ...EMPTY })}>排一场</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>

    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>{form.id ? '改这场' : '排一场'} · 直播放第三方（腾讯会议、视频号），这里填链接</div>
      <TextField placeholder="标题" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <TextArea rows={3} style={{ marginTop: 8 }} placeholder="讲什么、答疑多久" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <TextField placeholder="主讲" value={form.speaker} onChange={e => setForm({ ...form, speaker: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
        <TextField placeholder="适合：园长、保健医" value={form.who} onChange={e => setForm({ ...form, who: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="ac-sel" type="datetime-local" value={form.when} onChange={e => setForm({ ...form, when: e.target.value })} style={{ flex: 2, minWidth: 180 }} />
        <TextField type="number" placeholder="分钟" value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} style={{ width: 90 }} />
      </div>
      <TextField style={{ marginTop: 8 }} placeholder="直播链接 https://…" value={form.liveUrl} onChange={e => setForm({ ...form, liveUrl: e.target.value })} />
      <TextField style={{ marginTop: 8 }} placeholder="回放链接 https://…（直播后补）" value={form.replayUrl} onChange={e => setForm({ ...form, replayUrl: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField placeholder="讲义链接 https://…" value={form.slidesUrl} onChange={e => setForm({ ...form, slidesUrl: e.target.value, slidesFile: e.target.value ? null : form.slidesFile })} style={{ flex: 1, minWidth: 160 }} />
        {form.slidesFile ? <span className="chip" onClick={() => setForm({ ...form, slidesFile: null })} title="点一下移除"><Icon name="image" /> {form.slidesFile.name || '讲义图'} ×</span> : <Button size="sm" icon="image" disabled={busy} onClick={() => fileRef.current?.click()}>或传讲义图</Button>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      </div>
      <TextArea rows={3} style={{ marginTop: 8 }} placeholder="要点整理（直播后补，回放卡片上显示）" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      {pool.cases.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">这场展示的案例（斗课入选、分享者案例）</div><div className="chips" style={{ marginTop: 4 }}>{pool.cases.slice(0, 40).map(c => <button key={c.id} className={'chip' + (form.caseIds.includes(c.id) ? ' on' : '')} onClick={() => toggleId('caseIds', c.id)}>{c.title.slice(0, 16)} · {c.byName}</button>)}</div></div>}
      {pool.titles.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">这场颁发的称号</div><div className="chips" style={{ marginTop: 4 }}>{pool.titles.slice(0, 40).map(t => <button key={t.id} className={'chip' + (form.titleIds.includes(t.id) ? ' on' : '')} onClick={() => toggleId('titleIds', t.id)}>{t.name} · {t.label}</button>)}</div></div>}
      <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>存</Button></div></div>
    </div>}

    {data && !data.upcoming.length && <div className="card small muted">下一场还没排。{data.canEdit ? '点右上角「排一场」。' : '排上了会在这里和首页出现。'}</div>}
    {data?.upcoming.slice(0, 1).map(l => <Card key={l.id} l={l} first user={user} onBook={book} onEdit={data.canEdit ? edit : null} onDelete={del} onChange={load} />)}
    <div className="grid2">{data?.upcoming.slice(1).map(l => <Card key={l.id} l={l} user={user} onBook={book} onEdit={data.canEdit ? edit : null} onDelete={del} onChange={load} />)}</div>
    {data?.done.length > 0 && <div className="sect" style={{ marginTop: 18 }}><div className="sect-t">回放 · {data.done.length}</div>
      <div className="grid2">{data.done.map(l => <Card key={l.id} l={l} user={user} onBook={book} onEdit={data.canEdit ? edit : null} onDelete={del} onChange={load} />)}</div>
    </div>}
    {sharers && <div className="sect" style={{ marginTop: 18 }}><div className="sect-t">分享者候选 <span className="small muted">被「用过，有效」≥ {sharers.usesMin} 次或入库 ≥ {sharers.casesMin} 条或入选 · 邀请用的名单，不公开</span></div>
      {data?.upcoming.length > 1 && <div className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}><span className="small muted">邀到哪一场</span><select className="ac-sel" value={inviteTo} onChange={e => setInviteTo(e.target.value)}>{data.upcoming.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select></div>}
      <div className="sect-b">
        {!sharers.candidates.length && <div className="lrow small muted">还没有达到条件的分享者。</div>}
        {sharers.candidates.map(s => <div key={s.uid} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{s.name}{s.orgName ? ' · ' + s.orgName : ''}{s.sharer ? <span className="tag" style={{ marginInlineStart: 6 }}>年度分享者</span> : null}</div><div className="small muted">入库 {s.cases} 条 · 被用 {s.uses} 次{s.selected ? ` · 入选 ${s.selected}` : ''}{s.invited.length ? ` · 已邀：${s.invited.join('、')}` : ''}</div><div className="chips" style={{ marginTop: 4 }}>{s.caseList.map(c => <button key={c.id} className="chip" onClick={() => invite(s, c.id)}>邀讲《{c.title.slice(0, 14)}》· 被用 {c.uses}</button>)}</div></div><Button size="sm" onClick={() => invite(s)}>邀上讲堂</Button></div>)}
      </div></div>}
    <div className="small muted" style={{ marginTop: 16 }}>提醒只在你预约的那一场开播前 30 分钟发一条，在小程序里打开订阅。</div>
  </div>
}
