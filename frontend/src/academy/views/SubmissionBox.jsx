// 关卡页「做」这一段的实践关 / 研讨关：写文字、传照片、看点评、看同园他人作答。
// 实践关要点评通过才算「做」完成；研讨关交了就算。没登录只能看要求。
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { useSubmissions, latestOf } from '../../store/useSubmissions.js'
import { uploadMedia } from '../../lib/upload.js'
import Icon from '../../components/Icon.jsx'
import { Button, TextArea } from '../../components/ui.jsx'
import { fmtDay } from './common.jsx'

export const STATUS = { pending: ['待点评', 'var(--orange)'], pass: ['已通过', 'var(--green)'], revise: ['需修改', 'var(--red)'] }
export const StatusTag = ({ status }) => { const [t, c] = STATUS[status] || [status, 'var(--label-2)']; return <span className="tag" style={{ color: c, background: `color-mix(in srgb,${c} 14%,transparent)` }}>{t}</span> }

export default function SubmissionBox({ lv, status, onDone }) {
  const user = useStore(s => s.user)
  const data = useSubmissions(s => s.byLevel[lv.id])
  const [text, setText] = useState(''), [files, setFiles] = useState([]), [busy, setBusy] = useState(false), [editing, setEditing] = useState(false)
  const fileRef = useRef()
  useEffect(() => { if (user) useSubmissions.getState().load(lv.id) }, [user?.id, lv.id])
  const latest = latestOf(data?.submissions)
  const practice = lv.type === 'practice'
  const canSubmit = status === 'current' && user && (!latest || latest.status === 'revise' || editing)

  const pick = async e => {
    const list = [...(e.target.files || [])].slice(0, 6 - files.length)
    e.target.value = ''
    setBusy(true)
    try { for (const f of list) { const m = await uploadMedia(f); setFiles(fs => fs.some(x => x.hash === m.hash) ? fs : [...fs, m]) } }
    catch (err) { useUI.getState().toast(err.status === 413 || err.code === 'too-large' ? '照片太大，压一压再传（单张 2 MB 内）' : '上传失败' + (err.message ? '：' + err.message : '')) }
    finally { setBusy(false) }
  }
  const send = async () => {
    const t = text.trim()
    if (!t && !files.length) return useUI.getState().toast(practice ? '写一段记录或传一张照片' : '先写下你的回答')
    if (!practice && t.length < 20) return useUI.getState().toast('再写具体一点，至少 20 字')
    setBusy(true)
    try {
      const s = await useSubmissions.getState().submit(lv.id, { text: t, files: files.map(({ hash, name, type }) => ({ hash, name, type })) })
      setText(''); setFiles([]); setEditing(false)
      useUI.getState().toast(practice ? '已提交，等种子教师或园长点评' : '已提交')
      onDone?.(s)
    } catch (e) { useUI.getState().toast('提交失败' + (e.message ? '：' + e.message : '')) }
    finally { setBusy(false) }
  }

  return <>
    <div className="small muted">{practice ? '实践任务' : '情景研讨'}</div>
    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, lineHeight: 1.45 }}>{practice ? lv.evidence?.note : lv.prompt}</div>
    {lv.rubric?.length > 0 && <><div className="small muted" style={{ marginTop: 12 }}>{practice ? '点评看这几条' : '好回答的样子'}</div>
      <ul className="ac-steps" style={{ marginTop: 4 }}>{lv.rubric.map((r, i) => <li key={i}>{r}</li>)}</ul></>}
    {practice && <div className="ac-note" style={{ marginTop: 8 }}>素材里不出现幼儿姓名与正脸。记录是你写的，不用数字工具代写。</div>}

    {!user && <div className="card small muted" style={{ marginTop: 12 }}>登录后在这里提交。</div>}

    {latest && !editing && <div className="card" style={{ marginTop: 12, padding: 12 }}>
      <div className="ac-row"><span className="small muted">我的提交 · {fmtDay(latest.at)}</span><StatusTag status={latest.status} /></div>
      {latest.text && <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{latest.text}</div>}
      {latest.files?.length > 0 && <div className="ac-row" style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>{latest.files.map(f => <img key={f.hash} alt={f.name} src={`api/submissions/file?id=${latest.id}&hash=${f.hash}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />)}</div>}
      {latest.review && <div style={{ marginTop: 10, paddingTop: 10, borderTop: 'var(--hair) solid var(--sep)' }}>
        <div className="small muted">{latest.review.byName} 的点评 · {fmtDay(latest.review.at)}</div>
        {lv.rubric?.length > 0 && latest.review.scores?.some(x => x) && <div className="small" style={{ marginTop: 4 }}>{lv.rubric.map((r, i) => latest.review.scores[i] ? `${r} ${latest.review.scores[i]}/5` : null).filter(Boolean).join(' · ')}</div>}
        {latest.review.comment && <div style={{ marginTop: 4, fontSize: 15, lineHeight: 1.5 }}>{latest.review.comment}</div>}
      </div>}
      {status === 'current' && latest.status !== 'pass' && !practice && <div style={{ marginTop: 10 }}><Button size="sm" onClick={() => { setText(latest.text || ''); setEditing(true) }}>再写一版</Button></div>}
      {status === 'current' && latest.status === 'revise' && <div style={{ marginTop: 10 }}><Button size="sm" variant="tinted" onClick={() => { setText(latest.text || ''); setEditing(true) }}>按意见改一版再交</Button></div>}
      {status === 'current' && latest.status === 'pending' && <div className="ac-note" style={{ marginTop: 8 }}>等点评期间可以先去「测」。点评通过后这一关才能结算。</div>}
    </div>}

    {canSubmit && <div style={{ marginTop: 12 }}>
      <TextArea rows={practice ? 7 : 5} placeholder={practice ? (lv.evidence?.note ? '按上面的要求写' : '事实一段、推断一段，200–400 字') : '先写你会说的话，再写为什么这样说，50–150 字'} value={text} onChange={e => setText(e.target.value)} />
      {practice && (lv.evidence?.kinds?.includes('photo') || lv.evidence?.kinds?.includes('video')) && <div className="ac-row" style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
        {files.map(f => <span key={f.hash} className="chip" onClick={() => setFiles(fs => fs.filter(x => x.hash !== f.hash))} title="点一下移除"><Icon name={f.type?.startsWith('video/') ? 'play' : 'image'} /> {f.name || (f.type?.startsWith('video/') ? '片段' : '照片')} ×</span>)}
        {files.length < 6 && <Button size="sm" icon="camera" disabled={busy} onClick={() => fileRef.current?.click()}>{lv.evidence.kinds.includes('video') ? '加照片或片段' : '加照片'}</Button>}
        <input ref={fileRef} type="file" accept={lv.evidence.kinds.includes('video') ? 'image/*,video/mp4,video/quicktime,video/webm' : 'image/*'} multiple hidden onChange={pick} />
      </div>}
      <div className="ac-row" style={{ marginTop: 10 }}>
        <span className="small muted">{text.trim().length} 字{files.length ? ` · ${files.length} 个附件` : ''}</span>
        <div className="row" style={{ gap: 8 }}>{editing && <Button size="sm" onClick={() => setEditing(false)}>取消</Button>}<Button variant="primary" disabled={busy} onClick={send}>提交</Button></div>
      </div>
    </div>}

    {!practice && data?.others?.length > 0 && <div style={{ marginTop: 14 }}>
      <div className="small muted">同园老师的回答（交了才能看）</div>
      {data.others.map(o => <div key={o.id} className="card" style={{ marginTop: 8, padding: 12 }}>
        <div className="small muted">{o.name} · {fmtDay(o.at)}</div>
        <div style={{ marginTop: 4, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{o.text}</div>
        {o.review?.comment && <div className="small" style={{ marginTop: 6, color: 'var(--label-2)' }}>点评：{o.review.comment}</div>}
      </div>)}
    </div>}
  </>
}
