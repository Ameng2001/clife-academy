// 我的荣誉与学分：勋章（按记录算）、称号（人授）、学分明细、学分兑积分（积分是教研工坊、观察评价工具、贝果实验室的使用额度）。
// 不排行、不公开；颁发在大讲堂或园内活动上，这里只是记录。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { useS, fmtDay } from './common.jsx'

export default function Honors() {
  const nav = useNavigate(), S = useS()
  const user = useStore(s => s.user)
  const [h, setH] = useState(null), [p, setP] = useState(null), [n, setN] = useState(''), [busy, setBusy] = useState(false)
  const load = () => { if (!user) return; api('/api/me/honors').then(setH).catch(() => setH(null)); api('/api/me/points').then(setP).catch(() => setP(null)) }
  useEffect(() => { load() }, [user?.id])
  const levelCredits = Object.values(S.credits || {}).reduce((a, b) => a + b, 0)
  const exchange = async () => {
    const c = Math.floor(Number(n)); if (!(c >= 1)) return useUI.getState().toast('填要兑的学分数')
    if (!confirm(`用 ${c} 学分兑 ${c * p.rate} 积分？兑了不能换回来。`)) return
    setBusy(true)
    try { const r = await api('/api/me/points/exchange', { method: 'POST', body: JSON.stringify({ credits: c }) }); setP({ ...p, ...r }); setN(''); useUI.getState().toast(`已兑，现有 ${r.points} 积分`); load() }
    catch (e) { useUI.getState().toast('没兑成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const growth = h?.badges.filter(b => b.kind === 'growth') || [], contrib = h?.badges.filter(b => b.kind === 'contribution') || []
  return <div className="narrow">
    <div className="hdr"><div><h1>荣誉与学分</h1><div className="sub">只给本人看 · 不排行 · 不与考核挂钩</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!user && <div className="card small muted">登录后在这里看。</div>}

    {p && <div className="card">
      <div className="tiles" style={{ margin: 0 }}>
        <div className="tile"><div className="l">学分</div><div className="v">{p.creditsEarned}</div><div className="small muted">关卡 {levelCredits} · 案例与精选 {h?.creditsTotal ?? 0}</div></div>
        <div className="tile"><div className="l">积分</div><div className="v">{p.points}</div><div className="small muted">可兑学分 {p.creditsAvailable}</div></div>
      </div>
      <div className="small muted" style={{ marginTop: 10 }}>1 学分兑 {p.rate} 积分。积分是工具的使用额度：{Object.values(p.tools).join('、')}里换特定资源时扣。兑了不能换回。</div>
      {p.creditsAvailable > 0 && <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField type="number" placeholder={`最多 ${p.creditsAvailable}`} value={n} onChange={e => setN(e.target.value)} style={{ width: 120 }} />
        <Button size="sm" onClick={() => setN(String(p.creditsAvailable))}>全部</Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={exchange}>兑积分</Button>
      </div>}
      {p.history?.length > 0 && <div style={{ marginTop: 10 }}>{p.history.slice(0, 8).map((x, i) => <div key={i} className="ac-row small" style={{ marginTop: 4 }}><span className="muted">{fmtDay(x.at)} · {x.tool ? x.tool + ' · ' : ''}{x.note}</span><span style={{ color: x.n > 0 ? 'var(--green)' : 'var(--label-2)' }}>{x.n > 0 ? '+' : ''}{x.n}</span></div>)}</div>}
    </div>}

    {h?.titles.length > 0 && <div className="sect"><div className="sect-t">荣誉称号 <span className="tap small" style={{ color: 'var(--acc)', marginInlineStart: 8 }} onClick={() => nav('/studios')}>名师工作室 ›</span></div><div className="sect-b">
      {h.titles.map(t => <div key={t.id} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t"><Icon name="crown" /> {t.label}</div><div className="small muted">{t.byName} 授 · {fmtDay(t.at)} · {t.reason}</div></div></div>)}
    </div></div>}

    {h && <div className="sect"><div className="sect-t">成长勋章 <span className="tap small" style={{ color: 'var(--acc)', marginInlineStart: 8 }} onClick={() => nav('/certs')}>证书与认证 ›</span></div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 8 }}>
        {growth.map(b => <div key={b.key} className={'ac-badge' + (b.on ? ' on' : '')} title={b.desc}><div className="b">{b.name[0]}</div><div className="small" style={{ fontSize: 12 }}>{b.name}</div><div className="small muted" style={{ fontSize: 11 }}>{b.on ? fmtDay(b.at) : '未获得'}</div></div>)}
      </div>
    </div>}
    {h && <div className="sect"><div className="sect-t">贡献勋章</div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 8 }}>
        {contrib.map(b => <div key={b.key} className={'ac-badge' + (b.on ? ' on' : '')} title={b.desc}><div className="b"><Icon name={b.on ? 'medal' : 'dot'} /></div><div className="small" style={{ fontSize: 12 }}>{b.name}</div><div className="small muted" style={{ fontSize: 11 }}>{b.on ? fmtDay(b.at) : `${b.progress}/${b.of}`}</div></div>)}
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>条件公开：案例被采纳、作答被精选、给同事写意见、带出一个人。不按在线时长、登录天数发任何东西。</div>
    </div>}

    {h?.credits.length > 0 && <div className="sect"><div className="sect-t">关卡以外的学分</div><div className="sect-b">
      {h.credits.map((c, i) => <div key={i} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{c.note}</div><div className="small muted">{fmtDay(c.at)}</div></div><span style={{ color: 'var(--green)' }}>+{c.n}</span></div>)}
    </div></div>}
  </div>
}
