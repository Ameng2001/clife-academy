// 平台实操事件（服务端 GET /api/events 的条目）与关卡的对照。纯函数。
//
// 一关要求的事件名在 level.event；收到同名事件就算「做」完成。不限时间：平台在学这关之前就做过的也算
// （迁移方案里 Coach 的 skip-level 正是这种情况）。

/** 这关要的事件里，收到了哪些。返回事件条目数组（可能为空）。 */
export function eventsForLevel(events, level) {
  if (!level?.needsEvent) return []
  const want = String(level.event || '').trim()
  return (events || []).filter(e => e && e.event === want)
}

export const levelDone = (events, level) => eventsForLevel(events, level).length > 0

/** 结算时记进 session.events 的标识：平台事件记 id，演示记 demo:<事件名>。 */
export const eventRefs = (events, level) => eventsForLevel(events, level).map(e => (e.src === 'demo' ? 'demo:' : 'ev:') + (e.id || e.event))
