/* 园所间匿名中位数（docs/MIGRATION.md「cohort」行、ROADMAP 第十一节 E 期）：园长看本园的数和「其他园」的中位数，只此一行对照。
 * 规矩：其他园 ≥ 3 所才给中位数；只给中位数，不给任何一所别的园的数，不排名、不点名；没有测验分；按谁都看不出是哪所园。
 * 范围是整个实例（本市）；本区园够 3 所时另给本区一行。
 *
 * 比什么（都是园级比例，与人数无关）：整体完成率（各岗位 doneSum / 应学总关，summarize 的 rate 按人加权）、各岗位完成率（本园有该岗位才比）、
 * 七领域覆盖率（园里至少过一关该领域的人占比）、近 30 天在学占比。 */
import { orgKeyOf, summarize, ORG_ROLES } from './org.js';
import { LEVEL_DOMAIN, DOMAINS, PATH_NAMES, ROLE_PATH } from './events-data.js';
import { median, districtOrgsOf, districtKeyOf } from './district.js';

export const MIN_OTHERS = 3;
const MONTH = 30 * 86400000;
const pct = v => (v == null ? null : Math.round(v * 100));

/** 一所园的园级比例。 */
export function orgMetrics(members, stateOf, now = Date.now()) {
  const s = summarize(members, stateOf, now);
  const n = members.length;
  const prog = members.map(u => (stateOf(u.id)?.progress) || {});
  const roles = {};
  for (const r of s.roles) if (r.members > 0) roles[r.role] = r.rate / 100;
  const withMembers = s.roles.filter(r => r.members > 0);
  const rate = n ? withMembers.reduce((a, r) => a + r.rate * r.members, 0) / n / 100 : 0;
  const domains = {};
  for (const d of DOMAINS) domains[d.key] = n ? prog.filter(p => Object.keys(p).some(id => p[id]?.passedAt && LEVEL_DOMAIN[id] === d.key)).length / n : 0;
  const active30 = n ? prog.filter(p => Object.values(p).some(x => now - (Number(x?.passedAt) || 0) < MONTH)).length / n : 0;
  return { n, rate, roles, domains, active30 };
}

/** 实例里所有园（不含停用账号），{ key, name, members }。 */
export function allOrgsOf(db) {
  const by = new Map();
  for (const u of db.users) { if (u.disabled) continue; const k = orgKeyOf(u); if (!k) continue; if (!by.has(k)) by.set(k, { key: k, name: u.academy?.org?.name || k, members: [] }); by.get(k).members.push(u); }
  return [...by.values()];
}

/** 纯函数：本园 ＋ 其他园 → 对照。others 不含本园；不够 MIN_OTHERS 时 median 为 null。 */
export function cohortOf(mine, others, stateOf, now = Date.now()) {
  const me = orgMetrics(mine.members, stateOf, now);
  const os = others.map(o => orgMetrics(o.members, stateOf, now)).filter(m => m.n > 0);
  const enough = os.length >= MIN_OTHERS;
  const med = pick => (enough ? pct(median(os.map(pick).filter(v => v != null))) : null);
  const roleRows = ORG_ROLES.filter(r => me.roles[r] != null).map(r => {
    const vals = os.map(m => m.roles[r]).filter(v => v != null);
    return { role: r, name: PATH_NAMES[ROLE_PATH[r]] || r, mine: pct(me.roles[r]), median: enough && vals.length >= MIN_OTHERS ? pct(median(vals)) : null, orgs: vals.length };
  });
  return {
    others: os.length, minOthers: MIN_OTHERS, enough,
    rate: { mine: pct(me.rate), median: med(m => m.rate) },
    active30: { mine: pct(me.active30), median: med(m => m.active30) },
    roles: roleRows,
    domains: DOMAINS.map(d => ({ key: d.key, name: d.name, mine: pct(me.domains[d.key]), median: med(m => m.domains[d.key]) }))
  };
}

export function cohortRoutes({ json, db, readSession, isAdmin, readStateCached }) {
  return {
  // 园长看本园对全市（实例）其他园；本区够 3 所另给 district 一组。管理员可 ?org=<key>。
  'GET /api/org/cohort': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (user.academy?.role !== 'director' && !isAdmin(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const q = new URL(req.url, 'http://x').searchParams.get('org');
    const key = (isAdmin(user) && q) || orgKeyOf(user);
    const all = allOrgsOf(db);
    const mine = all.find(o => o.key === key);
    if (!mine) return json(res, 200, { org: null, at: Date.now(), city: null, district: null });
    const stateOf = uid => readStateCached(uid);
    const others = all.filter(o => o.key !== key);
    const city = cohortOf(mine, others, stateOf);
    const dk = districtKeyOf(user) || (db.orgDistricts || []).find(m => m.org === key)?.district || null;
    let district = null;
    if (dk) { const dOrgs = districtOrgsOf(db, dk).filter(o => o.key !== key); district = { key: dk, name: dk.replace(/^(id|name):/, ''), ...cohortOf(mine, dOrgs, stateOf) }; }
    json(res, 200, { org: { key, name: mine.name }, at: Date.now(), city, district });
  }
  };
}
