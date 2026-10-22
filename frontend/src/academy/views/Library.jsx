// 微课库：全部关卡按岗位 × 场景浏览、按关键词搜，不受解锁限制。未解锁的关能看「讲」与「看」，通关仍按路径顺序。
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { TextField } from '../../components/ui.jsx'
import { PATH_KEYS, pathNameOf, statusOf } from '../../lib/lessons.js'
import { allScenes, searchLessons, snippet } from '../../lib/library.js'
import { useS } from './common.jsx'
import { api } from '../../lib/api.js'

export default function Library() {
  const nav = useNavigate(), S = useS()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') || '')
  const path = PATH_KEYS.includes(sp.get('path')) ? sp.get('path') : null
  const scene = sp.get('scene') || null
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') || '') !== q) setParam('q', q) }, 250); return () => clearTimeout(t) }, [q])
  const scenes = useMemo(allScenes, [])
  const rows = useMemo(() => searchLessons(q, { path, scene }), [q, path, scene])
  // 讲堂微课：讲完的园长大讲堂切出来的三五条（GET /api/lectures/clips），只按关键词筛，不分岗位场景
  const [clips, setClips] = useState([])
  useEffect(() => { api('/api/lectures/clips').then(r => setClips(r.clips || [])).catch(() => setClips([])) }, [])
  const clipRows = useMemo(() => { const k = q.trim().toLowerCase(); return k ? clips.filter(c => [c.title, c.desc, c.lecture, c.speaker].some(x => (x || '').toLowerCase().includes(k))) : clips }, [clips, q])
  const mmss = s => `${Math.floor(s / 60)}′${String(s % 60).padStart(2, '0')}″`

  return <div className="narrow wide">
    <div className="hdr"><div><h1>微课库</h1><div className="sub">全部 {searchLessons('').length} 关按岗位与场景查，不受解锁限制</div></div><div className="hdr-actions"><button className="chip" onClick={() => nav('/collections')}><Icon name="grid" /> 合集</button><button className="chip" onClick={() => nav('/resources')}><Icon name="folder" /> 资源库</button><button className="chip" onClick={() => nav('/cases')}><Icon name="sparkles" /> 案例库</button></div></div>
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <TextField placeholder="搜标题、操作步骤、平台菜单，如「批量管理」" value={q} onChange={e => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} />
      <span style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--label-3)', display: 'flex' }}><Icon name="magnifier" /></span>
      {q && <button className="btn plain" style={{ position: 'absolute', insetInlineEnd: 6, top: '50%', transform: 'translateY(-50%)', padding: 6 }} aria-label="清除" onClick={() => setQ('')}><Icon name="xmark" /></button>}
    </div>
    <div className="chips" style={{ marginBottom: 8 }}>
      <button className={'chip' + (!path ? ' on' : '')} onClick={() => setParam('path', null)}>全部岗位</button>
      {PATH_KEYS.map(p => <button key={p} className={'chip' + (p === path ? ' on' : '')} onClick={() => setParam('path', p === path ? null : p)}>{pathNameOf(p)}</button>)}
    </div>
    <div className="chips" style={{ marginBottom: 14 }}>
      <button className={'chip' + (!scene ? ' on' : '')} onClick={() => setParam('scene', null)}>全部场景</button>
      {scenes.map(s => <button key={s} className={'chip' + (s === scene ? ' on' : '')} onClick={() => setParam('scene', s === scene ? null : s)}>{s}</button>)}
    </div>
    <div className="sect"><div className="sect-t">{q ? `找到 ${rows.length} 关` : `${rows.length} 关`}</div><div className="sect-b cols2">
      {!rows.length && <div className="lrow small muted">没有匹配的微课。换个词，或者去掉岗位、场景筛选。</div>}
      {rows.map(({ lesson: l, where }) => { const st = statusOf(S.progress, l.id); return (
        <div key={l.id} className="lrow tap" onClick={() => nav('/level/' + l.id)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lrow-t">{l.title}<span className="small muted" style={{ marginInlineStart: 8 }}>{pathNameOf(l.path)} 第 {l.i + 1} 关</span></div>
            <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.scene} · {l.dur}{l.needsEvent ? ' · 实操' : ''}{where && where !== 'title' ? ' · ' + snippet(l, q) : ' · ' + (l.goal || '')}</div>
          </div>
          {st === 'done' ? <span className="tag" style={{ color: 'var(--green)' }}>已通过</span> : st === 'current' ? <span className="tag">学习中</span> : <Icon name="chevronRight" />}
        </div>) })}
    </div></div>
    {clipRows.length > 0 && !path && !scene && <div className="sect" style={{ marginTop: 14 }}><div className="sect-t">讲堂微课 · {clipRows.length} 条 <span className="small muted">园长大讲堂讲完切出来的，点开回放</span></div><div className="sect-b">
      {clipRows.map(c => <a key={c.id} className="lrow tap" href={c.replayUrl ? c.replayUrl + (c.start ? '#t=' + c.start : '') : undefined} target={c.replayUrl ? '_blank' : undefined} rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} onClick={e => { if (!c.replayUrl) { e.preventDefault(); nav('/lectures') } }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lrow-t">{c.title}<span className="small muted" style={{ marginInlineStart: 8 }}>{c.lecture}{c.speaker ? ' · ' + c.speaker : ''}</span></div>
          <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.start ? mmss(c.start) + ' · ' : ''}{c.desc || (c.replayUrl ? '回放' : '回放整理中')}</div>
        </div>
        <Icon name={c.replayUrl ? 'play' : 'chevronRight'} />
      </a>)}
    </div></div>}
  </div>
}
