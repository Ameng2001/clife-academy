// 发展档案与学时证明（GET /api/me/portfolio、/api/me/hours）。档案是本人全部学习与作品记录，随人走：这页可打印成 PDF，也可下载 JSON。
// 学时证明按本地运营方与市教育局谈定的规则与格式出具（管理员在这里改规则），有编号可核验；出具时规则快照随证明保存。
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'
import { useBrand } from '../brand.js'

const toast = m => useUI.getState().toast(m)
const TYPE = { tool: '工具关', practice: '实践关', seminar: '研讨关' }
const STATUS = { pending: '待点评', pass: '通过', revise: '待修改' }
const pad = n => String(n).padStart(2, '0')
const toLocal = at => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

/** 学时证明（打印用）。 */
export function HoursSheet({ c }) {
  const brand = useBrand()
  const nav = useNavigate()
  const r = c.rule
  return <div className="narrow">
    <div className="hdr no-print"><div><h1>学时证明</h1><div className="sub">编号 {c.no}</div></div><div className="hdr-actions"><Button size="sm" icon="clipboard" onClick={() => window.print()}>打印 / 存 PDF</Button><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    <div className="card" style={{ padding: 28, border: '2px solid var(--acc)' }}>
      <div className="small muted" style={{ textAlign: 'center' }}>{brand.region ? brand.region + ' · ' : ''}{brand.name}</div>
      <div style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', margin: '12px 0 18px' }}>{r.title}</div>
      <div style={{ fontSize: 15, lineHeight: 1.9 }}>兹证明 <b>{c.name}</b>{c.orgName ? `（${c.orgName}）` : ''} 于 {fmtDay(c.from)} 至 {fmtDay(c.to)} 期间，在{brand.name}完成以下学习，合计 <b>{c.minutes}</b> 分钟，按每 {r.minutesPerHour} 分钟折 1 学时、{r.roundTo} 学时向下取整，计 <b style={{ fontSize: 20 }}>{c.hours}</b> 学时。</div>
      <table style={{ width: '100%', marginTop: 14, borderCollapse: 'collapse', fontSize: 14 }}><thead><tr style={{ borderBottom: '1px solid var(--sep)' }}><th style={{ textAlign: 'left', padding: '6px 0' }}>项目</th><th style={{ textAlign: 'right' }}>次</th><th style={{ textAlign: 'right' }}>分钟</th></tr></thead>
        <tbody>{c.lines.map(l => <tr key={l.kind} style={{ borderBottom: '1px solid var(--sep)' }}><td style={{ padding: '6px 0' }}>{l.label}</td><td style={{ textAlign: 'right' }}>{l.count}</td><td style={{ textAlign: 'right' }}>{l.minutes}</td></tr>)}</tbody></table>
      {r.note && <div className="small" style={{ marginTop: 14, lineHeight: 1.7 }}>{r.note}</div>}
      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}><div className="small muted">编号 {c.no}<br />核验：大课堂「学时证明」页输入编号，或 api/hours/verify?no={c.no}</div><div style={{ textAlign: 'right' }}><div>{r.issuer}</div>{r.signer && <div className="small muted">{r.signer}</div>}<div className="small muted">{fmtDay(c.at)}</div></div></div>
      {brand.credit && <div className="small muted" style={{ marginTop: 10, textAlign: 'center' }}>{brand.credit}</div>}
    </div>
    <div className="small muted no-print" style={{ marginTop: 12 }}>出具后规则快照随证明保存；以后规则改了，这份不变。继续教育学时认定以市里的口径为准。</div>
  </div>
}

