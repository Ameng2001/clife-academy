// 合集（/collections，/api/collections）：按主题攒案例、关卡、讲堂微课、名师讲堂、资源。没有点赞与浏览数，只按更新时间排。
// 建：管理员、区县管理员、园长、种子教师，范围按角色给；看：按范围。
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { PATH_KEYS, levelsOf, pathNameOf } from '../../lib/lessons.js'
import { fmtDay } from './common.jsx'

const KIND_ICON = { case: 'folder', level: 'list', clip: 'play', lecture: 'speaker', resource: 'clipboard' }

function Item({ it, kinds }) {
  const nav = useNavigate()
  const inner = <><span className="small" style={{ color: 'var(--acc)', flex: 'none', width: 64 }}><Icon name={KIND_ICON[it.kind]} /> {kinds[it.kind]}</span><div style={{ flex: 1, minWidth: 0 }}><div className="lrow-t">{it.title}</div><div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.note ? it.note + ' · ' : ''}{it.sub}</div></div><Icon name="chevronRight" /></>
  return it.external ? <a className="lrow tap" href={it.to} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{inner}</a> : <div className="lrow tap" onClick={() => nav(it.to)}>{inner}</div>
}

// 挑条目：案例（已入库）、关卡、讲堂微课、名师讲堂、资源，各自一个搜索框
function Picker({ items, setItems, max }) {
  const [tab, setTab] = useState('case'), [q, setQ] = useState('')
  const [pool, setPool] = useState({ case: null, clip: null, lecture: null, resource: null })
  useEffect(() => {
    if (tab === 'case' && !pool.case) api('/api/cases').then(r => setPool(p => ({ ...p, case: r.cases.map(c => ({ kind: 'case', id: c.id, title: c.title, sub: c.byName })) }))).catch(() => {})
    if (tab === 'clip' && !pool.clip) api('/api/lectures/clips').then(r => setPool(p => ({ ...p, clip: r.clips.map(c => ({ kind: 'clip', id: c.id, title: c.title, sub: c.lecture })) }))).catch(() => {})
    if (tab === 'lecture' && !pool.lecture) api('/api/lectures').then(r => setPool(p => ({ ...p, lecture: [...r.upcoming, ...r.done].map(l => ({ kind: 'lecture', id: l.id, title: l.title, sub: l.speaker || '' })) }))).catch(() => {})
    if (tab === 'resource' && !pool.resource) api('/api/resources').then(r => setPool(p => ({ ...p, resource: r.resources.map(x => ({ kind: 'resource', id: x.id, title: x.title, sub: x.kind || '' })) }))).catch(() => {})
  }, [tab])
  const levels = PATH_KEYS.flatMap(p => levelsOf(p).map(l => ({ kind: 'level', id: l.id, title: l.t, sub: pathNameOf(p) })))
  const cand = (tab === 'level' ? levels : pool[tab] || []).filter(x => !q.trim() || (x.title + x.sub).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30)
  const has = x => items.some(i => i.kind === x.kind && i.id === x.id)
  const toggle = x => setItems(has(x) ? items.filter(i => !(i.kind === x.kind && i.id === x.id)) : items.length < max ? [...items, { kind: x.kind, id: x.id, note: '', title: x.title }] : items)
  return <div style={{ marginTop: 8 }}>
    <div className="ac-tabs">{['case', 'level', 'clip', 'lecture', 'resource'].map(k => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{{ case: '案例', level: '关卡', clip: '讲堂微课', lecture: '名师讲堂', resource: '资源' }[k]}</button>)}</div>
    <TextField placeholder="搜一下" value={q} onChange={e => setQ(e.target.value)} />
    <div className="chips" style={{ marginTop: 6 }}>{cand.map(x => <button key={x.kind + x.id} className={'chip nocap' + (has(x) ? ' on' : '')} onClick={() => toggle(x)}>{x.title.slice(0, 18)}{x.sub ? ' · ' + x.sub.slice(0, 8) : ''}</button>)}{!cand.length && <span className="small muted">没有可挑的</span>}</div>
  </div>
}

