// 精品微课（/library）：查阅用，不按路径组织（路径的事只在学习路径页做）。一张卡＝一关，点开直接到「讲」；「做」「测」仍在学习路径里通关。
// 三个视图：全部（按方向 / 场景筛、关键词搜）、本周常查（本园最近回传过的实操事件对应的场景，GET /api/org/recent-events，只有事件名没有人）、
// 一日生活（按入园、进餐、活动、离园等环节分组）。第二个 tab 是名师讲堂切片。不受解锁限制。只显示本人状态，不显示人数。
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { TextField } from '../../components/ui.jsx'
import { PATH_KEYS, PATH_META, pathNameOf, levelOf, statusOf } from '../../lib/lessons.js'
import { allScenes, searchLessons, snippet, lessonsByDayPart } from '../../lib/library.js'
import { useS } from './common.jsx'
import { api } from '../../lib/api.js'

const KIND = { role: '岗位', domain: '领域', stage: '阶段', admin: '管理' }
const KIND_ICON = { role: 'person', domain: 'sparkles', stage: 'steps', admin: 'gauge', clip: 'play' }
const TYPES = [['single', '微课'], ['clip', '讲堂微课']]
const VIEWS = [['all', '全部'], ['recent', '本周常查'], ['day', '一日生活']]
const kindOf = p => PATH_META[p]?.kind || 'role'
const mmss = s => `${Math.floor(s / 60)}′${String(s % 60).padStart(2, '0')}″`

function Cover({ kind, label, icon }) {
  return <div className={'course-cover ' + kind}><span className="ic"><Icon name={icon || KIND_ICON[kind] || 'play'} /></span><span className="lb">{label}</span></div>
}

// 一关一张卡：点开直接到「讲」（?seg=jiang），锁着的也能看讲与看
function LessonCard({ r: { lesson: l, where }, q, S, nav }) {
  const st = statusOf(S.progress, l.id), k = kindOf(l.path)
  return <div className="card course" onClick={() => nav('/level/' + l.id + '?seg=jiang')}>
    <Cover kind={k} label={`${pathNameOf(l.path)} · 第 ${l.i + 1} 关`} />
    <div className="course-t">{l.title}</div>
    <div className="course-m" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.scene} · {l.dur}{l.needsEvent ? ' · 实操' : ''}{where && where !== 'title' ? ' · ' + snippet(l, q) : l.goal ? ' · ' + l.goal : ''}</div>
    <div className="course-f"><span className="muted">{st === 'done' ? '已通过' : st === 'current' ? '学习中' : st === 'locked' ? '未解锁 · 可查阅' : '可学'}</span><span style={{ color: 'var(--acc)', fontWeight: 600 }}>看讲与看 ›</span></div>
  </div>
}

