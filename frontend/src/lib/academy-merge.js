// 大课堂整份状态的合并规则（替代上游 sync-merge.js 的 mergeStates）。
//
// 设置类字段（theme、role、connStatus…）整块跟 _ts 新的一方；三个进度字段各有规则：
//   progress  按关卡 id 取并集；同一关两边都有时取 passedAt 最早的那条——通过是一次性事实，先到先算
//   sessions  只追加：按 id 取并集（旧记录没有 id 的按 levelId＋end 兜底），按 end 排序
//   credits   不合并，从合并后的 progress 重新算——存下来只是为了页面少算一遍，真相在 progress
// role 不在这里：它是个设置，跟上游一样由新的一方决定（平台登录时服务端会再覆盖）。
// lvDraft 不进同步，也不在 S 里（lib/level-draft.js）。
export const ACADEMY_FIELDS = ['progress', 'sessions', 'credits']

const isMap = v => v && typeof v === 'object' && !Array.isArray(v)
const list = v => (Array.isArray(v) ? v : [])
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))

export function mergeProgress(a, b) {
  const out = {}
  const pa = isMap(a) ? a : {}, pb = isMap(b) ? b : {}
  for (const k of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
    const x = isMap(pa[k]) && pa[k].passedAt ? pa[k] : null
    const y = isMap(pb[k]) && pb[k].passedAt ? pb[k] : null
    if (x && y) out[k] = clone(Number(y.passedAt) < Number(x.passedAt) ? y : x)
    else if (x || y) out[k] = clone(x || y)
  }
  return out
}

export const sessionKey = s => (s?.id != null ? 'id:' + s.id : `lv:${s?.levelId}|${s?.end ?? s?.d ?? ''}`)

export function mergeSessions(a, b) {
  const seen = new Map()
  for (const s of [...list(a), ...list(b)]) {
    if (!s || typeof s !== 'object') continue
    const k = sessionKey(s)
    if (!seen.has(k)) seen.set(k, clone(s))
  }
  return [...seen.values()].sort((x, y) => (Number(x.end) || 0) - (Number(y.end) || 0) || String(x.levelId).localeCompare(String(y.levelId)))
}

/** 学分从进度推：每关记在它自己 entry 的 credits 上（缺省 1），按路径键（id 的前半）累加。 */
export function creditsOf(progress) {
  const out = {}
  for (const [id, e] of Object.entries(isMap(progress) ? progress : {})) {
    if (!isMap(e) || !e.passedAt) continue
    const path = String(id).split('-')[0]
    out[path] = (out[path] || 0) + (Number.isFinite(Number(e.credits)) ? Number(e.credits) : 1)
  }
  return out
}

/** 把 n（新的一方）与 o 的大课堂字段合进 out。就地改 out 并返回。 */
export function mergeAcademy(out, n, o) {
  const progress = mergeProgress(n?.progress, o?.progress)
  const sessions = mergeSessions(n?.sessions, o?.sessions)
  if (Object.keys(progress).length || isMap(n?.progress) || isMap(o?.progress)) out.progress = progress
  if (sessions.length || Array.isArray(n?.sessions) || Array.isArray(o?.sessions)) out.sessions = sessions
  if (out.progress || n?.credits || o?.credits) out.credits = creditsOf(out.progress)
  delete out.lvDraft
  return out
}

/** local 比 server 多通过了几关（签到时问要不要带进账号）。 */
export function academyExtras(local, server) {
  const have = isMap(server?.progress) ? server.progress : {}
  return Object.entries(isMap(local?.progress) ? local.progress : {}).filter(([k, v]) => isMap(v) && v.passedAt && !(isMap(have[k]) && have[k].passedAt)).length
}

/** 整份状态 S 有没有值得保住的东西：通过过至少一关。 */
export const hasProgress = S => Object.values(isMap(S?.progress) ? S.progress : {}).some(e => isMap(e) && e.passedAt)

/**
 * 两份状态合一份：prefer 指定哪边的设置为准（'a' | 'b'），不指定则 _ts 新的一方；
 * progress / sessions / credits 走上面的并集规则。服务端的 _rev / _wid 簿记不带进结果。
 */
export function mergeStates(a0, b0, { prefer } = {}) {
  if (!a0) return b0 ? clone(b0) : b0
  if (!b0) return clone(a0)
  const side = prefer === 'a' || prefer === 'b' ? prefer : (Number(b0._ts) || 0) > (Number(a0._ts) || 0) ? 'b' : 'a'
  const n = side === 'a' ? a0 : b0, o = n === a0 ? b0 : a0
  const out = clone(n)
  mergeAcademy(out, n, o)
  out._ts = Math.max(Number(a0._ts) || 0, Number(b0._ts) || 0)
  for (const k of ['_rev', '_wid', '_wids']) delete out[k]
  return out
}

/** 登录时问的那句话要用的数：本地比账号多通过了几关。没有就是空对象。 */
export function localExtras(local, server) {
  const levels = academyExtras(local, server)
  return levels ? { levels } : {}
}
