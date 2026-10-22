// 运营后台汇总（/api/admin/overview）：管理员的一页，按六组摆开——用户与园所、研修期次、资源与案例、发题与点评、公告、审计。
// 每组只给数字与入口，事情在各自页面做；只有公告、用户停用、邀请码、审计流水在这页直接做（它们没有别的页）。不列个人成绩、不排名。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'
import { useBrand } from '../brand.js'

const fmtWhen = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}-${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}` }
const toLocal = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

function Group({ title, icon, children }) { return <div className="sect"><div className="sect-t"><Icon name={icon} /> {title}</div><div className="sect-b">{children}</div></div> }
function Row({ to, title, sub, n, onClick }) {
  const nav = useNavigate()
  return <div className={'lrow' + (to || onClick ? ' tap' : '')} onClick={() => (onClick ? onClick() : to && nav(to))}><div style={{ flex: 1 }}><div className="lrow-t">{title}</div>{sub && <div className="small muted">{sub}</div>}</div>{n != null && <span className="tag">{n}</span>}{(to || onClick) && <Icon name="more" />}</div>
}

function Notices({ list, onChange }) {
  const toast = useUI.getState().toast
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false)
  const save = async () => {
    if (form.title.trim().length < 2 || form.text.trim().length < 4) return toast('标题至少 2 个字，正文至少 4 个字')
    setBusy(true)
    try { await api('/api/admin/notices', { method: 'POST', body: JSON.stringify({ id: form.id || undefined, title: form.title, text: form.text, until: form.until ? new Date(form.until + 'T23:59').getTime() : undefined }) }); toast(form.id ? '已改' : '已发'); setForm(null); onChange() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  const remove = async n => { if (!confirm('撤这条公告？')) return; try { await api('/api/admin/notices', { method: 'POST', body: JSON.stringify({ id: n.id, remove: true }) }); onChange() } catch (e) { toast('没成') } }
  return <>
    {!form && <Row title="发一条" sub="首页顶上一条，可带截止日；不推送、不统计谁看过" onClick={() => setForm({ title: '', text: '', until: '' })} />}
    {form && <div style={{ padding: '8px 0' }}>
      <TextField placeholder="标题，如「周五晚平台维护」" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <TextArea rows={3} style={{ marginTop: 8 }} placeholder="正文：一两句说清事、时间、找谁" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className="small muted">显示到</span><input className="ac-sel" type="date" value={form.until} onChange={e => setForm({ ...form, until: e.target.value })} /><span className="small muted">不填一直显示</span><span style={{ flex: 1 }} /><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button size="sm" variant="primary" disabled={busy} onClick={save}>{form.id ? '改' : '发'}</Button></div>
    </div>}
    {list.map(n => <div key={n.id} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{n.title}{n.until && n.until < Date.now() ? <span className="small muted" style={{ marginInlineStart: 8 }}>已到期</span> : null}</div><div className="small" style={{ whiteSpace: 'pre-wrap' }}>{n.text}</div><div className="small muted">{n.byName} · {fmtDay(n.at)}{n.until ? ' · 显示到 ' + fmtDay(n.until) : ''}</div></div><div className="row" style={{ gap: 4 }}><button className="chip" onClick={() => setForm({ id: n.id, title: n.title, text: n.text, until: n.until ? toLocal(n.until) : '' })}>改</button><button className="chip" onClick={() => remove(n)}>撤</button></div></div>)}
    {!list.length && <div className="small muted" style={{ padding: '6px 0' }}>还没有公告。</div>}
  </>
}

function Users() {
  const toast = useUI.getState().toast
  const me = useStore(s => s.user)
  const [d, setD] = useState(null), [q, setQ] = useState(''), [open, setOpen] = useState(false)
  const load = () => api('/api/admin/users').then(setD).catch(() => setD(null))
  useEffect(() => { if (open && !d) load() }, [open])
  const toggle = async u => { if (!confirm(u.disabled ? `恢复 ${u.name}？` : `停用 ${u.name}？停用后登不进来，数据不动。`)) return; try { await api('/api/admin/user/disable', { method: 'POST', body: JSON.stringify({ id: u.id, disabled: !u.disabled }) }); load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } }
  const list = (d?.users || []).filter(u => !q || u.name.includes(q)).sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 50)
  return <>
    <Row title="用户名单" sub={open ? '按名字找；停用只是锁门，不删数据' : '找人、停用、恢复'} n={d ? d.users.length : null} onClick={() => setOpen(!open)} />
    {open && <div style={{ padding: '4px 0 8px' }}>
      <TextField placeholder="按名字找" value={q} onChange={e => setQ(e.target.value)} />
      {list.map(u => <div key={u.id} className="ac-row small" style={{ marginTop: 6 }}><span>{u.name}{u.admin ? ' · 管理员' : ''}{u.disabled ? ' · 已停用' : ''}<span className="muted">{u.created ? ' · ' + fmtDay(u.created) : ''}</span></span>{!u.admin && u.id !== me?.id && <button className="chip" onClick={() => toggle(u)}>{u.disabled ? '恢复' : '停用'}</button>}</div>)}
      {d && list.length === 50 && <div className="small muted" style={{ marginTop: 6 }}>只列最近 50 个，按名字找更多。</div>}
    </div>}
  </>
}

function Invites() {
  const toast = useUI.getState().toast
  const [d, setD] = useState(null), [open, setOpen] = useState(false)
  const load = () => api('/api/admin/invites').then(setD).catch(() => setD(null))
  useEffect(() => { if (open && !d) load() }, [open])
  const make = async () => { try { const r = await api('/api/admin/invites/new', { method: 'POST', body: JSON.stringify({}) }); toast('新码 ' + (r.code || r.invite?.code || '')); load() } catch (e) { toast('没成') } }
  const revoke = async i => { if (!confirm(`撤 ${i.code}？`)) return; try { await api('/api/admin/invites/revoke', { method: 'POST', body: JSON.stringify({ code: i.code }) }); load() } catch (e) { toast('没成') } }
  const unused = (d?.invites || []).filter(i => !i.usedBy && !i.revoked)
  return <>
    <Row title="邀请码" sub={d ? (d.invite_only ? '只凭邀请码注册' : '现在不限邀请，码可备着') : '新建、撤销'} n={d ? unused.length : null} onClick={() => setOpen(!open)} />
    {open && <div style={{ padding: '4px 0 8px' }}>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}><Button size="sm" variant="tinted" icon="plus" onClick={make}>新建一个</Button><span className="small muted">给谁就把码发给谁</span></div>
      {unused.map(i => <div key={i.code} className="ac-row small" style={{ marginTop: 6 }}><span style={{ fontFamily: 'ui-monospace, monospace' }}>{i.code}</span><button className="chip" onClick={() => revoke(i)}>撤</button></div>)}
      {d && (d.invites || []).filter(i => i.usedBy).slice(-5).map(i => <div key={i.code} className="small muted" style={{ marginTop: 4 }}>{i.code} · {i.usedByName || '已用'}</div>)}
    </div>}
  </>
}

function Audit({ n }) {
  const [d, setD] = useState(null), [cat, setCat] = useState(''), [open, setOpen] = useState(false)
  useEffect(() => { if (open) api(`/api/admin/audit?limit=30${cat ? '&cat=' + cat : ''}`).then(setD).catch(() => setD(null)) }, [open, cat])
  return <>
    <Row title="最近流水" sub="登录、改权限、删改内容；只看，不清" n={n} onClick={() => setOpen(!open)} />
    {open && <div style={{ padding: '4px 0 8px' }}>
      <div className="chips">{[['', '全部'], ['fail', '失败'], ['auth', '登录'], ['admin', '管理'], ['academy', '课堂']].map(([k, l]) => <button key={k} className={'chip' + (cat === k ? ' on' : '')} onClick={() => setCat(k)}>{l}</button>)}</div>
      {d && !d.enabled && <div className="small muted" style={{ marginTop: 6 }}>审计没开（AUDIT=0）。</div>}
      {(d?.events || []).map(e => <div key={e.id} className="small" style={{ marginTop: 6, color: e.ok ? undefined : 'var(--red, #c33)' }}><span className="muted">{fmtWhen(e.ts)}</span> · {e.ev}{e.name ? ' · ' + e.name : ''}{e.tname ? ' → ' + e.tname : ''}{e.msg ? ' · ' + e.msg : ''}</div>)}
      {d && !d.events.length && <div className="small muted" style={{ marginTop: 6 }}>没有。</div>}
    </div>}
  </>
}

// 平台名称：全称、短名、地区、一句话、技术支持署名。改了网页、小程序、证书、答疑提示词一起换；存完刷新 /api/config。
function BrandEditor({ onDone }) {
  const toast = useUI.getState().toast
  const refreshConfig = useStore(s => s.refreshConfig)
  const [d, setD] = useState(null), [f, setF] = useState(null), [busy, setBusy] = useState(false)
  useEffect(() => { api('/api/brand').then(r => { setD(r); setF({ ...r.brand }) }).catch(() => setD(null)) }, [])
  const save = async (body) => { setBusy(true); try { await api('/api/brand', { method: 'PUT', body: JSON.stringify(body) }); await refreshConfig(); toast('已改'); onDone() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  if (!f) return <div className="small muted" style={{ padding: '6px 0' }}>正在取…</div>
  const L = d.limits, set = k => e => setF({ ...f, [k]: e.target.value })
  return <div className="card" style={{ marginTop: 8 }}>
    <div className="small muted">全称（≤ {L.name} 字）· 登录页、证书、设置「关于」</div>
    <TextField value={f.name} maxLength={L.name} placeholder="如：龙城幼师学堂" onChange={set('name')} />
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 160 }}><div className="small muted">短名（≤ {L.short} 字）· 顶部导航、首页、小程序标题</div><TextField value={f.short} maxLength={L.short} placeholder="如：幼师学堂" onChange={set('short')} /></div>
      <div style={{ flex: 1, minWidth: 160 }}><div className="small muted">地区（可空）· 证书与小程序顶栏副题</div><TextField value={f.region} maxLength={L.region} placeholder="如：柳州市" onChange={set('region')} /></div>
    </div>
    <div className="small muted" style={{ marginTop: 8 }}>一句话 · 登录页副题</div>
    <TextField value={f.tagline} maxLength={L.tagline} onChange={set('tagline')} />
    <div className="small muted" style={{ marginTop: 8 }}>技术支持署名（可空）· 证书页脚</div>
    <TextField value={f.credit} maxLength={L.credit} placeholder="如：技术支持：C-Life" onChange={set('credit')} />
    <div className="ac-row" style={{ marginTop: 10 }}><Button size="sm" disabled={busy} onClick={() => confirm('回到默认「' + d.defaults.name + '」？') && save({ reset: true })}>回到默认</Button><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={onDone}>取消</Button><Button size="sm" variant="primary" disabled={busy || !f.name.trim()} onClick={() => save(f)}>存</Button></div></div>
  </div>
}

export default function Admin() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const brand = useBrand()
  const [brandOpen, setBrandOpen] = useState(false)
  const [d, setD] = useState(null), [err, setErr] = useState('')
  const load = () => { if (user) api('/api/admin/overview').then(r => { setD(r); setErr('') }).catch(e => setErr(e.status === 403 ? '只有管理员能看这页。' : '没取到。')) }
  useEffect(load, [user?.id])
  const o = d?.overview
  return <div className="narrow wide">
    <div className="hdr"><div><h1>运营后台</h1><div className="sub">六组事 · 数字与入口 · 不列个人、不排名</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!user && <div className="card small muted">登录后在这里看。</div>}
    {err && <div className="card small muted">{err}</div>}
    {o && <>
      <div className="tiles">
        <div className="tile tappable" onClick={() => nav('/ops')}><div className="l"><Icon name="clock" />待点评</div><div className="v">{o.review.pending}</div><div className="small muted">超期 {o.review.overdue} · 两个工作日口径</div></div>
        <div className="tile tappable" onClick={() => nav('/cases?tab=queue')}><div className="l"><Icon name="folder" />待审案例</div><div className="v">{o.content.casesPending}</div><div className="small muted">入库 {o.content.casesApproved} · 被用 {o.content.caseUses}</div></div>
        <div className="tile tappable" onClick={() => nav('/questions')}><div className="l"><Icon name="warning" />答疑升级</div><div className="v">{o.review.questionsEscalated}</div><div className="small muted">开着的问题 {o.review.questionsOpen}</div></div>
        <div className="tile tappable" onClick={() => nav('/programs')}><div className="l"><Icon name="calendar" />待定名单</div><div className="v">{o.programs.applied}</div><div className="small muted">报名中期次 {o.programs.open}</div></div>
      </div>

      <div className="grid2 groups"><Group title="用户与园所" icon="person">
        <Row to="/org" title="园所看板、称号、带教配对" sub={`园所 ${o.people.orgs} · 园长 ${o.people.directors} · 点评人 ${o.people.reviewers} · 配对中 ${o.people.pairs}`} />
        <Row to="/district" title="区县与共同体" sub={`区县管理员 ${o.people.district} · 共同体 ${o.people.communities}`} />
        <Users />
        <Invites />
      </Group>

      <Group title="研修期次" icon="calendar">
        <Row to="/programs" title="研修项目" sub="建期次、定名单、记完成；学时进档案" n={`${o.programs.open} 期报名中`} />
        <Row to="/portfolio?rule=1" title="学时规则与证明格式" sub="按市里确认表填：折算分钟、各类附加、取整、出具单位、落款、说明文字；改了只影响以后出具的证明" />
        <Row to="/certs" title="骨干认证期次" sub="报名、答辩、结果" n={`${o.programs.cohortsOpen} 期`} />
        <Row to="/lectures" title="名师讲堂" sub="排场、邀分享者" n={`${o.programs.lecturesUpcoming} 场将开`} />
        <Row to="/studios" title="名师工作室与年度展示" sub="工作室、展示场次" n={`${o.content.studios} 室 · ${o.programs.showcasesOpen} 场`} />
        <Row to="/camps" title="练习营" sub="全平台的营由这里开" n={`${o.programs.campsOpen} 营开着`} />
        <Row to="/sharedays" title="园所分享日" sub="区县管理员为共同体办" n={`${o.programs.sharedaysOpen} 场`} />
      </Group>

      <Group title="资源与案例" icon="folder">
        <Row to="/resources" title="资源库" sub="文献与政策、模板与工具；内置教育部文件只读" n={o.content.resources} />
        <Row to="/cases?tab=queue" title="专家案例审核" sub="入库、园长同意书、下架；审核人在园所页授" n={`${o.content.casesPending} 待审`} />
        <Row to="/library" title="课程包" sub="15 条路径 100 关；改关卡走代码仓库" />
        <Row to="/collections" title="合集" sub="按主题攒案例、关卡、讲堂微课、名师讲堂、资源；全平台的由这里建" />
      </Group>

      <Group title="发题与点评" icon="pencil">
        <Row to="/drills" title="每周一题" sub="面向全平台出题；园长出本园的，区县出共同体的" n={`${o.review.drillsOpen} 题开着`} />
        <Row to="/contests" title="斗课" sub="课例、环创、观察记录、家长沟通四种形式" n={`${o.review.contestsOpen} 应战中 · ${o.review.contestsReview} 评审中`} />
        <Row to="/review" title="点评队列" sub="实践关作品；评作品不评人" n={`${o.review.pending} 待 · ${o.review.overdue} 超期`} />
        <Row to="/ops" title="点评时效与运营周报" sub="全平台与各园一行；周一推一次" />
        <Row to="/questions" title="答疑" sub="两个工作日没人答自动升级到园长与管理员" n={`${o.review.questionsOpen} 开着`} />
        <Row title="答疑与 Coach 的模型" sub={o.review.coach ? '已接（ASSISTANT_* 环境变量）；模型只改措辞、不做结论' : '没接；答疑与 Coach 走规则草稿。接法见 .env.example 的 ASSISTANT_*'} />
      </Group>

      <Group title="公告" icon="speaker">
        <Notices list={d.notices} onChange={load} />
      </Group>

      <Group title="审计" icon="shield">
        <Row onClick={() => setBrandOpen(!brandOpen)} title="平台名称" sub={`${brand.name}${brand.region ? ' · ' + brand.region : ''} · 改了网页、小程序、证书、答疑提示词一起换`} />
        {brandOpen && <BrandEditor onDone={() => setBrandOpen(false)} />}
        <Row to="/policy" title="平台口径" sub="十条红线：不碰幼儿数据、不排名、评作品不评人、AI 只起草……各模块与模型提示同一份" />
        <div className="small muted" style={{ padding: '4px 0' }}>24 小时 {o.audit.day} 条，其中失败 {o.audit.dayFail}；留存 {o.audit.total} 条</div>
        <Audit n={o.audit.total} />
      </Group></div>
      <div className="small muted" style={{ marginTop: 10 }}>这页只汇总与入口。改权限（园长、点评人、审核人、区县管理员）在园所页与区县页；删用户、清审计不放在界面上，走命令行。</div>
    </>}
  </div>
}
