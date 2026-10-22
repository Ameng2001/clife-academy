// 教学物料商城（/mall）：本地运营方上架教具、绘本、耗材、名额，教师用积分换，运营方发货到园（docs/POINTS-DESIGN.md 第三节第 2 条）。
// 不做购物车、拼单、秒杀；不显示已兑件数与热门榜；库存数只给运营方。钱包页与教研工坊统一，这里只显示余额。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { fmtDay } from './common.jsx'

const EMPTY = { id: null, title: '', desc: '', points: '', stock: '', scope: 'district', communityId: '', deliver: 'org', pickupNote: '', off: false }
const STATUS_COLOR = { placed: 'var(--orange)', shipped: 'var(--acc)', done: 'var(--green)', cancelled: 'var(--label-3)' }

export default function Mall() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI.getState().toast
  const [d, setD] = useState(null), [busy, setBusy] = useState(false), [form, setForm] = useState(null), [notes, setNotes] = useState({}), [tab, setTab] = useState('items')
  const load = () => { if (!user) { setD(null); return } api('/api/mall').then(setD).catch(e => toast('没取到商城' + (e.message ? '：' + e.message : ''))) }
  useEffect(load, [user?.id])
  const redeem = async it => {
    const where = it.deliver === 'org' ? `寄到 ${d.orgName || '本园'}` : `现场领${it.pickupNote ? '：' + it.pickupNote : ''}`
    if (!confirm(`用 ${it.points} 积分换「${it.title}」？${where}。发货前可以取消，积分退回。`)) return
    setBusy(true)
    try { const r = await api('/api/mall/redeem', { method: 'POST', body: JSON.stringify({ id: it.id, note: notes[it.id] || '' }) }); toast(`已换，还有 ${r.points} 积分`); setNotes({ ...notes, [it.id]: '' }); load() }
    catch (e) { toast(e.code === 'insufficient' ? '积分不够' : e.code === 'stock' ? '换完了' : '没换成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const act = async (o, action) => {
    if (action === 'cancel' && !confirm(`取消「${o.title}」？积分退回。`)) return
    setBusy(true)
    try { await api('/api/mall/orders', { method: 'POST', body: JSON.stringify({ id: o.id, action, note: notes[o.id] || '' }) }); toast(action === 'cancel' ? '已取消，积分退回' : action === 'ship' ? '已标发货' : '已标签收'); load() }
    catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const save = async () => {
    if (form.title.trim().length < 2) return toast('写个名称')
    if (!(Math.floor(Number(form.points)) >= 1)) return toast('积分价填正整数')
    setBusy(true)
    try { await api('/api/mall/items', { method: 'POST', body: JSON.stringify({ id: form.id || undefined, title: form.title, desc: form.desc, points: +form.points, stock: form.stock === '' ? null : +form.stock, scope: form.scope, communityId: form.communityId || undefined, deliver: form.deliver, pickupNote: form.pickupNote, off: form.off }) }); toast(form.id ? '已改' : '已上架'); setForm(null); load() }
    catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const edit = it => setForm({ id: it.id, title: it.title, desc: it.desc, points: String(it.points), stock: it.stock == null ? '' : String(it.stock), scope: it.scope, communityId: '', deliver: it.deliver, pickupNote: it.pickupNote, off: it.off })

  return <div className="narrow wide">
    <div className="hdr"><div><h1>教学物料商城</h1><div className="sub">教具、绘本、耗材、名额 · 用积分换 · 寄到园</div></div><div className="hdr-actions"><button className="chip" onClick={() => nav('/honors')}><Icon name="star" /> 荣誉与积分</button>{d?.manage && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ ...EMPTY, scope: d.canScopes[0] })}>上架</Button>}</div></div>
    {!user && <div className="card small muted">登录后在这里换。</div>}
    {d && <div className="card" style={{ marginBottom: 12 }}><div className="ac-row"><div><div className="small muted">我的积分</div><div style={{ fontSize: 24, fontWeight: 700 }}>{d.points ?? '—'}</div></div><div className="small muted" style={{ textAlign: 'end', maxWidth: 360 }}>积分是平台唯一的资产，过关、入库、互动都自动记。不是钱，不可转赠、不排行。明细在教研工坊的钱包页看。</div></div></div>}

    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>{form.id ? '改这件' : '上架一件'} · 只上教学物料：教具、绘本、区角材料、耗材、讲堂与培训名额。不上购物卡、现金等价物、与教学无关的礼品。</div>
      <TextField placeholder="名称，如「绘本《好饿的毛毛虫》」" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <TextArea rows={3} style={{ marginTop: 8 }} placeholder="说明：规格、适合的年龄班、怎么领" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <TextField type="number" min="1" placeholder="积分价" value={form.points} onChange={e => setForm({ ...form, points: e.target.value })} style={{ width: 110 }} />
        <TextField type="number" min="0" placeholder="库存（空是不限）" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} style={{ width: 150 }} />
        <select className="ac-sel" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}>{d.canScopes.map(k => <option key={k} value={k}>{d.scopes[k]}</option>)}</select>
        {form.scope === 'community' && <TextField placeholder="共同体 id" value={form.communityId} onChange={e => setForm({ ...form, communityId: e.target.value })} style={{ width: 160 }} />}
        <select className="ac-sel" value={form.deliver} onChange={e => setForm({ ...form, deliver: e.target.value })}>{Object.entries(d.deliver).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
      </div>
      {form.deliver === 'pickup' && <TextField style={{ marginTop: 8 }} placeholder="在哪领、什么时候领" value={form.pickupNote} onChange={e => setForm({ ...form, pickupNote: e.target.value })} />}
      <div className="ac-row" style={{ marginTop: 10 }}>
        <label className="small row" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={form.off} onChange={e => setForm({ ...form, off: e.target.checked })} /> 下架（教师看不到）</label>
        <div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button size="sm" variant="primary" disabled={busy} onClick={save}>{form.id ? '改' : '上架'}</Button></div>
      </div>
    </div>}

    {d && <div className="ac-tabs" style={{ marginBottom: 12 }}>
      <button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>物料 {d.items.length}</button>
      <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>我换的{d.orders.length ? ` ${d.orders.length}` : ''}</button>
      {d.manage && <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>订单{d.all?.filter(o => o.status === 'placed').length ? ` ${d.all.filter(o => o.status === 'placed').length} 待发` : ''}</button>}
    </div>}

    {d && tab === 'items' && <>
      {!d.items.length && <div className="card small muted">还没有上架的物料。{d.manage ? '点右上角「上架」。' : '本地运营方上架后在这里换。'}</div>}
      <div className="grid2">{d.items.map(it => <div key={it.id} className="card" style={{ opacity: it.off ? .6 : 1 }}>
        <div className="ac-row" style={{ alignItems: 'flex-start' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{it.title}</div><div className="small muted" style={{ marginTop: 2 }}>{it.scopeName}{it.communityName ? ' · ' + it.communityName : ''} · {it.deliverName}{it.off ? ' · 已下架' : !it.available ? ' · 换完了' : ''}{it.canEdit && it.left != null ? ` · 还剩 ${it.left}` : ''}</div></div><div style={{ fontWeight: 700, color: 'var(--acc)', flex: 'none' }}>{it.points} 积分</div></div>
        {it.desc && <div className="small" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{it.desc}</div>}
        {it.deliver === 'pickup' && it.pickupNote && <div className="small muted" style={{ marginTop: 4 }}>领取：{it.pickupNote}</div>}
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {it.available && <><TextField placeholder={it.deliver === 'org' ? '备注（如寄到哪个班），可不填' : '备注，可不填'} value={notes[it.id] || ''} onChange={e => setNotes({ ...notes, [it.id]: e.target.value })} style={{ flex: 1, minWidth: 160 }} /><Button size="sm" variant="primary" disabled={busy || (d.points ?? 0) < it.points} onClick={() => redeem(it)}>{(d.points ?? 0) < it.points ? '积分不够' : '换'}</Button></>}
          {it.canEdit && <Button size="sm" onClick={() => edit(it)}>改</Button>}
        </div>
      </div>)}</div>
    </>}

    {d && tab === 'mine' && <>
      {!d.orders.length && <div className="card small muted">还没换过。</div>}
      {d.orders.map(o => <div key={o.id} className="card" style={{ marginTop: 10 }}><div className="ac-row"><div><div style={{ fontWeight: 600 }}>{o.title}</div><div className="small muted">{fmtDay(o.at)} · {o.points} 积分 · {o.deliverName}{o.note ? ' · ' + o.note : ''}</div></div><span className="small" style={{ color: STATUS_COLOR[o.status] }}>{o.statusName}</span></div>
        {o.status === 'placed' && <div style={{ marginTop: 8 }}><Button size="sm" disabled={busy} onClick={() => act(o, 'cancel')}>取消，退回积分</Button></div>}
        {o.cancelNote && <div className="small muted" style={{ marginTop: 6 }}>{o.cancelNote}</div>}
      </div>)}
    </>}

    {d && tab === 'all' && d.manage && <>
      {!d.all.length && <div className="card small muted">还没有订单。</div>}
      {d.all.map(o => <div key={o.id} className="card" style={{ marginTop: 10 }}><div className="ac-row"><div><div style={{ fontWeight: 600 }}>{o.title}</div><div className="small muted">{o.name}{o.orgName ? ' · ' + o.orgName : ''} · {fmtDay(o.at)} · {o.points} 积分 · {o.deliverName}{o.note ? ' · ' + o.note : ''}</div></div><span className="small" style={{ color: STATUS_COLOR[o.status] }}>{o.statusName}{o.byName && o.status !== 'placed' ? ' · ' + o.byName : ''}</span></div>
        {(o.status === 'placed' || o.status === 'shipped') && <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {o.status === 'placed' && <Button size="sm" variant="primary" disabled={busy} onClick={() => act(o, 'ship')}>标发货</Button>}
          <Button size="sm" disabled={busy} onClick={() => act(o, 'done')}>标签收</Button>
          <TextField placeholder="取消原因" value={notes[o.id] || ''} onChange={e => setNotes({ ...notes, [o.id]: e.target.value })} style={{ flex: 1, minWidth: 140 }} /><Button size="sm" disabled={busy} onClick={() => act(o, 'cancel')}>取消并退回</Button>
        </div>}
      </div>)}
    </>}
  </div>
}
