// 教研共同体（/community）：幼师学坊的 UGC 一面，做成内容社区的样子（参照懂了鸭首页：顶部 tab、一张「本期」大卡＋「动动手」入口、
// 下面是带封面的作品卡网格，可筛可搜）。收的东西：专家案例、课程成果、合集、讲堂微课。
// 红线照旧：不显示人数、不点赞、不排行、评作品不评人；「关注」这种跟人走的 tab 不做，换成「本园」「本共同体」。
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { api } from '../../lib/api.js'
import { DOMAINS } from '../../lib/capability.js'
import { fmtDay } from './common.jsx'

const TABS = [['new', '最新'], ['org', '本园'], ['community', '本共同体'], ['collections', '合集'], ['domain', '按领域']]
const TYPES = [['', '全部'], ['case', '专家案例'], ['work', '课程成果'], ['clip', '讲堂微课']]
const TYPE_NAME = { case: '专家案例', work: '课程成果', clip: '讲堂微课', collection: '合集' }
const TYPE_KIND = { case: 'domain', work: 'stage', clip: 'clip', collection: 'role' }   // 封面底色沿用精品微课的四种
const TYPE_ICON = { case: 'sparkles', work: 'clipboard', clip: 'play', collection: 'grid' }
const dname = k => DOMAINS.find(d => d.key === k)?.name || k
const when = x => x.curated?.at || x.at || x.updatedAt || 0
// 工坊五大领域 → 七领域能力地图（课程成果按领域筛时用）
const FIVE_TO_SEVEN = { lang: 'plan', social: 'comm', health: 'life', art: 'env', sci: 'play' }

