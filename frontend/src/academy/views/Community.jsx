// 教研共同体（/community）：幼师学坊的 UGC 一面，和「学」的几页（路径、微课、讲堂）分开摆。
// 下面放五样东西：专家案例、课程成果、合集、园所分享日、名师工作室；落地页本身不做信息流墙，
// 只给三块：最新入库（案例与成果混排）、本园做过的、名师讲堂讲过的成果。不显示人数、不排行。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const ENTRIES = [
  ['cases', 'sparkles', '专家案例', '园里真实做过的事，标明可直接用 / 需改编 / 只看思路'],
  ['works', 'clipboard', '课程成果', '在教研工坊做出来、班里用过的课，写明改了什么'],
  ['collections', 'grid', '合集', '按主题攒案例、关卡、讲堂微课、资源'],
  ['sharedays', 'share', '园所分享日', '每学期一次，各园一页，共同体内交流'],
  ['studios', 'crown', '名师工作室', '专家讲师主持，骨干教师参加，每年一次市级展示']
]
const when = x => x.curated?.at || x.at

export default function Community() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [cases, setCases] = useState(null), [works, setWorks] = useState(null), [community, setCommunity] = useState(null), [lecture, setLecture] = useState(null)
  useEffect(() => {
    if (!user) { setCases(null); setWorks(null); setCommunity(null); setLecture(null); return }
    api('/api/cases').then(r => setCases(r.cases)).catch(() => setCases([]))
    api('/api/works').then(r => setWorks(r.works)).catch(() => setWorks([]))
    api('/api/me/community').then(r => setCommunity(r.community)).catch(() => setCommunity(null))
    // 名师讲堂里讲过（或排了要讲）课程成果与案例的那一场：有分享者或有展示案例的，最近的一场
    api('/api/lectures').then(r => { const all = [...r.upcoming, ...r.done]; setLecture(all.find(l => l.sharers?.length || l.showcase?.length) || null) }).catch(() => setLecture(null))
  }, [user?.id])
  const rows = [...(cases || []).map(c => ({ kind: 'case', id: c.id, title: c.title, by: c.byName, org: c.orgName, at: when(c), tag: '例', to: '/cases?q=' + encodeURIComponent(c.title) })),
    ...(works || []).map(w => ({ kind: 'work', id: w.id, title: w.title, by: w.byName, org: w.orgName, at: when(w), tag: '课', to: '/works?q=' + encodeURIComponent(w.title) }))].sort((a, b) => b.at - a.at)
  const myOrg = user?.academy?.org?.name || null
  const mine = myOrg ? rows.filter(r => r.org === myOrg) : []
  const Row = ({ r }) => <div className="lrow tap" onClick={() => nav(r.to)}><span className="chip" style={{ pointerEvents: 'none' }}>{r.tag}</span><div style={{ flex: 1 }}><div className="lrow-t">{r.title}</div><div className="small muted">{r.by}{r.org ? ' · ' + r.org : ''} · {fmtDay(r.at)}</div></div><Icon name="chevronRight" /></div>
  return <div className="narrow wide">
    <div className="hdr"><div><h1>教研共同体</h1><div className="sub">教师在园里做过的事、在教研工坊做出来的课 · 实名共享 · 评作品不评人 · 不计人数、不排行</div></div><div className="hdr-actions">{user && <Button size="sm" variant="tinted" icon="plus" onClick={() => nav('/cases')}>分享一个</Button>}</div></div>
    <div className="tiles">
      {ENTRIES.map(([k, ic, t, d]) => <div key={k} className="tile tappable" onClick={() => nav('/' + k)}><div className="l"><Icon name={ic} />{t}</div><div className="small muted" style={{ marginTop: 4 }}>{d}</div></div>)}
      {community && <div className="tile tappable" onClick={() => nav('/cases?community=1')}><div className="l"><Icon name="globe" />跨园共同体</div><div className="v" style={{ fontSize: 15 }}>{community.name}</div><div className="small muted">{community.orgs.map(o => o.name + (o.key === community.lead ? '（组长园）' : '')).join('、')}</div></div>}
    </div>
    {!user && <div className="card ac-note" style={{ marginTop: 12 }}>专家案例与课程成果实名共享，登录后可见。</div>}
    {user && <div className="grid2">
      <div className="sect" style={{ marginTop: 12 }}><div className="sect-t">最新入库</div><div className="sect-b">
        {cases === null || works === null ? <div className="lrow"><div className="small muted">取中…</div></div>
          : rows.length === 0 ? <div className="lrow"><div className="small muted">还没有入库的案例与成果。园里做过的事去「专家案例」分享，工坊里做过的课去「课程成果」分享。</div></div>
          : rows.slice(0, 8).map(r => <Row key={r.kind + r.id} r={r} />)}
      </div></div>
      <div>
        {myOrg && <div className="sect" style={{ marginTop: 12 }}><div className="sect-t">本园做过的 <span className="small muted" style={{ fontWeight: 400 }}>{myOrg}</span></div><div className="sect-b">
          {mine.length === 0 ? <div className="lrow"><div className="small muted">本园还没有入库的案例与成果。</div></div> : mine.slice(0, 6).map(r => <Row key={r.kind + r.id} r={r} />)}
        </div></div>}
        {lecture && <div className="card tappable" style={{ marginTop: 12 }} onClick={() => nav('/lectures')}>
          <div className="small muted">名师讲堂 · {lecture.phase === 'done' ? '讲过' : '要讲'}这些 · {fmtDay(lecture.at)}</div><div style={{ fontWeight: 600, marginTop: 2 }}>{lecture.title}</div>
          {lecture.sharers?.length > 0 && <div className="small muted" style={{ marginTop: 4 }}>上台分享：{lecture.sharers.map(s => s.name + (s.caseTitle ? '《' + s.caseTitle + '》' : '')).join('、')}</div>}
          {lecture.showcase?.length > 0 && <div className="small muted" style={{ marginTop: 2 }}>讲到的案例：{lecture.showcase.map(c => '《' + c.title + '》').join('')}</div>}
        </div>}
        <div className="card ac-note" style={{ marginTop: 12 }}>入库的案例与成果是下一轮路径与讲堂的素材：名师讲堂讲它，合集收它，研讨关拿它出题。学分换的积分可在教研工坊里用。</div>
      </div>
    </div>}
  </div>
}
