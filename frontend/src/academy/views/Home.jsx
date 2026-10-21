import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api.js'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { ORG, PROBES, PATH_KEYS, ROLE_PATH_KEYS, PATH_META, levelId, levelOf, cursorOf, pathSummary, pathNameOf } from '../../lib/lessons.js'
import { canReview } from './Review.jsx'
import { drafts } from '../../lib/level-draft.js'
import { useS, myPath, RoleSelect } from './common.jsx'
import { useStore } from '../../store/useStore.js'

export default function Home() {
  const nav = useNavigate(), S = useS()
  const path = myPath(S)
  const sum = pathSummary(S.progress, path)
  const cur = cursorOf(S.progress, path)
  const today = sum.finished ? null : levelOf(levelId(path, cur))
  const credits = Object.values(S.credits || {}).reduce((a, b) => a + b, 0)
  // 登录了就显示平台给的园所名，没登录（演示）用样例园名
  const user = useStore(s => s.user)
  const orgName = user?.academy?.org?.name || ORG
  const d = new Date()
  const [pair, setPair] = useState(null)
  useEffect(() => { if (user) api('/api/me/pair').then(setPair).catch(() => setPair(null)); else setPair(null) }, [user?.id])
  return <div className="narrow">
    <div className="hdr">
      <div><h1>学前大课堂</h1><div className="sub">{orgName} · {d.getMonth() + 1} 月 {d.getDate()} 日</div></div>
      <div className="hdr-actions"><RoleSelect S={S} /><button className="iconbtn" onClick={() => nav('/settings')}><Icon name="gear" /></button></div>
    </div>

    <div className="card">
      <div className="lbl2" style={{ color: 'var(--label-2)', fontSize: 13 }}>今天这一关 · {pathNameOf(path)}路径</div>
      {today ? <>
        <div className="big" style={{ marginTop: 4 }}>第 {today.i + 1} 关 · {today.title}</div>
        <div className="ac-note" style={{ marginTop: 6 }}>{today.goal}</div>
        <div className="ac-row" style={{ marginTop: 12 }}>
          <span className="small muted">{today.scene} · {today.dur}{today.needsEvent ? ' · 含平台实操' : today.type === 'practice' ? ' · 交证据' : today.type === 'seminar' ? ' · 情景研讨' : ''}</span>
          <Button variant="primary" icon="play" onClick={() => nav('/level/' + today.id)}>{drafts.has(today.id) ? '继续' : '开始'}</Button>
        </div>
      </> : <div className="big" style={{ marginTop: 4 }}>本路径已全部通过 🎉</div>}
      <div className="ac-bar"><i style={{ width: `${sum.total ? sum.done / sum.total * 100 : 0}%` }} /></div>
      <div className="small muted" style={{ marginTop: 6 }}>{sum.done} / {sum.total} 关 · {credits} 学分</div>
    </div>

    <div className="tiles">
      <div className="tile tappable" onClick={() => nav('/paths')}><div className="l"><Icon name="list" />全部路径</div><div className="v">{PATH_KEYS.length} 条</div></div>
      {user?.academy?.role === 'director' || user?.admin
        ? <div className="tile tappable" onClick={() => nav('/org')}><div className="l"><Icon name="gauge" />园长看板</div><div className="v">本园</div><div className="small muted">各岗位完成情况与补训建议</div></div>
        : <div className="tile"><div className="l"><Icon name="gauge" />本园体检</div><div className="v">{PROBES.length} 项</div><div className="small muted">探针接平台后显示</div></div>}
    </div>

    <div className="sect">
      <div className="sect-t">各岗位进度</div>
      <div className="sect-b">
        {ROLE_PATH_KEYS.map(p => { const s = pathSummary(S.progress, p); return <div key={p} className="lrow tap" onClick={() => nav('/paths/' + p)}>
          <div style={{ flex: 1 }}><div className="lrow-t">{s.name}</div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${s.total ? s.done / s.total * 100 : 0}%` }} /></div></div>
          <span className="small muted" style={{ marginInlineStart: 12 }}>{s.done}/{s.total}</span><Icon name="chevronRight" />
        </div> })}
      </div>
    </div>

    {PATH_KEYS.length > ROLE_PATH_KEYS.length && <div className="sect">
      <div className="sect-t">领域路径</div>
      <div className="sect-b">
        {PATH_KEYS.filter(p => !ROLE_PATH_KEYS.includes(p)).map(p => { const s = pathSummary(S.progress, p); return <div key={p} className="lrow tap" onClick={() => nav('/paths/' + p)}>
          <div style={{ flex: 1 }}><div className="lrow-t">{s.name}<span className="small muted" style={{ marginInlineStart: 8 }}>{PATH_META[p]?.domain}</span></div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${s.total ? s.done / s.total * 100 : 0}%` }} /></div></div>
          <span className="small muted" style={{ marginInlineStart: 12 }}>{s.done}/{s.total}</span><Icon name="chevronRight" />
        </div> })}
      </div>
    </div>}
    {(pair?.mentor || pair?.mentees?.length > 0) && <div className="sect"><div className="sect-t">带教</div><div className="sect-b">
      {pair.mentor && <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">带教教师：{pair.mentor.name}</div><div className="small muted">你的实践关作品由 {pair.mentor.name} 点评</div></div></div>}
      {pair.mentees?.length > 0 && <div className="lrow tap" onClick={() => nav('/review')}><div style={{ flex: 1 }}><div className="lrow-t">带着 {pair.mentees.map(m => m.name).join('、')}</div><div className="small muted">看他们的实践关作品并点评</div></div><Icon name="chevronRight" /></div>}
    </div></div>}
    {canReview(user) && user?.academy?.role !== 'director' && <div className="sect"><div className="sect-b"><div className="lrow tap" onClick={() => nav('/review')}><div style={{ flex: 1 }}><div className="lrow-t">点评队列</div><div className="small muted">本园实践关待点评</div></div><Icon name="chevronRight" /></div></div></div>}
  </div>
}
