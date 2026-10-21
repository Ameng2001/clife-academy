// 大课堂的状态与同步：一份 S 存在 localStorage，登录后整份与服务端 GET/PUT /api/data 同步，
// 修订号 baseRev / baseWid 做条件写，409 就合并（lib/academy-merge.js）再推。
// 上游 useStore.js 的多标签页接力、手机文件镜像、媒体、健康数据、旧版抬升都不要了：
// 大课堂是一台设备一个浏览器标签的用法，草稿另存（lib/level-draft.js），不进 S。
import { create } from 'zustand'
import { api } from '../lib/api.js'
import { guestAllowed } from '../lib/guest.js'
import { mergeStates, localExtras, hasProgress } from '../lib/academy-merge.js'

export const DEF = {
  _ts: 0,
  theme: 'auto',        // 'auto' | 'light' | 'dark'
  accent: 'lime',
  connStatus: true,     // 顶部显示连接状态条
  connLocal: true,      // 访客那条「只在这个浏览器里」的提示，× 掉就不再出
  role: 'nurse',        // 岗位：nurse | teacher | care | it | director（平台登录时以服务端为准）
  progress: {},         // { [levelId]: { passedAt, credits, quiz } } 只增不减
  sessions: [],         // 每次通关一条 { id, levelId, end, … } 只追加
  credits: {},          // 按路径累计，由 progress 推导
}
export const hasData = hasProgress
const clone = v => JSON.parse(JSON.stringify(v))
export const freshState = () => clone(DEF)

const KEY = 'academy_state_v1'
const USER_KEY = 'academy_user'
const OWNER_KEY = 'academy_owner'     // 这份本地 S 属于哪个账号（会话过期后 user 没了，owner 还在）
const GUEST_KEY = 'academy_guest'
const SYNC_KEY = 'academy_sync'       // { rev, wid, ts }：本地 S 从服务端哪个修订长出来的
const DIRTY_KEY = 'academy_dirty'     // 本地有服务端没见过的改动
const FP_KEY = 'academy_synced_fp'    // 上次两边一致时本地通过的关卡 id
const ADOPT_KEY = 'academy_adopt'     // 登录时「本地进度要不要记到账号」还没答完
const STASH_KEY = 'academy_stash'     // 强制退出时留下的、还欠服务端的改动，按账号存
const POLL_MS = 30000
const PUSH_DELAY_MS = 1500
const CHECK_MIN_MS = 3000

const read = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } }
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch { /* 存不下就只留在内存 */ } }

