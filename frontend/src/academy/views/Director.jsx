// 园长看板：本园各岗位在大课堂里的学习情况（GET /api/org/summary）。
// 只按岗位汇总与补训建议；人员列表只有通过关数与最近学习日期，没有测验分；不跨园、不排名（docs/ROADMAP.md 第八节）。
// 探针体检卡：GET /api/org/checkup（views/Checkup.jsx 的 CheckupCard）。
import { useEffect, useState } from 'react'
import { useUI } from '../../store/useUI.js'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { api } from '../../lib/api.js'
import { CheckupCard } from './Checkup.jsx'
import Icon from '../../components/Icon.jsx'
import { Button, TextField } from '../../components/ui.jsx'
import { fmtDay } from './common.jsx'

export default function Director() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [data, setData] = useState(null), [err, setErr] = useState(null), [busy, setBusy] = useState(false)
  const [pairs, setPairs] = useState([]), [mentor, setMentor] = useState(''), [mentee, setMentee] = useState('')
  const loadPairs = async () => { try { setPairs((await api('/api/org/pairs')).pairs) } catch { /* 403 等：不显示 */ } }
  const addPair = async () => {
    if (!mentor || !mentee) return
    setBusy(true)
    try { const r = await api('/api/org/pairs', { method: 'PUT', body: JSON.stringify({ mentor, mentee }) }); useUI.getState().toast(r.replaced ? '已换带教教师' : '已配对'); setMentor(''); setMentee(''); await loadPairs() }
    catch (e) { useUI.getState().toast('没配成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const endPair = async p => {
    setBusy(true)
    try { await api('/api/org/pairs/end', { method: 'POST', body: JSON.stringify({ id: p.id }) }); useUI.getState().toast('已结束'); await loadPairs() }
    catch (e) { useUI.getState().toast('没结束成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const load = async () => {
    setBusy(true)
    try { setData(await api('/api/org/summary')); setErr(null) }
    catch (e) { setErr(e) }
    finally { setBusy(false) }
  }
  useEffect(() => { if (user) { load(); loadPairs() } }, [user?.id])
  const [checkup, setCheckup] = useState(null)
  useEffect(() => { if (user) api('/api/org/checkup').then(setCheckup).catch(() => setCheckup(null)) }, [user?.id])
  const [titles, setTitles] = useState(null), [titleFor, setTitleFor] = useState(null), [titleKey, setTitleKey] = useState('seed'), [titleLabel, setTitleLabel] = useState(''), [reason, setReason] = useState('')
  const loadTitles = () => api('/api/org/titles').then(setTitles).catch(() => setTitles(null))
  const [certs, setCerts] = useState(null)
  useEffect(() => { if (user) api('/api/org/certificates').then(setCerts).catch(() => setCerts(null)) }, [user?.id])
  useEffect(() => { if (user) loadTitles() }, [user?.id])
  const grantTitle = async () => {
    if (reason.trim().length < 5) return useUI.getState().toast('写授予理由，至少 5 字')
    setBusy(true)
    try { await api('/api/org/titles', { method: 'POST', body: JSON.stringify({ uid: titleFor.id, title: titleKey, label: titleLabel, reason }) }); useUI.getState().toast(`已记：${titleFor.name} · ${titleKey === 'custom' ? titleLabel : titles.titleNames[titleKey]}。颁发安排在大讲堂或园内活动上。`); setTitleFor(null); setReason(''); setTitleLabel(''); loadTitles() }
    catch (e) { useUI.getState().toast('没成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const revokeTitle = async t => { if (!confirm(`撤回 ${t.name} 的「${t.label}」？`)) return; try { await api('/api/org/titles/revoke', { method: 'POST', body: JSON.stringify({ id: t.id }) }); loadTitles() } catch (e) { useUI.getState().toast('没成' + (e.message ? '：' + e.message : '')) } }
  const setReviewer = async m => {
    setBusy(true)
    try { await api('/api/org/reviewer', { method: 'PUT', body: JSON.stringify({ uid: m.id, reviewer: !m.reviewer }) }); useUI.getState().toast(m.reviewer ? `${m.name} 不再是点评人` : `${m.name} 已设为点评人`); await load() }
    catch (e) { useUI.getState().toast('没改成' + (e.message ? '：' + e.message : '')); setBusy(false) }
  }

  const head = <div className="hdr">
    <div><h1>园长看板</h1><div className="sub">{data?.org?.name || user?.academy?.org?.name || '本园'}{data ? ` · ${fmtDay(data.at)}` : ''}</div></div>
    <div className="hdr-actions"><button className="iconbtn" disabled={busy} onClick={load}><Icon name="repeat" /></button><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
  </div>

  if (!user) return <div className="narrow">{head}<div className="card small muted">登录园长账号后可看本园情况。</div></div>
  if (err) return <div className="narrow">{head}<div className="card small">{err.status === 403 ? '这页只给园长看。岗位由平台账号决定。' : err.status === 401 ? '登录已过期，请重新登录。' : '没取到数据' + (err.message ? '：' + err.message : '')}</div></div>
  if (!data) return <div className="narrow">{head}<div className="card small muted">正在取数…</div></div>

  const roles = data.roles.filter(r => r.members > 0)
  const needs = roles.filter(r => r.next && r.finished < r.members).sort((a, b) => a.rate - b.rate)
  return <div className="narrow">
    {head}
    <div className="tiles">
      <div className="tile"><div className="l"><Icon name="personCircle" />本园在学</div><div className="v">{data.members_total}<span className="small muted"> 人</span></div></div>
      <div className="tile"><div className="l"><Icon name="checkCircle" />本周通关</div><div className="v">{data.passes7d}<span className="small muted"> 关</span></div></div>
    </div>

    <div className="sect"><div className="sect-t">各岗位完成情况</div><div className="sect-b">
      {!roles.length && <div className="lrow small muted">还没有本园教师登录过大课堂。</div>}
      {roles.map(r => <div key={r.role} className="lrow">
        <div style={{ flex: 1 }}>
          <div className="lrow-t">{r.name}<span className="small muted" style={{ marginInlineStart: 8 }}>{r.members} 人 · 完成 {r.finished} · 在学 {r.started} · 未开始 {r.members - r.finished - r.started}</span></div>
          <div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${r.rate}%` }} /></div>
        </div>
        <span className="small muted" style={{ marginInlineStart: 12, minWidth: 56, textAlign: 'end' }}>{r.rate}%<br />{r.avgDone}/{r.total} 关</span>
      </div>)}
    </div></div>

    <div className="sect"><div className="sect-t">补训建议</div><div className="sect-b">
      {!needs.length && <div className="lrow small muted">各岗位都已完成，或还没有人开始。</div>}
      {needs.map(r => <div key={r.role} className="lrow tap" onClick={() => nav('/level/' + r.next.levelId)}>
        <div style={{ flex: 1 }}><div className="lrow-t">{r.name}：{r.next.count} 人停在「{r.next.title}」</div><div className="small muted">建议午睡时段集中学这一关，由种子教师陪练。</div></div>
        <Icon name="chevronRight" />
      </div>)}
    </div></div>

    <div className="sect"><div className="sect-t">本园人员</div><div className="sect-b">
      {data.members.map(m => <div key={m.id} className="lrow">
        <div style={{ flex: 1 }}><div className="lrow-t">{m.name}<span className="small muted" style={{ marginInlineStart: 8 }}>{m.roleName}</span>{m.reviewer && <span className="tag" style={{ marginInlineStart: 8 }}>点评人</span>}</div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${m.total ? m.done / m.total * 100 : 0}%` }} /></div></div>
        <span className="small muted" style={{ marginInlineStart: 12, minWidth: 72, textAlign: 'end' }}>{m.done}/{m.total} 关<br />{m.lastAt ? fmtDay(m.lastAt) : '未开始'}</span>
        {m.id !== user.id && m.role !== 'director' && <button className={'chip' + (m.reviewer ? ' on' : '')} style={{ marginInlineStart: 10 }} disabled={busy} title={m.reviewer ? '取消点评人' : '设为点评人'} onClick={() => setReviewer(m)}>{m.reviewer ? '取消' : '设为点评人'}</button>}
        {m.id !== user.id && <button className="chip" style={{ marginInlineStart: 6 }} disabled={busy} onClick={() => { setTitleFor(m); setReason('') }}>授称号</button>}
      </div>)}
      {titleFor && <div className="lrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div className="small muted">给 {titleFor.name} 授荣誉称号 · 写清理由，颁发在大讲堂或园内活动上，这里只是记录</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select className="ac-sel" value={titleKey} onChange={e => setTitleKey(e.target.value)}>{Object.entries(titles?.titleNames || {}).map(([k, v]) => <option key={k} value={k}>{k === 'custom' ? '自定…' : v}</option>)}</select>
          {titleKey === 'custom' && <TextField placeholder="称号名" value={titleLabel} onChange={e => setTitleLabel(e.target.value)} style={{ width: 140 }} />}
          <TextField placeholder="授予理由" value={reason} onChange={e => setReason(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <Button size="sm" onClick={() => setTitleFor(null)}>取消</Button><Button size="sm" variant="primary" disabled={busy} onClick={grantTitle}>记下</Button>
        </div>
      </div>}
      {titles?.titles.length > 0 && <div className="lrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
        <div className="small muted">已授称号</div>
        {titles.titles.map(t => <div key={t.id} className="ac-row small"><span><Icon name="crown" /> {t.name} · {t.label}<span className="muted"> · {t.byName} · {fmtDay(t.at)} · {t.reason}</span></span><button className="chip" onClick={() => revokeTitle(t)}>撤回</button></div>)}
      </div>}
      <div className="lrow small muted">点评人能看本园的点评队列、按量表点评实践关的提交。一般是种子教师或教研主任；园长本来就能点评。</div>
    </div></div>

    {certs && <div className="sect"><div className="sect-t">本园证书 <span className="small muted">岗位认证 {certs.counts.tool} · 领域研修 {certs.counts.domain} · 骨干 {certs.counts.backbone}</span></div><div className="sect-b">
      {!certs.certificates.length && <div className="lrow small muted">还没有人拿到证书。岗位数智应用认证走完本岗位路径自动发；领域研修证书要作品全部通过点评。</div>}
      {certs.certificates.slice(0, 20).map(c => <div key={c.id} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t"><Icon name="checkCircle" /> {c.name} · {c.label}</div><div className="small muted">{fmtDay(c.at)} · 编号 {c.no}</div></div></div>)}
      <div className="lrow small muted">只记级别与日期，没有分数；不跨园比较，不作考核依据。</div>
    </div></div>}

    <div className="sect"><div className="sect-t">带教配对</div><div className="sect-b">
      {!pairs.length && <div className="lrow small muted">还没有配对。带教教师能看到、能点评所带教师的实践关作品。</div>}
      {pairs.map(p => <div key={p.id} className="lrow">
        <div style={{ flex: 1 }}><div className="lrow-t">{p.mentor.name} 带 {p.mentee.name}</div><div className="small muted">{fmtDay(p.at)} 起</div></div>
        <button className="chip" disabled={busy} onClick={() => endPair(p)}>结束</button>
      </div>)}
      {data.members.length > 1 && <div className="lrow" style={{ gap: 8, flexWrap: 'wrap' }}>
        <select className="ac-sel" value={mentor} onChange={e => setMentor(e.target.value)} style={{ flex: 1, minWidth: 120 }}><option value="">带教教师</option>{data.members.filter(m => m.id !== mentee).map(m => <option key={m.id} value={m.id}>{m.name} · {m.roleName}</option>)}</select>
        <span className="small muted">带</span>
        <select className="ac-sel" value={mentee} onChange={e => setMentee(e.target.value)} style={{ flex: 1, minWidth: 120 }}><option value="">新教师</option>{data.members.filter(m => m.id !== mentor && m.role !== 'director').map(m => <option key={m.id} value={m.id}>{m.name} · {m.roleName}</option>)}</select>
        <Button size="sm" variant="tinted" disabled={busy || !mentor || !mentee} onClick={addPair}>配对</Button>
      </div>}
    </div></div>

    <div className="sect"><div className="sect-t">点评</div>
      <div className="lrow tap" onClick={() => nav('/review')}><div style={{ flex: 1 }}><div className="lrow-t">实践关待点评</div><div className="small muted">本园老师交的观察记录等证据，按量表给意见。</div></div><Icon name="chevronRight" /></div>
    </div>

    <div className="sect"><div className="sect-t tap" onClick={() => nav('/checkup')}>本园应用体检 <Icon name="chevronRight" /></div>
      {checkup ? <CheckupCard data={checkup} compact /> : <div className="card small muted">12 项探针接平台数据后每周出卡。只看园所对平台的使用情况，不出现任何幼儿数据，不排名，不作考核依据。</div>}
    </div>
    <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => nav('/home')}>回首页</Button>
  </div>
}
