// 微课库：全部关卡按岗位 × 场景浏览，不受解锁限制；关键词搜标题、目标、步骤、平台菜单路径、场景、按钮名。
// 教师记得的往往是「批量调整在哪个菜单」，所以菜单路径与步骤文本都在搜索范围里。纯函数。
import D from './lessons-data.js'
import { PATH_KEYS, levelOf, levelId, pathNameOf } from './lessons.js'

/** 全部关卡（含标题替换后的 levelOf 结果），按路径顺序。 */
export function allLessons() {
  const out = []
  for (const p of PATH_KEYS) for (let i = 0; i < D.PATHS[p].length; i++) out.push(levelOf(levelId(p, i)))
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
