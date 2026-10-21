// 一关：讲 → 看 → 做 → 测。草稿只留本机（lib/level-draft.js），通关走 finish-level.js。
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { levelOf, statusOf } from '../../lib/lessons.js'
import { finishLevel, canPass } from '../../lib/finish-level.js'
import { drafts, useDraft } from '../../lib/level-draft.js'
import { useS, update } from './common.jsx'

const SEGS = [['jiang', '讲'], ['kan', '看'], ['zuo', '做'], ['ce', '测']]
const setDraft = (id, mut) => drafts.set(id, mut)

export default function Level() {
  const nav = useNavigate(), S = useS()
  const { id } = useParams()
  const lv = levelOf(id)
  if (!lv) return <div className="narrow"><div className="empty">没有这一关。</div></div>
  const st = statusOf(S.progress, id)
  const d = useDraft(id)
  const answered = lv.qs.filter((_, i) => d.answers[i] != null).length
  const right = lv.qs.filter((q, i) => d.answers[i] != null && q.o[d.answers[i]][1] === 1).length
  const gate = canPass(lv, { zuoDone: d.zuoDone, right, of: lv.qs.length })
  const segDone = { jiang: true, kan: true, zuo: !lv.needsEvent || d.zuoDone, ce: answered === lv.qs.length && gate.ok }

  const pass = () => {
    const r = finishLevel(S, id, { zuoDone: d.zuoDone, right, of: lv.qs.length, events: d.events })
    if (!r.passed) { useUI.getState().toast(r.why === 'quiz' ? '测验还没全对，改一改再提交。' : r.why === 'zuo' ? '「做」这一步还没完成。' : '这一关现在不能结算。'); return }
    update(s => { s.progress = r.S.progress; s.sessions = r.S.sessions; s.credits = r.S.credits })
    drafts.clear(id)
    useUI.getState().toast(`第 ${lv.i + 1} 关通过，+1 学分`)
    nav('/paths/' + lv.path, { replace: true })
  }

  return <div className="narrow">
    <div className="hdr">
      <div><div className="small muted">第 {lv.i + 1} 关 · {lv.scene} · {lv.dur}</div><h1 style={{ fontSize: 26 }}>{lv.title}</h1></div>
      <button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button>
    </div>
    {st === 'done' && <div className="card small" style={{ color: 'var(--green)' }}>已通过。可以复习，不再计分。</div>}
    <div className="ac-tabs">{SEGS.map(([k, n]) => <button key={k} className={(d.seg === k ? 'on' : '') + (segDone[k] && k !== 'jiang' && k !== 'kan' ? ' done' : '')} onClick={() => setDraft(id, x => { x.seg = k })}>{n}</button>)}</div>

    {d.seg === 'jiang' && <div className="card">
      <div className="small muted">学完能做到</div><div style={{ fontSize: 17, fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>{lv.goal}</div>
      {lv.menu?.length > 0 && <><div className="small muted" style={{ marginTop: 14 }}>平台入口</div>
        <div className="ac-menu">{lv.menu.map((m, i) => <span key={i} style={{ display: 'contents' }}>{i > 0 && <span className="arr">›</span>}<span className="chip">{m}</span></span>)}{lv.btn && <><span className="arr">›</span><span className="chip" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>{lv.btn}</span></>}</div></>}
      {lv.steps?.length > 0 && <><div className="small muted" style={{ marginTop: 14 }}>操作步骤</div><ol className="ac-steps">{lv.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></>}
      <div style={{ marginTop: 14 }}><Button variant="primary" onClick={() => setDraft(id, x => { x.seg = 'kan' })}>下一步：看微课</Button></div>
    </div>}

    {d.seg === 'kan' && <div className="card">
      {lv.featured === 'obs'
        ? <video className="ac-video" controls playsInline src={`lessons/${id}.mp4`} />
        : <div className="ac-video" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-3)', fontSize: 14 }}>微课制作中 · {lv.dur}</div>}
      <div className="ac-note" style={{ marginTop: 10 }}>白板微课，{lv.dur}。看完到「做」里在平台上实际操作一次。</div>
      <div style={{ marginTop: 14 }}><Button variant="primary" onClick={() => setDraft(id, x => { x.seg = 'zuo' })}>下一步：去做</Button></div>
    </div>}

    {d.seg === 'zuo' && <div className="card">
      {lv.needsEvent ? <>
        <div className="small muted">平台实操</div><div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{lv.event}</div>
        <div className="ac-note" style={{ marginTop: 8 }}>在平台上完成后，平台会把这一步回传到大课堂，这里自动打勾。不需要截图，也不需要手工登记。</div>
        <div className="ac-row" style={{ marginTop: 14 }}>
          <span className={'tag' + (d.zuoDone ? '' : '')} style={d.zuoDone ? { color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 16%,transparent)' } : undefined}>{d.zuoDone ? '平台已回传' : '等待平台回传'}</span>
          {!d.zuoDone && <Button size="sm" variant="tinted" onClick={() => setDraft(id, x => { x.zuoDone = true; x.events = [...x.events, 'demo:' + lv.event] })}>模拟回传（演示）</Button>}
        </div>
      </> : <div className="ac-note">这一关没有平台实操，直接进入测验。</div>}
      <div style={{ marginTop: 14 }}><Button variant="primary" disabled={!segDone.zuo} onClick={() => setDraft(id, x => { x.seg = 'ce' })}>下一步：测一测</Button></div>
    </div>}

    {d.seg === 'ce' && <div className="card">
      {lv.qs.map((q, qi) => { const a = d.answers[qi]; return <div key={qi} style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{qi + 1}. {q.t}</div>
        {q.o.map((o, oi) => <button key={oi} className={'ac-opt' + (a == null ? '' : oi === a ? (o[1] === 1 ? ' right' : ' wrong') : '')} disabled={a != null && o[1] !== 1 && oi !== a ? false : a != null}
          onClick={() => setDraft(id, x => { x.answers = { ...x.answers, [qi]: oi } })}>{o[0]}</button>)}
        {a != null && <div className="ac-fb">{q.o[a][2]}{q.o[a][1] !== 1 && <> <button className="btn plain" style={{ padding: 0, marginInlineStart: 6, color: 'var(--acc)' }} onClick={() => setDraft(id, x => { const n = { ...x.answers }; delete n[qi]; x.answers = n; x.seg = q.jump || 'jiang' })}>回去看「{q.jump === 'kan' ? '看' : '讲'}」再答</button></>}</div>}
      </div> })}
      <div className="ac-row">
        <span className="small muted">{answered}/{lv.qs.length} 题 · 对 {right}</span>
        {st === 'current' ? <Button variant="primary" icon="checkCircle" disabled={!(answered === lv.qs.length && gate.ok)} onClick={pass}>通关</Button> : <Button onClick={() => nav('/paths/' + lv.path)}>返回路径</Button>}
      </div>
    </div>}
  </div>
}
