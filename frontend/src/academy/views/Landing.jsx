// 登录前页：桌面上左边是介绍、路径目录、下一场名师讲堂与回放数，右边是登录卡（Login.jsx）；手机上只有登录卡（academy.css 把左栏藏掉）。
// 不是门户：能公开的只有这些；专家案例、看板都要登录。数据读 /api/lectures（不登录也给）和本地课包目录。
import { useEffect, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { PATH_KEYS, PATH_META, pathNameOf, levelsOf } from '../../lib/lessons.js'
import { api } from '../../lib/api.js'
import Login from './Login.jsx'
import { fmtWhen } from './Lectures.jsx'

const KIND = { role: '岗位', domain: '领域', stage: '阶段', admin: '管理' }
export default function Landing({ relogin }) {
  const [lec, setLec] = useState(null), [pol, setPol] = useState(null)
  useEffect(() => { api('/api/lectures').then(setLec).catch(() => setLec(null)); api('/api/policy').then(setPol).catch(() => setPol(null)) }, [])
  const rule = id => pol?.rules.find(r => r.id === id)
  const groups = ['role', 'domain', 'stage', 'admin'].map(k => [k, PATH_KEYS.filter(p => (PATH_META[p]?.kind || 'role') === k)]).filter(([, ps]) => ps.length)
  const total = PATH_KEYS.reduce((a, p) => a + levelsOf(p).length, 0)
  const next = lec?.upcoming?.[0]
  return <div className="landing">
    <div className="landing-main">
      <div className="landing-hero">
        <div className="small" style={{ color: 'var(--acc)', fontWeight: 600 }}>幼儿园教师专业发展 · 本地研修平台</div>
        <h1>按岗位走关，在平台上做一次就算一次</h1>
        <p>{PATH_KEYS.length} 条路径 {total} 关，保健医、班级教师、保育员、园长各走各的线，七个专业领域都有。学到的在园里做了，平台记一次，学分可以换工具额度，也计入继续教育学时。</p>
        <div className="landing-points">
          <div><Icon name="play" /><b>讲、看、做</b><span>每关先讲清楚，再看一段演示，最后在园里做一次或交一份作品</span></div>
          <div><Icon name="sparkles" /><b>{rule('work-not-person')?.title || '评作品不评人'}</b><span>{rule('no-ranking')?.text || '作品由点评人、带教教师看，不排名、不公开分数，案例实名共享'}</span></div>
          <div><Icon name="shield" /><b>{rule('child-data')?.title || '不碰幼儿数据'}</b><span>{rule('child-data')?.text || '不用数字产品评价幼儿，幼儿不对屏，平台只记教师自己的学习'}</span></div>
        </div>
        {pol && <div className="small muted" style={{ marginTop: -10, marginBottom: 16 }}>全部 {pol.rules.length} 条口径见登录后的「平台口径」页；运营方改一处，这里与模型提示一起变。</div>}
      </div>
      <div className="landing-cols">
        <div className="card">
          <div className="sect-t" style={{ marginTop: 0 }}>路径目录</div>
          {groups.map(([k, ps]) => <div key={k} style={{ marginTop: 8 }}><div className="small muted">{KIND[k]}路径</div><div className="chips" style={{ marginTop: 4 }}>{ps.map(p => <span key={p} className="chip nocap">{pathNameOf(p)} · {levelsOf(p).length} 关</span>)}</div></div>)}
        </div>
        <div className="card">
          <div className="sect-t" style={{ marginTop: 0 }}>名师讲堂</div>
          {next ? <>
            <div className="small muted" style={{ marginTop: 6 }}>下一场 · {fmtWhen(next.at, next.minutes)}</div>
            <div style={{ fontWeight: 700, fontSize: 17, margin: '4px 0' }}>{next.title}</div>
            {next.desc && <div className="small muted">{next.desc}</div>}
            {next.pack?.preview?.points?.length > 0 && <div className="small" style={{ marginTop: 8 }}>{next.pack.preview.points.map((x, i) => <div key={i}>{i + 1}. {x}</div>)}</div>}
            <div className="small muted" style={{ marginTop: 8 }}>登录后可预约，开播前提醒</div>
          </> : <div className="small muted" style={{ marginTop: 6 }}>每月一场，政策解读、园所建设路径、课程领导力。{lec ? '下一场还没排。' : ''}</div>}
          {lec?.done?.length > 0 && <div className="small muted" style={{ marginTop: 10 }}>已有 {lec.done.length} 场回放{lec.done.some(l => l.pack?.clips?.length) ? '，切出的微课进精品微课' : ''}</div>}
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 14 }}>平台由本地运营方运营，账号来自园所所在的平台；没有账号请联系本园园长或区县教研员。</div>
    </div>
    <div className="landing-side"><Login relogin={relogin} /></div>
  </div>
}
