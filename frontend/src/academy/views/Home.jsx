import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api.js'
import Icon from '../../components/Icon.jsx'
import { Button, TextField } from '../../components/ui.jsx'
import { ORG, PATH_KEYS, ROLE_PATH_KEYS, PATH_META, levelId, levelOf, cursorOf, pathSummary, pathNameOf } from '../../lib/lessons.js'
import { canReview } from './Review.jsx'
import { drafts } from '../../lib/level-draft.js'
import { useS, myPath, RoleSelect, fmtDay } from './common.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { fmtWhen } from './Lectures.jsx'
import { useBrand } from '../brand.js'

export default function Home() {
  const brand = useBrand()
  const nav = useNavigate(), S = useS()
  const path = myPath(S)
  const sum = pathSummary(S.progress, path)
  const cur = cursorOf(S.progress, path)
  const today = sum.finished ? null : levelOf(levelId(path, cur))
  const credits = Object.values(S.credits || {}).reduce((a, b) => a + b, 0)
  // 登录了就显示平台给的园所名，没登录（演示）用样例园名
  const user = useStore(s => s.user)
  const orgName = user?.academy?.org?.name || user?.academy?.district?.name || ORG
  const d = new Date()
  const [pair, setPair] = useState(null)
  const [community, setCommunity] = useState(null)
  const [qa, setQa] = useState(null)
  const [show, setShow] = useState(null)
  useEffect(() => { if (user) api('/api/showcases').then(r => setShow(r.showcases.find(x => !x.closedAt) || null)).catch(() => setShow(null)); else setShow(null) }, [user?.id])
  useEffect(() => { if (user) api('/api/questions').then(setQa).catch(() => setQa(null)); else setQa(null) }, [user?.id])
  useEffect(() => { if (user) api('/api/me/community').then(r => setCommunity(r.community)).catch(() => setCommunity(null)); else setCommunity(null) }, [user?.id])
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
  const [plan, setPlan] = useState(null)
  const [notices, setNotices] = useState([])
  useEffect(() => { if (user) api('/api/notices').then(r => setNotices(r.notices)).catch(() => setNotices([])); else setNotices([]) }, [user?.id])
  useEffect(() => { if (user) api('/api/me/coach').then(r => setPlan(r.plan)).catch(() => setPlan(null)); else setPlan(null) }, [user?.id])
  return <div className="narrow wide">
    <div className="hdr">
      <div><h1>{brand.short}</h1><div className="sub">{orgName} · {d.getMonth() + 1} 月 {d.getDate()} 日</div></div>
      <div className="hdr-actions"><RoleSelect S={S} /><button className="iconbtn" onClick={() => nav('/settings')}><Icon name="gear" /></button></div>
    </div>
    <div className="home-grid"><div className="home-main">
    {notices.map(n => <div key={n.id} className="card" style={{ marginBottom: 10, padding: 12, background: 'color-mix(in srgb,var(--acc) 8%,transparent)' }}><div style={{ fontWeight: 600 }}><Icon name="speaker" /> {n.title}</div><div className="small" style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{n.text}</div><div className="small muted" style={{ marginTop: 2 }}>平台公告 · {fmtDay(n.at)}{n.until ? ' · 至 ' + fmtDay(n.until) : ''}</div></div>)}

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
      {plan && plan.levels.length > 0 && <div className="small tap" style={{ marginTop: 8, color: 'var(--acc)' }} onClick={() => nav('/coach')}>本周待学（Coach 学期计划第 {plan.week} 周）：{plan.levels.map(l => (l.passed ? '✓ ' : '') + l.title).join('、')} ›</div>}
    </div>

    <form className="card" style={{ marginTop: 10, padding: 12 }} onSubmit={e => { e.preventDefault(); const v = e.currentTarget.q.value.trim(); nav('/library' + (v ? '?q=' + encodeURIComponent(v) : '')) }}>
      <div className="lbl2" style={{ color: 'var(--label-2)', fontSize: 13 }}>遇到事查一下 · 精品微课</div>
      <div className="row" style={{ gap: 8, marginTop: 6 }}><TextField name="q" placeholder="搜标题、操作步骤、平台菜单，如「批量管理」" style={{ flex: 1 }} /><Button type="submit" size="sm" variant="tinted" icon="magnifier">查</Button></div>
      <div className="small muted" style={{ marginTop: 6 }}>不受解锁限制，点开直接看「讲」与「看」；走关还是在学习路径。</div>
    </form>

    <div className="tiles">
      {user?.admin && <div className="tile tappable" onClick={() => nav('/admin')}><div className="l"><Icon name="gear" />运营后台</div><div className="v">六组事</div><div className="small muted">用户与园所、研修期次、资源与案例、发题与点评、公告、审计</div></div>}
      <div className="tile tappable" onClick={() => nav('/paths')}><div className="l"><Icon name="list" />全部路径</div><div className="v">{PATH_KEYS.length} 条</div></div>
      {user?.academy?.role === 'district'
        ? <div className="tile tappable" onClick={() => nav('/district')}><div className="l"><Icon name="gauge" />区县看板</div><div className="v">{user.academy.district?.name || '本区'}</div><div className="small muted">园所数、覆盖率中位数、认证人数</div></div>
        : user?.academy?.role === 'director' || user?.admin
        ? <div className="tile tappable" onClick={() => nav('/org')}><div className="l"><Icon name="gauge" />园长看板</div><div className="v">本园</div><div className="small muted">各岗位完成情况与补训建议</div></div>
        : <div className="tile"><div className="l"><Icon name="gauge" />本园体检</div><div className="v">{chk?.sum ? chk.sum.warn : '—'}<span className="small muted"> 项需关注</span></div><div className="small muted">{chk?.recommendations?.length ? `推荐你学「${chk.recommendations[0].title}」` : chk?.sum ? '本周园长看板出卡' : '登录后显示'}</div></div>}
    </div>

    <div className="sect">
      <div className="sect-t">各岗位进度</div>
      <div className="sect-b">
        {ROLE_PATH_KEYS.filter(p => PATH_META[p]?.kind !== 'admin' || p === path).map(p => { const s = pathSummary(S.progress, p); return <div key={p} className="lrow tap" onClick={() => nav('/paths/' + p)}>
          <div style={{ flex: 1 }}><div className="lrow-t">{s.name}</div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${s.total ? s.done / s.total * 100 : 0}%` }} /></div></div>
          <span className="small muted" style={{ marginInlineStart: 12 }}>{s.done}/{s.total}</span><Icon name="chevronRight" />
        </div> })}
      </div>
    </div>

    {PATH_KEYS.length > ROLE_PATH_KEYS.length && <div className="sect">
      <div className="sect-t">领域路径</div>
      <div className="sect-b">
        {PATH_KEYS.filter(p => !ROLE_PATH_KEYS.includes(p) && PATH_META[p]?.kind !== 'stage').map(p => { const s = pathSummary(S.progress, p); return <div key={p} className="lrow tap" onClick={() => nav('/paths/' + p)}>
          <div style={{ flex: 1 }}><div className="lrow-t">{s.name}<span className="small muted" style={{ marginInlineStart: 8 }}>{PATH_META[p]?.domain}</span></div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${s.total ? s.done / s.total * 100 : 0}%` }} /></div></div>
          <span className="small muted" style={{ marginInlineStart: 12 }}>{s.done}/{s.total}</span><Icon name="chevronRight" />
        </div> })}
      </div>
    </div>}
    {PATH_KEYS.some(p => PATH_META[p]?.kind === 'stage' && (PATH_META[p].stage !== '管理' || user?.academy?.role === 'director' || user?.admin)) && <div className="sect">
      <div className="sect-t">阶段路径</div>
      <div className="sect-b">
        {PATH_KEYS.filter(p => PATH_META[p]?.kind === 'stage' && (PATH_META[p].stage !== '管理' || user?.academy?.role === 'director' || user?.admin)).map(p => { const s = pathSummary(S.progress, p); return <div key={p} className="lrow tap" onClick={() => nav('/paths/' + p)}>
          <div style={{ flex: 1 }}><div className="lrow-t">{s.name}<span className="small muted" style={{ marginInlineStart: 8 }}>{PATH_META[p]?.stage}阶段</span></div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${s.total ? s.done / s.total * 100 : 0}%` }} /></div></div>
          <span className="small muted" style={{ marginInlineStart: 12 }}>{s.done}/{s.total}</span><Icon name="chevronRight" />
        </div> })}
      </div>
    </div>}
    </div><aside className="home-side">
    {lecture && <div className="card tappable" style={{ background: 'var(--acc)', color: '#fff', marginTop: 14 }} onClick={() => nav('/lectures')}>
      <div className="small" style={{ opacity: .85 }}>名师讲堂 · 每月一场</div>
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
    {qa && (qa.queue.length > 0 || qa.mine.some(q => q.status === 'open')) && <div className="sect"><div className="sect-t">答疑</div><div className="sect-b">
      {qa.queue.length > 0 && <div className="lrow tap" onClick={() => nav('/questions?tab=queue')}><div style={{ flex: 1 }}><div className="lrow-t">待我回答 {qa.queue.length} 条{qa.escalated ? ` · 转讲师 ${qa.escalated}` : ''}</div><div className="small muted">助手已整理材料{qa.assistantConfigured ? '并起了草稿，确认或改一改' : '，写一条回答'}</div></div><Icon name="chevronRight" /></div>}
      {qa.mine.filter(q => q.status === 'open').slice(0, 2).map(q => <div key={q.id} className="lrow tap" onClick={() => nav('/questions?id=' + q.id)}><div style={{ flex: 1 }}><div className="lrow-t">{q.text}</div><div className="small muted">等回答{q.answers.length ? ` · 已有 ${q.answers.length} 条，去采纳` : ''}</div></div><Icon name="chevronRight" /></div>)}
    </div></div>}
    {show && <div className="card tappable" style={{ marginTop: 14 }} onClick={() => nav('/studios?show=' + show.id)}>
      <div className="small muted">市级展示 · {show.studioName} 主持</div><div style={{ fontWeight: 600, marginTop: 2 }}>{show.title}</div><div className="small muted">{fmtDay(show.at)}{show.place ? ' · ' + show.place : ''} · 上台 {show.entryCount} 件 · 作品与名师点评，没有分数</div>
    </div>}
    {community && <div className="sect"><div className="sect-t">跨园共同体</div><div className="sect-b">
      <div className="lrow tap" onClick={() => nav('/cases?community=1')}><div style={{ flex: 1 }}><div className="lrow-t">{community.name}</div><div className="small muted">{community.orgs.map(o => o.name + (o.key === community.lead ? '（组长园）' : '')).join('、')} · 共同体案例 {community.cases} 条{community.drills ? ` · 联合研讨题 ${community.drills}` : ''}</div></div><Icon name="chevronRight" /></div>
    </div></div>}
    {(pair?.mentor || pair?.mentees?.length > 0) && <div className="sect"><div className="sect-t">带教</div><div className="sect-b">
      {pair.mentor && <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">带教教师：{pair.mentor.name}</div><div className="small muted">你的实践关作品由 {pair.mentor.name} 点评</div></div></div>}
      {pair.mentees?.length > 0 && <div className="lrow tap" onClick={() => nav('/review')}><div style={{ flex: 1 }}><div className="lrow-t">带着 {pair.mentees.map(m => m.name).join('、')}</div><div className="small muted">看他们的实践关作品并点评</div></div><Icon name="chevronRight" /></div>}
    </div></div>}
    {canReview(user) && user?.academy?.role !== 'director' && <div className="sect"><div className="sect-b"><div className="lrow tap" onClick={() => nav('/review')}><div style={{ flex: 1 }}><div className="lrow-t">点评队列</div><div className="small muted">本园实践关待点评</div></div><Icon name="chevronRight" /></div></div></div>}
  </aside></div>
  </div>
}
