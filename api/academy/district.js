/* 区县看板与区县归属（docs/ROADMAP.md 第八节「区县」行、第六节跨园共同体）。
 *
 * 看什么：园所数、在学人数、各领域覆盖率的中位数、认证人数、共同体活动（斗课、研讨、案例）、体检汇总（接通回传的园数、本周有需关注项的园数）。
 * 不看什么：任何一所园的数。园所只给名单（按名称排序），中位数只在 ≥ 3 园时给；不排名、不导出、无测验分。
 *
 * 区县归属：user.academy.district（平台给、开发桩填）。一所园属于区县 D，当它的成员里有人带 district D，或区县管理员在
 * db.orgDistricts 里把它挂进来（{ org:orgKey, name, district:districtKey, by, at }）。区县管理员（role 'district'）只看自己的区；管理员可 ?district=。 */
import { orgKeyOf, summarize } from './org.js';
import { PATH_LEN, PATH_KIND, LEVEL_DOMAIN, DOMAINS } from './events-data.js';
import { buildCard } from './checkup.js';

export const MIN_ORGS = 3;
export const districtKeyOf = u => { const d = u?.academy?.district; return d ? (d.id ? 'id:' + d.id : d.name ? 'name:' + d.name : null) : null; };
const keyFrom = o => (o && typeof o === 'object' ? (o.id ? 'id:' + String(o.id).trim() : o.name ? 'name:' + String(o.name).trim() : null) : null);
const DOMAIN_PATHS = Object.keys(PATH_KIND).filter(p => PATH_KIND[p] === 'domain');

/** 中位数，百分数取整；空数组 null。 */
export const median = xs => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/** 纯函数：一个区的园（{ key, name, members:[user] }）＋ 状态读取 → 汇总。导出便于测试。 */
export function summarizeDistrict(orgs, stateOf, extra = {}) {
  const per = orgs.map(o => {
    const prog = o.members.map(u => (stateOf(u.id)?.progress) || {});
    const n = o.members.length;
    const cover = {};
    for (const d of DOMAINS) cover[d.key] = n ? prog.filter(p => Object.keys(p).some(id => p[id]?.passedAt && LEVEL_DOMAIN[id] === d.key)).length / n : 0;
    const s = summarize(o.members, stateOf);
    const roleRate = s.roles.filter(r => r.members > 0);
    const finished = roleRate.reduce((a, r) => a + r.finished, 0);
    const certified = prog.reduce((a, p) => a + DOMAIN_PATHS.filter(path => { let i = 0; while (i < PATH_LEN[path] && p[`${path}-${i}`]?.passedAt) i++; return PATH_LEN[path] > 0 && i >= PATH_LEN[path]; }).length, 0);
    return { n, cover, finished, certified, passes7d: s.passes7d, rate: n ? roleRate.reduce((a, r) => a + r.rate * r.members, 0) / n : 0 };
  });
  const enough = orgs.length >= MIN_ORGS;
  const pct = v => (v == null ? null : Math.round(v * 100));
  return {
    orgs: orgs.map(o => ({ key: o.key, name: o.name })).sort((a, b) => a.name.localeCompare(b.name, 'zh')),
    orgCount: orgs.length, minOrgs: MIN_ORGS, medians: enough,
    members_total: per.reduce((a, p) => a + p.n, 0),
    finished: per.reduce((a, p) => a + p.finished, 0),            // 走完岗位路径的人数（全区合计）
    certified: per.reduce((a, p) => a + p.certified, 0),          // 走完领域路径的人次（一人多领域记多次）
    passes7d: per.reduce((a, p) => a + p.passes7d, 0),
    domains: DOMAINS.map(d => ({ key: d.key, name: d.name, median: enough ? pct(median(per.map(p => p.cover[d.key]))) : null })),
    rateMedian: enough ? Math.round(median(per.map(p => p.rate))) : null,
    ...extra
  };
}

export const isDistrictAdmin = u => u?.academy?.role === 'district';
/** 一个区的园：成员带 district 的 ＋ 手工挂的（db.orgDistricts）；名称取成员的园名或挂接时写的名。communities.js 也用。 */
export function districtOrgsOf(db, dk) {
  const byKey = new Map();
  for (const u of db.users) { if (u.disabled) continue; const ok = orgKeyOf(u); if (!ok) continue; if (districtKeyOf(u) === dk) byKey.set(ok, { key: ok, name: u.academy.org.name || ok, members: [], via: 'members' }); }
  for (const m of db.orgDistricts || []) if (m.district === dk && !byKey.has(m.org)) byKey.set(m.org, { key: m.org, name: m.name || m.org, members: [], via: 'manual' });
  for (const u of db.users) { if (u.disabled) continue; const ok = orgKeyOf(u); const o = ok && byKey.get(ok); if (o) { o.members.push(u); if (!o.name || o.name === ok) o.name = u.academy.org.name || o.name; } }
  return [...byKey.values()];
}
/** 区县管理员看自己的区；管理员可 ?district=。 */
export const districtOf = (user, req, isAdmin) => { const q = new URL(req.url, 'http://x').searchParams.get('district'); return (isAdmin(user) && q) || districtKeyOf(user); };

