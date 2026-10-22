// 微课库：全部关卡按岗位 × 场景浏览，不受解锁限制；关键词搜标题、目标、步骤、平台菜单路径、场景、按钮名。
// 教师记得的往往是「批量调整在哪个菜单」，所以菜单路径与步骤文本都在搜索范围里。纯函数。
import { PATH_KEYS, levelsOf, levelOf, levelId, pathNameOf } from './lessons.js'

/** 全部关卡（含标题替换后的 levelOf 结果），按路径顺序。 */
export function allLessons() {
  const out = []
  for (const p of PATH_KEYS) for (let i = 0; i < levelsOf(p).length; i++) out.push(levelOf(levelId(p, i)))
  return out
}

/** 场景清单，按首次出现顺序。 */
export const allScenes = () => [...new Set(allLessons().map(l => l.scene))]

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '')
const tokens = q => norm(q).split(/[,，;；/／|｜]+/).filter(Boolean)

/** 一关可搜的文本（已归一化）。 */
export function haystack(l) {
  return norm([l.title, l.goal, l.scene, l.btn, ...(l.menu || []), ...(l.steps || []), l.event, pathNameOf(l.path)].join(' '))
}

/**
 * 搜索。query 空则按筛选返回全部；多个词用逗号、分号、斜线隔开时要同时命中。
 * 命中标题的排前面，其次目标，再次菜单与步骤。
 */
export function searchLessons(query, { path = null, scene = null } = {}) {
  const ts = tokens(query)
  const rows = []
  for (const l of allLessons()) {
    if (path && l.path !== path) continue
    if (scene && l.scene !== scene) continue
    if (!ts.length) { rows.push({ lesson: l, score: 0, where: null }); continue }
    const hay = haystack(l), title = norm(l.title), goal = norm(l.goal), menu = norm((l.menu || []).concat(l.btn || '').join(' '))
    if (!ts.every(t => hay.includes(t))) continue
    const score = ts.reduce((a, t) => a + (title.includes(t) ? 3 : goal.includes(t) ? 2 : menu.includes(t) ? 1.5 : 1), 0)
    const where = ts.some(t => title.includes(t)) ? 'title' : ts.some(t => goal.includes(t)) ? 'goal' : ts.some(t => menu.includes(t)) ? 'menu' : 'steps'
    rows.push({ lesson: l, score, where })
  }
  if (ts.length) rows.sort((a, b) => b.score - a.score)
  return rows
}

/** 命中处的一小段文字，给结果行做摘要。 */
export function snippet(l, query, max = 40) {
  const ts = tokens(query)
  if (!ts.length) return l.goal || ''
  const fields = [l.goal, ...(l.steps || []), ...(l.menu || [])]
  for (const f of fields) { const n = norm(f); const t = ts.find(t => n.includes(t)); if (t) { const i = n.indexOf(t); const s = String(f); return (i > 12 ? '…' : '') + s.slice(Math.max(0, i - 12), i + max) } }
  return l.goal || ''
}

/** 一日生活环节 → 场景。精品微课「一日生活」视图按这个顺序分组；不在表里的场景（账号、教研、园长工作台…）不属于一日生活，不显示。 */
export const DAY_PARTS = [
  ['入园与晨检', ['出勤与请假', '晨午检', '健康检查', '安全']],
  ['进餐与午睡', ['膳食', '进餐', '午睡', '睡眠健康']],
  ['活动与游戏', ['活动设计', '活动现场', '区角', '自主游戏', '游戏分享', '数智体能', '课中互动', '墙面与主题']],
  ['过渡与一日常规', ['过渡环节', '一日常规', '观察记录', '日常反馈']],
  ['健康与特殊情况', ['疾病防控', '疾病管理', '健康档案', '体检', '冲突处理', '特殊需要']],
  ['离园与家园', ['家长会', '个别约谈', '家园活动']],
]
const PART_OF = new Map(DAY_PARTS.flatMap(([part, scenes]) => scenes.map(s => [s, part])))
export const dayPartOf = scene => PART_OF.get(scene) || null
/** 按环节分组的关卡：[[环节, [关卡…]], …]，空环节不出。 */
export function lessonsByDayPart(rows) {
  return DAY_PARTS.map(([part, scenes]) => [part, rows.filter(r => scenes.includes(r.lesson.scene))]).filter(([, ls]) => ls.length)
}
