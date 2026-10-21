// 能力地图（docs/ROADMAP.md 第五节）：《幼儿园教师专业标准》七个领域，各一个状态，由三类证据合成：
// 工具关通过（含测验）、实践关作品被点评通过、研讨关作答。给本人看的是「哪些领域有证据、哪些还空着」，不是分数条。
// 工具关按内容归入领域（晨午检→一日生活，观察记录工具→观察评价，教研工坊→教育活动计划）；
// 账号、设备、园长工作台这些平台操作不属于专业领域，单列为「平台工具」。纯函数。
import { PATH_KEYS, PATH_META, levelsOf, levelOf } from './lessons.js'

export const DOMAINS = Object.freeze([
  { key: 'env', name: '环境创设与利用' },
  { key: 'life', name: '一日生活组织与保育' },
  { key: 'play', name: '游戏活动支持与引导' },
  { key: 'plan', name: '教育活动计划与实施' },
  { key: 'obs', name: '观察、记录与评价' },
  { key: 'comm', name: '沟通与合作' },
  { key: 'reflect', name: '反思与发展' }
])
const BY_NAME = Object.fromEntries(DOMAINS.map(d => [d.name, d.key]))
const SKILL_DOMAIN = { health: 'life', food: 'life', sleep: 'life', sport: 'life', teach: 'plan', family: 'comm' }
const SCENE_DOMAIN = { '观察记录': 'obs' }

/** 一关属于哪个领域；平台工具关（账号、设备、看板）返回 null。 */
export function domainOf(level) {
  const meta = PATH_META[level.path]
  if (meta?.domain && BY_NAME[meta.domain]) return BY_NAME[meta.domain]
  if (SCENE_DOMAIN[level.scene]) return SCENE_DOMAIN[level.scene]
  return SKILL_DOMAIN[level.skill] || null
}

const latestByLevel = subs => {
  const m = {}
  for (const s of subs || []) if (!m[s.levelId] || s.at > m[s.levelId].at) m[s.levelId] = s
  return m
}

/**
 * progress：{ [levelId]: { passedAt } }；submissions：本人全部提交（GET /api/submissions）。
 * 返回 { domains: [{ key, name, status, tools, works, answers, pending, revise, total, cert }], tools: { done, total } }
 *   status  'empty' 没有证据 | 'started' 只有待点评 / 需修改的作品 | 'evidenced' 有通过的关或作品
 *   cert    领域路径（obs、comm 这类）走完 → { path, name, done, total, ready }；没有领域路径的领域为 null
 */
export function capabilityMap(progress = {}, submissions = []) {
  const latest = latestByLevel(submissions)
  const acc = Object.fromEntries(DOMAINS.map(d => [d.key, { ...d, tools: 0, works: 0, answers: 0, pending: 0, revise: 0, total: 0, cert: null }]))
  const tools = { done: 0, total: 0 }
  for (const p of PATH_KEYS) {
    for (const l of levelsOf(p)) {
      const lv = levelOf(l.id), k = domainOf(lv), passed = !!progress[l.id]?.passedAt
      if (!k) { tools.total++; if (passed) tools.done++; continue }
      const d = acc[k]; d.total++
      const s = latest[l.id]
      if (lv.type === 'practice') { if (s?.status === 'pass') d.works++; else if (s?.status === 'pending') d.pending++; else if (s?.status === 'revise') d.revise++ }
      else if (lv.type === 'seminar') { if (s) d.answers++ }
      else if (passed) d.tools++
    }
    const meta = PATH_META[p]
    if (meta?.domain && BY_NAME[meta.domain]) {
      const ls = levelsOf(p), done = ls.filter(l => progress[l.id]?.passedAt).length
      acc[BY_NAME[meta.domain]].cert = { path: p, name: meta.domain, done, total: ls.length, ready: ls.length > 0 && done === ls.length }
    }
  }
  const domains = DOMAINS.map(d => {
    const a = acc[d.key]
    a.status = a.tools + a.works + a.answers > 0 ? 'evidenced' : a.pending + a.revise > 0 ? 'started' : 'empty'
    return a
  })
  return { domains, tools, evidenced: domains.filter(d => d.status === 'evidenced').length }
}

/** 一句话说明一个领域有哪些证据。 */
export function evidenceText(d) {
  const parts = []
  if (d.tools) parts.push(`工具关通过 ${d.tools}`)
  if (d.works) parts.push(`作品通过点评 ${d.works}`)
  if (d.answers) parts.push(`研讨作答 ${d.answers}`)
  if (d.pending) parts.push(`待点评 ${d.pending}`)
  if (d.revise) parts.push(`需修改 ${d.revise}`)
  return parts.length ? parts.join(' · ') : d.total ? '还没有证据' : '内容建设中'
}
