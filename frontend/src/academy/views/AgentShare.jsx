// 用 Agent 整理（docs/WORKSHOP-SHARE-DESIGN.md 三 B 路）：教师把一份公开的 Skill 地址和一枚投稿令牌发给 Claude、WorkBuddy 等 Agent，
// Agent 读工坊导出的文件、整理成课程成果草稿上传；教师在「我交的」补「改了什么」再交给园长。Agent 不替教师写那一栏。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/api.js'
import { useBrand } from '../brand.js'

export default function AgentShare() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const brand = useBrand()
  const toast = useUI.getState().toast
  const [tokens, setTokens] = useState(null), [fresh, setFresh] = useState(null), [busy, setBusy] = useState(false)
  const skillUrl = `${location.origin}/api/skill/share-work.md`
  const load = () => api('/api/me/tokens').then(setTokens).catch(() => setTokens(null))
  useEffect(() => { if (user) load() }, [user?.id])
  const submitTokens = (tokens?.tokens || []).filter(t => t.scope === 'submit')
  const make = async () => {
    const label = prompt('这枚投稿令牌给哪个 Agent 用？（标签会写在它投来的草稿上）', 'Claude'); if (label === null) return
    setBusy(true)
    try { const r = await api('/api/me/tokens', { method: 'POST', body: JSON.stringify({ label, scope: 'submit' }) }); setFresh(r.token); load() } catch (e) { toast('没成' + (e.message ? '：' + e.message : '')) } finally { setBusy(false) }
  }
  const tokenText = fresh || 'cla_…（把你的投稿令牌贴在这里）'
  const promptText = `读 ${skillUrl} ，把我附上的这门课整理成${brand.short}的课程成果草稿。先给我看预览，我确认后再用这枚令牌上传：${tokenText}。不要替我写「在起草稿上改了什么」。`
  const copy = async (s, what) => { try { await navigator.clipboard.writeText(s); toast('已复制' + what) } catch { toast('复制失败，手动选中复制') } }
  const mono = { fontFamily: 'ui-monospace, monospace', fontSize: 13, wordBreak: 'break-all' }
  return <div className="narrow">
    <div className="hdr"><div><h1>用 Agent 整理</h1><div className="sub">把工坊导出的课交给 Claude、WorkBuddy 等整理成草稿 · 「改了什么」仍由你写</div></div><button className="iconbtn" onClick={() => nav(-1)}><Icon name="xmark" /></button></div>
    {!user && <div className="card small muted">登录后在这里拿令牌与指令。</div>}

    <div className="sect"><div className="sect-t">怎么走</div><div className="sect-b">
      <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">1 · 在教研工坊里把这门课的文件导出来</div><div className="small muted">信息采集表、网络图或大纲、周计划或计划表、教案 docx，zip 也行。先在班里用过，再分享。</div></div></div>
      <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">2 · 拿一枚投稿令牌，把下面这段指令和文件发给 Agent</div><div className="small muted">Agent 读了 Skill 就知道取哪些字段、怎么上传。它会先给你看预览。</div></div></div>
      <div className="lrow"><div style={{ flex: 1 }}><div className="lrow-t">3 · 回到「课程成果 → 我交的」，打开草稿</div><div className="small muted">补「在起草稿上改了什么」，点「交给园长」。七天没动的草稿自动删。</div></div></div>
    </div></div>

    {user && <div className="sect"><div className="sect-t">投稿令牌</div><div className="sect-b">
      {fresh && <div className="card" style={{ background: 'color-mix(in srgb,var(--acc) 10%,transparent)', marginTop: 0 }}><div className="small muted">新令牌，只显示这一次；下面的指令已经带上了</div><div style={{ ...mono, margin: '6px 0' }}>{fresh}</div><Button size="sm" onClick={() => copy(fresh, '令牌')}>只复制令牌</Button></div>}
      {submitTokens.map(t => <div key={t.id} className="lrow"><div style={{ flex: 1 }}><div className="lrow-t"><Icon name="key" /> {t.label} · 投稿令牌</div><div className="small muted">{t.lastUsedAt ? '最近用 ' + new Date(t.lastUsedAt).toLocaleString('zh-CN', { hour12: false }) : '还没用过'} · 令牌只在新建时显示一次，丢了就在设置里撤掉再建</div></div></div>)}
      <div className="lrow tap" onClick={() => !busy && make()}><div style={{ flex: 1 }}><div className="lrow-t"><Icon name="plus" /> 新建一枚投稿令牌</div><div className="small muted">标签写 Agent 的名字；它投来的草稿会标「经「某某」导入」。署名是你，仍走园长同意与审核。</div></div><Icon name="more" /></div>
    </div></div>}

    <div className="sect"><div className="sect-t">发给 Agent 的指令</div><div className="sect-b">
      <div className="card" style={{ marginTop: 0 }}>
        <div className="small" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{promptText}</div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}><Button size="sm" variant="primary" onClick={() => copy(promptText, '指令')}>复制指令</Button><Button size="sm" onClick={() => copy(skillUrl, ' Skill 地址')}>只复制 Skill 地址</Button><a className="chip" href={skillUrl} target="_blank" rel="noreferrer">看 Skill 内容</a></div>
      </div>
      <div className="lrow small muted">Skill 是公开的一页说明（{skillUrl}），不含你的信息。令牌是你的，别发到公开的地方；用完可以在设置里撤。</div>
    </div></div>

    <div className="sect"><div className="sect-t">Agent 不会做的</div><div className="sect-b">
      <div className="lrow small">不写「改了什么」：这一栏只能你自己写，Agent 填了服务端也丢掉。</div>
      <div className="lrow small">不带幼儿姓名与正脸；教案里预设的幼儿应答是剧本，不算效果。</div>
      <div className="lrow small">不带工坊评分与送审次数；不替你点提交。</div>
    </div></div>
    <div className="row" style={{ gap: 8, marginTop: 14 }}><Button size="sm" variant="tinted" onClick={() => nav('/works?tab=mine')}>去「我交的」看草稿</Button><Button size="sm" onClick={() => nav('/settings')}>所有令牌在设置里</Button></div>
  </div>
}
