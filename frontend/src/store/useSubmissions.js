// 本人在实践关、研讨关的提交（GET/POST /api/submissions）。服务端是权威，这里只按关缓存在内存里。
// zuoDoneOf(level, list)：实践关要最新一条点评通过；研讨关交了就算。
import { create } from 'zustand'
import { api } from '../lib/api.js'
import { useStore } from './useStore.js'

export const latestOf = list => (list && list.length ? list[0] : null)
export function zuoDoneOf(level, list) {
  const s = latestOf(list)
  if (!s) return false
  return level.type === 'seminar' ? true : s.status === 'pass'
}

export const useSubmissions = create((set, get) => ({
  byLevel: {},      // levelId → { submissions, others, rubric, title }
  loading: {},
  async load(levelId) {
    if (!useStore.getState().user) return null
    if (get().loading[levelId]) return get().loading[levelId]
    const p = (async () => {
      try { const r = await api('/api/submissions?level=' + encodeURIComponent(levelId)); set(s => ({ byLevel: { ...s.byLevel, [levelId]: r } })); return r }
      catch (e) { if (e.status === 401) set({ byLevel: {} }); return get().byLevel[levelId] || null }
      finally { set(s => { const { [levelId]: _, ...rest } = s.loading; return { loading: rest } }) }
    })()
    set(s => ({ loading: { ...s.loading, [levelId]: p } }))
    return p
  },
  async submit(levelId, { text, files }) {
    const r = await api('/api/submissions', { method: 'POST', body: JSON.stringify({ levelId, text, files }) })
    await get().load(levelId)
    return r.submission
  },
  // 本人全部提交（能力地图用）。没登录为空。
  all: null,
  async loadAll() {
    if (!useStore.getState().user) { set({ all: null }); return [] }
    try { const r = await api('/api/submissions'); set({ all: r.submissions || [] }); return r.submissions || [] }
    catch (e) { if (e.status === 401) set({ all: null }); return get().all || [] }
  },
  clear() { set({ byLevel: {}, loading: {}, all: null }) }
}))

useStore.subscribe((s, prev) => { if ((prev.user?.id || null) !== (s.user?.id || null)) useSubmissions.getState().clear() })
