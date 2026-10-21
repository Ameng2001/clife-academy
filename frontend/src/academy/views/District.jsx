// 区县看板（GET /api/district/summary）：园所数、在学人数、各领域覆盖率中位数、认证人数、共同体活动、体检汇总。
// 不列任何一所园的数：园所只给名单，中位数不足三园不显示；不排名、不导出、无测验分（docs/ROADMAP.md 第八节「区县」行）。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'

export default function District() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [d, setD] = useState(null), [err, setErr] = useState(null), [orgs, setOrgs] = useState(null)
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [manage, setManage] = useState(false)
  const load = async () => {
    try { setD(await api('/api/district/summary')); setErr(null) } catch (e) { setErr(e.code === 'district' ? '区县管理员才能看区县看板。' : '没取到区县汇总。') }
    try { setOrgs((await api('/api/district/orgs')).orgs) } catch { setOrgs(null) }
  }
  useEffect(() => { if (user) load() }, [user?.id])
  const attach = async () => {
    const n = name.trim(); if (!n) return
    setBusy(true)
    try { const r = await api('/api/district/orgs', { method: 'PUT', body: JSON.stringify({ orgs: [{ name: n }] }) }); useUI.getState().toast(r.added ? '已挂进本区' : r.rejected.length ? '没挂成：' + r.rejected[0].code : '已在本区'); setName(''); await load() }
    catch (e) { useUI.getState().toast('没挂成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const detach = async o => {
    if (!confirm(`把「${o.name}」从本区解除挂接？`)) return
    try { await api('/api/district/orgs/remove', { method: 'POST', body: JSON.stringify({ org: o.key }) }); useUI.getState().toast('已解除'); await load() }
    catch (e) { useUI.getState().toast('没解成' + (e.message ? '：' + e.message : '')) }
  }
  const dn = d?.district?.name || user?.academy?.district?.name || ''
  return <div className="narrow">
    <div className="hdr"><div><h1>区县看板</h1><div className="sub">{dn ? dn + ' · ' : ''}只看汇总 · 不列单园 · 不排名</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!user && <div className="card small muted">区县管理员登录后看。</div>}
    {err && <div className="card small muted">{err}</div>}
    {d && !d.district && <div className="card small muted">这个账号没有区县归属。平台账号由平台给区县字段；开发桩登录时填区县。</div>}

    {d?.district && <>
      <div className="tiles">
        <div className="tile"><div className="l"><Icon name="gauge" />园所</div><div className="v">{d.orgCount}<span className="small muted"> 所</span></div><div className="small muted">有账号登录过或已挂接</div></div>
        <div className="tile"><div className="l"><Icon name="person" />在学</div><div className="v">{d.members_total}<span className="small muted"> 人</span></div><div className="small muted">本周通关 {d.passes7d} 关</div></div>
        <div className="tile"><div className="l"><Icon name="medal" />走完岗位路径</div><div className="v">{d.finished}<span className="small muted"> 人</span></div></div>
        <div className="tile"><div className="l"><Icon name="checkCircle" />领域认证</div><div className="v">{d.certified}<span className="small muted"> 人次</span></div><div className="small muted">走完一条领域路径记一次</div></div>
      </div>

      <div className="sect">
        <div className="sect-t">各领域覆盖率 · 中位数</div>
        <div className="sect-b">
          {!d.medians && <div className="card small muted">辖区不足 {d.minOrgs} 所园，不显示中位数：两所园的中位数等于暴露单园的数。</div>}
          {d.medians && <>
            <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">岗位路径完成率</div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${d.rateMedian}%` }} /></div></div><span className="small muted" style={{ marginInlineStart: 12 }}>{d.rateMedian}%</span></div>
            {d.domains.map(x => <div key={x.key} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{x.name}</div><div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${x.median}%` }} /></div></div><span className="small muted" style={{ marginInlineStart: 12 }}>{x.median}%</span></div>)}
            <div className="lrow small muted">覆盖率：一所园里该领域至少有一条证据（工具关通过、作品通过点评、研讨作答）的教师占比；这里是 {d.orgCount} 所园的中位数，不是平均，不是任何一所园。</div>
          </>}
        </div>
      </div>

      {d.activity && <div className="sect">
        <div className="sect-t">共同体活动</div>
        <div className="sect-b">
          <div className="lrow"><div style={{ flex: 1 }} className="lrow-t">斗课园内赛</div><span className="small muted">{d.activity.contests.total} 场 · 进行中 {d.activity.contests.open} · 已收官 {d.activity.contests.done}</span></div>
          <div className="lrow"><div style={{ flex: 1 }} className="lrow-t">研讨关作答</div><span className="small muted">{d.activity.drillAnswers} 条</span></div>
          <div className="lrow"><div style={{ flex: 1 }} className="lrow-t">入库案例</div><span className="small muted">{d.activity.cases} 条</span></div>
          <div className="lrow"><div style={{ flex: 1 }} className="lrow-t">大讲堂预约</div><span className="small muted">{d.activity.lectureBookings} 人次</span></div>
          <div className="lrow small muted">跨园共同体与共同体赛分期开；先在下面登记本区园所名单。</div>
        </div>
      </div>}

      <div className="sect">
        <div className="sect-t">体检汇总</div>
        <div className="sect-b">
          <div className="lrow"><div style={{ flex: 1 }} className="lrow-t">接通平台回传的园</div><span className="small muted">{d.checkup.pushed} / {d.orgCount}</span></div>
          <div className="lrow"><div style={{ flex: 1 }} className="lrow-t">本周有需关注项的园</div><span className="small muted">{d.checkup.warn} 所</span></div>
          <div className="lrow small muted">不列哪所园、哪一项。体检卡是园长自用的工具，区县在园长例会上提醒即可，不作考核。</div>
        </div>
      </div>

      <div className="sect">
        <div className="sect-t">本区园所 <span className="small muted">{d.orgCount} 所 · 按名称排序 · 无数字</span></div>
        <div className="sect-b">
          {(orgs || d.orgs).map(o => <div key={o.key} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{o.name}</div>{o.via && <div className="small muted">{o.via === 'manual' ? '手工挂接' : '成员账号带本区'}</div>}</div>{manage && o.via === 'manual' && <Button size="sm" variant="ghost" onClick={() => detach(o)}>解除</Button>}</div>)}
          {!d.orgCount && <div className="lrow small muted">还没有园。园所账号登录时带区县就会出现在这里；也可以手工挂接。</div>}
          <div className="lrow" style={{ gap: 8 }}>
            <Button size="sm" variant="ghost" onClick={() => setManage(!manage)}>{manage ? '收起' : '挂接园所'}</Button>
            {manage && <><TextField placeholder="园所名称（与登录账号的园名一致）" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} /><Button size="sm" disabled={busy || !name.trim()} onClick={attach}>挂接</Button></>}
          </div>
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 14 }}>大课堂不产生园所排名、教师名单与分数；上级要数，给的就是这一页。<span className="tap" style={{ color: 'var(--acc)', marginInlineStart: 6 }} onClick={() => nav('/paths/district')}>区县管理员路径 ›</span></div>
    </>}
  </div>
}
