// 精品微课（/library）：课程列表形式。系列课＝一条路径（岗位 / 领域 / 阶段 / 管理），单节课＝一关，讲堂微课＝名师讲堂切片。
// 按方向、场景筛，按关键词搜，不受解锁限制：未解锁的关能看「讲」与「看」，通关仍按路径顺序。只显示本人进度，不显示人数。
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { TextField } from '../../components/ui.jsx'
import { PATH_KEYS, PATH_META, pathNameOf, levelsOf, statusOf, pathSummary } from '../../lib/lessons.js'
import { allScenes, searchLessons, snippet } from '../../lib/library.js'
import { useS } from './common.jsx'
import { api } from '../../lib/api.js'

const KIND = { role: '岗位', domain: '领域', stage: '阶段', admin: '管理' }
const KIND_ICON = { role: 'person', domain: 'sparkles', stage: 'steps', admin: 'gauge', clip: 'play' }
const TYPES = [['series', '系列课'], ['single', '单节课'], ['clip', '讲堂微课']]
const kindOf = p => PATH_META[p]?.kind || 'role'
const minutesOf = dur => { const m = /(\d+)′(\d+)″/.exec(dur || ''); return m ? +m[1] + (+m[2] >= 30 ? 1 : 0) : 0 }
const mmss = s => `${Math.floor(s / 60)}′${String(s % 60).padStart(2, '0')}″`

function Cover({ kind, label, icon }) {
  return <div className={'course-cover ' + kind}><span className="ic"><Icon name={icon || KIND_ICON[kind] || 'play'} /></span><span className="lb">{label}</span></div>
}