export default function Collections() {
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const user = useStore(s => s.user)
  const toast = useUI.getState().toast
  const [d, setD] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false)
  const openId = sp.get('id')
  const load = () => { if (user) api('/api/collections').then(setD).catch(() => setD(null)) }
  useEffect(load, [user?.id])
  const save = async () => {
    if (form.title.trim().length < 2) return toast('写个标题')
    if (!form.items.length) return toast('至少挑一条')
    setBusy(true)
    try { await api('/api/collections', { method: 'POST', body: JSON.stringify({ id: form.id || undefined, title: form.title, desc: form.desc, scope: form.scope, communityId: form.communityId || undefined, items: form.items.map(({ kind, id, note }) => ({ kind, id, note })) }) }); toast(form.id ? '已改' : '已建'); setForm(null); load() }
    catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  const del = async c => { if (!confirm(`删掉「${c.title}」？`)) return; try { await api('/api/collections/delete', { method: 'POST', body: JSON.stringify({ id: c.id }) }); load() } catch (e) { toast('没成') } }
  const edit = c => setForm({ id: c.id, title: c.title, desc: c.desc || '', scope: c.scope, communityId: '', items: c.items.map(i => ({ kind: i.kind, id: i.id, note: i.note || '', title: i.title })) })
  const list = d?.collections || []
  const open = openId ? list.find(c => c.id === openId) : null
  return <div className="narrow wide">
    <div className="hdr"><div><h1>合集</h1><div className="sub">按主题攒案例、关卡、讲堂微课、名师讲堂、资源 · 不计数、不排行</div></div><div className="hdr-actions"><button className="chip" onClick={() => nav('/community')}><Icon name="share" /> 教研共同体</button>{d?.scopes.length > 0 && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ id: null, title: '', desc: '', scope: d.scopes[0].key, communityId: d.community?.id || '', items: [] })}>建一份</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    {!user && <div className="card small muted">登录后在这里看。</div>}
    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>{form.id ? '改这份' : '建一份合集'} · 最多 {d.max} 条</div>
      <TextField placeholder="主题，如「午睡：从安静角到起床」" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <TextArea rows={2} style={{ marginTop: 8 }} placeholder="一句话说这份合集给谁、怎么用（可不填）" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="ac-sel" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}>{d.scopes.map(s => <option key={s.key} value={s.key}>给{s.name}</option>)}</select>
        {form.scope === 'community' && d.communities.length > 0 && <select className="ac-sel" value={form.communityId} onChange={e => setForm({ ...form, communityId: e.target.value })}><option value="">选共同体</option>{d.communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      </div>
      <div className="small muted" style={{ marginTop: 10 }}>已挑 {form.items.length} 条（点一下移除；备注写为什么放进来）</div>
      {form.items.map((it, i) => <div key={it.kind + it.id} className="row" style={{ gap: 6, marginTop: 4, alignItems: 'center' }}><span className="chip nocap on" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}>{d.kinds[it.kind]} · {(it.title || it.id).slice(0, 16)} ×</span><TextField placeholder="备注" value={it.note} onChange={e => setForm({ ...form, items: form.items.map((x, j) => j === i ? { ...x, note: e.target.value } : x) })} style={{ flex: 1 }} /></div>)}
      <Picker items={form.items} setItems={items => setForm({ ...form, items })} max={d.max} />
      <div className="ac-row" style={{ marginTop: 10 }}><span /><div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>存</Button></div></div>
    </div>}
    {open && <div className="card">
      <div className="small muted">{open.scopeName}{open.where ? ' · ' + open.where : ''} · {open.byName} · {fmtDay(open.updatedAt)}<span className="tap" style={{ marginInlineStart: 10, color: 'var(--acc)' }} onClick={() => setSp({})}>全部合集 ›</span></div>
      <div style={{ fontWeight: 700, fontSize: 20, margin: '4px 0' }}>{open.title}</div>
      {open.desc && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{open.desc}</div>}
      <div className="sect" style={{ marginTop: 10 }}><div className="sect-b">{open.items.map(it => <Item key={it.kind + it.id} it={it} kinds={d.kinds} />)}</div></div>
      {open.canEdit && <div className="row" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><Button size="sm" onClick={() => del(open)}>删</Button><Button size="sm" onClick={() => edit(open)}>改</Button></div>}
    </div>}
    {!open && d && !list.length && <div className="card small muted">还没有合集。{d.scopes.length ? '点右上角「建一份」。' : '园长、区县管理员或运营方建了会在这里出现。'}</div>}
    {!open && <div className="grid2">{list.map(c => <div key={c.id} className="card tappable" style={{ marginTop: 10 }} onClick={() => setSp({ id: c.id })}>
      <div className="small muted">{c.scopeName}{c.where ? ' · ' + c.where : ''} · {c.byName}</div>
      <div style={{ fontWeight: 700, fontSize: 17, margin: '4px 0' }}>{c.title}</div>
      {c.desc && <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.desc}</div>}
      <div className="chips" style={{ marginTop: 6 }}>{Object.entries(c.items.reduce((a, i) => ({ ...a, [i.kind]: (a[i.kind] || 0) + 1 }), {})).map(([k, n]) => <span key={k} className="chip nocap">{d.kinds[k]} {n}</span>)}</div>
    </div>)}</div>}
  </div>
}
