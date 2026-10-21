// Coach 面向专业发展（/api/me/coach）：排一学期、周回顾、单关复盘。证据只有学习记录；变更只有 add-practice 与 pair；采用由本人定，配对由园长定。
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { levelOf, levelsOf, PATH_KEYS, pathNameOf } from '../../lib/lessons.js'
import { fmtDay } from './common.jsx'

const KIND = { plan: '学期计划', review: '周回顾', debrief: '单关复盘' }
const TYPE = { 'add-practice': '再做一次实践任务', pair: '建议配带教' }
const titleOf = id => { try { return levelOf(id)?.t || id } catch { return id } }

function Card({ c, onChange }) {
  const nav = useNavigate()
  const toast = useUI.getState().toast
  const [busy, setBusy] = useState(false)
  const accept = async on => { setBusy(true); try { await api('/api/me/coach/accept', { method: 'POST', body: JSON.stringify({ id: c.id, on }) }); toast(on ? (c.kind === 'plan' ? '已采用，首页出「本周待学」' : '已采用') : '已放下'); onChange() } catch (e) { toast('没成') } finally { setBusy(false) } }
  return <div className="card" style={{ marginTop: 12 }}>
    <div className="small muted">{KIND[c.kind]} · {fmtDay(c.at)} · {c.model ? '模型改过措辞' : '规则草稿'}{c.accepted === true ? ' · 已采用' : c.accepted === false ? ' · 没采用' : ''}</div>
    {c.kind === 'debrief' && <div style={{ fontWeight: 700, fontSize: 17, margin: '4px 0' }}>{c.title}<span className="small muted" style={{ marginInlineStart: 8 }}>{c.domain || ''}</span></div>}
    {c.kind === 'plan' && <div style={{ fontWeight: 700, fontSize: 17, margin: '4px 0' }}>{c.term} · {c.stage}阶段</div>}
    <div style={{ fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.summary}</div>
    {c.lines?.length > 0 && <ul className="small" style={{ margin: '6px 0 0', paddingInlineStart: 18, color: 'var(--label-2)' }}>{c.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    {c.notes?.length > 0 && <ul className="small" style={{ margin: '6px 0 0', paddingInlineStart: 18, color: 'var(--label-2)' }}>{c.notes.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    {c.stalled?.length > 0 && <div className="chips" style={{ marginTop: 6 }}>{c.stalled.map(s => <button key={s.path} className="chip" onClick={() => nav('/paths/' + s.path)}>{s.name} {s.done}/{s.total} · 停了 {s.days} 天</button>)}</div>}
    {c.weeks?.length > 0 && <div style={{ marginTop: 8 }}>{c.weeks.slice(0, 16).map(w => <div key={w.week} className="ac-row small" style={{ marginTop: 4, alignItems: 'flex-start' }}><span className="muted" style={{ width: 56, flex: 'none' }}>第 {w.week} 周</span><span style={{ flex: 1 }}>{w.levelIds.map(id => <span key={id} className="tap" style={{ color: 'var(--acc)', marginInlineEnd: 8 }} onClick={() => nav('/level/' + id)}>{titleOf(id)}{levelOf(id)?.type === 'practice' ? '（实践）' : ''}</span>)}{w.why && <span className="muted"> · {w.why}</span>}</span></div>)}</div>}
    {c.changes?.length > 0 && <div style={{ marginTop: 8 }}>{c.changes.map((x, i) => <div key={i} className="card" style={{ padding: 10, marginTop: 6, background: 'color-mix(in srgb,var(--acc) 8%,transparent)' }}><div style={{ fontWeight: 600 }}>{TYPE[x.type] || x.type}{x.levelId ? <span className="tap small" style={{ color: 'var(--acc)', marginInlineStart: 8 }} onClick={() => nav('/level/' + x.levelId)}>{titleOf(x.levelId)} ›</span> : null}</div><div className="small" style={{ marginTop: 2 }}>{x.why}</div><div className="small muted" style={{ marginTop: 2 }}>{x.how}</div></div>)}</div>}
    {c.next && <div className="small" style={{ marginTop: 8 }}><span className="muted">下一步：</span>{c.next}</div>}
    {c.kind !== 'debrief' && c.accepted !== true && <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'flex-end' }}><Button size="sm" disabled={busy} onClick={() => accept(false)}>放下</Button><Button size="sm" variant="primary" disabled={busy} onClick={() => accept(true)}>{c.kind === 'plan' ? '采用这份计划' : '采用'}</Button></div>}
    {c.kind === 'plan' && c.accepted === true && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><Button size="sm" disabled={busy} onClick={() => accept(false)}>不用这份了</Button></div>}
  </div>
}

export default function Coach() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const user = useStore(s => s.user)
  const toast = useUI.getState().toast
  const [d, setD] = useState(null), [busy, setBusy] = useState(''), [levelId, setLevelId] = useState(sp.get('level') || '')
  const load = () => { if (user) api('/api/me/coach').then(setD).catch(() => setD(null)) }
  useEffect(load, [user?.id])
  const run = async (kind, body) => { setBusy(kind); try { await api('/api/me/coach/' + kind, { method: 'POST', body: JSON.stringify(body || {}) }); load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy('') } }
  useEffect(() => { if (user && sp.get('level') && sp.get('run') === '1') run('debrief', { levelId: sp.get('level') }) }, [user?.id])
  return <div className="narrow">
    <div className="hdr"><div><h1>Coach</h1><div className="sub">专业发展 · {d?.stage ? d.stage + '阶段 · ' : ''}{d?.model ? '接了模型' : '规则草稿'} · 只读学习记录</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!user && <div className="card small muted">登录后在这里用。</div>}
    {d && <>
      {d.plan && <div className="card" style={{ background: 'var(--acc)', color: '#fff' }}><div className="small" style={{ opacity: .85 }}>采用中的学期计划 · {d.plan.term} · 第 {d.plan.week}/{d.plan.weeks} 周</div><div style={{ marginTop: 4, fontSize: 16, fontWeight: 600 }}>{d.plan.levels.map(l => <span key={l.id} className="tap" style={{ marginInlineEnd: 10, textDecoration: l.passed ? 'line-through' : 'none', opacity: l.passed ? .7 : 1 }} onClick={() => nav('/level/' + l.id)}>{l.title}{l.type === 'practice' ? '（实践）' : ''}</span>)}</div>{d.plan.why && <div className="small" style={{ opacity: .85, marginTop: 4 }}>{d.plan.why}</div>}</div>}
      <div className="tiles">
        <div className="tile tappable" onClick={() => !busy && run('plan')}><div className="l"><Icon name="calendar" />排一学期</div><div className="v" style={{ fontSize: 16 }}>{busy === 'plan' ? '在排…' : '按阶段与自评'}</div><div className="small muted">先接没走完的线，再补最弱的领域</div></div>
        <div className="tile tappable" onClick={() => !busy && run('review')}><div className="l"><Icon name="history" />周回顾</div><div className="v" style={{ fontSize: 16 }}>{busy === 'review' ? '在看…' : '哪条线停了'}</div><div className="small muted">反复不过的实践关、要不要配带教</div></div>
      </div>
      <div className="card" style={{ marginTop: 10 }}><div className="small muted">单关复盘</div><div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <select className="ac-sel" value={levelId} onChange={e => setLevelId(e.target.value)} style={{ flex: 1, minWidth: 160 }}><option value="">挑一关</option>{PATH_KEYS.flatMap(p => levelsOf(p).map(l => <option key={l.id} value={l.id}>{pathNameOf(p)} · {l.t}</option>))}</select>
        <Button size="sm" disabled={!levelId || !!busy} onClick={() => run('debrief', { levelId })}>复盘</Button>
      </div></div>
      <div className="small muted" style={{ marginTop: 10 }}>{d.evidence} 变更只有两类：再做一次实践任务、建议配带教；采用不采用你定，配对园长定。</div>
      {!d.cards.length && <div className="card small muted" style={{ marginTop: 10 }}>还没有卡片。</div>}
      {d.cards.map(c => <Card key={c.id} c={c} onChange={load} />)}
    </>}
  </div>
}
