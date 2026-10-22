// 轻形态（/forms/:caseId，/api/cases/forms）：把一条入库案例变成拿来就用的三样：家长会十分钟课件、过渡环节改前改后对比卡、《评估指南》条文记忆卡。
// 作者、审核人、管理员能生成与改；登录用户都能看、能打印。草稿只搬案例里的话，接了模型只改措辞。
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'

export const KIND_ORDER = ['parents', 'transition', 'memo']
const HINT = { parents: '五页，一页一分钟，剩下五分钟答疑', transition: '一张卡贴在过渡环节的位置', memo: '三条指标，背要义、对做法' }
const lines = v => String(v || '').split('\n').map(x => x.trim()).filter(Boolean)

function Show({ f }) {
  const c = f.content
  if (f.kind === 'parents') return <div>
    {c.slides.map((s, i) => <div key={i} className="card" style={{ marginTop: 8, padding: 14 }}><div className="small muted">第 {i + 1} 页</div><div style={{ fontWeight: 700, fontSize: 17, margin: '2px 0 6px' }}>{s.h}</div>{s.lines.map((l, j) => <div key={j} style={{ lineHeight: 1.6 }}>· {l}</div>)}</div>)}
    <div className="small muted" style={{ marginTop: 8 }}>{c.footer}</div>
  </div>
  if (f.kind === 'transition') return <div className="card" style={{ marginTop: 8, padding: 14 }}>
    <div style={{ fontWeight: 700, fontSize: 17 }}>{c.scene}</div>
    <div className="row" style={{ gap: 12, marginTop: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 180 }}><div className="small" style={{ color: 'var(--red)', fontWeight: 600 }}>改前</div>{c.before.map((l, i) => <div key={i} style={{ lineHeight: 1.6 }}>· {l}</div>)}</div>
      <div style={{ flex: 1, minWidth: 180 }}><div className="small" style={{ color: 'var(--green)', fontWeight: 600 }}>改后</div>{c.after.map((l, i) => <div key={i} style={{ lineHeight: 1.6 }}>· {l}</div>)}</div>
    </div>
    {c.why && <div className="small" style={{ marginTop: 8 }}><span className="muted">为什么：</span>{c.why}</div>}
    <div className="small muted" style={{ marginTop: 8 }}>{c.footer}</div>
  </div>
  return <div>
    {c.cards.map((x, i) => <div key={i} className="card" style={{ marginTop: 8, padding: 14, borderInlineStart: '4px solid var(--acc)' }}><div className="small" style={{ color: 'var(--acc)', fontWeight: 600 }}>{x.clause}</div><div style={{ fontWeight: 600, margin: '2px 0' }}>{x.gist}</div>{x.apply && <div className="small muted">案例里的做法：{x.apply}</div>}</div>)}
    <div className="small muted" style={{ marginTop: 8 }}>{c.footer}</div>
  </div>
}

function Edit({ f, onDone }) {
  const toast = useUI.getState().toast
  const [c, setC] = useState(JSON.parse(JSON.stringify(f.content))), [busy, setBusy] = useState(false)
  const save = async () => { setBusy(true); try { await api('/api/cases/forms', { method: 'POST', body: JSON.stringify({ id: f.id, content: c }) }); toast('已存'); onDone(true) } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) } }
  const setSlide = (i, k, v) => setC(x => ({ ...x, slides: x.slides.map((s, j) => j === i ? { ...s, [k]: v } : s) }))
  const setCard = (i, k, v) => setC(x => ({ ...x, cards: x.cards.map((s, j) => j === i ? { ...s, [k]: v } : s) }))
  return <div className="card" style={{ marginTop: 8, padding: 12 }}>
    {f.kind === 'parents' && <>
      <TextField placeholder="课件标题" value={c.title} onChange={e => setC({ ...c, title: e.target.value })} />
      {c.slides.map((s, i) => <div key={i} style={{ marginTop: 8 }}><TextField placeholder={`第 ${i + 1} 页标题`} value={s.h} onChange={e => setSlide(i, 'h', e.target.value)} /><TextArea rows={3} style={{ marginTop: 4 }} placeholder="一行一条，最多 5 条" value={s.lines.join('\n')} onChange={e => setSlide(i, 'lines', lines(e.target.value))} /></div>)}
    </>}
    {f.kind === 'transition' && <>
      <TextField placeholder="场景，如「户外回来到午睡」" value={c.scene} onChange={e => setC({ ...c, scene: e.target.value })} />
      <div className="small muted" style={{ marginTop: 8 }}>改前（一行一条）</div><TextArea rows={3} value={c.before.join('\n')} onChange={e => setC({ ...c, before: lines(e.target.value) })} />
      <div className="small muted" style={{ marginTop: 8 }}>改后（一行一条）</div><TextArea rows={3} value={c.after.join('\n')} onChange={e => setC({ ...c, after: lines(e.target.value) })} />
      <TextField style={{ marginTop: 8 }} placeholder="为什么这样改（一句）" value={c.why} onChange={e => setC({ ...c, why: e.target.value })} />
    </>}
    {f.kind === 'memo' && <>
      <TextField placeholder="记忆卡标题" value={c.title} onChange={e => setC({ ...c, title: e.target.value })} />
      {c.cards.map((x, i) => <div key={i} style={{ marginTop: 8 }}><div className="small" style={{ color: 'var(--acc)' }}>{x.clause}</div><TextField placeholder="要义一句" value={x.gist} onChange={e => setCard(i, 'gist', e.target.value)} /><TextField style={{ marginTop: 4 }} placeholder="案例里对应的做法" value={x.apply} onChange={e => setCard(i, 'apply', e.target.value)} /></div>)}
    </>}
    <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'flex-end' }}><Button size="sm" onClick={() => onDone(false)}>取消</Button><Button size="sm" variant="primary" disabled={busy} onClick={save}>存</Button></div>
  </div>
}

