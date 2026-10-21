// 微课库：全部关卡按岗位 × 场景浏览、按关键词搜，不受解锁限制。未解锁的关能看「讲」与「看」，通关仍按路径顺序。
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { TextField } from '../../components/ui.jsx'
import { PATH_KEYS, pathNameOf, statusOf } from '../../lib/lessons.js'
import { allScenes, searchLessons, snippet } from '../../lib/library.js'
import { useS } from './common.jsx'

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

  return <div className="narrow">
    <div className="hdr"><div><h1>微课库</h1><div className="sub">全部 {searchLessons('').length} 关按岗位与场景查，不受解锁限制</div></div></div>
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
    <div className="sect"><div className="sect-t">{q ? `找到 ${rows.length} 关` : `${rows.length} 关`}</div><div className="sect-b">
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
  </div>
}
