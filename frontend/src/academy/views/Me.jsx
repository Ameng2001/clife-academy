import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { useStore } from '../../store/useStore.js'
import { PATH_KEYS, pathSummary, titleOf, parseLevelId } from '../../lib/lessons.js'
import { useS, myPath, fmtDay } from './common.jsx'

export default function Me() {
  const nav = useNavigate(), S = useS()
  const user = useStore(s => s.user)
  const path = myPath(S), sum = pathSummary(S.progress, path)
  const credits = Object.values(S.credits || {}).reduce((a, b) => a + b, 0)
  const badges = PATH_KEYS.map(p => pathSummary(S.progress, p))
  const recs = Object.entries(S.progress || {}).sort((a, b) => b[1].passedAt - a[1].passedAt)
  return <div className="narrow">
    <div className="hdr"><div><h1>我的</h1><div className="sub">{user ? user.name : '演示账号'} · {sum.name}</div></div><button className="iconbtn" onClick={() => nav('/settings')}><Icon name="gear" /></button></div>
    <div className="tiles">
      <div className="tile"><div className="l">学分</div><div className="v">{credits}</div></div>
      <div className="tile"><div className="l">本岗位已通过</div><div className="v">{sum.done}<span className="small muted"> / {sum.total}</span></div></div>
      <div className="tile"><div className="l">岗位徽章</div><div className="v">{badges.filter(b => b.finished).length}</div></div>
      <div className="tile"><div className="l">初级岗位认证</div><div className="v" style={{ fontSize: 18 }}>{sum.finished ? '可报名' : '未达到'}</div></div>
    </div>
    <div className="sect"><div className="sect-t">岗位徽章</div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
        {badges.map(b => <div key={b.path} className={'ac-badge' + (b.finished ? ' on' : '')}><div className="b">{b.name[0]}</div><div className="small" style={{ fontSize: 12 }}>{b.name}</div><div className="small muted" style={{ fontSize: 11 }}>{b.finished ? '已获得' : `${b.done}/${b.total}`}</div></div>)}
      </div>
    </div>
    <div className="sect"><div className="sect-t">学习记录</div><div className="sect-b">
      {!recs.length && <div className="lrow small muted">还没有通过的关卡。</div>}
      {recs.map(([id, r]) => { const p = parseLevelId(id); return <div key={id} className="lrow">
        <div style={{ flex: 1 }}><div className="lrow-t">第 {p.i + 1} 关 · {titleOf(id)}</div><div className="small muted">{pathSummary(S.progress, p.path).name} · 测验 {r.quiz?.right}/{r.quiz?.of}</div></div>
        <span className="small muted">{fmtDay(r.passedAt)}</span>
      </div> })}
    </div></div>
    <div className="card ac-note">初级认证：完成本岗位路径，测验正确率 80% 以上，线上完成。中级：初级通过，提交一份本园场景应用案例，线下答辩。</div>
  </div>
}
