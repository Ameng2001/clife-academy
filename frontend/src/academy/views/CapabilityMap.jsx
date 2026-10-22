// 能力地图：七个领域各一个状态（docs/ROADMAP.md 第五节）。给本人看的是「哪些领域有证据、哪些还空着」，
// 不是分数条，不和别人比。证据来自本人进度（工具关通过）与本人提交（作品、作答）。
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useSubmissions } from '../../store/useSubmissions.js'
import { capabilityMap, evidenceText } from '../../lib/capability.js'
import { useS } from './common.jsx'

const STATUS = { evidenced: ['有证据', 'var(--green)'], started: ['在做', 'var(--orange)'], empty: ['还空着', 'var(--label-3)'] }

export default function CapabilityMap() {
  const nav = useNavigate(), S = useS()
  const user = useStore(s => s.user)
  const subs = useSubmissions(s => s.all)
  useEffect(() => { if (user) useSubmissions.getState().loadAll() }, [user?.id])
  const m = useMemo(() => capabilityMap(S.progress, subs || []), [S.progress, subs])
  return <div className="narrow wide">
    <div className="hdr"><div><h1>能力地图</h1><div className="sub">《幼儿园教师专业标准》七个领域 · {m.evidenced} 个有证据</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    <div className="card small muted">只给本人看。证据是关卡通过、作品被点评通过、研讨作答三类；不是分数，不和别人比，不作考核依据。</div>
    <div className="sect"><div className="sect-b">
      {m.domains.map(d => { const [t, c] = STATUS[d.status]; return <div key={d.key} className={'lrow' + (d.cert ? ' tap' : '')} onClick={() => d.cert && nav('/paths/' + d.cert.path)}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: c, flex: 'none', marginInlineEnd: 12 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lrow-t">{d.name}<span className="small" style={{ marginInlineStart: 8, color: c }}>{t}</span></div>
          <div className="small muted">{evidenceText(d)}{d.cert ? ` · 领域路径 ${d.cert.done}/${d.cert.total}${d.cert.ready ? ' · 领域研修证书可申领' : ''}` : ''}</div>
        </div>
        {d.cert && <Icon name="chevronRight" />}
      </div> })}
    </div></div>
    <div className="sect"><div className="sect-t">平台工具</div><div className="sect-b">
      <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">账号、设备、工作台这类操作</div><div className="small muted">不属于专业领域，单独记：通过 {m.tools.done} / {m.tools.total} 关</div></div></div>
    </div></div>
    {!user && <div className="card small muted">登录后作品与作答的证据才会出现在这里。</div>}
    <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => nav('/me')}>回「我的」</Button>
  </div>
}
