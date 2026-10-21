import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { PATH_KEYS, levelsOf, levelOf, statusOf, pathSummary } from '../../lib/lessons.js'
import { useS, myPath } from './common.jsx'

export default function Paths() {
  const nav = useNavigate(), S = useS()
  const { path: param } = useParams()
  const path = PATH_KEYS.includes(param) ? param : myPath(S)
  const sum = pathSummary(S.progress, path)
  return <div className="narrow">
    <div className="hdr"><div><h1>学习路径</h1><div className="sub">按岗位走关，通一关解一关</div></div></div>
    <div className="chips" style={{ marginBottom: 14 }}>
      {PATH_KEYS.map(p => <button key={p} className={'chip' + (p === path ? ' on' : '')} onClick={() => nav('/paths/' + p, { replace: true })}>{pathSummary(S.progress, p).name}</button>)}
    </div>
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
  </div>
}
