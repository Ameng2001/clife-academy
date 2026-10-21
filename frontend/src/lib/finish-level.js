// 一关的结算：上游 finish-workout.js 的教师版。纯函数，返回新状态，不改入参。
//
// 规则（与大课堂原型 tryPass 一致，加了可配置门槛）：
//   · 「做」：工具关要求平台事件的，必须收到该事件；实践关要证据被点评通过；研讨关要交了作答（都是 zuoDone）；不要求的直接算做完
//   · 「测」：正确率 ≥ passRate（默认 1.0，即全对；gated 策略可降到 0.8）
//   · 只有 current 状态的关能通过；重复结算不加分
// 日志只追加：sessions 记这一次学习发生了什么，progress 记结果。改规则不改历史。
import { levelOf, statusOf } from './lessons.js'

// 记录的 id：合并时按它去重（lib/academy-merge.js），所以两台设备同一毫秒也不能撞
const sessionId = now => now.toString(36) + '-' + Math.random().toString(36).slice(2, 8)

export const DEFAULT_PASS_RATE = 1
export const CREDITS_PER_LEVEL = 1

/** 这一关当前能不能通过，以及为什么不能。 */
export function canPass(level, { zuoDone = false, right = 0, of = 0, passRate = DEFAULT_PASS_RATE } = {}) {
  if (!level) return { ok: false, why: 'no-level' }
  if ((level.needsEvent || level.needsSubmission) && !zuoDone) return { ok: false, why: 'zuo' }
  const total = of || level.qs.length
  if (total > 0 && right / total < passRate) return { ok: false, why: 'quiz' }
  return { ok: true, why: null }
}

/**
 * 结算一关。attempt = { zuoDone, right, of, events:[], segs:{}, start, end }。
 * 返回 { S, passed, why }。passed 为 false 时 S 仍记一条 session（学了但没过），progress 不变。
 */
export function finishLevel(S, id, attempt = {}, { now = Date.now(), passRate = DEFAULT_PASS_RATE } = {}) {
  const level = levelOf(id)
  if (!level) return { S, passed: false, why: 'no-level' }
  const progress = S.progress || {}
  const session = {
    id: sessionId(now), d: new Date(now).toISOString().slice(0, 10), levelId: id,
    start: attempt.start ?? now, end: attempt.end ?? now,
    quiz: { right: attempt.right ?? 0, of: attempt.of ?? level.qs.length },
    events: Array.isArray(attempt.events) ? attempt.events.slice() : [],
    zuoDone: !!attempt.zuoDone
  }
  const sessions = [...(S.sessions || []), session]
  const status = statusOf(progress, id)
  if (status !== 'current') return { S: { ...S, sessions }, passed: false, why: status === 'done' ? 'already' : 'locked' }
  const gate = canPass(level, { ...attempt, passRate })
  if (!gate.ok) return { S: { ...S, sessions }, passed: false, why: gate.why }
  const credits = { ...(S.credits || {}) }
  credits[level.path] = (credits[level.path] || 0) + CREDITS_PER_LEVEL
  return {
    S: {
      ...S, sessions, credits,
      progress: { ...progress, [id]: { passedAt: now, credits: CREDITS_PER_LEVEL, quiz: session.quiz } }
    },
    passed: true, why: null
  }
}
