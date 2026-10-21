// 园长看板：本园各岗位在大课堂里的学习情况（GET /api/org/summary）。
// 只按岗位汇总与补训建议；人员列表只有通过关数与最近学习日期，没有测验分；不跨园、不排名（docs/ROADMAP.md 第八节）。
// 探针体检卡要接平台数据，这里先占位。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { api } from '../../lib/api.js'
import { PROBES } from '../../lib/lessons.js'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { fmtDay } from './common.jsx'

export default function Director() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [data, setData] = useState(null), [err, setErr] = useState(null), [busy, setBusy] = useState(false)
  const load = async () => {
    setBusy(true)
    try { setData(await api('/api/org/summary')); setErr(null) }
    catch (e) { setErr(e) }
    finally { setBusy(false) }
  }
  useEffect(() => { if (user) load() }, [user?.id])

  const head = <div className="hdr">
    <div><h1>园长看板</h1><div className="sub">{data?.org?.name || user?.academy?.org?.name || '本园'}{data ? ` · ${fmtDay(data.at)}` : ''}</div></div>
    <div className="hdr-actions"><button className="iconbtn" disabled={busy} onClick={load}><Icon name="repeat" /></button><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
  </div>

  if (!user) return <div className="narrow">{head}<div className="card small muted">登录园长账号后可看本园情况。</div></div>
  if (err) return <div className="narrow">{head}<div className="card small">{err.status === 403 ? '这页只给园长看。岗位由平台账号决定。' : err.status === 401 ? '登录已过期，请重新登录。' : '没取到数据' + (err.message ? '：' + err.message : '')}</div></div>
  if (!data) return <div className="narrow">{head}<div className="card small muted">正在取数…</div></div>

  const roles = data.roles.filter(r => r.members > 0)
  const needs = roles.filter(r => r.next && r.finished < r.members).sort((a, b) => a.rate - b.rate)
  return <div className="narrow">
    {head}
    <div className="tiles">
      <div className="tile"><div className="l"><Icon name="personCircle" />本园在学</div><div className="v">{data.members_total}<span className="small muted"> 人</span></div></div>
      <div className="tile"><div className="l"><Icon name="checkCircle" />本周通关</div><div className="v">{data.passes7d}<span className="small muted"> 关</span></div></div>
    </div>

    <div className="sect"><div className="sect-t">各岗位完成情况</div><div className="sect-b">
      {!roles.length && <div className="lrow small muted">还没有本园教师登录过大课堂。</div>}
      {roles.map(r => <div key={r.role} className="lrow">
        <div style={{ flex: 1 }}>
          <div className="lrow-t">{r.name}<span className="small muted" style={{ marginInlineStart: 8 }}>{r.members} 人 · 完成 {r.finished} · 在学 {r.started} · 未开始 {r.members - r.finished - r.started}</span></div>
          <div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${r.rate}%` }} /></div>
        </div>
        <span className="small muted" style={{ marginInlineStart: 12, minWidth: 56, textAlign: 'end' }}>{r.rate}%<br />{r.avgDone}/{r.total} 关</span>
      </div>)}
    </div></div>

    <div className="sect"><div className="sect-t">补训建议</div><div className="sect-b">
      {!needs.length && <div className="lrow small muted">各岗位都已完成，或还没有人开始。</div>}
      {needs.map(r => <div key={r.role} className="lrow tap" onClick={() => nav('/level/' + r.next.levelId)}>
        <div style={{ flex: 1 }}><div className="lrow-t">{r.name}：{r.next.count} 人停在「{r.next.title}」</div><div className="small muted">建议午睡时段集中学这一关，由种子教师陪练。</div></div>
        <Icon name="chevronRight" />
      </div>)}
    </div></div>

    <div className="sect"><div className="sect-t">本园人员</div><div className="sect-b">
      {data.members.map(m => <div key={m.id} className="lrow">
        <div style={{ flex: 1 }}><div className="lrow-t">{m.name}<span className="small muted" style={{ marginInlineStart: 8 }}>{m.roleName}</span></div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${m.total ? m.done / m.total * 100 : 0}%` }} /></div></div>
        <span className="small muted" style={{ marginInlineStart: 12, minWidth: 72, textAlign: 'end' }}>{m.done}/{m.total} 关<br />{m.lastAt ? fmtDay(m.lastAt) : '未开始'}</span>
      </div>)}
    </div></div>

    <div className="sect"><div className="sect-t">本园应用体检</div>
      <div className="card small muted">{PROBES.length} 项探针接平台数据后每周出卡。这里只看园所对平台的使用情况，不出现任何幼儿数据，不排名，不作考核依据。</div>
    </div>
    <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => nav('/home')}>回首页</Button>
  </div>
}
