// 名师工作室与市级展示（GET /api/studios、/api/showcases）。工作室：管理员建、专家讲师主持、有骨干教师认证的教师申请、
// 主持人收录成员案例为产出。市级展示：一个工作室主持，从各共同体赛入选作品与工作室产出里挑作品上台，每件一段名师点评，
// 可授「年度分享者」；不是赛，没有分数与名次。全平台登录用户可看。
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const toast = m => useUI.getState().toast(m)
const pad = n => String(n).padStart(2, '0')
const toLocal = at => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const post = async (p, body, ok, onDone) => { try { const r = await api(p, { method: 'POST', body: JSON.stringify(body) }); if (ok) toast(ok); onDone && onDone(r) } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } }

function CaseRow({ c, nav, right }) {
  return <div className="lrow"><div style={{ flex: 1 }} className="tap" onClick={() => nav('/cases?q=' + encodeURIComponent(c.title))}><div className="lrow-t">{c.title}</div><div className="small muted">{c.byName}{c.orgName ? ' · ' + c.orgName : ''}{c.age ? ' · ' + c.age : ''}{c.tag ? ' · ' + c.tag : ''}{c.from ? ' · ' + c.from : ''}</div></div>{right}</div>
}

function Studio({ s, data, reload, nav }) {
  const [open, setOpen] = useState(false), [note, setNote] = useState(''), [addUid, setAddUid] = useState(''), [reason, setReason] = useState('')
  return <div className="card" style={{ marginTop: 10, padding: 12, opacity: s.closedAt ? 0.7 : 1 }}>
    <div className="ac-row tap" onClick={() => setOpen(!open)}><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{s.name}{s.closedAt ? <span className="tag" style={{ marginInlineStart: 6 }}>已结</span> : null}</div><div className="small muted">{s.hostName} 主持{s.focus ? ' · ' + s.focus : ''}{s.term ? ' · ' + s.term : ''} · 成员 {s.members.length} · 产出 {s.cases.length} 条{s.mine ? ' · ' + { host: '我主持', member: '我是成员', applicant: '已申请，等主持人' }[s.mine] : ''}</div></div><Icon name={open ? 'chevronUp' : 'chevronDown'} /></div>
    {open && <>
      {s.intro && <div className="small" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{s.intro}</div>}
      <div className="small muted" style={{ marginTop: 8 }}>成员：{s.members.length ? s.members.map(m => m.name + (m.orgName ? '（' + m.orgName + '）' : '')).join('、') : '还没有'}</div>
      {s.canApply && <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}><TextField placeholder="一句话：想在工作室做什么" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} /><Button size="sm" variant="tinted" onClick={() => post('/api/studios/apply', { id: s.id, note }, '已申请，主持人通过后成为成员', reload)}>申请加入</Button></div>}
      {!s.canApply && !s.mine && !s.closedAt && <div className="small muted" style={{ marginTop: 6 }}>{data.eligible ? '' : '申请要有骨干教师认证。'}</div>}
      {s.cases.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">工作室产出</div>{s.cases.map(c => <CaseRow key={c.id} c={c} nav={nav} />)}</div>}
      {s.canHost && <>
        {s.applicants?.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">申请人</div>{s.applicants.map(a => <div key={a.uid} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{a.name}{a.orgName ? '（' + a.orgName + '）' : ''}</div><div className="small muted">{a.note || '没写'} · {fmtDay(a.at)}</div></div><div className="row" style={{ gap: 6 }}><Button size="sm" variant="tinted" onClick={() => post('/api/studios/members', { id: s.id, uid: a.uid, action: 'accept', reason: reason || undefined }, '已通过，授「名师工作室成员」', reload)}>通过</Button><Button size="sm" onClick={() => post('/api/studios/members', { id: s.id, uid: a.uid, action: 'decline' }, '已婉拒', reload)}>婉拒</Button></div></div>)}</div>}
        {s.members.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">成员管理</div>{s.members.map(m => <div key={m.uid} className="lrow"><div style={{ flex: 1 }} className="lrow-t">{m.name}{m.orgName ? '（' + m.orgName + '）' : ''}</div><Button size="sm" onClick={() => window.confirm('移出并撤「名师工作室成员」称号？') && post('/api/studios/members', { id: s.id, uid: m.uid, action: 'remove' }, '已移出', reload)}>移出</Button></div>)}</div>}
        {data.users && <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}><select className="ac-sel" value={addUid} onChange={e => setAddUid(e.target.value)}><option value="">直接加一位成员…</option>{data.users.filter(u => !s.members.some(m => m.uid === u.id)).map(u => <option key={u.id} value={u.id}>{u.name}{u.orgName ? '（' + u.orgName + '）' : ''}</option>)}</select><TextField placeholder="理由（授称号时记下）" value={reason} onChange={e => setReason(e.target.value)} style={{ flex: 1 }} /><Button size="sm" disabled={!addUid} onClick={() => post('/api/studios/members', { id: s.id, uid: addUid, action: 'add', reason }, '已加入', r => { setAddUid(''); reload() })}>加入</Button></div>}
        {s.memberCases?.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">成员的入库案例，可收为产出</div>{s.memberCases.map(c => <CaseRow key={c.id} c={c} nav={nav} right={<Button size="sm" onClick={() => post('/api/studios/cases', { id: s.id, caseIds: [...s.cases.map(x => x.id), c.id] }, '已收录', reload)}>收录</Button>} />)}</div>}
      </>}
    </>}
  </div>
}

function Showcase({ sc, reload, nav, openId }) {
  const [open, setOpen] = useState(openId === sc.id), [full, setFull] = useState(null), [comment, setComment] = useState({}), [sharer, setSharer] = useState({}), [summary, setSummary] = useState('')
  const load = () => api('/api/showcases/one?id=' + sc.id).then(r => setFull(r.showcase)).catch(() => setFull(null))
  useEffect(() => { if (open) load() }, [open, sc.entries.length, sc.closedAt, sc.sharers.length])
  const d = full || sc
  const done = r => { setFull(r.showcase); reload() }
  return <div className="card" style={{ marginTop: 10, padding: 12 }}>
    <div className="ac-row tap" onClick={() => setOpen(!open)}><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{sc.title}{sc.closedAt ? <span className="tag" style={{ marginInlineStart: 6 }}>已收官</span> : null}</div><div className="small muted">{sc.studioName} 主持 · {fmtDay(sc.at)}{sc.place ? ' · ' + sc.place : ''}{sc.theme ? ' · ' + sc.theme : ''} · 上台 {sc.entryCount} 件{sc.sharers.length ? ' · 年度分享者 ' + sc.sharers.map(x => x.name).join('、') : ''}</div></div><Icon name={open ? 'chevronUp' : 'chevronDown'} /></div>
    {open && <>
      {d.note && <div className="small" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{d.note}</div>}
      {d.summary && <div className="small" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>收官：{d.summary}</div>}
      <div style={{ marginTop: 10 }}><div className="small muted">上台作品{d.canHost && !d.closedAt ? '（按出场顺序）' : ''}</div>
        {!d.entries.length && <div className="lrow small muted">{d.canHost ? (d.pool?.length ? '从下面的候选池挑。' : '候选池还是空的：共同体赛收官有入选作品、或工作室收录产出后出现；也可在案例库另选。') : '主持人还没定。'}</div>}
        {d.entries.map((c, i) => <div key={c.id} className="lrow" style={{ display: 'block' }}>
          <div className="ac-row"><div style={{ flex: 1 }} className="tap" onClick={() => nav('/cases?q=' + encodeURIComponent(c.title))}><div className="lrow-t">{i + 1}. {c.title}{c.mine ? <span className="tag" style={{ marginInlineStart: 6, color: 'var(--acc)' }}>我的</span> : null}</div><div className="small muted">{c.byName}{c.orgName ? ' · ' + c.orgName : ''}{c.communityName ? ' · ' + c.communityName : ''}{c.tag ? ' · ' + c.tag : ''}</div></div>{d.canHost && !d.closedAt && <Button size="sm" onClick={() => post('/api/showcases/entries', { id: sc.id, caseIds: d.entries.filter(x => x.id !== c.id).map(x => x.id) }, '已撤下', done)}>撤下</Button>}</div>
          {c.comment ? <div className="small" style={{ marginTop: 6, padding: '8px 10px', background: 'color-mix(in srgb,var(--acc) 7%,transparent)', borderRadius: 8, whiteSpace: 'pre-wrap' }}><b>名师点评</b>（{c.comment.byName}）：{c.comment.text}</div> : null}
          {d.canHost && !d.closedAt && <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'flex-start' }}><TextArea rows={2} placeholder={c.comment ? '改点评' : '名师点评：这件作品好在哪、换一个班怎么调；对作品不对人'} value={comment[c.id] ?? ''} onChange={e => setComment({ ...comment, [c.id]: e.target.value })} style={{ flex: 1 }} /><Button size="sm" variant="tinted" disabled={(comment[c.id] || '').trim().length < 10} onClick={() => post('/api/showcases/comment', { id: sc.id, caseId: c.id, text: comment[c.id] }, '已记点评', r => { setComment({ ...comment, [c.id]: '' }); done(r) })}>记</Button></div>}
        </div>)}
      </div>
      {d.sharers.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">年度分享者</div>{d.sharers.map(x => <div key={x.uid} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{x.name}{x.orgName ? '（' + x.orgName + '）' : ''}</div><div className="small muted">{x.reason}</div></div></div>)}</div>}
      {d.canHost && !d.closedAt && <>
        {d.pool?.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">候选池：各共同体赛入选作品与工作室产出（也可在案例库另选）</div>{d.pool.map(c => <CaseRow key={c.id} c={c} nav={nav} right={<Button size="sm" onClick={() => post('/api/showcases/entries', { id: sc.id, caseIds: [...d.entries.map(x => x.id), c.id] }, '已上台', done)}>上台</Button>} />)}</div>}
        {d.entries.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">授「年度分享者」（只能授上台作品的作者，留理由）</div>{[...new Map(d.entries.map(c => [c.byName, c])).values()].map(c => <div key={c.id} className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}><span className="small" style={{ minWidth: 60 }}>{c.byName}</span><TextField placeholder="理由" value={sharer[c.id] ?? ''} onChange={e => setSharer({ ...sharer, [c.id]: e.target.value })} style={{ flex: 1 }} /><Button size="sm" disabled={(sharer[c.id] || '').trim().length < 5} onClick={() => post('/api/showcases/sharer', { id: sc.id, uid: c.byUid, reason: sharer[c.id] }, '已授', done)}>授</Button></div>)}</div>}
        <div className="row" style={{ gap: 8, marginTop: 12, alignItems: 'center' }}><TextField placeholder="收官一句话（可空）" value={summary} onChange={e => setSummary(e.target.value)} style={{ flex: 1 }} /><Button size="sm" variant="primary" disabled={!d.entries.length} onClick={() => window.confirm('收官后上台案例标「市级展示 · ' + sc.year + '」，不能再改。确定？') && post('/api/showcases/close', { id: sc.id, summary }, '已收官', done)}>收官</Button></div>
      </>}
    </>}
  </div>
}

export default function Studios() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [sp] = useSearchParams()
  const [data, setData] = useState(null), [shows, setShows] = useState(null), [form, setForm] = useState(null), [sform, setSform] = useState(null), [busy, setBusy] = useState(false)
  const load = () => { if (!user) return; api('/api/studios').then(setData).catch(() => setData(null)); api('/api/showcases').then(setShows).catch(() => setShows(null)) }
  useEffect(() => { load() }, [user?.id])
  const saveStudio = async () => {
    if (form.name.trim().length < 2 || !form.hostUid) return toast('写名称、选主持人')
    setBusy(true); await post('/api/studios', { ...form, id: form.id || undefined }, form.id ? '已改' : '已建', () => { setForm(null); load() }); setBusy(false)
  }
  const saveShow = async () => {
    if (sform.title.trim().length < 2 || !sform.studioId) return toast('写标题、选主持的工作室')
    setBusy(true); await post('/api/showcases', { ...sform, at: new Date(sform.date + 'T09:00').getTime() }, '已建', () => { setSform(null); load() }); setBusy(false)
  }
  return <div className="narrow">
    <div className="hdr"><div><h1>名师工作室</h1><div className="sub">市级 · 专家讲师主持，骨干教师参加，产出园本案例 · 每年一次市级展示</div></div><div className="hdr-actions">{data?.canManage && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ name: '', focus: '', term: '', intro: '', hostUid: '' })}>建工作室</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后可见。</div>}
    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><TextField placeholder="工作室名，如「张老师工作室」" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ flex: 2, minWidth: 180 }} /><TextField placeholder="方向，如 游戏活动支持与引导" value={form.focus} onChange={e => setForm({ ...form, focus: e.target.value })} style={{ flex: 2, minWidth: 160 }} /><TextField placeholder="学期" value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} style={{ flex: 1, minWidth: 90 }} /></div>
      <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}><span className="small muted">主持人</span><select className="ac-sel" value={form.hostUid} onChange={e => setForm({ ...form, hostUid: e.target.value })}><option value="">选一位平台用户…</option>{(data?.users || []).map(u => <option key={u.id} value={u.id}>{u.name}{u.orgName ? '（' + u.orgName + '）' : ''}</option>)}</select></div>
      <TextArea rows={2} style={{ marginTop: 8 }} placeholder="简介：做什么、产出什么（可空）" value={form.intro} onChange={e => setForm({ ...form, intro: e.target.value })} />
      <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={saveStudio}>建</Button></div></div>
    </div>}
    {data && <>
      {!data.studios.length && <div className="card small muted">还没有工作室。{data.canManage ? '点右上角「建工作室」。' : '本地运营方建，专家讲师主持。'}</div>}
      {data.studios.map(s => <Studio key={s.id} s={s} data={data} reload={load} nav={nav} />)}
    </>}
    {shows && <div className="sect"><div className="sect-t ac-row">市级展示 <span className="small muted">每年一次 · 作品与名师点评 · 没有分数与名次</span>{shows.canHost && !sform && <Button size="sm" variant="tinted" icon="plus" onClick={() => setSform({ studioId: shows.studios[0]?.id || '', year: String(new Date().getFullYear()), title: '', theme: '', date: toLocal(Date.now() + 30 * 86400000), place: '', note: '' })}>办一场</Button>}</div>
      {sform && <div className="card" style={{ marginBottom: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><select className="ac-sel" value={sform.studioId} onChange={e => setSform({ ...sform, studioId: e.target.value })}>{shows.studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><TextField placeholder="年份" value={sform.year} onChange={e => setSform({ ...sform, year: e.target.value })} style={{ width: 80 }} /><input className="ac-sel" type="date" value={sform.date} onChange={e => setSform({ ...sform, date: e.target.value })} /></div>
        <TextField style={{ marginTop: 8 }} placeholder="标题，如「2026 柳州学前教育市级展示」" value={sform.title} onChange={e => setSform({ ...sform, title: e.target.value })} />
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}><TextField placeholder="主题（可空）" value={sform.theme} onChange={e => setSform({ ...sform, theme: e.target.value })} style={{ flex: 2, minWidth: 160 }} /><TextField placeholder="地点（可空）" value={sform.place} onChange={e => setSform({ ...sform, place: e.target.value })} style={{ flex: 1, minWidth: 120 }} /></div>
        <TextArea rows={2} style={{ marginTop: 8 }} placeholder="说明（可空）" value={sform.note} onChange={e => setSform({ ...sform, note: e.target.value })} />
        <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setSform(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={saveShow}>建</Button></div></div>
      </div>}
      {!shows.showcases.length && <div className="card small muted">还没有市级展示。{shows.canHost ? '点「办一场」。' : '由名师工作室主持，各共同体赛的入选作品上台。'}</div>}
      {shows.showcases.map(sc => <Showcase key={sc.id} sc={sc} reload={load} nav={nav} openId={sp.get('show')} />)}
    </div>}
    <div className="small muted" style={{ marginTop: 14 }}>三级赛制：园内赛 → 共同体赛 → 市级展示。展示不评分、不排名、不按园统计；上台案例在案例库标「市级展示」。</div>
  </div>
}
