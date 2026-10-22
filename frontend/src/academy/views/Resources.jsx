// 资源库：文献与政策（内置教育部文件）、模板与工具（园长、点评人上传）。文件只收图片与短视频，文档类贴链接。
// 没登录只看公开的；本园的只给同园。关卡里引用的条文按书名跳到这里（?q=）。
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button, TextField, TextArea } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { uploadMedia } from '../../lib/upload.js'
import { DOMAINS } from '../../lib/capability.js'
import { fmtDay } from './common.jsx'

const KIND_ORDER = ['policy', 'template', 'case', 'other']
const EMPTY = { id: null, kind: 'template', title: '', domain: '', desc: '', url: '', file: null, scope: 'org' }

export default function Resources() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') || '')
  const kind = sp.get('kind') || '', domain = sp.get('domain') || ''
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }
  const [data, setData] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false)
  const fileRef = useRef()
  const load = async () => {
    const p = new URLSearchParams(); if (q.trim()) p.set('q', q.trim()); if (kind) p.set('kind', kind); if (domain) p.set('domain', domain)
    try { setData(await api('/api/resources?' + p.toString())) } catch (e) { useUI.getState().toast('没取到资源' + (e.message ? '：' + e.message : '')) }
  }
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') || '') !== q) setParam('q', q) }, 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { load() }, [sp.toString(), user?.id])
  const director = user?.academy?.role === 'director' || !!user?.admin
  const save = async () => {
    if (!form.title.trim()) return useUI.getState().toast('写个标题')
    if (!form.url.trim() && !form.file) return useUI.getState().toast('贴一个链接，或传一张图片 / 一段短视频')
    setBusy(true)
    try {
      await api('/api/resources', { method: 'POST', body: JSON.stringify({ ...form, domain: form.domain || null }) })
      useUI.getState().toast(form.id ? '已改' : '已加入资源库'); setForm(null); await load()
    } catch (e) { useUI.getState().toast('没保存成' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }
  const del = async r => {
    if (!confirm(`删掉「${r.title}」？`)) return
    try { await api('/api/resources/delete', { method: 'POST', body: JSON.stringify({ id: r.id }) }); useUI.getState().toast('已删'); await load() }
    catch (e) { useUI.getState().toast('没删成' + (e.message ? '：' + e.message : '')) }
  }
  const pick = async e => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try { const m = await uploadMedia(f); setForm(x => ({ ...x, file: m })) }
    catch (err) { useUI.getState().toast(err.status === 415 || err.code === 'unsupported' ? '只收图片与短视频，文档请贴链接' : '上传失败' + (err.message ? '：' + err.message : '')) }
    finally { setBusy(false) }
  }
  const kinds = data?.kinds || {}

  return <div className="narrow wide">
    <div className="hdr"><div><h1>资源库</h1><div className="sub">文献与政策 · 模板与工具</div></div><div className="hdr-actions"><button className="chip" onClick={() => nav('/cases')}><Icon name="sparkles" /> 专家案例</button>{data?.canAdd && !form && <Button size="sm" variant="tinted" icon="plus" onClick={() => setForm({ ...EMPTY })}>加一条</Button>}<button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div></div>
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <TextField placeholder="搜书名、模板名，如「评估指南」「观察记录」" value={q} onChange={e => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} />
      <span style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--label-3)', display: 'flex' }}><Icon name="magnifier" /></span>
    </div>
    <div className="chips" style={{ marginBottom: 8 }}>
      <button className={'chip' + (!kind ? ' on' : '')} onClick={() => setParam('kind', null)}>全部</button>
      {KIND_ORDER.filter(k => kinds[k]).map(k => <button key={k} className={'chip' + (k === kind ? ' on' : '')} onClick={() => setParam('kind', k === kind ? null : k)}>{kinds[k]}</button>)}
    </div>
    <div className="chips" style={{ marginBottom: 14 }}>
      <button className={'chip' + (!domain ? ' on' : '')} onClick={() => setParam('domain', null)}>全部领域</button>
      {DOMAINS.map(d => <button key={d.key} className={'chip' + (d.key === domain ? ' on' : '')} onClick={() => setParam('domain', d.key === domain ? null : d.key)}>{d.name}</button>)}
    </div>

    {form && <div className="card" style={{ marginBottom: 14 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>{form.id ? '改这条' : '加一条'}</div>
      <TextField placeholder="标题" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <select className="ac-sel" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} style={{ flex: 1 }}>{KIND_ORDER.filter(k => kinds[k]).map(k => <option key={k} value={k}>{kinds[k]}</option>)}</select>
        <select className="ac-sel" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} style={{ flex: 1 }}><option value="">不分领域</option>{DOMAINS.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}</select>
      </div>
      <TextArea rows={2} style={{ marginTop: 8 }} placeholder="一两句说明：是什么、怎么用" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} />
      <TextField style={{ marginTop: 8 }} placeholder="链接（飞书文档、网盘、官网原文）" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
      <div className="ac-row" style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
        {form.file ? <span className="chip" onClick={() => setForm({ ...form, file: null })} title="点一下移除"><Icon name="image" /> {form.file.name || '文件'} ×</span> : <Button size="sm" icon="camera" disabled={busy} onClick={() => fileRef.current?.click()}>传图片或短视频</Button>}
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime" hidden onChange={pick} />
        <span className="small muted">文档类贴链接就行</span>
      </div>
      <div className="ac-row" style={{ marginTop: 10 }}>
        <select className="ac-sel" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}><option value="org">本园可见</option>{director && <option value="public">所有园可见</option>}</select>
        <div className="row" style={{ gap: 8 }}><Button size="sm" onClick={() => setForm(null)}>取消</Button><Button variant="primary" disabled={busy} onClick={save}>保存</Button></div>
      </div>
    </div>}

    <div className="sect"><div className="sect-t">{data ? `${data.resources.length} 条` : '正在取数…'}</div><div className="sect-b cols2">
      {data && !data.resources.length && <div className="lrow small muted">没有匹配的资源。{!user && '登录后还能看到本园上传的。'}</div>}
      {data?.resources.map(r => <div key={r.id} className="lrow" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lrow-t">{r.title}{r.seed && <span className="tag" style={{ marginInlineStart: 8 }}>{r.source}{r.year ? ' ' + r.year : ''}</span>}{!r.seed && r.scope === 'public' && <span className="tag acc" style={{ marginInlineStart: 8 }}>公开</span>}</div>
          {r.desc && <div className="small muted" style={{ marginTop: 2, lineHeight: 1.45 }}>{r.desc}</div>}
          <div className="small muted" style={{ marginTop: 4 }}>{kinds[r.kind]}{r.domain ? ' · ' + (DOMAINS.find(d => d.key === r.domain)?.name || r.domain) : ''}{r.byName ? ` · ${r.byName} · ${fmtDay(r.at)}` : ''}</div>
          <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {r.url && <a className="chip" href={r.url} target="_blank" rel="noreferrer"><Icon name="link" /> 打开</a>}
            {r.file && <a className="chip" href={`api/resources/file?id=${r.id}`} target="_blank" rel="noreferrer"><Icon name={r.file.type?.startsWith('video') ? 'play' : 'image'} /> {r.file.name || '文件'}</a>}
            {r.canEdit && <><button className="chip" onClick={() => setForm({ id: r.id, kind: r.kind, title: r.title, domain: r.domain || '', desc: r.desc || '', url: r.url || '', file: r.file ? { ...r.file, hash: undefined } : null, scope: r.scope })}>改</button><button className="chip" onClick={() => del(r)}>删</button></>}
          </div>
        </div>
      </div>)}
    </div></div>
    {!user && <div className="card small muted">登录后能看到本园上传的模板，园长与点评人能上传。</div>}
  </div>
}