function RuleForm({ rule, onSaved }) {
  const [f, setF] = useState({ ...rule }), [busy, setBusy] = useState(false)
  // 从运营后台 /portfolio?rule=1 跳来时滚到表单
  useEffect(() => { if (new URLSearchParams(location.hash.split('?')[1] || '').get('rule') === '1') document.getElementById('hours-rule')?.scrollIntoView({ block: 'start' }) }, [])
  const N = (k, w = 70) => <input className="ac-sel" style={{ width: w }} type="number" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
  const save = async () => { setBusy(true); try { const r = await api('/api/hours/rule', { method: 'PUT', body: JSON.stringify(f) }); toast('已存'); onSaved(r.rule) } catch (e) { toast('没存成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  return <div id="hours-rule" className="card" style={{ marginTop: 10 }}>
    <div className="small muted">计时规则与证明格式（管理员）：按与市教育局、教师发展中心谈定的口径填；改了只影响以后出具的证明。</div>
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}><span className="small">每</span>{N('minutesPerHour')}<span className="small">分钟 = 1 学时 · 实践关另加</span>{N('practiceExtra')}<span className="small">分钟 · 研讨关另加</span>{N('seminarExtra')}<span className="small">分钟 · 骨干答辩通过加</span>{N('backboneMinutes')}<span className="small">分钟</span></div>
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}><span className="small">取整到</span><select className="ac-sel" value={f.roundTo} onChange={e => setF({ ...f, roundTo: Number(e.target.value) })}><option value={0.25}>0.25</option><option value={0.5}>0.5</option><option value={1}>1</option></select><span className="small">学时 ·</span><label className="small"><input type="checkbox" checked={!!f.lectureCounts} onChange={e => setF({ ...f, lectureCounts: e.target.checked })} /> 大讲堂预约且已开播的计入（没有到场记录，默认不计）</label></div>
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}><TextField placeholder="证明标题" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={{ flex: 1, minWidth: 160 }} /><TextField placeholder="出具单位" value={f.issuer} onChange={e => setF({ ...f, issuer: e.target.value })} style={{ flex: 2, minWidth: 200 }} /><TextField placeholder="签发人（可空）" value={f.signer} onChange={e => setF({ ...f, signer: e.target.value })} style={{ flex: 1, minWidth: 120 }} /></div>
    <TextArea rows={2} style={{ marginTop: 8 }} placeholder="证明上的说明文字" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
    <div className="ac-row" style={{ marginTop: 10 }}><span /><Button size="sm" variant="primary" disabled={busy} onClick={save}>存规则</Button></div>
  </div>
}

