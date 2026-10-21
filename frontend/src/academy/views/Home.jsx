import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { ORG, PROBES, PATH_KEYS, levelId, levelOf, cursorOf, pathSummary, pathNameOf } from '../../lib/lessons.js'
import { useS, myPath, RoleSelect } from './common.jsx'

export default function Home() {
  const nav = useNavigate(), S = useS()
  const path = myPath(S)
  const sum = pathSummary(S.progress, path)
  const cur = cursorOf(S.progress, path)
  const today = sum.finished ? null : levelOf(levelId(path, cur))
  const credits = Object.values(S.credits || {}).reduce((a, b) => a + b, 0)
  const d = new Date()
  return <div className="narrow">
    <div className="hdr">
      <div><h1>学前大课堂</h1><div className="sub">{ORG} · {d.getMonth() + 1} 月 {d.getDate()} 日</div></div>
      <div className="hdr-actions"><RoleSelect S={S} /><button className="iconbtn" onClick={() => nav('/settings')}><Icon name="gear" /></button></div>
    </div>

    <div className="card">
      <div className="lbl2" style={{ color: 'var(--label-2)', fontSize: 13 }}>今天这一关 · {pathNameOf(path)}路径</div>
      {today ? <>
        <div className="big" style={{ marginTop: 4 }}>第 {today.i + 1} 关 · {today.title}</div>
        <div className="ac-note" style={{ marginTop: 6 }}>{today.goal}</div>
        <div className="ac-row" style={{ marginTop: 12 }}>
          <span className="small muted">{today.scene} · {today.dur}{today.needsEvent ? ' · 含平台实操' : ''}</span>
          <Button variant="primary" icon="play" onClick={() => nav('/level/' + today.id)}>{S.lvDraft?.[today.id] ? '继续' : '开始'}</Button>
        </div>
      </> : <div className="big" style={{ marginTop: 4 }}>本路径已全部通过 🎉</div>}
      <div className="ac-bar"><i style={{ width: `${sum.total ? sum.done / sum.total * 100 : 0}%` }} /></div>
      <div className="small muted" style={{ marginTop: 6 }}>{sum.done} / {sum.total} 关 · {credits} 学分</div>
    </div>

    <div className="tiles">
      <div className="tile tappable" onClick={() => nav('/paths')}><div className="l"><Icon name="list" />全部路径</div><div className="v">{PATH_KEYS.length} 条</div></div>
      <div className="tile"><div className="l"><Icon name="gauge" />本园体检</div><div className="v">{PROBES.length} 项</div><div className="small muted">探针接平台后显示</div></div>
    </div>

    <div className="sect">
      <div className="sect-t">各岗位进度</div>
      <div className="sect-b">
        {PATH_KEYS.map(p => { const s = pathSummary(S.progress, p); return <div key={p} className="lrow tap" onClick={() => nav('/paths/' + p)}>
          <div style={{ flex: 1 }}><div className="lrow-t">{s.name}</div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${s.total ? s.done / s.total * 100 : 0}%` }} /></div></div>
          <span className="small muted" style={{ marginInlineStart: 12 }}>{s.done}/{s.total}</span><Icon name="chevronRight" />
        </div> })}
      </div>
    </div>
  </div>
}