export const useStore = create((set, get) => {
  let base = read(SYNC_KEY)               // { rev, wid, ts } | null
  let dirty = read(DIRTY_KEY) === 1
  let pushTm = null, pushing = null, pushAgain = false, pushPending = false
  let pulling = null, lastCheck = 0, pollTm = null
  let adoptHold = false, adopting = null, rejoined = false
  let configFetch = null

  const S0 = Object.assign(clone(DEF), read(KEY) || {})
  const user0 = read(USER_KEY)

  /* ---------------- sync 状态 ---------------- */
  const statusOf = (x, user) => x.auth ? 'auth' : !user ? 'local' : x.offline ? 'offline' : x.lastError ? 'error' : x.held ? 'held' : x.pending ? 'pending' : 'ok'
  const sameError = (a, b) => (a && b ? a.status === b.status && a.code === b.code : a === b)
  const setSync = patch => {
    const cur = get().sync
    const next = { ...cur, ...patch }
    next.status = statusOf(next, get().user)
    if (Object.keys(next).some(k => (k === 'lastError' ? !sameError(next[k], cur[k]) : next[k] !== cur[k]))) set({ sync: next })
  }
  const isNetworkError = e => e && e.status == null
  const refused = e => e?.status === 401
  const reached = (extra = {}) => setSync({ offline: false, auth: false, lastError: null, ...extra })
  const failed = (e, extra = {}) => {
    const lastError = { status: e?.status ?? 0, code: e?.code || (e?.status === 401 ? 'auth' : isNetworkError(e) ? 'network' : 'http') }
    if (refused(e)) setSync({ auth: true, offline: false, lastError, ...extra })
    else if (isNetworkError(e)) setSync({ offline: true, lastError, ...extra })
    else setSync({ offline: false, lastError, ...extra })
  }
  // 两边一份一样的拷贝：推送落地、拉取采纳、或查修订发现谁都没动。
  const confirmed = S => {
    write(FP_KEY, Object.keys(S.progress || {}).filter(k => S.progress[k]?.passedAt))
    reached({ pending: false, lastSynced: Date.now() })
  }

  /* ---------------- 本地拷贝 ---------------- */
  const writeBase = (rev, ts, wid) => { base = rev == null ? null : { rev, ts: ts || 0, ...(wid ? { wid } : {}) }; write(SYNC_KEY, base) }
  const markDirty = v => { dirty = !!v; write(DIRTY_KEY, dirty ? 1 : null) }
  const localChanged = (S = get().S) => dirty || (!!base && (Number(S._ts) || 0) > (base.ts || 0))
  const persist = S => { write(KEY, S); set({ S }) }
  const schedulePush = () => {
    if (!get().user) return
    if (!get().ready) { pushPending = true; return }
    clearTimeout(pushTm)
    pushTm = setTimeout(() => get().pushState(), PUSH_DELAY_MS)
  }
  // 服务端的拷贝原样成为本地的（时间戳也是它的）。
  const takeServer = (state, rev) => {
    const S = Object.assign(clone(DEF), state || {})
    persist(S)
    writeBase(rev, S._ts, state?._wid)
    markDirty(false)
    confirmed(S)
  }
  // 两边都改了：并集，记住服务端修订，随后推的那次以它为条件。base.ts 留旧值，推之前拉一次仍认得出本地未发。
  const mergeInto = (local, remote, rev, wid) => {
    const ts = base?.ts || 0
    const merged = mergeStates(local, remote)
    merged._ts = Math.max(Date.now(), Number(merged._ts) || 0)
    persist(merged)
    writeBase(rev, ts, wid || remote?._wid)
    markDirty(true)
  }

  /* ---------------- 推 / 拉 ---------------- */
  const doPush = async (attempt = 0) => {
    const S = get().S
    const body = { state: S, stamped: true }
    if (base) { body.baseRev = base.rev; if (base.wid) body.baseWid = base.wid }
    try {
      const r = await api('/api/data', { method: 'PUT', body: JSON.stringify(body) })
      writeBase(r.rev, S._ts, r.wid)
      markDirty(false)
      confirmed(S)
    } catch (e) {
      if (e.status === 409 && e.data && attempt < 2) {
        mergeInto(get().S, e.data.state, e.data.rev || 0)
        return doPush(attempt + 1)
      }
      markDirty(true)
      failed(e, { pending: true })
    }
  }
  const checkRev = async (force = false) => {
    if (!get().user || !get().ready || adoptHold || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return
    if (!force && Date.now() - lastCheck < CHECK_MIN_MS) return
    lastCheck = Date.now()
    if (pulling) return pulling
    if (!base || localChanged()) return get().pullState()
    try {
      const { rev, wid } = await api('/api/data/rev')
      if (rev !== base.rev || (base.wid && wid && wid !== base.wid)) return get().pullState()
      confirmed(get().S)
    } catch (e) { failed(e) }
  }
  const schedulePoll = () => { clearTimeout(pollTm); pollTm = setTimeout(() => { checkRev(); schedulePoll() }, POLL_MS) }
  const flush = () => { if (pushTm) { clearTimeout(pushTm); pushTm = null; get().pushState() } }
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkRev(); else flush() })
    window.addEventListener('focus', () => checkRev())
    window.addEventListener('online', () => checkRev(true))
    window.addEventListener('pagehide', flush)
  }

  /* ---------------- 登录接管 ---------------- */
  const readAdopt = () => read(ADOPT_KEY)
  const adoptOwed = () => { const m = readAdopt(); const u = get().user; return m && u && m.uid === u.id ? m : null }
  const setHold = on => { adoptHold = on; if (get().sync) setSync({ held: on }) }
  const releaseAdopt = () => { setHold(false); write(ADOPT_KEY, null) }
  const stashes = () => read(STASH_KEY, {}) || {}
  const applyStash = async () => {
    const uid = get().user?.id
    const all = stashes()
    if (!uid || !all[uid]) return
    const kept = all[uid]
    delete all[uid]
    write(STASH_KEY, Object.keys(all).length ? all : null)
    const merged = mergeStates(get().S, kept)
    merged._ts = Math.max(Date.now(), Number(merged._ts) || 0)
    persist(merged)
    markDirty(true)
    await get().pushState()
  }
  // 登录后决定这份本地拷贝的去向：
  //   账号在服务端是空的 → 本地直接推上去；
  //   同一账号回来（会话过期重登）→ 当作两台设备合并；
  //   换了账号 / 访客登录 → 本地比账号多通过的关卡，问一句要不要记进去，不要就取服务端的。
  const runAdopt = async (ask) => {
    if (pulling) await pulling
    const mark = adoptOwed()
    const sameAccount = mark ? !!mark.rejoined : rejoined
    let res
    try { res = await api('/api/data') }
    catch (e) { failed(e); if (!mark) releaseAdopt(); throw e }
    let { state, rev } = res
    reached()
    const S0 = get().S
    if (!state) {
      releaseAdopt()
      writeBase(rev, 0)
      if (hasData(S0)) { markDirty(true); await get().pushState() } else { markDirty(false); confirmed(get().S) }
      await applyStash()
      return { adopted: false, added: false }
    }
    if (sameAccount) {
      releaseAdopt()
      // 从服务端某个修订长出来、之后又没改过的拷贝，直接换成服务端的；其余按两台设备合并。
      const plain = !hasData(S0) || (!!base && !localChanged(S0))
      if (plain) takeServer(state, rev)
      else { mergeInto(S0, state, rev); await get().pushState() }
      await applyStash()
      return { adopted: true, added: false, merged: !plain }
    }
    const extras = localExtras(S0, state)
    let keep = false
    if (extras.levels && typeof ask === 'function') {
      keep = !!(await ask(extras))
      // 问题可能开着好几分钟：以关掉时服务端的拷贝为准。
      try { const r = await api('/api/data'); if (r && r.state) ({ state, rev } = r) } catch { /* 用第一次读到的 */ }
    }
    releaseAdopt()
    if (keep) {
      const merged = mergeStates(state, get().S, { prefer: 'a' })
      merged._ts = Math.max(Date.now(), Number(merged._ts) || 0)
      persist(merged)
      writeBase(rev, 0, state?._wid)
      markDirty(true)
      await get().pushState()
      await applyStash()
      return { adopted: true, added: true }
    }
    takeServer(state, rev)
    await applyStash()
    return { adopted: true, added: false }
  }

  const clearLocalSession = () => {
    get().setUser(null)
    write(OWNER_KEY, null)
    writeBase(null)
    markDirty(false)
    write(FP_KEY, null)
    releaseAdopt()
    persist(freshState())
    setSync({ offline: false, auth: false, lastError: null, pending: false, held: false, lastSynced: 0 })
  }

  return {
    S: S0,
    user: user0,
    ready: false,
    sync: { status: user0 ? 'pending' : 'local', auth: false, offline: false, lastError: null, pending: dirty, held: false, lastSynced: 0 },
    config: null,

    // 改一处：mut 就地改副本；push=false 只存本地不触发推送（下一次改动会把它一起带上）。
    update(mut, push = true) {
      const S = clone(get().S)
      mut(S)
      S._ts = Math.max(Date.now(), (base?.ts || 0) + 1, (Number(get().S._ts) || 0) + 1)
      persist(S)
      markDirty(true)
      if (push) schedulePush()
    },

    isGuest: () => { try { return localStorage.getItem(GUEST_KEY) === '1' } catch { return false } },
    setGuest(v) {
      try { if (v) localStorage.setItem(GUEST_KEY, '1'); else localStorage.removeItem(GUEST_KEY) } catch { /* 无妨 */ }
      set({})
      if (v) setSync({ auth: false, offline: false, lastError: null })
    },

    async loadConfig() { return get().config || get().refreshConfig() },
    async refreshConfig() {
      if (configFetch) return configFetch
      configFetch = (async () => {
        try { const c = await api('/api/config'); set({ config: c }); return c }
        catch { return null }
        finally { configFetch = null }
      })()
      return configFetch
    },

    // adopt：登录（adoptProfile 随后决定本地拷贝去向，答完之前不推不拉）。
    setUser(u, { adopt } = {}) {
      if (u) {
        const owner = read(OWNER_KEY)
        rejoined = owner === u.id
        const other = !!owner && owner !== u.id
        if (adopt) {
          setHold(true)
          clearTimeout(pushTm); pushTm = null
          write(ADOPT_KEY, { uid: u.id, rejoined })
          // 这份拷贝是别的账号的：它还欠服务端的改动按那个账号留着，等那个账号再登录时带上；本地从空开始。
          if (other) {
            if (localChanged()) { const all = stashes(); all[owner] = get().S; write(STASH_KEY, all) }
            persist(freshState()); writeBase(null); markDirty(false); write(FP_KEY, null)
          }
        } else {
          const m = readAdopt()
          if (m && m.uid !== u.id) write(ADOPT_KEY, null)
          adoptHold = !!m && m.uid === u.id
        }
        write(OWNER_KEY, u.id)
        write(USER_KEY, u)
        try { localStorage.removeItem(GUEST_KEY) } catch { /* 无妨 */ }
        set({ user: u })
        setSync({ held: adoptHold, auth: false, offline: false, lastError: null })
      } else {
        write(USER_KEY, null)
        set({ user: null })
        setSync({ held: false })
      }
    },
    async adoptProfile(ask) {
      if (adopting) return adopting
      adopting = runAdopt(ask).finally(() => { adopting = null })
      return adopting
    },
    // 关页时问题没答完：开机后再问一遍，答完才同步。
    async resumeAdoption() {
      const m = adoptOwed()
      if (!m) { if (adoptHold) releaseAdopt(); return null }
      if (adopting) return adopting
      try {
        const ask = (await import('../academy/sheets.jsx')).askAddDeviceData
        return await get().adoptProfile(ask)
      } catch { return null }
    },

    async pushState() {
      if (!get().user || adoptHold) return
      clearTimeout(pushTm); pushTm = null
      if (pushing) { pushAgain = true; return pushing.then(() => pushing) }
      pushing = doPush().finally(() => { pushing = null; if (pushAgain) { pushAgain = false; get().pushState() } })
      return pushing
    },
    // 问服务端要它的拷贝，把差异摆平。待发的推送先走：服务端答的就是含它的那份。
    async pullState() {
      if (adoptHold || !get().user) return
      if (pulling) return pulling
      pulling = (async () => {
        try {
          if (pushTm) { clearTimeout(pushTm); pushTm = null; await get().pushState() }
          else if (pushing) await pushing
          const { state, rev } = await api('/api/data')
          lastCheck = Date.now()
          reached()
          const S = get().S
          const changed = dirty || pushPending || localChanged(S)
          pushPending = false
          if (!state) {
            writeBase(rev, 0)
            if (hasData(S) || changed) { markDirty(true); await get().pushState() } else { markDirty(false); confirmed(S) }
            return
          }
          if (!base) {
            if (changed && hasData(S)) { mergeInto(S, state, rev); await get().pushState() }
            else takeServer(state, rev)
            return
          }
          const moved = rev !== base.rev || (base.wid && state._wid && state._wid !== base.wid)
          if (!moved) { if (changed) await get().pushState(); else confirmed(S); return }
          if (changed) { mergeInto(S, state, rev); await get().pushState() }
          else takeServer(state, rev)
        } catch (e) {
          failed(e, { pending: localChanged() })
          if (refused(e)) get().setUser(null)
        } finally { pulling = null }
      })()
      return pulling
    },
    async syncNow() {
      if (!get().user) { setSync({}); return get().sync }
      if (adoptHold) { await get().resumeAdoption(); if (adoptHold) return get().sync }
      if (pulling) await pulling
      await get().pullState()
      return get().sync
    },
    // 本地有而服务端没见过的：count 是上次一致之后新通过的关卡数（只改了设置算 1）。
    unsyncedChanges() {
      if (!get().user || !localChanged()) return { owed: false, count: 0 }
      const fp = new Set(read(FP_KEY, []) || [])
      const levels = Object.keys(get().S.progress || {}).filter(k => get().S.progress[k]?.passedAt && !fp.has(k)).length
      return { owed: true, count: levels || 1 }
    },
    // 退出：欠着服务端的改动不丢——先试着推，推不上去就拒绝，force 则按账号留在本地，下次同一账号登录带上。
    async signOut({ force = false } = {}) {
      flush()
      if (pushing) await pushing
      if (localChanged() && get().user) { try { await get().pushState() } catch { /* 下面按欠着处理 */ } }
      const left = get().unsyncedChanges()
      if (left.owed && !force) return left
      if (left.owed) { const all = stashes(); all[get().user.id] = get().S; write(STASH_KEY, all) }
      try { await api('/api/logout', { method: 'POST', body: '{}' }) } catch { /* cookie 留着也会过期 */ }
      clearLocalSession()
      return { owed: false }
    },

    async boot() {
      const cfg = await get().loadConfig()
      if (!guestAllowed(cfg)) get().setGuest(false)
      const had = !!get().user
      try {
        const me = await api('/api/me')
        if (!me.user?.id) throw Object.assign(new Error('no user'), { status: 200, code: 'bad-response' })
        get().setUser(me.user)
        if (adoptOwed()) { finish(); get().resumeAdoption(); return }
        await get().pullState()
      } catch (e) {
        // 会话没了（过期、别处退出）：回登录页，本地拷贝留着，同一账号再登录会合并。
        // 本来就没登录的，401 只是「没登录」，不是故障。
        if (refused(e)) { get().setUser(null); if (had) failed(e); else setSync({ auth: false, offline: false, lastError: null }) }
        else if (had) failed(e, { pending: localChanged() })
      }
      finish()
      function finish() {
        set({ ready: true })
        if (pushPending) { pushPending = false; schedulePush() }
        schedulePoll()
      }
    },
  }
})
