// 课程库的读取层：路径、关卡、题目、步骤。纯函数，数据来自 lessons-data.js（生成物）。
//
// 关卡 id 是 `<pathKey>-<index>`（nurse-5）。index 从 0 起，是该路径数组里的位置；
// 路径顺序就是推进顺序（上游 rotation 的「下一个没做的就是今天的」）。
import D0 from './lessons-data.js'
import { EXTRA_PATHS, EXTRA_PATHN, EXTRA_META, EXTRA_SKMAP, EXTRA_ROLES } from './lessons-extra.js'

// 工具线（生成物）＋ 领域路径（手写）合成一份
const D = { ...D0, ROLES: { ...D0.ROLES, ...EXTRA_ROLES }, PATHS: { ...D0.PATHS, ...EXTRA_PATHS }, PATHN: { ...D0.PATHN, ...EXTRA_PATHN }, SKMAP: { ...D0.SKMAP, ...EXTRA_SKMAP } }
export const PATH_KEYS = Object.freeze(Object.keys(D.PATHS))
// 岗位路径：工具线五条 ＋ 管理阶段路径（kind:'admin'，如区县管理员）；领域路径不在其中
export const ROLE_PATH_KEYS = Object.freeze([...Object.keys(D0.PATHS), ...Object.keys(EXTRA_PATHS).filter(p => EXTRA_META[p]?.kind === 'admin')])
export const ADMIN_PATH_KEYS = Object.freeze(Object.keys(EXTRA_PATHS).filter(p => EXTRA_META[p]?.kind === 'admin'))
export const PATH_META = EXTRA_META
export const ROLES = D.ROLES
export const PATH_NAMES = D.PATHN
export const PROBES = D.PROBES
export const SKILL_OF_SCENE = D.SKMAP
export const ORG = D.ORG

export const levelId = (path, i) => `${path}-${i}`

/** `nurse-5` → { path:'nurse', i:5 }，不合法返回 null。 */
export function parseLevelId(id) {
  const m = /^([a-z]+)-(\d+)$/.exec(String(id || ''))
  if (!m || !D.PATHS[m[1]]) return null
  const i = Number(m[2])
  return i < D.PATHS[m[1]].length ? { path: m[1], i } : null
}

/** 一条路径的全部关卡，带 id 与序号。 */
export const levelsOf = path => (D.PATHS[path] || []).map((l, i) => ({ ...l, id: levelId(path, i), path, i }))

/** 单关，含全日观察特辑的替换（标题、步骤、题目来自 OBS）。找不到返回 null。 */
export function levelOf(id) {
  const p = parseLevelId(id)
  if (!p) return null
  const raw = D.PATHS[p.path][p.i]
  const featured = raw.featured === 'obs'
  return {
    ...raw, id, path: p.path, i: p.i,
    title: featured ? '全日观察与疾病登记' : raw.t,
    steps: featured ? D.OBS.steps : raw.steps,
    qs: featured ? D.OBS.qs : raw.qs,
    skill: D.SKMAP[raw.scene] || null,
    // 关卡类型：tool 平台事件判通（工具线全是）；practice 交证据＋点评；seminar 情景题作答
    type: raw.type === 'practice' || raw.type === 'seminar' ? raw.type : 'tool',
    // 「做」这一段要不要平台事件：空字符串的关没有实操（只讲看测）
    needsEvent: (raw.type === 'practice' || raw.type === 'seminar') ? false : !!(raw.event && String(raw.event).trim()),
    // 要不要提交（实践关的证据、研讨关的作答）
    needsSubmission: raw.type === 'practice' || raw.type === 'seminar'
  }
}

export const titleOf = id => levelOf(id)?.title ?? null
export const pathNameOf = path => D.PATHN[path] ?? path
export const isRolePath = path => ROLE_PATH_KEYS.includes(path)
export const pathOfRole = role => D.ROLES[role]?.path ?? null
export const levelCount = path => (D.PATHS[path] || []).length

/** 路径里第一个未通过的序号；全通过返回长度。进度表是 { [levelId]: { passedAt, … } }。 */
export function cursorOf(progress, path) {
  const n = levelCount(path)
  let i = 0
  while (i < n && progress?.[levelId(path, i)]?.passedAt) i++
  return i
}

/** 'done' | 'current' | 'locked'，线性解锁；其他策略见 progression.js。 */
export function statusOf(progress, id) {
  const p = parseLevelId(id)
  if (!p) return 'locked'
  if (progress?.[id]?.passedAt) return 'done'
  return p.i === cursorOf(progress, p.path) ? 'current' : 'locked'
}

/** 一个路径的进度摘要。 */
export function pathSummary(progress, path) {
  const n = levelCount(path), done = cursorOf(progress, path)
  return { path, name: pathNameOf(path), total: n, done, finished: n > 0 && done >= n }
}