export function districtRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, readStateCached }) {
  db.orgDistricts = db.orgDistricts || [];
  const isDistrict = isDistrictAdmin;
  const myDistrict = (user, req) => districtOf(user, req, isAdmin);
  const orgsOf = dk => districtOrgsOf(db, dk);
  const checkupOf = orgs => {
    const rows = db.checkups || [], first = db.checkupOrgs || [];
    let pushed = 0, warn = 0;
    for (const o of orgs) {
      const mine = rows.filter(r => r.org === o.key); if (!mine.length) continue; pushed++;
      const card = buildCard(mine, { learning: null, firstAt: first.find(x => x.org === o.key)?.firstAt || null });
      if (card.sum.warn > 0) warn++;
    }
    return { pushed, warn };
  };
  const activityOf = orgs => {
    const keys = new Set(orgs.map(o => o.key));
    const contests = (db.contests || []).filter(c => keys.has(c.org));
    const uids = new Set(orgs.flatMap(o => o.members.map(u => u.id)));
    return {
      contests: { total: contests.length, open: contests.filter(c => !c.closedAt).length, done: contests.filter(c => !!c.closedAt).length },
      drillAnswers: (db.drillAnswers || []).filter(a => keys.has(a.org)).length,
      cases: (db.cases || []).filter(c => c.status === 'approved' && (keys.has(c.org) || uids.has(c.by))).length,
      lectureBookings: (db.lectures || []).reduce((a, l) => a + (l.bookings || []).filter(id => uids.has(id)).length, 0)
    };
  };
  const guard = (req, res) => {
    const user = readSession(req);
    if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
    if (!isDistrict(user) && !isAdmin(user)) { json(res, 403, { error: 'district admins only', code: 'district' }); return null; }
    return user;
  };

  return {
  // 区县看板
  'GET /api/district/summary': async (req, res) => {
    const user = guard(req, res); if (!user) return;
    const dk = myDistrict(user, req);
    if (!dk) return json(res, 200, { district: null, at: Date.now(), ...summarizeDistrict([], () => null, { checkup: { pushed: 0, warn: 0 }, activity: null }) });
    const orgs = orgsOf(dk);
    json(res, 200, { district: user.academy?.district || { id: null, name: dk.replace(/^(id|name):/, '') }, at: Date.now(),
      ...summarizeDistrict(orgs, uid => readStateCached(uid), { checkup: checkupOf(orgs), activity: activityOf(orgs) }) });
  },
  // 本区园所名单（含挂接方式），区县管理员与管理员
  'GET /api/district/orgs': async (req, res) => {
    const user = guard(req, res); if (!user) return;
    const dk = myDistrict(user, req);
    const orgs = dk ? orgsOf(dk) : [];
    json(res, 200, { district: dk, orgs: orgs.map(o => ({ key: o.key, name: o.name, via: o.via, members: o.members.length })).sort((a, b) => a.name.localeCompare(b.name, 'zh')) });
  },
  // 把园挂进本区：{ orgs:[{ id?, name }] }；已在本区的跳过；挂在别区的不抢（先让那边解）
  'PUT /api/district/orgs': async (req, res) => {
    const user = guard(req, res); if (!user) return;
    const dk = myDistrict(user, req);
    if (!dk) return json(res, 400, { error: 'no district on this account', code: 'no-district' });
    const body = await readBody(req);
    const list = Array.isArray(body.orgs) ? body.orgs : [body.org || body];
    if (!list.length || list.length > 100) return json(res, 400, { error: '1–100 orgs', code: 'batch' });
    let added = 0; const rejected = [];
    list.forEach((o, i) => {
      const key = keyFrom(o); if (!key) return rejected.push({ i, code: 'no-org' });
      const other = db.orgDistricts.find(m => m.org === key && m.district !== dk);
      if (other) return rejected.push({ i, code: 'other-district' });
      if (db.orgDistricts.some(m => m.org === key && m.district === dk)) return;
      db.orgDistricts.push({ org: key, name: String(o.name || '').trim().slice(0, 80) || key, district: dk, by: user.id, at: Date.now() }); added++;
    });
    saveDb();
    audit(req, 'district.orgs', { user, msg: `${dk} +${added}` });
    json(res, 200, { added, rejected, orgs: orgsOf(dk).map(o => ({ key: o.key, name: o.name, via: o.via })) });
  },
  'POST /api/district/orgs/remove': async (req, res) => {
    const user = guard(req, res); if (!user) return;
    const dk = myDistrict(user, req);
    const body = await readBody(req);
    const key = String(body.org || '');
    const n = db.orgDistricts.length;
    db.orgDistricts = db.orgDistricts.filter(m => !(m.org === key && m.district === dk));
    if (db.orgDistricts.length === n) return json(res, 404, { error: 'not attached by hand (members carry the district)', code: 'none' });
    saveDb();
    audit(req, 'district.orgs.remove', { user, msg: `${dk} -${key}` });
    json(res, 200, { ok: true });
  }
  };
}