// 做成一张卡：封面（案例有图就用图，否则按类型底色）、类型、标题、谁 · 园 · 日期
function Card({ it, nav }) {
  return <div className="card course" onClick={() => nav(it.to)}>
    {it.img ? <div className="course-cover" style={{ padding: 0 }}><img src={it.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><span className="lb" style={{ position: 'absolute', left: 10, bottom: 10 }}>{it.label}</span></div>
      : <div className={'course-cover ' + TYPE_KIND[it.type]}><span className="ic"><Icon name={TYPE_ICON[it.type]} /></span><span className="lb">{it.label}</span></div>}
    <div className="course-m" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}><span className="tag" style={{ marginInlineEnd: 6 }}>{TYPE_NAME[it.type]}</span>{it.sub}</div>
    <div className="course-t">{it.title}</div>
    {it.message && <div className="small" style={{ margin: '4px 0 0', paddingInlineStart: 8, borderInlineStart: '3px solid var(--acc)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.message}</div>}
    <div className="course-f"><span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.by}{it.org ? ' · ' + it.org : ''}</span><span className="muted" style={{ flex: 'none', marginInlineStart: 6 }}>{it.at ? fmtDay(it.at) : ''}</span></div>
  </div>
}

export default function Community() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [sp, setSp] = useSearchParams()
  const tab = TABS.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : 'new'
  const type = TYPES.some(([k]) => k === sp.get('type')) ? sp.get('type') || '' : ''
  const domain = sp.get('domain') || ''
  const [q, setQ] = useState(sp.get('q') || '')
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') || '') !== q) setParam('q', q) }, 250); return () => clearTimeout(t) }, [q])
  const [cases, setCases] = useState(null), [works, setWorks] = useState(null), [clips, setClips] = useState([]), [cols, setCols] = useState([]), [community, setCommunity] = useState(null), [lecture, setLecture] = useState(null)
  useEffect(() => {
    if (!user) { setCases(null); setWorks(null); setClips([]); setCols([]); setCommunity(null); setLecture(null); return }
    api('/api/cases').then(r => setCases(r.cases.map(c => ({ ...c, useName: r.uses[c.use] })))).catch(() => setCases([]))
    api('/api/works').then(r => setWorks(r.works)).catch(() => setWorks([]))
    api('/api/lectures/clips').then(r => setClips(r.clips || [])).catch(() => setClips([]))
    api('/api/collections').then(r => setCols(r.collections || [])).catch(() => setCols([]))
    api('/api/me/community').then(r => setCommunity(r.community)).catch(() => setCommunity(null))
    api('/api/lectures').then(r => setLecture(r.upcoming[0] || r.done[0] || null)).catch(() => setLecture(null))
  }, [user?.id])
  const myOrg = user?.academy?.org?.name || null
  const commOrgs = useMemo(() => new Set((community?.orgs || []).map(o => o.name)), [community])

  // 四种东西拍平成一种卡
  const items = useMemo(() => {
    const img = c => { const f = c.files?.find(f => /^image\//.test(f.type || '')); return f ? `api/cases/file?id=${c.id}&hash=${f.hash}` : null }
    return [
      ...(cases || []).map(c => ({ type: 'case', id: c.id, title: c.title, by: c.byName, org: c.orgName, at: when(c), img: img(c), label: dname(c.domain) + (c.age ? ' · ' + c.age : ''), sub: c.useName || '', domains: [c.domain], showcase: !!c.showcase, text: c.text, to: '/cases?q=' + encodeURIComponent(c.title) })),
      ...(works || []).map(w => ({ type: 'work', id: w.id, title: w.title, by: w.byName, org: w.orgName, at: when(w), img: null, label: w.pipelineName + (w.age ? ' · ' + w.age : '') + (w.weeks ? ' · ' + w.weeks + ' 周' : ''), sub: (w.domainNames || []).join('、'), domains: (w.domains || []).map(d => FIVE_TO_SEVEN[d]).filter(Boolean), text: w.summary, message: w.message ? `${w.byName}：${w.message}` : '', to: '/works?q=' + encodeURIComponent(w.title) })),
      ...clips.map(c => ({ type: 'clip', id: c.id, title: c.title, by: c.speaker, org: null, at: c.at, img: null, label: c.lecture, sub: c.desc || '', domains: [], text: c.desc, to: '/library?type=clip' }))
    ].sort((a, b) => b.at - a.at)
  }, [cases, works, clips])
  const colItems = cols.map(c => ({ type: 'collection', id: c.id, title: c.title, by: c.byName, org: c.where, at: c.updatedAt, img: null, label: c.scopeName + ' · ' + c.total + ' 条', sub: c.desc || '', domains: [], text: c.desc, to: '/collections?id=' + c.id }))

  const kw = q.trim().toLowerCase()
  let shown = tab === 'collections' ? colItems : items
  if (tab === 'org') shown = shown.filter(it => myOrg && it.org === myOrg)
  if (tab === 'community') shown = shown.filter(it => it.org && commOrgs.has(it.org))
  if (type) shown = shown.filter(it => it.type === type)
  if (domain) shown = shown.filter(it => it.domains.includes(domain))
  if (kw) shown = shown.filter(it => [it.title, it.by, it.org, it.label, it.sub, it.text].filter(Boolean).join(' ').toLowerCase().includes(kw))
  const loading = cases === null || works === null
  const featured = items.find(it => it.showcase) || null

  return <div className="narrow wide">
    <div className="hdr"><div><h1>教研共同体</h1><div className="sub">教师在园里做过的事、在教研工坊做出来的课 · 实名共享 · 评作品不评人 · 不计人数、不排行</div></div><div className="hdr-actions">{user && <Button size="sm" variant="tinted" icon="plus" onClick={() => nav('/cases')}>分享一个</Button>}</div></div>
    {!user && <div className="card ac-note" style={{ marginTop: 12 }}>专家案例与课程成果实名共享，登录后可见。</div>}
    {user && <>
      <div className="ac-tabs">{TABS.filter(([k]) => k !== 'community' || community).map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setParam('tab', k === 'new' ? null : k)}>{t}</button>)}</div>

      <div className="grid2">
        {featured ? <div className="card course" style={{ padding: 12 }} onClick={() => nav(featured.to)}>
          {featured.img ? <div className="course-cover" style={{ padding: 0, aspectRatio: '2 / 1' }}><img src={featured.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
            : <div className="course-cover domain" style={{ aspectRatio: '2 / 1' }}><span className="ic"><Icon name="star" /></span><span className="lb">市级展示 · {featured.label}</span></div>}
          <div className="course-m">市级展示 · 名师点评过的案例</div><div className="course-t" style={{ fontSize: 18 }}>{featured.title}</div>
          <div className="small muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{featured.text}</div>
          <div className="course-f"><span className="muted">{featured.by}{featured.org ? ' · ' + featured.org : ''}</span><span style={{ color: 'var(--acc)', fontWeight: 600 }}>看 ›</span></div>
        </div> : lecture ? <div className="card course" style={{ padding: 12 }} onClick={() => nav('/lectures')}>
          <div className="course-cover clip" style={{ aspectRatio: '2 / 1' }}><span className="ic"><Icon name="play" /></span><span className="lb">名师讲堂 · {lecture.phase === 'done' ? '可回看' : fmtDay(lecture.at)}</span></div>
          <div className="course-m">名师讲堂 · 每月一场 · 一场留给课程成果</div><div className="course-t" style={{ fontSize: 18 }}>{lecture.title}</div>
          <div className="small muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{lecture.desc}</div>
          <div className="course-f"><span className="muted">{lecture.speaker}</span><span style={{ color: 'var(--acc)', fontWeight: 600 }}>{lecture.phase === 'done' ? '回看 ›' : '预约 ›'}</span></div>
        </div> : <div className="card ac-note">还没有市级展示的案例与讲堂场次。</div>}

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>动动手</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="tile tappable" onClick={() => nav('/cases')}><div className="l"><Icon name="sparkles" />分享一个案例</div><div className="small muted" style={{ marginTop: 4 }}>园里真实做过的一件事，标明怎么用</div></div>
            <div className="tile tappable" onClick={() => nav('/works')}><div className="l"><Icon name="clipboard" />分享一门课</div><div className="small muted" style={{ marginTop: 4 }}>在教研工坊做、班里用过，写明改了什么</div></div>
            <div className="tile tappable" onClick={() => nav('/collections')}><div className="l"><Icon name="grid" />建一份合集</div><div className="small muted" style={{ marginTop: 4 }}>按主题攒案例、关卡、讲堂微课</div></div>
            <div className="tile tappable" onClick={() => nav('/sharedays')}><div className="l"><Icon name="share" />交一页分享日</div><div className="small muted" style={{ marginTop: 4 }}>每学期一次，各园一页，不评比</div></div>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>在教研工坊里点「分享到幼师学坊」可以直接投过来：到「设置 → 接口令牌」建一枚投稿令牌。入库记的积分又能在工坊里用。{community ? ' 本共同体：' + community.name + '。' : ''}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, padding: 12 }}>
        <div className="ac-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, flex: 'none' }}>{tab === 'collections' ? '合集' : '全部作品'}</div>
          <TextField style={{ flex: 1, minWidth: 180 }} placeholder="搜标题、分享人、园所、领域" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {tab !== 'collections' && <div className="frow" style={{ marginTop: 8 }}><div className="fl">类型</div><div className="chips">{TYPES.map(([k, t]) => <button key={k} className={'chip' + (k === type ? ' on' : '')} onClick={() => setParam('type', k === type ? null : k)}>{t}</button>)}</div></div>}
        {tab !== 'collections' && <div className="frow"><div className="fl">领域</div><div className="chips"><button className={'chip' + (!domain ? ' on' : '')} onClick={() => setParam('domain', null)}>全部</button>{DOMAINS.map(d => <button key={d.key} className={'chip' + (d.key === domain ? ' on' : '')} onClick={() => setParam('domain', d.key === domain ? null : d.key)}>{d.name}</button>)}</div></div>}
        {loading ? <div className="small muted" style={{ marginTop: 10 }}>取中…</div>
          : shown.length === 0 ? <div className="small muted" style={{ marginTop: 10 }}>{tab === 'collections' ? '还没有合集。按主题攒几条，建一份。' : tab === 'org' ? '本园还没有入库的作品。' : '还没有匹配的作品。园里做过的事去「专家案例」分享，工坊里做过的课去「课程成果」分享。'}</div>
          : tab === 'domain' ? DOMAINS.map(d => { const ls = shown.filter(it => it.domains.includes(d.key)); return ls.length ? <div key={d.key} className="sect"><div className="sect-t">{d.name}</div><div className="course-grid">{ls.map(it => <Card key={it.type + it.id} it={it} nav={nav} />)}</div></div> : null })
          : <div className="course-grid">{shown.map(it => <Card key={it.type + it.id} it={it} nav={nav} />)}</div>}
        <div className="small muted" style={{ marginTop: 10 }}>入库的案例与成果是下一轮路径与讲堂的素材：名师讲堂讲它，合集收它，研讨关拿它出题。不显示浏览与点赞数，用过的人标「用过，有效」只给分享者看。</div>
      </div>
    </>}
  </div>
}
