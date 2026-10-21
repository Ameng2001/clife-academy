// 园长大讲堂：每月一场。直播在第三方，这里只做预约、回放列表、讲义。排场是管理员（本地运营方）的事。
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

function Card({ l, first, user, onBook, onEdit, onDelete }) {
  const toast = useUI.getState().toast
  const nav = useNavigate()
  const tone = first ? { background: 'var(--acc)', color: '#fff' } : {}
  const sub = first ? { opacity: .85 } : { color: 'var(--label-2)' }
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
      {onEdit && <><Button size="sm" onClick={() => onEdit(l)}>改</Button><Button size="sm" onClick={() => onDelete(l)}>删</Button></>}
    </div>
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
  return <div className="narrow">
    <div className="hdr"><div><h1>园长大讲堂</h1><div className="sub">每月一场 · 安排在午睡时段 · 直播后有回放与讲义</div></div><div className="hdr-actions">{data?.canEdit && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ ...EMPTY })}>排一场</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>

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
    {data?.upcoming.map((l, i) => <Card key={l.id} l={l} first={i === 0} user={user} onBook={book} onEdit={data.canEdit ? edit : null} onDelete={del} />)}
    {data?.done.length > 0 && <div className="sect" style={{ marginTop: 18 }}><div className="sect-t">回放 · {data.done.length}</div>
      {data.done.map(l => <Card key={l.id} l={l} user={user} onBook={book} onEdit={data.canEdit ? edit : null} onDelete={del} />)}
    </div>}
    <div className="small muted" style={{ marginTop: 16 }}>提醒只在你预约的那一场开播前 30 分钟发一条，在小程序里打开订阅。</div>
  </div>
}
