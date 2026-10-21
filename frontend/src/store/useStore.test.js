// 同步引擎对着一个内存里的假服务端跑一遍：推、拉、409 合并、登录接管的三条路、退出时欠着的改动。
import { describe, it, expect, beforeEach, vi } from 'vitest'

function memStorage() {
  let m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => { m = new Map() }, key: i => [...m.keys()][i], get length() { return m.size } }
}
// 假服务端：一个账号一份文档，_rev 自增，baseRev 不对就 409 并把现文档带回去。
function fakeServer() {
  const srv = { user: null, doc: null, rev: 0, down: false, puts: 0 }
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body })
  srv.fetch = async (url, init = {}) => {
    if (srv.down) throw new TypeError('network down')
    const method = (init.method || 'GET').toUpperCase()
    const body = init.body ? JSON.parse(init.body) : null
    if (url === '/api/config') return json(200, { allow_guest: true, auth: { dev: true, wechat: false, platform: false } })
    if (url === '/api/logout') { srv.user = null; return json(200, { ok: true }) }
    if (!srv.user) return json(401, { error: 'not signed in' })
    if (url === '/api/me') return json(200, { user: srv.user })
    if (url === '/api/data' && method === 'GET') return json(200, { state: srv.doc, rev: srv.rev })
    if (url === '/api/data/rev') return json(200, { rev: srv.rev, ...(srv.doc?._wid ? { wid: srv.doc._wid } : {}) })
    if (url === '/api/data' && method === 'PUT') {
      srv.puts++
      if (body.baseRev != null && body.baseRev !== srv.rev) return json(409, { error: 'conflict', rev: srv.rev, state: srv.doc })
      srv.rev++
      srv.doc = { ...body.state, _rev: srv.rev, _wid: 'w' + srv.rev }
      return json(200, { ok: true, rev: srv.rev, wid: srv.doc._wid })
    }
    return json(404, { error: 'no route' })
  }
  // 另一台设备直接写了服务端
  srv.otherDeviceWrites = mut => { const d = JSON.parse(JSON.stringify(srv.doc || {})); mut(d); srv.rev++; srv.doc = { ...d, _rev: srv.rev, _wid: 'w' + srv.rev } }
  return srv
}
const passed = (id, at) => ({ passedAt: at, credits: 1, quiz: { right: 1, of: 1 } })
const U1 = { id: 'u1', name: '李老师', academy: { role: 'nurse' } }
const U2 = { id: 'u2', name: '王园长', academy: { role: 'director' } }

let srv, store
async function fresh(seed = {}) {
  vi.resetModules()
  srv = fakeServer()
  const ls = memStorage()
  for (const [k, v] of Object.entries(seed)) ls.setItem(k, JSON.stringify(v))
  vi.stubGlobal('localStorage', ls)
  vi.stubGlobal('fetch', srv.fetch)
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} })
  vi.stubGlobal('document', { addEventListener() {}, visibilityState: 'visible' })
  store = (await import('./useStore.js')).useStore
  return store.getState()
}
const st = () => store.getState()

