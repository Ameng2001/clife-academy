// 证书与认证期次（GET /api/me/certificates、/api/cohorts）：三级——岗位数智应用认证（自动）、领域研修证书（自动＋点评记录）、骨干教师认证（按学期开班，线下答辩）。
// 只有本人看自己的；证书有编号可核验；没有分数；可打印进发展档案。管理员在这里开班、记答辩结果。
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const toast = m => useUI.getState().toast(m)
const PHASE = { upcoming: '未开始报名', open: '报名中', defense: '报名截止 · 待答辩', closed: '已结班' }
const pad = n => String(n).padStart(2, '0')
const toLocal = at => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function Progress({ done, total }) { return <div className="ac-bar" style={{ marginTop: 6 }}><i style={{ width: `${total ? Math.min(100, done / total * 100) : 0}%` }} /></div> }

/** 单张证书（打印用）。 */
export function CertificateSheet({ c }) {
  const nav = useNavigate()
  return <div className="narrow">
    <div className="hdr no-print"><div><h1>证书</h1><div className="sub">编号 {c.no}</div></div><div className="hdr-actions"><Button size="sm" icon="clipboard" onClick={() => window.print()}>打印 / 存 PDF</Button><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    <div className="card" style={{ padding: 28, textAlign: 'center', border: '2px solid var(--acc)' }}>
      <div className="small muted">C-Life 学前大课堂</div>
      <div style={{ fontSize: 26, fontWeight: 700, margin: '14px 0 6px' }}>{c.label}</div>
      <div style={{ fontSize: 18, marginTop: 18 }}>{c.name}{c.orgName ? <span className="small muted">（{c.orgName}）</span> : null}</div>
      <div className="small" style={{ marginTop: 14, lineHeight: 1.7 }}>{c.kind === 'tool' ? '完成本岗位工具路径全部关卡，测验正确率不低于 80%。' : c.kind === 'domain' ? '完成本领域研修路径全部关卡，实践关作品全部通过点评。' : '三条领域研修证书、一份园本案例，并通过线下答辩。'}</div>
      <div className="small muted" style={{ marginTop: 18 }}>{fmtDay(c.at)}{c.byName ? ' · ' + c.byName + ' 签发' : ''} · 编号 {c.no}</div>
      <div className="small muted" style={{ marginTop: 4 }}>核验：大课堂「证书核验」输入编号，或 api/certificates/verify?no={c.no}</div>
    </div>
    <div className="small muted no-print" style={{ marginTop: 12 }}>证书只记级别与日期，不含分数；可随发展档案导出。继续教育学时认定按本地运营方与教育局的约定另出证明。</div>
  </div>
}

