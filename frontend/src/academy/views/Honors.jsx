// 我的荣誉与积分：勋章（按记录算）、称号（人授）、积分余额与最近几笔（积分是平台唯一的资产，花在教研工坊等工具的额度与教学物料上）。
// 钱包页与教研工坊统一，学坊不单独做：这里只给余额和最近几笔，明细在工坊的钱包页。
// 不排行、不公开；颁发在名师讲堂或园内活动上，这里只是记录。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { useStore } from '../../store/useStore.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

export default function Honors() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [h, setH] = useState(null), [p, setP] = useState(null), [org, setOrg] = useState(null)
  const load = () => { if (!user) return; api('/api/me/honors').then(setH).catch(() => setH(null)); api('/api/me/points').then(setP).catch(() => setP(null)); api('/api/org/honors').then(setOrg).catch(() => setOrg(null)) }
  useEffect(() => { load() }, [user?.id])
  const growth = h?.badges.filter(b => b.kind === 'growth') || [], contrib = h?.badges.filter(b => b.kind === 'contribution') || []
  return <div className="narrow wide">
    <div className="hdr"><div><h1>荣誉与积分</h1><div className="sub">只给本人看 · 不排行 · 不与考核挂钩</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!user && <div className="card small muted">登录后在这里看。</div>}

    {p && <div className="card">
      <div className="tiles" style={{ margin: 0 }}>
        <div className="tile"><div className="l">积分</div><div className="v">{p.points}</div><div className="small muted">{p.quota?.left > 0 || p.quota?.used > 0 ? `园所额度 ${p.quota.left}（园长分的，只用在工具上，先扣它再扣积分${p.quota.used ? `，已用 ${p.quota.used}` : ''}）` : '过关、入库、互动都自动记'}</div></div>
        <div className="tile"><div className="l">通过的关</div><div className="v">{p.levelsPassed}</div><div className="small muted">每关 {p.rules?.earn?.level ?? 10} 积分</div></div>
      </div>
      <div className="small muted" style={{ marginTop: 10 }}>积分是工具的使用额度：{Object.values(p.tools).join('、')}里换特定资源时扣。只有你自己看得到，不排行、不可转赠。明细与花销在教研工坊的钱包页看，两边是同一个账。 <span className="tap" style={{ color: 'var(--acc)' }} onClick={() => nav('/mall')}>教学物料商城 ›</span></div>
      {p.history?.length > 0 && <div style={{ marginTop: 10 }}>
        <div className="small muted">最近几笔{p.history.some(x => x.sub === 'quota') ? '。标「园所额度」的几笔扣的是园长分的额度，没动你的积分' : ''}</div>
        {p.history.slice(0, 8).map((x, i) => <div key={i} className="ac-row small" style={{ marginTop: 4 }}><span className="muted">{fmtDay(x.at)} · {x.tool ? x.tool + ' · ' : ''}{x.sub === 'quota' && <span className="tag acc" style={{ marginInlineEnd: 4 }}>园所额度</span>}{x.note}</span><span title={x.sub === 'quota' ? '从园所额度扣' : undefined} style={{ color: x.n > 0 ? 'var(--green)' : x.sub === 'quota' ? 'var(--label-3)' : 'var(--label-2)' }}>{x.n > 0 ? '+' : ''}{x.n}</span></div>)}
      </div>}
    </div>}

    {h?.titles.length > 0 && <div className="sect"><div className="sect-t">荣誉称号 <span className="tap small" style={{ color: 'var(--acc)', marginInlineStart: 8 }} onClick={() => nav('/studios')}>名师工作室 ›</span></div><div className="sect-b">
      {h.titles.map(t => <div key={t.id} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t"><Icon name="crown" /> {t.label}</div><div className="small muted">{t.byName} 授 · {fmtDay(t.at)} · {t.reason}</div></div></div>)}
    </div></div>}

    {h && <div className="sect"><div className="sect-t">成长勋章 <span className="tap small" style={{ color: 'var(--acc)', marginInlineStart: 8 }} onClick={() => nav('/certs')}>证书与认证 ›</span> <span className="tap small" style={{ color: 'var(--acc)', marginInlineStart: 8 }} onClick={() => nav('/portfolio')}>发展档案 ›</span></div>
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

    {org && <div className="sect"><div className="sect-t">园所集体荣誉 <span className="small muted">{org.orgName || '本园'} · 系统按园统计 · 只给本园看</span></div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
        {!org.badges.length && <div className="small muted">本园同岗位满 3 人后才会出现。</div>}
        {org.badges.map(b => <div key={b.key} className={'ac-badge' + (b.on ? ' on' : '')} title={b.desc}><div className="b"><Icon name={b.on ? 'trophy' : 'dot'} /></div><div className="small" style={{ fontSize: 12 }}>{b.name}</div><div className="small muted" style={{ fontSize: 11 }}>{b.on ? fmtDay(b.at) : `${b.progress}/${b.of}`}</div></div>)}
      </div>
    </div>}
    {h?.credits.length > 0 && <div className="sect"><div className="sect-t">记过的事</div><div className="sect-b">
      {h.credits.map((c, i) => <div key={i} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{c.note}</div><div className="small muted">{fmtDay(c.at)}</div></div></div>)}
    </div></div>}
  </div>
}
