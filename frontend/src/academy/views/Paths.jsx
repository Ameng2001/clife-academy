import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { PATH_KEYS, levelsOf, levelOf, statusOf, pathSummary } from '../../lib/lessons.js'
import { useS, myPath } from './common.jsx'

export default function Paths() {
  const nav = useNavigate(), S = useS()
  const { path: param } = useParams()
  const path = PATH_KEYS.includes(param) ? param : myPath(S)
  const sum = pathSummary(S.progress, path)
  // 手机：chips 选路径＋单列关卡；桌面（academy.css ≥ 1000px）：左栏路径竖列表带进度，右栏关卡
  return <div className="narrow wide">
    <div className="hdr"><div><h1>学习路径</h1><div className="sub">按岗位走关，通一关解一关</div></div></div>
    <div className="paths-grid">
    <aside className="paths-side">
      <div className="chips paths-chips" style={{ marginBottom: 14 }}>
        {PATH_KEYS.map(p => <button key={p} className={'chip' + (p === path ? ' on' : '')} onClick={() => nav('/paths/' + p, { replace: true })}>{pathSummary(S.progress, p).name}</button>)}
      </div>
      <div className="sect paths-list"><div className="sect-b">
        {PATH_KEYS.map(p => { const ps = pathSummary(S.progress, p); return <div key={p} className={'lrow tap' + (p === path ? ' on' : '')} onClick={() => nav('/paths/' + p, { replace: true })}>
          <div style={{ flex: 1, minWidth: 0 }}><div className="lrow-t" style={{ color: p === path ? 'var(--acc)' : undefined, fontWeight: p === path ? 700 : undefined }}>{ps.name}</div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${ps.total ? ps.done / ps.total * 100 : 0}%` }} /></div></div>
          <span className="small muted" style={{ marginInlineStart: 10 }}>{ps.done}/{ps.total}</span>
        </div> })}
      </div></div>
    </aside>
    <div className="paths-main">
    <div className="card" style={{ paddingBottom: 12 }}>
      <div className="ac-row"><div className="big">{sum.name}路径</div><span className="tag">{sum.done} / {sum.total} 关</span></div>
      <div className="ac-bar"><i style={{ width: `${sum.total ? sum.done / sum.total * 100 : 0}%` }} /></div>
    </div>
    <div className="sect"><div className="sect-b">
      {levelsOf(path).map(l => { const lv = levelOf(l.id), st = statusOf(S.progress, l.id); return (
        <div key={l.id} className={'lrow ac-lv ' + st + (st === 'locked' ? '' : ' tap')} onClick={() => st !== 'locked' && nav('/level/' + l.id)}>
          <span className="n">{st === 'done' ? <Icon name="check" /> : l.i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}><div className="t">{lv.title}</div><div className="s">{lv.scene} · {lv.dur}{lv.needsEvent ? ' · 实操' : lv.type === 'practice' ? ' · 实践' : lv.type === 'seminar' ? ' · 研讨' : ''}</div></div>
          {st === 'locked' ? <Icon name="lock" /> : <Icon name="chevronRight" />}
        </div>) })}
    </div></div>
    </div></div>
  </div>
}