export default function Certificates() {
  const nav = useNavigate()
  const { id } = useParams()
  const user = useStore(s => s.user)
  const [d, setD] = useState(null), [cohorts, setCohorts] = useState(null), [err, setErr] = useState(null)
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [note, setNote] = useState(''), [verifyNo, setVerifyNo] = useState(''), [verified, setVerified] = useState(null), [resultNote, setResultNote] = useState({})
  const load = async () => {
    if (!user) return
    try { setD(await api('/api/me/certificates')); setErr(null) } catch { setErr('没取到证书。') }
    try { setCohorts(await api('/api/cohorts')) } catch { setCohorts(null) }
  }
  useEffect(() => { load() }, [user?.id])
  const apply = async c => {
    setBusy(true)
    try { await api('/api/cohorts/apply', { method: 'POST', body: JSON.stringify({ id: c.id, note }) }); toast('已报名，答辩时间见期次'); setNote(''); load() }
    catch (e) { toast(e.code === 'eligible' ? '条件还不够：要三条领域研修证书和一份入库案例' : e.code === 'phase' ? '不在报名窗口' : '没报成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const saveCohort = async () => {
    if (!form.name.trim() || !form.term.trim()) return toast('写班名与学期')
    setBusy(true)
    try { await api('/api/cohorts', { method: 'POST', body: JSON.stringify({ id: form.id || undefined, name: form.name, term: form.term, applyFrom: new Date(form.from + 'T00:00').getTime(), applyTo: new Date(form.to + 'T23:59').getTime(), defenseAt: form.defense ? new Date(form.defense + 'T09:00').getTime() : undefined, place: form.place, note: form.note }) }); toast(form.id ? '已改' : '已开班'); setForm(null); load() }
    catch (e) { toast('没存成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  const result = async (c, a, r) => {
    if (!confirm(`记 ${a.name} 的答辩结果为「${{ pass: '通过', fail: '未通过', absent: '缺席' }[r]}」？${r === 'pass' ? '通过即签发骨干教师认证。' : ''}`)) return
    try { await api('/api/cohorts/result', { method: 'POST', body: JSON.stringify({ id: c.id, uid: a.uid, result: r, note: resultNote[a.uid] || '' }) }); toast('已记'); load() } catch (e) { toast('没记成' + (e.message ? '：' + e.message : '')) }
  }
  const verify = async () => { try { setVerified(await api('/api/certificates/verify?no=' + encodeURIComponent(verifyNo.trim()))) } catch { setVerified({ valid: false }) } }
  if (id && d) { const c = d.certificates.find(x => x.id === id); if (c) return <CertificateSheet c={c} /> }
  const admin = cohorts?.canHost
  return <div className="narrow">
    <div className="hdr"><div><h1>证书与认证</h1><div className="sub">三级 · 自动判定或按学期答辩 · 只有本人看得到 · 没有分数</div></div><div className="hdr-actions">{admin && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ name: '', term: '', from: toLocal(Date.now()), to: toLocal(Date.now() + 14 * 86400000), defense: '', place: '', note: '' })}>开班</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后看。</div>}
    {err && <div className="card small muted">{err}</div>}

    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>{form.id ? '改期次' : '开一期骨干教师认证'} · 报名条件：三条领域研修证书 ＋ 一份入库案例 · 线下答辩</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><TextField placeholder="班名，如「2027 春骨干教师认证」" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ flex: 2, minWidth: 180 }} /><TextField placeholder="学期，如 2027春" value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} style={{ flex: 1, minWidth: 100 }} /></div>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="small muted">报名</span><input className="ac-sel" type="date" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} /><span className="small muted">到</span><input className="ac-sel" type="date" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} />
        <span className="small muted">答辩</span><input className="ac-sel" type="date" value={form.defense} onChange={e => setForm({ ...form, defense: e.target.value })} />
      </div>
      <TextField style={{ marginTop: 8 }} placeholder="答辩地点（可空）" value={form.place} onChange={e => setForm({ ...form, place: e.target.value })} />
      <TextArea rows={2} style={{ marginTop: 8 }} placeholder="说明：答辩形式、带什么材料（可空）" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
      <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={saveCohort}>{form.id ? '存' : '开班'}</Button></div></div>
    </div>}

    {d && <>
      <div className="sect"><div className="sect-t">我的证书 <span className="small muted">{d.certificates.length} 张</span></div><div className="sect-b">
        {!d.certificates.length && <div className="lrow small muted">还没有证书。下面是三级的条件与进度。</div>}
        {d.certificates.map(c => <div key={c.id} className="lrow tap" onClick={() => nav('/certs/' + c.id)}><div style={{ flex: 1 }}><div className="lrow-t"><Icon name="checkCircle" /> {c.label}</div><div className="small muted">{fmtDay(c.at)} · 编号 {c.no}</div></div><Icon name="chevronRight" /></div>)}
      </div></div>

      <div className="sect"><div className="sect-t">三级认证的条件与进度</div><div className="sect-b">
        {d.tool && <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{d.kinds.tool} · {d.tool.name}{d.tool.ok && <span className="tag" style={{ marginInlineStart: 6, color: 'var(--acc)' }}>已获得</span>}</div><div className="small muted">完成本岗位工具路径全部 {d.tool.total} 关，测验正确率 ≥ 80% · 已过 {d.tool.done} 关{d.tool.quiz != null ? ` · 正确率 ${d.tool.quiz}%` : ''}</div><Progress done={d.tool.done} total={d.tool.total} /></div></div>}
        {d.domains.map(x => <div key={x.path} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{d.kinds.domain} · {x.name}{x.ok && <span className="tag" style={{ marginInlineStart: 6, color: 'var(--acc)' }}>已获得</span>}</div><div className="small muted">走完 {x.total} 关 · 已过 {x.done}；实践关作品全部通过点评 · 已过 {x.works}/{x.worksTotal}</div><Progress done={x.done + x.works} total={x.total + x.worksTotal} /></div></div>)}
        <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">{d.kinds.backbone}{d.backbone.ok && <span className="tag" style={{ marginInlineStart: 6, color: 'var(--acc)' }}>已获得</span>}</div><div className="small muted">三条领域研修证书（现有 {d.backbone.domainCerts}）＋ 一份入库案例（现有 {d.backbone.cases}）＋ 线下答辩 · 按学期开班，下面报名{d.backbone.eligible && !d.backbone.ok ? ' · 条件已达到' : ''}</div><Progress done={Math.min(d.backbone.domainCerts, 3) + Math.min(d.backbone.cases, 1)} total={4} /></div></div>
        <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">七领域都有证据{d.seven.ok && <span className="tag" style={{ marginInlineStart: 6, color: 'var(--acc)' }}>已获得</span>}</div><div className="small muted">成长勋章：七个专业领域各至少一条证据 · 现有 {d.seven.have}/{d.seven.of}，看<span className="tap" style={{ color: 'var(--acc)' }} onClick={() => nav('/map')}>能力地图</span></div></div></div>
      </div></div>
    </>}

    {cohorts && <div className="sect"><div className="sect-t">认证期次 <span className="small muted">骨干教师认证 · 按学期开班</span></div><div className="sect-b">
      {!cohorts.cohorts.length && <div className="lrow small muted">还没有开班。{admin ? '点右上角「开班」。' : '本地运营方按学期开班，开了在这里报名。'}</div>}
      {cohorts.cohorts.map(c => <div key={c.id} className="lrow" style={{ display: 'block' }}>
        <div className="ac-row"><div className="lrow-t">{c.name}</div><span className="small muted">{PHASE[c.phase]}</span></div>
        <div className="small muted" style={{ marginTop: 4 }}>{c.term} · 报名 {fmtDay(c.applyFrom)} 到 {fmtDay(c.applyTo)}{c.defenseAt ? ` · 答辩 ${fmtDay(c.defenseAt)}` : ''}{c.place ? ' · ' + c.place : ''} · 报名 {c.applicants} 人{c.passed ? ` · 通过 ${c.passed}` : ''}</div>
        {c.note && <div className="small" style={{ marginTop: 4, color: 'var(--label-2)' }}>{c.note}</div>}
        {c.mine && <div className="small" style={{ marginTop: 6 }}>我已报名（{fmtDay(c.mine.at)}）{c.mine.result ? ` · 结果：${{ pass: '通过', fail: '未通过', absent: '缺席' }[c.mine.result]}${c.mine.resultNote ? ' · ' + c.mine.resultNote : ''}` : ' · 等答辩'}</div>}
        {!c.mine && c.phase === 'open' && d?.backbone?.eligible && !d.backbone.ok && <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}><TextField placeholder="报名备注：答辩想讲的案例（可空）" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} /><Button size="sm" variant="primary" disabled={busy} onClick={() => apply(c)}>报名</Button></div>}
        {!c.mine && c.phase === 'open' && d && !d.backbone.eligible && <div className="small muted" style={{ marginTop: 6 }}>条件还不够，先拿三条领域研修证书和一份入库案例。</div>}
        {admin && <div style={{ marginTop: 8, paddingTop: 8, borderTop: 'var(--hair) solid var(--sep)' }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><Button size="sm" onClick={() => setForm({ id: c.id, name: c.name, term: c.term, from: toLocal(c.applyFrom), to: toLocal(c.applyTo), defense: c.defenseAt ? toLocal(c.defenseAt) : '', place: c.place || '', note: c.note || '' })}>改</Button>{c.phase !== 'closed' && <Button size="sm" onClick={() => confirm('结班？之后不再报名。') && api('/api/cohorts/close', { method: 'POST', body: JSON.stringify({ id: c.id }) }).then(load)}>结班</Button>}</div>
          {(c.list || []).map(a => <div key={a.uid} className="ac-row small" style={{ marginTop: 6, flexWrap: 'wrap', gap: 6 }}><span>{a.name}{a.orgName ? ' · ' + a.orgName : ''}{a.note ? ' · ' + a.note : ''}{a.result ? ` · ${{ pass: '通过', fail: '未通过', absent: '缺席' }[a.result]}` : ''}</span>{!a.result && <span className="row" style={{ gap: 6, alignItems: 'center' }}><TextField placeholder="一句评语" value={resultNote[a.uid] || ''} onChange={e => setResultNote({ ...resultNote, [a.uid]: e.target.value })} style={{ width: 140 }} /><Button size="sm" variant="primary" onClick={() => result(c, a, 'pass')}>通过</Button><Button size="sm" onClick={() => result(c, a, 'fail')}>未通过</Button><Button size="sm" variant="ghost" onClick={() => result(c, a, 'absent')}>缺席</Button></span>}</div>)}
        </div>}
      </div>)}
    </div></div>}

    <div className="sect"><div className="sect-t">证书核验</div><div className="sect-b"><div className="lrow" style={{ gap: 8 }}><TextField placeholder="证书编号，如 CL-2026-00001" value={verifyNo} onChange={e => setVerifyNo(e.target.value)} style={{ flex: 1 }} /><Button size="sm" onClick={verify}>核验</Button></div>
      {verified && <div className="lrow small">{verified.valid ? `有效 · ${verified.label} · ${verified.name}${verified.orgName ? '（' + verified.orgName + '）' : ''} · ${fmtDay(verified.at)}` : '没有这个编号。'}</div>}
    </div></div>
    <div className="small muted" style={{ marginTop: 14 }}>证书不含分数，不跨园比较，不作考核依据；继续教育学时认定另按市里认可的格式出证明。</div>
  </div>
}
