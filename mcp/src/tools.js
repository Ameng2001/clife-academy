/* 只读工具。每个工具调一个 GET 接口，能看什么由服务端按账号判（教师看自己，园长看本园，区县管理员看本区，管理员看全平台）；
   桥不放大权限，也不把服务端给的个人名单再往外传：园所与区县的汇总只留岗位、人数、中位数这些行，不列个人。
   课程目录直接读 frontend/src/lib/lessons.js，与网页同一份。 */
import { z } from 'zod'
import { get } from './http.js'
import { PATH_KEYS, PATH_META, PATH_NAMES, levelsOf, levelCount, pathSummary, pathNameOf } from '../../frontend/src/lib/lessons.js'

const day = ts => (ts ? new Date(ts).toISOString().slice(0, 10) : null)
const when = ts => (ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : null)
const KIND = { tool: '岗位路径（平台工具）', domain: '领域路径（证书）', stage: '阶段路径', admin: '区县管理员路径' }
const pathRow = p => ({ path: p, name: PATH_NAMES[p] || p, kind: KIND[PATH_META[p]?.kind || 'tool'], stage: PATH_META[p]?.stage || null, domain: PATH_META[p]?.domain || null, levels: levelCount(p) })

export const TOOLS = [
  {
    name: 'whoami', description: '我是谁：当前令牌对应的账号、岗位、园所或区县。先调这个，再决定能问园所还是区县。', schema: {},
    handler: async () => { const r = await get('/api/me'); const u = r.user; return { id: u.id, name: u.name, admin: !!u.admin, role: u.academy?.role || null, org: u.academy?.org?.name || null, district: u.academy?.district?.name || null, reviewer: !!u.academy?.reviewer, curator: !!u.academy?.curator } }
  },
  {
    name: 'list_paths', description: '课程目录：15 条路径（岗位、领域、阶段、区县管理员）各几关。', schema: {},
    handler: async () => ({ paths: PATH_KEYS.map(pathRow), total_levels: PATH_KEYS.reduce((n, p) => n + levelCount(p), 0) })
  },
  {
    name: 'get_path', description: '一条路径的关卡清单：标题、类型（tool 平台实操 / practice 交证据 / seminar 情景研讨）、场景、时长、目标。', schema: { path: z.string().describe('路径键，如 nurse、obs、manage；见 list_paths') },
    handler: async ({ path }) => { if (!PATH_KEYS.includes(path)) throw Object.assign(new Error(`没有这条路径：${path}`), { code: 'NOT_FOUND' }); return { ...pathRow(path), levels: levelsOf(path).map(l => ({ id: l.id, n: l.i + 1, title: l.t || l.title, type: l.type || 'tool', scene: l.scene || null, duration: l.dur || null, goal: l.goal || null })) } }
  },
  {
    name: 'my_progress', description: '我自己的学习进度：每条路径过了几关、停在哪关、学分；只有本人的。', schema: {},
    handler: async () => {
      const r = await get('/api/data'); const S = r.state || {}; const progress = S.progress || {}
      const paths = PATH_KEYS.map(p => { const s = pathSummary(progress, p); return { path: p, name: pathNameOf(p), done: s.done, total: s.total, finished: !!s.finished } }).filter(x => x.done > 0)
      const credits = Object.values(S.credits || {}).reduce((a, b) => a + b, 0)
      return { role: S.role || null, credits, paths, last_passed: Object.entries(progress).filter(([, v]) => v?.passedAt).sort((a, b) => b[1].passedAt - a[1].passedAt).slice(0, 5).map(([id, v]) => ({ level: id, at: day(v.passedAt) })) }
    }
  },
  {
    name: 'my_honors', description: '我的徽章、称号、证书与学时（本人）。', schema: {},
    handler: async () => { const [h, c] = await Promise.all([get('/api/me/honors'), get('/api/me/certificates')]); return { honors: h, certificates: c } }
  },
  {
    name: 'org_summary', description: '本园各岗位完成情况（园长、管理员）：每个岗位几人、平均过关数、完成率、近 7 天过关；不列个人。', schema: {},
    handler: async () => { const r = await get('/api/org/summary'); return { org: r.org?.name || null, at: when(r.at), members_total: r.members_total, passes_7d: r.passes7d, roles: (r.roles || []).map(g => ({ role: g.name, path: g.path, members: g.members, finished: g.finished, started: g.started, avg_done: g.avgDone, total: g.total, rate_pct: g.rate, passes_7d: g.passes7d })) } }
  },
  {
    name: 'org_weekly', description: '运营周报：上一周本园（园长）或全平台＋各园一行（管理员）：过关、作品、点评、超期、每周一题、答疑、入库。', schema: {},
    handler: async () => { const r = await get('/api/ops/weekly'); const { queue, ...rest } = r; void queue; return rest }
  },
  {
    name: 'org_review_stats', description: '点评时效（园长、管理员）：待点评、超期、最老一件的时间、近 30 天点评用时中位数；不列点评人。', schema: {},
    handler: async () => { const r = await get('/api/review/stats'); const { queue, orgs, ...rest } = r; return { ...rest, oldestAt: when(rest.oldestAt), orgs: orgs ? orgs.map(o => ({ name: o.name, members: o.members, pending: o.pending, overdue: o.overdue })) : undefined } }
  },
  {
    name: 'org_checkup', description: '本园应用体检卡（园长、管理员）：12 项探针的本周结果与推课建议。', schema: {},
    handler: async () => { const r = await get('/api/org/checkup'); return { org: r.orgName || r.org, pushed_by_platform: r.pushed, card: r.card } }
  },
  {
    name: 'org_cohort', description: '本园对其他园的匿名对照（园长、管理员）：整体完成率、各岗位完成率、七领域覆盖率、近 30 天在学占比，本园的数与其他园的中位数；其他园 ≥ 3 所才有中位数；不排名、不点名。', schema: {},
    handler: async () => { const r = await get('/api/org/cohort'); return { org: r.org?.name || null, at: when(r.at), city: r.city, district: r.district } }
  },
  {
    name: 'org_honors', description: '园所集体荣誉（园长、管理员）：本园拿到的集体徽章。', schema: {},
    handler: async () => get('/api/org/honors')
  },
  {
    name: 'district_summary', description: '区县看板（区县管理员、管理员）：园所数、覆盖率中位数、走完路径与认证人数；≥ 3 园才给中位数；不排名。', schema: {},
    handler: async () => { const r = await get('/api/district/summary'); return { ...r, at: when(r.at) } }
  },
  {
    name: 'district_orgs', description: '本区园所名单（区县管理员、管理员）：园名、人数、挂接方式。', schema: {},
    handler: async () => get('/api/district/orgs')
  },
  {
    name: 'search_cases', description: '案例库检索（入库的案例）：按关键词、领域、年龄段、用途。', schema: { q: z.string().optional().describe('关键词'), domain: z.string().optional().describe('领域键：env/life/play/plan/obs/comm/reflect'), community: z.boolean().optional().describe('只看本园所在共同体各园的') },
    handler: async ({ q, domain, community }) => { const r = await get('/api/cases', { q, domain, community: community ? 1 : undefined }); return { total_in_library: r.total, community: r.community?.name || null, cases: (r.cases || []).slice(0, 30).map(c => ({ id: c.id, title: c.title, domain: c.domain, age: c.age, use: c.use, by: c.byName, org: c.orgName, at: day(c.at), excerpt: (c.text || '').slice(0, 160) })) } }
  },
  {
    name: 'list_resources', description: '资源库：文献与政策、模板与工具；可按关键词、类别、领域。', schema: { q: z.string().optional(), kind: z.string().optional().describe('类别键，见返回的 kinds'), domain: z.string().optional() },
    handler: async ({ q, kind, domain }) => { const r = await get('/api/resources', { q, kind, domain }); return { kinds: r.kinds, resources: (r.resources || []).slice(0, 40).map(x => ({ id: x.id, kind: x.kind, title: x.title, domain: x.domain, desc: x.desc, url: x.url || null, scope: x.scope })) } }
  },
  {
    name: 'upcoming', description: '近期安排：将开的园长大讲堂、开着的每周一题、在用的平台公告。', schema: {},
    handler: async () => {
      const [l, d, n] = await Promise.all([get('/api/lectures'), get('/api/drills'), get('/api/notices')])
      return {
        lectures: (l.upcoming || []).slice(0, 5).map(x => ({ id: x.id, title: x.title, at: when(x.at), minutes: x.minutes, speaker: x.speaker, booked: !!x.booked })),
        drills: (d.current || []).slice(0, 5).map(x => ({ id: x.id, title: x.title, domain: x.domain, scope: x.scope, closes: when(x.closeAt), answers: x.answers ?? undefined })),
        notices: (n.notices || []).map(x => ({ title: x.title, text: x.text, until: day(x.until) }))
      }
    }
  }
]
