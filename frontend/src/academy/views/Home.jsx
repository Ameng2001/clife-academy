import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api.js'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { ORG, PATH_KEYS, ROLE_PATH_KEYS, PATH_META, levelId, levelOf, cursorOf, pathSummary, pathNameOf } from '../../lib/lessons.js'
import { canReview } from './Review.jsx'
import { drafts } from '../../lib/level-draft.js'
import { useS, myPath, RoleSelect, fmtDay } from './common.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { fmtWhen } from './Lectures.jsx'

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
  const [lecture, setLecture] = useState(null)
  const [drill, setDrill] = useState(null)
  const [contest, setContest] = useState(null)
  const [chk, setChk] = useState(null)
  useEffect(() => { if (user) api('/api/me/checkup').then(setChk).catch(() => setChk(null)); else setChk(null) }, [user?.id])
  useEffect(() => { if (user) api('/api/contests').then(r => setContest(r.current[0] || null)).catch(() => setContest(null)); else setContest(null) }, [user?.id])
  useEffect(() => { if (user) api('/api/drills').then(r => setDrill(r.current[0] || null)).catch(() => setDrill(null)); else setDrill(null) }, [user?.id])
  useEffect(() => { api('/api/lectures').then(r => setLecture(r.upcoming[0] || null)).catch(() => setLecture(null)) }, [user?.id])
  const bookLecture = async () => {
    if (!user) return useUI.getState().toast('登录后才能预约')
    try { const r = await api('/api/lectures/book', { method: 'POST', body: JSON.stringify({ id: lecture.id, on: !lecture.booked }) }); setLecture(r.lecture); useUI.getState().toast(r.lecture.booked ? '已预约，开播前提醒' : '已取消预约') }
    catch (e) { useUI.getState().toast('没成' + (e.message ? '：' + e.message : '')) }
  }
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
        : <div className="tile"><div className="l"><Icon name="gauge" />本园体检</div><div className="v">{chk?.sum ? chk.sum.warn : '—'}<span className="small muted"> 项需关注</span></div><div className="small muted">{chk?.recommendations?.length ? `推荐你学「${chk.recommendations[0].title}」` : chk?.sum ? '本周园长看板出卡' : '登录后显示'}</div></div>}
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
    {lecture && <div className="card tappable" style={{ background: 'var(--acc)', color: '#fff', marginTop: 14 }} onClick={() => nav('/lectures')}>
      <div className="small" style={{ opacity: .85 }}>园长大讲堂 · 每月一场</div>
      <div className="small" style={{ opacity: .85, marginTop: 2 }}>{fmtWhen(lecture.at, lecture.minutes)}{lecture.phase === 'live' ? ' · 正在直播' : ''}</div>
      <div style={{ fontWeight: 700, fontSize: 18, margin: '4px 0' }}>{lecture.title}</div>
      {lecture.desc && <div className="small" style={{ opacity: .9 }}>{lecture.desc}</div>}
      <div style={{ marginTop: 10 }}><Button size="sm" style={{ background: '#fff', color: 'var(--acc)' }} icon={lecture.booked ? 'bellSlash' : 'bell'} onClick={e => { e.stopPropagation(); bookLecture() }}>{lecture.booked ? '已预约 · 开播前提醒' : '预约直播'}</Button></div>
    </div>}
    {drill && <div className="card tappable" style={{ marginTop: 14 }} onClick={() => nav('/drills')}>
      <div className="ac-row"><span className="small muted">每周一题{drill.scope === 'org' ? ' · 本园' : ''}</span><span className="small muted">{drill.answered} 人答</span></div>
      <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.45, margin: '6px 0' }}>{drill.title}</div>
      <div className="small" style={{ color: drill.mine ? 'var(--green)' : 'var(--acc)' }}>{drill.mine ? (drill.mine.review ? '已答 · ' + drill.mine.review.byName + ' 点评了' : '已答 · 看同园老师怎么答') : '去作答'} <Icon name="chevronRight" /></div>
    </div>}
    {chk?.recommendations?.length > 0 && <div className="sect"><div className="sect-t">本园体检推给你的关</div><div className="sect-b">
      {chk.recommendations.map(r => <div key={r.levelId} className="lrow tap" onClick={() => nav('/level/' + r.levelId)}><div style={{ flex: 1 }}><div className="lrow-t">「{r.title}」</div><div className="small muted">{r.why}</div></div><Icon name="chevronRight" /></div>)}
    </div></div>}
    {contest && <div className="card tappable" style={{ marginTop: 14 }} onClick={() => nav('/contests?id=' + contest.id)}>
      <div className="ac-row"><span className="small muted"><Icon name="trophy" /> 斗课 · {contest.phase === 'open' ? '应战中，' + fmtDay(contest.dueAt) + ' 截止' : '互评与点评'}</span><span className="small muted">{contest.entries} 人应战</span></div>
      <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.45, margin: '6px 0' }}>{contest.title}</div>
      <div className="small" style={{ color: contest.mine ? 'var(--green)' : 'var(--acc)' }}>{contest.phase === 'open' ? (contest.mine ? '已应战 · 改作品' : '自愿应战，交一份活动设计') : '看同事的设计、互评'} <Icon name="chevronRight" /></div>
    </div>}
    {(pair?.mentor || pair?.mentees?.length > 0) && <div className="sect"><div className="sect-t">带教</div><div className="sect-b">
      {pair.mentor && <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">带教教师：{pair.mentor.name}</div><div className="small muted">你的实践关作品由 {pair.mentor.name} 点评</div></div></div>}
      {pair.mentees?.length > 0 && <div className="lrow tap" onClick={() => nav('/review')}><div style={{ flex: 1 }}><div className="lrow-t">带着 {pair.mentees.map(m => m.name).join('、')}</div><div className="small muted">看他们的实践关作品并点评</div></div><Icon name="chevronRight" /></div>}
    </div></div>}
    {canReview(user) && user?.academy?.role !== 'director' && <div className="sect"><div className="sect-b"><div className="lrow tap" onClick={() => nav('/review')}><div style={{ flex: 1 }}><div className="lrow-t">点评队列</div><div className="small muted">本园实践关待点评</div></div><Icon name="chevronRight" /></div></div></div>}
  </div>
}
