// 本人收到的平台实操事件：与 S 分开存（服务端是权威，本地只是缓存），按账号缓存在 localStorage。
// 关卡页在「做」这一段每 10 秒问一次；演示按钮走 POST /api/events（服务端 DEV_LOGIN=1 才收）。
import { create } from 'zustand'
import { api } from '../lib/api.js'
import { useStore } from './useStore.js'

const KEY = 'academy_events'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null } }
const write = v => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY) } catch { /* 无妨 */ } }

export const useEvents = create((set, get) => {
  const cached = read()
  let loading = null
  return {
    uid: cached?.uid || null,
    events: cached?.events || [],
    error: null,

    // 拉本人全部事件（量小，不做 since 增量）。没登录就清空。
    async load() {
      const user = useStore.getState().user
      if (!user) { if (get().events.length) { set({ uid: null, events: [] }); write(null) } return [] }
      if (loading) return loading
      loading = (async () => {
        try {
          const { events } = await api('/api/events')
          set({ uid: user.id, events, error: null })
          write({ uid: user.id, events })
          return events
        } catch (e) {
          if (e.status === 401) { set({ uid: null, events: [] }); write(null) }
          else set({ error: e })
          return get().events
        } finally { loading = null }
      })()
      return loading
    },

    // 演示：本人给自己回传一条。服务端没开 DEV_LOGIN 会 403。
    async demo(event) {
      const r = await api('/api/events', { method: 'POST', body: JSON.stringify({ event }) })
      const user = useStore.getState().user
      set({ uid: user?.id || null, events: r.events || get().events, error: null })
      write({ uid: user?.id || null, events: r.events || get().events })
      return r
    },

    clear() { set({ uid: null, events: [], error: null }); write(null) }
  }
})

// 换账号或退出：缓存不跨账号
useStore.subscribe((s, prev) => {
  const was = prev.user?.id || null, now = s.user?.id || null
  if (was !== now && useEvents.getState().uid && useEvents.getState().uid !== now) useEvents.getState().clear()
})