export default function Portfolio() {
  const nav = useNavigate()
  const { id } = useParams()
  const user = useStore(s => s.user)
  const [p, setP] = useState(null), [h, setH] = useState(null), [rule, setRule] = useState(null), [range, setRange] = useState(null), [busy, setBusy] = useState(false), [verifyNo, setVerifyNo] = useState(''), [verified, setVerified] = useState(null), [sheet, setSheet] = useState(null)
  const loadHours = async (r = range) => { try { setH(await api('/api/me/hours' + (r ? `?from=${new Date(r.from + 'T00:00').getTime()}&to=${new Date(r.to + 'T23:59:59').getTime()}` : ''))) } catch { setH(null) } }
  useEffect(() => { if (!user) return; api('/api/me/portfolio').then(setP).catch(() => setP(null)); api('/api/hours/rule').then(setRule).catch(() => setRule(null)); loadHours(null) }, [user?.id])
  useEffect(() => { if (h && !range) setRange({ from: toLocal(h.schoolYear.from), to: toLocal(h.schoolYear.to) }) }, [h])
  useEffect(() => { if (id && user) api('/api/me/hours/one?id=' + id).then(r => setSheet(r.cert)).catch(() => setSheet(null)) }, [id, user?.id])
  if (id) return sheet ? <HoursSheet c={sheet} /> : <div className="narrow"><div className="card small muted">正在取证明…</div></div>
  const issue = async () => {
    setBusy(true)
    try { const r = await api('/api/me/hours/issue', { method: 'POST', body: JSON.stringify({ from: new Date(range.from + 'T00:00').getTime(), to: new Date(range.to + 'T23:59:59').getTime() }) }); toast('已出具 ' + r.cert.no); loadHours(); nav('/portfolio/hours/' + r.cert.id) }
    catch (e) { toast(e.code === 'empty' ? '这段时间没有可计学时的记录' : '没出成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  const verify = async () => { try { setVerified(await api('/api/hours/verify?no=' + encodeURIComponent(verifyNo.trim()))) } catch { setVerified({ valid: false }) } }
  // 带登录态的下载：取一份最新的档案，浏览器端生成文件（服务端 ?download=1 给的是同一份，供脚本用）
  // 迁移包：带签名的整份档案；迁入：选一个别处发的包文件
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const pack = async () => { try { const pkg = await api('/api/me/portfolio/package'); const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `迁移包-${pkg.person.name}-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); toast('迁移包已下载，带签名，换城市时在那边「迁入」') } catch { toast('没成') } }
  const importFile = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    setImporting(true)
    try { const pkg = JSON.parse(await f.text()); const r = await api('/api/me/portfolio/import', { method: 'POST', body: JSON.stringify({ package: pkg }) }); toast(r.item.verified === true ? '已迁入，核验通过' : r.item.verified === false ? '已迁入，但发包方核验不通过，档案里会标出' : '已迁入，发包方联不上，记为未核验'); setP(await api('/api/me/portfolio')) }
    catch (err) { toast(err.code === 'dup' ? '这份已经迁入过' : err.code === 'format' || err.code === 'shape' ? '不是迁移包文件' : '没成' + (err.message ? '：' + err.message : '')) } finally { setImporting(false) }
  }
  const removeImport = async i => { if (!confirm(`删掉迁入的「${i.person.orgName || i.issuer.name}」这份？`)) return; try { await api('/api/me/portfolio/imports/remove', { method: 'POST', body: JSON.stringify({ id: i.id }) }); setP(await api('/api/me/portfolio')) } catch { toast('没成') } }
  const download = async () => { try { const fresh = await api('/api/me/portfolio?download=1'); const blob = new Blob([JSON.stringify(fresh, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `发展档案-${fresh.person.name}-${toLocal(fresh.exportedAt)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) } catch (e) { toast('没下成' + (e.message ? '：' + e.message : '')) } }
  return <div className="narrow">
    <div className="hdr"><div><h1>发展档案</h1><div className="sub">本人全部学习与作品记录 · 随人走 · 不含幼儿数据与 AI 中间判断</div></div><div className="hdr-actions no-print"><Button size="sm" icon="clipboard" onClick={() => window.print()}>打印 / 存 PDF</Button><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后可见。</div>}
    {p && <>
      <div className="card"><div style={{ fontWeight: 600, fontSize: 17 }}>{p.person.name}</div><div className="small muted">{[p.person.orgName, p.person.districtName, p.person.role].filter(Boolean).join(' · ')} · 导出于 {fmtDay(p.exportedAt)}</div>
        <div className="row" style={{ gap: 14, marginTop: 10, flexWrap: 'wrap' }} >{[['通过的关', p.summary.levels], ['学习分钟', p.summary.minutes], ['通过的作品', p.summary.works], ['研讨作答', p.summary.seminars + p.summary.drillAnswers], ['入库案例', p.summary.cases], ['证书', p.summary.certificates], ['勋章', p.summary.badges], ['称号', p.summary.titles], ['学分', p.summary.creditsTotal], ['答疑被采纳', p.summary.answersAccepted]].map(([k, v]) => <div key={k}><div style={{ fontSize: 20, fontWeight: 700 }}>{v}</div><div className="small muted">{k}</div></div>)}</div>
        <div className="row no-print" style={{ gap: 8, marginTop: 10 }}><Button size="sm" variant="tinted" icon="download" onClick={download}>下载 JSON</Button><span className="small muted">换平台、换园时带走；格式 {p.format}</span></div></div>
      <div className="sect"><div className="sect-t">随人走 <span className="small muted">换园留痕 · 换城市带包</span></div><div className="sect-b">
        {p.history.map((h, i) => <div key={'h' + i} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{h.orgName || '（园所未记）'}<span className="small muted" style={{ marginInlineStart: 8 }}>{h.role || ''}</span></div><div className="small muted">{h.from ? fmtDay(h.from) : '？'} 至 {h.to ? fmtDay(h.to) : '？'} · 同一账号，记录连续</div></div></div>)}
        {p.imports.map(i => <div key={i.id} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">迁入 · {i.person.orgName || i.issuer.name}{i.person.role ? ' · ' + i.person.role : ''}<span className="tag" style={{ marginInlineStart: 8 }}>{i.verified === true ? '核验通过' : i.verified === false ? '核验不通过' : '未核验'}</span></div><div className="small muted">{i.issuer.name} 发于 {fmtDay(i.issuedAt)} · 过关 {i.summary.levels ?? 0} · 作品 {i.summary.works ?? 0} · 证书 {i.summary.certificates ?? 0} · 只作档案，不并进进度</div></div><button className="chip no-print" onClick={() => removeImport(i)}>删</button></div>)}
        <div className="row no-print" style={{ gap: 8, padding: '8px 0', flexWrap: 'wrap', alignItems: 'center' }}><Button size="sm" variant="tinted" icon="download" onClick={pack}>导出迁移包</Button><Button size="sm" disabled={importing} onClick={() => fileRef.current?.click()}>迁入一份</Button><input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={importFile} /><span className="small muted">迁移包带本平台签名，到了别处可核验；同一城市换园不用包，登录就连着。</span></div>
      </div></div>
      {p.paths.length > 0 && <div className="sect"><div className="sect-t">路径</div><div className="sect-b">{p.paths.map(x => <div key={x.path} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{x.name}</div><div className="small muted">已过 {x.done} / {x.total} 关{x.finishedAt ? ' · 走完于 ' + fmtDay(x.finishedAt) : ''}</div></div></div>)}</div></div>}
      {p.certificates.length > 0 && <div className="sect"><div className="sect-t">证书</div><div className="sect-b">{p.certificates.map(c => <div key={c.no} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{c.label}</div><div className="small muted">{fmtDay(c.at)} · 编号 {c.no}{c.byName ? ' · ' + c.byName + ' 签发' : ''}</div></div></div>)}</div></div>}
      {(p.titles.length > 0 || p.badges.length > 0) && <div className="sect"><div className="sect-t">荣誉</div><div className="sect-b">{p.titles.map((t, i) => <div key={'t' + i} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{t.label}</div><div className="small muted">{t.byName} 授 · {fmtDay(t.at)} · {t.reason}</div></div></div>)}{p.badges.map(b => <div key={b.key} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{b.name}</div><div className="small muted">{b.kind === 'growth' ? '成长勋章' : '贡献勋章'}{b.at ? ' · ' + fmtDay(b.at) : ''}</div></div></div>)}</div></div>}
      {p.submissions.length > 0 && <div className="sect"><div className="sect-t">实践与研讨</div><div className="sect-b">{p.submissions.map(s => <div key={s.id} className="lrow" style={{ display: 'block' }}><div className="lrow-t">{TYPE[s.type]} · {s.levelTitle} <span className="small muted">{STATUS[s.status] || s.status} · {fmtDay(s.at)}{s.files ? ` · ${s.files} 个附件` : ''}</span></div><div className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{s.text}</div>{s.review && <div className="small muted" style={{ marginTop: 4 }}>点评（{s.review.byName}）：{s.review.comment || s.review.verdict}</div>}</div>)}</div></div>}
      {(p.cases.length > 0 || p.contests.length > 0 || p.showcases.length > 0) && <div className="sect"><div className="sect-t">案例与斗课</div><div className="sect-b">
        {p.cases.map(c => <div key={c.id} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{c.title}</div><div className="small muted">{c.status === 'approved' ? '已入库' : c.status} · {fmtDay(c.at)}{c.tag ? ' · ' + c.tag : ''}{c.showcase ? ' · 市级展示 ' + c.showcase.year : ''}</div></div></div>)}
        {p.contests.map((e, i) => <div key={'e' + i} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{e.contest}</div><div className="small muted">{e.level === 'community' ? '共同体赛' : '园内赛'} · {fmtDay(e.at)}{e.selected ? ' · 入选' : ''}</div></div></div>)}
        {p.showcases.map((s, i) => <div key={'s' + i} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{s.title}</div><div className="small muted">年度分享者</div></div></div>)}
      </div></div>}
      {(p.studios.length > 0 || p.community || p.lectures.length > 0) && <div className="sect"><div className="sect-t">工作室、共同体与大讲堂</div><div className="sect-b">
        {p.studios.map((s, i) => <div key={'st' + i} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{s.name}</div><div className="small muted">{s.role} · {fmtDay(s.at)}</div></div></div>)}
        {p.community && <div className="lrow"><div className="lrow-t">跨园共同体 · {p.community.name}</div></div>}
        {p.lectures.map((l, i) => <div key={'l' + i} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{l.title}</div><div className="small muted">预约 · {l.speaker} · {fmtDay(l.at)}</div></div></div>)}
      </div></div>}
      {p.levels.length > 0 && <div className="sect"><div className="sect-t">通过的关 <span className="small muted">测验对错只有本人看</span></div><div className="sect-b">{p.levels.map(l => <div key={l.id} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{l.pathName} · {l.title}</div><div className="small muted">{TYPE[l.type]} · {l.minutes} 分钟{l.quiz ? ` · 测验 ${l.quiz.right}/${l.quiz.of}` : ''}</div></div><span className="small muted">{fmtDay(l.passedAt)}</span></div>)}</div></div>}
      <div className="small muted" style={{ marginTop: 8 }}>不在档案里：{p.excluded.join('；')}。</div>
    </>}
    {h && range && <div className="sect"><div className="sect-t">学时证明 <span className="small muted">按市里认可的格式 · 有编号可核验</span></div>
      <div className="card no-print">
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className="small muted">区间</span><input className="ac-sel" type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} /><span className="small muted">到</span><input className="ac-sel" type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} /><Button size="sm" onClick={() => loadHours()}>算一算</Button><Button size="sm" onClick={() => { const r = { from: toLocal(h.schoolYear.from), to: toLocal(h.schoolYear.to) }; setRange(r); loadHours(r) }}>本学年</Button></div>
        <div style={{ marginTop: 10 }}>{h.lines.map(l => <div key={l.kind} className="ac-row small"><span>{l.label} × {l.count}</span><span className="muted">{l.minutes} 分钟</span></div>)}{!h.lines.length && <div className="small muted">这段时间没有可计学时的记录。</div>}</div>
        <div className="ac-row" style={{ marginTop: 10 }}><span>合计 {h.minutes} 分钟 · <b>{h.hours}</b> 学时 <span className="small muted">每 {h.rule.minutesPerHour} 分钟 1 学时，{h.rule.roundTo} 学时向下取整</span></span><Button size="sm" variant="primary" disabled={busy || !h.minutes} onClick={issue}>出具证明</Button></div>
      </div>
      {h.certs.length > 0 && <div className="sect-b" style={{ marginTop: 10 }}>{h.certs.map(c => <div key={c.id} className="lrow tap" onClick={() => nav('/portfolio/hours/' + c.id)}><div style={{ flex: 1 }}><div className="lrow-t"><Icon name="checkCircle" /> {c.rule.title} · {c.hours} 学时</div><div className="small muted">{fmtDay(c.from)} 至 {fmtDay(c.to)} · 编号 {c.no} · 出具于 {fmtDay(c.at)}</div></div><Icon name="chevronRight" /></div>)}</div>}
      <div className="card no-print" style={{ marginTop: 10 }}><div className="row" style={{ gap: 8, alignItems: 'center' }}><TextField placeholder="核验：输入学时证明编号，如 XS-2026-00001" value={verifyNo} onChange={e => setVerifyNo(e.target.value)} style={{ flex: 1 }} /><Button size="sm" onClick={verify}>核验</Button></div>{verified && <div className="small" style={{ marginTop: 8 }}>{verified.valid ? `有效：${verified.name}${verified.orgName ? '（' + verified.orgName + '）' : ''} · ${fmtDay(verified.from)} 至 ${fmtDay(verified.to)} · ${verified.hours} 学时 · ${verified.issuer} · 出具于 ${fmtDay(verified.at)}` : '没有这个编号。'}</div>}</div>
      {rule?.canEdit && <RuleForm rule={rule.rule} onSaved={r => { setRule({ ...rule, rule: r }); loadHours() }} />}
      <div className="small muted no-print" style={{ marginTop: 10 }}>继续教育学时认定由本地运营方与市教育局、教师发展中心谈定；这里的规则与格式照谈定的口径配。大讲堂没有到场记录，默认不计。</div>
    </div>}
  </div>
}