export default function Library() {
  const nav = useNavigate(), S = useS()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') || '')
  const type = TYPES.some(([k]) => k === sp.get('type')) ? sp.get('type') : (sp.get('q') || sp.get('path') || sp.get('scene') ? 'single' : 'series')
  const kind = KIND[sp.get('kind')] ? sp.get('kind') : null
  const path = PATH_KEYS.includes(sp.get('path')) ? sp.get('path') : null
  const scene = sp.get('scene') || null
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') || '') !== q) { const n = new URLSearchParams(sp); if (q) { n.set('q', q); if (!n.get('type')) n.set('type', 'single') } else n.delete('q'); setSp(n, { replace: true }) } }, 250); return () => clearTimeout(t) }, [q])
  const scenes = useMemo(allScenes, [])

  // 系列课：每条路径一张卡，本人进度来自 progress
  const series = useMemo(() => PATH_KEYS.map(p => { const ls = levelsOf(p); return { key: p, name: pathNameOf(p), kind: kindOf(p), n: ls.length, minutes: ls.reduce((a, l) => a + minutesOf(l.dur), 0), practice: ls.filter(l => l.event || l.type === 'practice').length, meta: PATH_META[p] || {}, sum: pathSummary(S.progress, p) } }).filter(s => !kind || s.kind === kind), [S.progress, kind])
  // 单节课：关键词 + 路径 + 场景，再按方向过滤
  const rows = useMemo(() => searchLessons(q, { path, scene }).filter(({ lesson: l }) => !kind || kindOf(l.path) === kind), [q, path, scene, kind])
  // 讲堂微课：名师讲堂讲完切出来的（GET /api/lectures/clips）
  const [clips, setClips] = useState([])
  useEffect(() => { api('/api/lectures/clips').then(r => setClips(r.clips || [])).catch(() => setClips([])) }, [])
  const clipRows = useMemo(() => { const k = q.trim().toLowerCase(); return k ? clips.filter(c => [c.title, c.desc, c.lecture, c.speaker].some(x => (x || '').toLowerCase().includes(k))) : clips }, [clips, q])
  const total = useMemo(() => searchLessons('').length, [])
  const count = type === 'series' ? `${series.length} 条系列课` : type === 'single' ? (q ? `找到 ${rows.length} 关` : `${rows.length} 关`) : `${clipRows.length} 条`

  return <div className="narrow wide">
    <div className="hdr"><div><h1>精品微课</h1><div className="sub">{PATH_KEYS.length} 条系列课 · {total} 关，按岗位与领域挑，不受解锁限制</div></div><div className="hdr-actions"><button className="chip" onClick={() => nav('/collections')}><Icon name="grid" /> 合集</button><button className="chip" onClick={() => nav('/cases')}><Icon name="sparkles" /> 专家案例</button></div></div>
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <TextField placeholder="搜标题、操作步骤、平台菜单，如「批量管理」" value={q} onChange={e => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} />
      <span style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--label-3)', display: 'flex' }}><Icon name="magnifier" /></span>
      {q && <button className="btn plain" style={{ position: 'absolute', insetInlineEnd: 6, top: '50%', transform: 'translateY(-50%)', padding: 6 }} aria-label="清除" onClick={() => setQ('')}><Icon name="xmark" /></button>}
    </div>
    <div className="frow"><span className="fl">课程类型</span><div className="chips">{TYPES.map(([k, t]) => <button key={k} className={'chip' + (type === k ? ' on' : '')} onClick={() => setParam('type', k)}>{t}</button>)}</div></div>
    {type !== 'clip' && <div className="frow"><span className="fl">方向</span><div className="chips"><button className={'chip' + (!kind ? ' on' : '')} onClick={() => setParam('kind', null)}>全部</button>{Object.entries(KIND).map(([k, t]) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setParam('kind', kind === k ? null : k)}>{t}</button>)}</div></div>}
    {type === 'single' && <div className="frow"><span className="fl">场景</span><div className="chips"><button className={'chip' + (!scene ? ' on' : '')} onClick={() => setParam('scene', null)}>全部</button>{scenes.map(s => <button key={s} className={'chip' + (s === scene ? ' on' : '')} onClick={() => setParam('scene', s === scene ? null : s)}>{s}</button>)}</div></div>}
    {type === 'single' && path && <div className="frow"><span className="fl">路径</span><div className="chips"><button className="chip on" onClick={() => setParam('path', null)}>{pathNameOf(path)} <Icon name="xmark" /></button></div></div>}

    <div className="sect-t" style={{ marginTop: 10 }}>{count}</div>
    {type === 'series' && <div className="course-grid">
      {series.map(s => <div key={s.key} className="card course" onClick={() => nav('/paths/' + s.key)}>
        <Cover kind={s.kind} label={KIND[s.kind] + '路径'} />
        <div className="course-t">{s.name}</div>
        <div className="course-m">{s.n} 关{s.minutes ? ` · 约 ${s.minutes} 分钟` : ''}{s.practice ? ` · ${s.practice} 关实操` : ''}{s.meta.domain ? ` · ${s.meta.domain}` : s.meta.stage ? ` · ${s.meta.stage}阶段` : ''}</div>
        <div className="course-f"><span className="muted">{s.sum.finished ? '已走完' : s.sum.done ? `本人 ${s.sum.done}/${s.n} 关` : '还没开始'}</span><span style={{ color: 'var(--acc)', fontWeight: 600 }}>{s.sum.finished ? '回看' : s.sum.done ? '继续' : '开始'} ›</span></div>
      </div>)}
      {!series.length && <div className="card small muted" style={{ gridColumn: '1/-1' }}>这个方向还没有系列课。</div>}
    </div>}
    {type === 'single' && <div className="course-grid">
      {rows.map(({ lesson: l, where }) => { const st = statusOf(S.progress, l.id); const k = kindOf(l.path); return (
        <div key={l.id} className="card course" onClick={() => nav('/level/' + l.id)}>
          <Cover kind={k} label={`${pathNameOf(l.path)} · 第 ${l.i + 1} 关`} />
          <div className="course-t">{l.title}</div>
          <div className="course-m" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.scene} · {l.dur}{l.needsEvent ? ' · 实操' : ''}{where && where !== 'title' ? ' · ' + snippet(l, q) : l.goal ? ' · ' + l.goal : ''}</div>
          <div className="course-f"><span className="muted">{st === 'done' ? '已通过' : st === 'current' ? '学习中' : '可预习'}</span><span style={{ color: 'var(--acc)', fontWeight: 600 }}>{st === 'locked' ? '看讲与看' : '进入'} ›</span></div>
        </div>) })}
      {!rows.length && <div className="card small muted" style={{ gridColumn: '1/-1' }}>没有匹配的微课。换个词，或者去掉方向、场景筛选。</div>}
    </div>}
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
