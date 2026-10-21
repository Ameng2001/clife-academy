// 工具层：注入假 fetch，验每个工具发到哪条 GET、带不带令牌、把个人名单滤掉没有；配置缺失的报错。
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { TOOLS } from '../src/tools.js'
import { _setFetchForTests, checkConfig } from '../src/http.js'

const byName = Object.fromEntries(TOOLS.map(t => [t.name, t.handler]))
const calls = []
const ANSWERS = {
  '/api/me': { user: { id: 'u1', name: '赵园长', admin: false, academy: { role: 'director', org: { name: '甲园' } } } },
  '/api/data': { state: { role: 'director', credits: { 'director-0': 3 }, progress: { 'director-0': { passedAt: 1760000000000 }, 'director-1': { passedAt: 1760100000000 } } } },
  '/api/org/summary': { org: { name: '甲园' }, at: 1, members_total: 4, passes7d: 3, members: [{ name: '甲一', done: 3 }], roles: [{ name: '保健医', path: 'care', members: 2, finished: 0, started: 2, avgDone: 3, total: 8, rate: 38, passes7d: 3 }] },
  '/api/review/stats': { pending: 1, overdue: 0, oldestAt: 1, medianMinutes: 40, queue: [{ id: 'x', name: '甲一' }], orgs: [{ name: '甲园', members: 4, pending: 1, overdue: 0, key: 'name:甲园' }] },
  '/api/cases': { total: 2, cases: [{ id: 'c1', title: '影子从哪来', domain: 'play', byName: '甲一', orgName: '甲园', at: 1, text: '一段正文' }] },
  '/api/lectures': { upcoming: [{ id: 'l1', title: '讲堂', at: 1, minutes: 60 }] }, '/api/drills': { current: [] }, '/api/notices': { notices: [{ title: '停电', text: '周五', until: null }] }
}
function fakeFetch(url, init) {
  const u = new URL(url); calls.push({ path: u.pathname, q: Object.fromEntries(u.searchParams), auth: init.headers.Authorization })
  const body = ANSWERS[u.pathname]
  if (u.pathname === '/api/district/summary') return Promise.resolve({ status: 403, ok: false, json: async () => ({ error: 'district only', code: 'district' }) })
  return Promise.resolve({ status: body ? 200 : 404, ok: !!body, json: async () => body || { error: 'not found' } })
}

describe('tools', () => {
  beforeEach(() => { process.env.ACADEMY_URL = 'http://127.0.0.1:3000/'; process.env.ACADEMY_TOKEN = 'cla_abc.def'; _setFetchForTests(fakeFetch); calls.length = 0 })
  afterEach(() => _setFetchForTests(null))

  test('every tool has a name, description and schema; names are unique', () => {
    expect(new Set(TOOLS.map(t => t.name)).size).toBe(TOOLS.length)
    for (const t of TOOLS) { expect(t.description.length).toBeGreaterThan(8); expect(typeof t.schema).toBe('object') }
  })
  test('whoami hits /api/me with the bearer token', async () => {
    const r = await byName.whoami({})
    expect(r).toMatchObject({ name: '赵园长', role: 'director', org: '甲园' })
    expect(calls[0]).toMatchObject({ path: '/api/me', auth: 'Bearer cla_abc.def' })
  })
  test('list_paths / get_path read the local course pack', async () => {
    const l = await byName.list_paths({})
    expect(l.paths.length).toBe(15); expect(l.total_levels).toBe(100)
    const p = await byName.get_path({ path: 'manage' })
    expect(p.levels.length).toBe(6); expect(p.levels[0]).toHaveProperty('title')
    await expect(byName.get_path({ path: 'nope' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(calls.length).toBe(0)
  })
  test('my_progress summarises per path and credits', async () => {
    const r = await byName.my_progress({})
    expect(r.credits).toBe(3); expect(r.paths).toEqual([{ path: 'director', name: '园长', done: 2, total: 6, finished: false }]); expect(r.last_passed[0].level).toBe('director-1')
  })
  test('org_summary and org_review_stats drop the per-person lists', async () => {
    const s = await byName.org_summary({})
    expect(s.roles[0]).toMatchObject({ role: '保健医', members: 2, rate_pct: 38 }); expect(JSON.stringify(s)).not.toContain('甲一')
    const v = await byName.org_review_stats({})
    expect(v.pending).toBe(1); expect(v.queue).toBeUndefined(); expect(v.orgs[0]).toEqual({ name: '甲园', members: 4, pending: 1, overdue: 0 }); expect(JSON.stringify(v)).not.toContain('甲一')
  })
  test('search_cases passes the query through and trims the text', async () => {
    const r = await byName.search_cases({ q: '影子', community: true })
    expect(calls[0].q).toEqual({ q: '影子', community: '1' }); expect(r.cases[0]).toMatchObject({ title: '影子从哪来', excerpt: '一段正文' })
  })
  test('upcoming merges lectures, drills and notices', async () => {
    const r = await byName.upcoming({})
    expect(r.lectures[0].title).toBe('讲堂'); expect(r.notices[0].title).toBe('停电'); expect(r.drills).toEqual([])
  })
  test('403 from the server becomes FORBIDDEN, not a crash', async () => {
    await expect(byName.district_summary({})).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  test('missing config is a CONFIG error naming the variable', () => {
    delete process.env.ACADEMY_TOKEN
    expect(() => checkConfig()).toThrow(/ACADEMY_TOKEN/)
    process.env.ACADEMY_TOKEN = 'nope'
    expect(() => checkConfig()).toThrow(/cla_/)
  })
})
