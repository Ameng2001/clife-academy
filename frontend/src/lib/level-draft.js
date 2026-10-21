// 关卡草稿（讲看做测走到哪、模拟回传、答题）只留本机：不进 S，不进同步，不参与合并。
// 换设备从头走这一关的四段，代价很小；而把草稿同步出去，两台设备会互相覆盖对方正在答的题。
// 存 localStorage 一个键；测试时注入自己的 storage。
import { useSyncExternalStore } from 'react'

export const DRAFT_KEY = 'academy_drafts_v1'
export const FRESH = () => ({ seg: 'jiang', zuoDone: false, events: [], answers: {} })

export function createDrafts(storage) {
  let cache = null
  const listeners = new Set()
  const read = () => {
    if (cache) return cache
    try { const raw = storage?.getItem(DRAFT_KEY); cache = raw ? JSON.parse(raw) : {} } catch { cache = {} }
    if (!cache || typeof cache !== 'object') cache = {}
    return cache
  }
  const write = next => {
    cache = next
    try { storage?.setItem(DRAFT_KEY, JSON.stringify(next)) } catch { /* 私密模式等：草稿只活在内存里 */ }
    for (const l of listeners) l()
  }
  const get = id => read()[id] || null
  const set = (id, mut) => {
    const d = { ...(get(id) || FRESH()) }
    mut(d)
    write({ ...read(), [id]: d })
    return d
  }
  const clear = id => { const { [id]: _, ...rest } = read(); write(rest) }
  const clearAll = () => write({})
  const subscribe = l => { listeners.add(l); return () => listeners.delete(l) }
  return { get, set, clear, clearAll, subscribe, has: id => !!get(id) }
}

const browserStorage = (() => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } })()
export const drafts = createDrafts(browserStorage)

/** React：某关的草稿，没有时给一份新的（不落盘）。 */
export function useDraft(id) {
  const snap = useSyncExternalStore(drafts.subscribe, () => drafts.get(id), () => null)
  return snap || FRESH()
}