export default function Library() {
  const nav = useNavigate(), S = useS()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') || '')
  const type = sp.get('type') === 'clip' ? 'clip' : 'single'
  const view = VIEWS.some(([k]) => k === sp.get('view')) && !sp.get('q') ? sp.get('view') : 'all'
  const kind = KIND[sp.get('kind')] ? sp.get('kind') : null
  const path = PATH_KEYS.includes(sp.get('path')) ? sp.get('path') : null
  const scene = sp.get('scene') || null
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') || '') !== q) { const n = new URLSearchParams(sp); if (q) { n.set('q', q); n.delete('view'); n.delete('type') } else n.delete('q'); setSp(n, { replace: true }) } }, 250); return () => clearTimeout(t) }, [q])
  const scenes = useMemo(allScenes, [])

  // 全部：关键词 + 路径 + 场景，再按方向过滤
  const rows = useMemo(() => searchLessons(q, { path, scene }).filter(({ lesson: l }) => !kind || kindOf(l.path) === kind), [q, path, scene, kind])
  // 讲堂微课：名师讲堂讲完切出来的（GET /api/lectures/clips）
  const [clips, setClips] = useState([])
  useEffect(() => { api('/api/lectures/clips').then(r => setClips(r.clips || [])).catch(() => setClips([])) }, [])
  const clipRows = useMemo(() => { const k = q.trim().toLowerCase(); return k ? clips.filter(c => [c.title, c.desc, c.lecture, c.speaker].some(x => (x || '').toLowerCase().includes(k))) : clips }, [clips, q])
  // 本周常查：本园最近回传的事件 → 关卡 → 场景；按事件次数的先后排场景，场景内按路径顺序
  const [recent, setRecent] = useState(null)
  useEffect(() => { if (view !== 'recent' || recent) return; api('/api/org/recent-events?days=7').then(setRecent).catch(() => setRecent({ events: [] })) }, [view])
  const recentRows = useMemo(() => {
    if (!recent) return []
    const order = []
    for (const e of recent.events) for (const id of e.levels) { const sc = levelOf(id)?.scene; if (sc && !order.includes(sc)) order.push(sc) }
    return order.flatMap(sc => rows.filter(r => r.lesson.scene === sc))
  }, [recent, rows])
  const dayGroups = useMemo(() => lessonsByDayPart(rows), [rows])
  const total = useMemo(() => searchLessons('').length, [])
  const shown = view === 'recent' ? recentRows : view === 'day' ? dayGroups.flatMap(([, ls]) => ls) : rows
  const count = type === 'clip' ? `${clipRows.length} 条` : q ? `找到 ${rows.length} 关` : view === 'recent' ? `${recentRows.length} 关` : `${shown.length} 关`

  return <div className="narrow wide">
    <div className="hdr"><div><h1>精品微课</h1><div className="sub">遇到事查一下 · {total} 关按场景查，不受解锁限制；要走关去学习路径</div></div><div className="hdr-actions"><button className="chip" onClick={() => nav('/paths')}><Icon name="steps" /> 学习路径</button><button className="chip" onClick={() => nav('/collections')}><Icon name="grid" /> 合集</button><button className="chip" onClick={() => nav('/cases')}><Icon name="sparkles" /> 专家案例</button></div></div>
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <TextField placeholder="搜标题、操作步骤、平台菜单，如「批量管理」" value={q} onChange={e => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} />
      <span style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--label-3)', display: 'flex' }}><Icon name="magnifier" /></span>
      {q && <button className="btn plain" style={{ position: 'absolute', insetInlineEnd: 6, top: '50%', transform: 'translateY(-50%)', padding: 6 }} aria-label="清除" onClick={() => setQ('')}><Icon name="xmark" /></button>}
    </div>
    <div className="frow"><span className="fl">看什么</span><div className="chips">{TYPES.map(([k, t]) => <button key={k} className={'chip' + (type === k ? ' on' : '')} onClick={() => setParam('type', k === 'single' ? null : k)}>{t}</button>)}</div></div>
    {type === 'single' && !q && <div className="frow"><span className="fl">视图</span><div className="chips">{VIEWS.map(([k, t]) => <button key={k} className={'chip' + (view === k ? ' on' : '')} onClick={() => setParam('view', k === 'all' ? null : k)}>{t}</button>)}</div></div>}
    {type === 'single' && <div className="frow"><span className="fl">方向</span><div className="chips"><button className={'chip' + (!kind ? ' on' : '')} onClick={() => setParam('kind', null)}>全部</button>{Object.entries(KIND).map(([k, t]) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setParam('kind', kind === k ? null : k)}>{t}</button>)}</div></div>}
    {type === 'single' && view !== 'day' && <div className="frow"><span className="fl">场景</span><div className="chips"><button className={'chip' + (!scene ? ' on' : '')} onClick={() => setParam('scene', null)}>全部</button>{scenes.map(s => <button key={s} className={'chip' + (s === scene ? ' on' : '')} onClick={() => setParam('scene', s === scene ? null : s)}>{s}</button>)}</div></div>}
    {type === 'single' && path && <div className="frow"><span className="fl">路径</span><div className="chips"><button className="chip on" onClick={() => setParam('path', null)}>{pathNameOf(path)} <Icon name="xmark" /></button></div></div>}

    <div className="sect-t" style={{ marginTop: 10 }}>{count}</div>
    {type === 'single' && view === 'recent' && recent && <div className="small muted" style={{ marginBottom: 8 }}>{recent.scope === 'org' ? '本园最近 7 天在平台上做过的事，对应的微课排在前面；只有事情，没有人。' : '账号没挂园所，先按本人最近做过的事排。'}{!recent.events.length ? ' 这周还没有回传，先看全部。' : ''}</div>}
    {type === 'single' && view !== 'day' && <div className="course-grid">
      {shown.map(r => <LessonCard key={r.lesson.id} r={r} q={q} S={S} nav={nav} />)}
      {!shown.length && <div className="card small muted" style={{ gridColumn: '1/-1' }}>{view === 'recent' ? '本周没有对得上的微课。' : '没有匹配的微课。换个词，或者去掉方向、场景筛选。'}</div>}
    </div>}
    {type === 'single' && view === 'day' && dayGroups.map(([part, ls]) => <div key={part} className="sect"><div className="sect-t">{part} <span className="muted" style={{ fontWeight: 400 }}>· {ls.length} 关</span></div><div className="course-grid">{ls.map(r => <LessonCard key={r.lesson.id} r={r} q={q} S={S} nav={nav} />)}</div></div>)}
    {type === 'single' && view === 'day' && !dayGroups.length && <div className="card small muted">这个方向里没有一日生活环节的微课。</div>}
    {type === 'clip' && <div className="course-grid">
      {clipRows.map(c => <a key={c.id} className="card course" href={c.replayUrl ? c.replayUrl + (c.start ? '#t=' + c.start : '') : undefined} target={c.replayUrl ? '_blank' : undefined} rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} onClick={e => { if (!c.replayUrl) { e.preventDefault(); nav('/lectures') } }}>
        <Cover kind="clip" label={c.lecture || '名师讲堂'} icon="play" />
        <div className="course-t">{c.title}</div>
        <div className="course-m">{c.speaker ? c.speaker + ' · ' : ''}{c.start ? mmss(c.start) + ' · ' : ''}{c.desc || (c.replayUrl ? '回放' : '回放整理中')}</div>
        <div className="course-f"><span className="muted">名师讲堂切片</span><span style={{ color: 'var(--acc)', fontWeight: 600 }}>{c.replayUrl ? '看回放' : '去讲堂'} ›</span></div>
      </a>)}
      {!clipRows.length && <div className="card small muted" style={{ gridColumn: '1/-1' }}>还没有讲堂微课。名师讲堂讲完、切出片段后会出现在这里。</div>}
    </div>}
  </div>
}