export default function Forms() {
  const nav = useNavigate()
  const { caseId } = useParams()
  const user = useStore(s => s.user)
  const toast = useUI.getState().toast
  const [d, setD] = useState(null), [busy, setBusy] = useState(''), [editing, setEditing] = useState(null), [open, setOpen] = useState(null)
  const load = () => { if (user) api('/api/cases/forms?caseId=' + encodeURIComponent(caseId)).then(r => { setD(r); if (!open && r.forms.length) setOpen(r.forms[0].kind) }).catch(() => setD(null)) }
  useEffect(load, [user?.id, caseId])
  const draft = async kind => { setBusy(kind); try { await api('/api/cases/forms/draft', { method: 'POST', body: JSON.stringify({ caseId, kind }) }); toast('草稿出来了，看一眼再改'); setOpen(kind); load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy('') } }
  const remove = async f => { if (!confirm('删掉这份？')) return; try { await api('/api/cases/forms', { method: 'POST', body: JSON.stringify({ id: f.id, remove: true }) }); load() } catch (e) { toast('没成') } }
  const caseInfo = d?.forms[0]?.case
  return <div className="narrow">
    <div className="hdr"><div><h1>拿来就用</h1><div className="sub">{caseInfo ? `《${caseInfo.title}》 · ${caseInfo.byName}${caseInfo.orgName ? ' · ' + caseInfo.orgName : ''}` : '把一条案例变成三样能直接用的东西'}</div></div><div className="hdr-actions"><button className="chip" onClick={() => window.print()}><Icon name="clipboard" /> 打印</button><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后在这里看。</div>}
    {d && <>
      <div className="small muted" style={{ marginBottom: 8 }}>只搬案例里的话，不加内容；署名随案例走。{d.canMake ? '你可以生成草稿再改。' : '作者、审核人或管理员可以生成。'}</div>
      {KIND_ORDER.map(k => { const f = d.forms.find(x => x.kind === k); return <div key={k} className="card" style={{ marginTop: 10 }}>
        <div className="ac-row tap" onClick={() => setOpen(open === k ? null : k)}>
          <div><div style={{ fontWeight: 600 }}>{d.kinds[k]}</div><div className="small muted">{f ? `${f.byName} · ${f.model ? '模型改过措辞' : '规则草稿'}` : HINT[k]}</div></div>
          {f ? <Icon name={open === k ? 'chevronUp' : 'chevronDown'} /> : d.canMake ? <Button size="sm" variant="primary" disabled={!!busy} onClick={e => { e.stopPropagation(); draft(k) }}>{busy === k ? '在做…' : '生成'}</Button> : <span className="small muted">还没做</span>}
        </div>
        {f && open === k && (editing === f.id ? <Edit f={f} onDone={ok => { setEditing(null); if (ok) load() }} /> : <>
          <Show f={f} />
          {f.canEdit && <div className="row" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><Button size="sm" onClick={() => remove(f)}>删</Button><Button size="sm" disabled={!!busy} onClick={() => draft(k)}>重新生成</Button><Button size="sm" variant="primary" onClick={() => setEditing(f.id)}>改</Button></div>}
        </>)}
      </div> })}
    </>}
  </div>
}
