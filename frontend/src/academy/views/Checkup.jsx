// 本园应用体检卡：12 项探针，11 项平台每周回传、「学习」大课堂自己算。只看园所对平台的使用情况：不出现幼儿数据、不排名、不作考核依据。
// 同一项连续两周需关注 → 推荐对应岗位的关卡。新上线园所前两周只开三项。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { useStore } from '../../store/useStore.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const SN = { ok: ['正常', 'var(--green)'], warn: ['需关注', 'var(--orange)'], idle: ['未开始', 'var(--label-3)'] }
const Pill = ({ s, n }) => { const [t, c] = SN[s]; return <span className="tag" style={{ color: c, background: `color-mix(in srgb,${c} 14%,transparent)` }}>{t}{n != null ? ' ' + n : ''}</span> }

export function CheckupCard({ data, compact }) {
  const nav = useNavigate()
  if (!data?.card) return <div className="card small muted">登录的账号没有园所，没有体检卡。</div>
  const c = data.card
  return <>
    <div className="ac-row" style={{ flexWrap: 'wrap', gap: 6 }}>
      <span className="small muted">{fmtDay(new Date(c.week + 'T00:00').getTime())} 这周{c.generatedAt ? ' · 平台 ' + fmtDay(c.generatedAt) + ' 回传' : data.pushed ? ' · 平台还没回传' : ' · 还没接平台'}</span>
      <span className="row" style={{ gap: 6 }}><Pill s="ok" n={c.sum.ok} /><Pill s="warn" n={c.sum.warn} /><Pill s="idle" n={c.sum.idle} /></span>
    </div>
    {c.limited && <div className="ac-note" style={{ marginTop: 8 }}>新上线园所前两周只看账号覆盖、基础数据、设备在线三项，其余 {c.total - c.probes.length} 项两周后开。</div>}
    {c.recommendations.length > 0 && <div className="card" style={{ marginTop: 10, padding: 12 }}>
      <div className="small muted">连续两周需关注，推荐对应岗位学</div>
      {c.recommendations.map(r => <div key={r.levelId} className="lrow tap" onClick={() => nav('/level/' + r.levelId)}><div style={{ flex: 1 }}><div className="lrow-t">「{r.title}」</div><div className="small muted">{r.why}</div></div><Icon name="chevronRight" /></div>)}
    </div>}
    {(compact ? c.probes.filter(p => p.status !== 'ok').concat(c.probes.filter(p => p.status === 'ok')).slice(0, 5) : c.probes).map(p => <div key={p.key} className="card" style={{ marginTop: 8, padding: 12 }}>
      <div className="ac-row"><span style={{ fontWeight: 600 }}>{p.name}</span><Pill s={p.status} /></div>
      <div className="small" style={{ marginTop: 4 }}>{p.text}</div>
      <div className="ac-row" style={{ marginTop: 8 }}>
        <span className="row" style={{ gap: 4, alignItems: 'center' }}>{p.weeks.map((w, i) => <i key={i} title={c.weeks[i]} style={{ width: 14, height: 14, borderRadius: 3, display: 'inline-block', background: w === 'ok' ? 'var(--green)' : w === 'warn' ? 'var(--orange)' : 'var(--surface-3)' }} />)}<span className="small muted" style={{ marginInlineStart: 6 }}>近 4 周</span></span>
        {p.go?.levelId && <span className="small tap" style={{ color: 'var(--acc)' }} onClick={() => nav('/level/' + p.go.levelId)}>{p.act} ›</span>}
        {p.go?.local && <span className="small muted">{p.act}（本地专区）</span>}
      </div>
    </div>)}
  </>
}

export default function Checkup() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [data, setData] = useState(null), [err, setErr] = useState(null)
  useEffect(() => { if (user) api('/api/org/checkup').then(setData).catch(e => setErr(e.code === 'director' ? '园长才能看体检卡。' : '没取到体检卡。')); }, [user?.id])
  return <div className="narrow wide">
    <div className="hdr"><div><h1>本园应用体检</h1><div className="sub">每周一出卡 · 共 12 项 · 只看平台使用情况</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!user && <div className="card small muted">园长登录后看。</div>}
    {err && <div className="card small muted">{err}</div>}
    {data && <CheckupCard data={data} />}
    <div className="small muted" style={{ marginTop: 14 }}>不出现单个幼儿数据，不做园所排名，不作为教师考核依据。区县教育局只看汇总口径。</div>
  </div>
}