describe('useStore 同步', () => {
  beforeEach(() => fresh())

  it('没登录：boot 后 ready，状态 local，改动只留本地', async () => {
    await st().boot()
    expect(st().ready).toBe(true)
    expect(st().sync.status).toBe('local')
    st().update(s => { s.progress['nurse-0'] = passed('nurse-0', 10) })
    expect(JSON.parse(localStorage.getItem('academy_state_v1')).progress['nurse-0'].passedAt).toBe(10)
    expect(srv.puts).toBe(0)
  })

  it('账号在服务端是空的：登录后本地进度直接推上去', async () => {
    await st().boot()
    st().update(s => { s.progress['nurse-0'] = passed('nurse-0', 10) })
    srv.user = U1
    st().setUser(U1, { adopt: true })
    expect(st().sync.status).toBe('held')
    const ask = vi.fn()
    await st().adoptProfile(ask)
    expect(ask).not.toHaveBeenCalled()
    expect(Object.keys(srv.doc.progress)).toEqual(['nurse-0'])
    expect(st().sync.status).toBe('ok')
    expect(st().unsyncedChanges()).toEqual({ owed: false, count: 0 })
  })

  it('换账号登录：本地多通过的关卡问一句，要就并进去，不要就取服务端的', async () => {
    await st().boot()
    st().update(s => { s.progress['nurse-0'] = passed('nurse-0', 10) })
    srv.user = U2
    srv.doc = { _ts: 5, role: 'director', progress: { 'director-0': passed('director-0', 5) }, sessions: [], credits: { director: 1 } }; srv.rev = 3
    st().setUser(U2, { adopt: true })
    const ask = vi.fn(async extras => { expect(extras).toEqual({ levels: 1 }); return true })
    await st().adoptProfile(ask)
    expect(ask).toHaveBeenCalledTimes(1)
    expect(Object.keys(srv.doc.progress).sort()).toEqual(['director-0', 'nurse-0'])
    expect(srv.doc.credits).toEqual({ director: 1, nurse: 1 })
    expect(srv.doc.role).toBe('director')   // 设置以账号为准
    expect(st().S.progress['director-0']).toBeTruthy()
  })

  it('换账号登录，答「保持账号原样」：本地那关不进账号', async () => {
    await st().boot()
    st().update(s => { s.progress['nurse-0'] = passed('nurse-0', 10) })
    srv.user = U2
    srv.doc = { _ts: 5, role: 'director', progress: { 'director-0': passed('director-0', 5) }, sessions: [], credits: {} }; srv.rev = 3
    st().setUser(U2, { adopt: true })
    await st().adoptProfile(async () => false)
    expect(Object.keys(srv.doc.progress)).toEqual(['director-0'])
    expect(Object.keys(st().S.progress)).toEqual(['director-0'])
    expect(srv.puts).toBe(0)
  })

  it('推送撞上别的设备的写入：409 → 并集 → 再推一次', async () => {
    srv.user = U1
    srv.doc = { _ts: 1, progress: {}, sessions: [], credits: {} }; srv.rev = 1
    await st().boot()
    expect(st().sync.status).toBe('ok')
    srv.otherDeviceWrites(d => { d.progress['nurse-1'] = passed('nurse-1', 20); d._ts = 20 })
    st().update(s => { s.progress['nurse-0'] = passed('nurse-0', 30) })
    await st().pushState()
    expect(Object.keys(srv.doc.progress).sort()).toEqual(['nurse-0', 'nurse-1'])
    expect(Object.keys(st().S.progress).sort()).toEqual(['nurse-0', 'nurse-1'])
    expect(st().sync.status).toBe('ok')
  })

  it('同一关两台设备都通过：取 passedAt 最早的那条', async () => {
    srv.user = U1
    srv.doc = { _ts: 1, progress: {}, sessions: [], credits: {} }; srv.rev = 1
    await st().boot()
    srv.otherDeviceWrites(d => { d.progress['nurse-0'] = passed('nurse-0', 20); d._ts = 20 })
    st().update(s => { s.progress['nurse-0'] = passed('nurse-0', 30) })
    await st().pushState()
    expect(srv.doc.progress['nurse-0'].passedAt).toBe(20)
  })

  it('服务端动了、本地没动：拉取直接采纳服务端的', async () => {
    srv.user = U1
    srv.doc = { _ts: 1, progress: { 'nurse-0': passed('nurse-0', 1) }, sessions: [], credits: { nurse: 1 } }; srv.rev = 1
    await st().boot()
    srv.otherDeviceWrites(d => { d.progress['nurse-1'] = passed('nurse-1', 20); d._ts = 20 })
    await st().pullState()
    expect(Object.keys(st().S.progress).sort()).toEqual(['nurse-0', 'nurse-1'])
    expect(srv.puts).toBe(0)
  })

  it('服务端拒绝了（会话过期）：user 清掉，状态 auth，本地拷贝留着', async () => {
    await fresh({ academy_user: U1, academy_owner: 'u1', academy_state_v1: { _ts: 9, progress: { 'nurse-0': passed('nurse-0', 9) }, sessions: [], credits: {} } })
    await st().boot()
    expect(st().user).toBeNull()
    expect(st().sync.status).toBe('auth')
    expect(st().S.progress['nurse-0']).toBeTruthy()
    // 同一账号再登录：当作两台设备合并
    srv.user = U1
    srv.doc = { _ts: 1, progress: { 'nurse-1': passed('nurse-1', 1) }, sessions: [], credits: {} }; srv.rev = 1
    st().setUser(U1, { adopt: true })
    const ask = vi.fn()
    await st().adoptProfile(ask)
    expect(ask).not.toHaveBeenCalled()
    expect(Object.keys(srv.doc.progress).sort()).toEqual(['nurse-0', 'nurse-1'])
  })

  it('退出时还欠着改动：先拒绝；force 退出留在本地，同一账号回来时带上', async () => {
    srv.user = U1
    srv.doc = { _ts: 1, progress: {}, sessions: [], credits: {} }; srv.rev = 1
    await st().boot()
    srv.down = true
    st().update(s => { s.progress['nurse-0'] = passed('nurse-0', 30) })
    await st().pushState()
    expect(st().sync.status).toBe('offline')
    expect(await st().signOut()).toEqual({ owed: true, count: 1 })
    expect(st().user).toEqual(U1)
    expect(await st().signOut({ force: true })).toEqual({ owed: false })
    expect(st().user).toBeNull()
    expect(st().S.progress).toEqual({})
    srv.down = false
    srv.user = U1
    st().setUser(U1, { adopt: true })
    await st().adoptProfile(vi.fn())
    expect(Object.keys(srv.doc.progress)).toEqual(['nurse-0'])
    expect(localStorage.getItem('academy_stash')).toBeNull()
  })
})
