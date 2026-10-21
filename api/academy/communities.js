/* 跨园共同体（docs/ROADMAP.md 第六节）：按萧山模式，区县管理员把本区若干园编成一组，组内共享案例库、联合研讨关。
 *
 * db.communities: { id, district, name, orgs:[{ key, name }], lead:orgKey|null, note, by, byName, at, updatedAt }
 * 一所园在一个区里只属于一个共同体。共享的是教研产出（案例、研讨作答），不共享任何一园的进度、体检卡、人员表。
 * 建组、改组、解散：区县管理员（本区）或管理员；成员只看自己园在哪个共同体（GET /api/me/community）。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { districtOrgsOf, districtOf, isDistrictAdmin } from './district.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const MIN_ORGS = 2, MAX_ORGS = 6;

/** 共同体查询，cases.js / drills.js 用：某园在哪个共同体、同不同组。 */
export function createCommunities(db) {
  db.communities = db.communities || [];
  const ofOrg = orgKey => (orgKey ? db.communities.find(c => c.orgs.some(o => o.key === orgKey)) || null : null);
  const byId = id => db.communities.find(c => c.id === id) || null;
  const orgKeysOf = id => (byId(id)?.orgs || []).map(o => o.key);
  const sameCommunity = (a, b) => { const c = ofOrg(a); return !!c && !!b && c.orgs.some(o => o.key === b); };
  return { ofOrg, byId, orgKeysOf, sameCommunity };
}

export function communityRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, communities }) {
  const C = communities || createCommunities(db);
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const now = () => Date.now();
  const pub = c => ({ id: c.id, name: c.name, orgs: c.orgs.map(o => ({ key: o.key, name: o.name })), lead: c.lead || null, leadName: c.orgs.find(o => o.key === c.lead)?.name || null, note: c.note || '', byName: c.byName, at: c.at, updatedAt: c.updatedAt });
  const guard = (req, res) => {
    const user = readSession(req);
    if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
    if (!isDistrictAdmin(user) && !isAdmin(user)) { json(res, 403, { error: 'district admins only', code: 'district' }); return null; }
    return user;
  };

  return {
  // 本区共同体（只有名单，没有数）
  'GET /api/district/communities': async (req, res) => {
    const user = guard(req, res); if (!user) return;
    const dk = districtOf(user, req, isAdmin);
    const list = dk ? db.communities.filter(c => c.district === dk) : [];
    const taken = new Set(list.flatMap(c => c.orgs.map(o => o.key)));
    const free = dk ? districtOrgsOf(db, dk).filter(o => !taken.has(o.key)).map(o => ({ key: o.key, name: o.name })).sort((a, b) => a.name.localeCompare(b.name, 'zh')) : [];
    json(res, 200, { district: dk, communities: list.sort((a, b) => a.at - b.at).map(pub), free, min: MIN_ORGS, max: MAX_ORGS });
  },
  // 建组或改组：{ id?, name, orgs:[orgKey], lead?, note? }。2–6 园，都要在本区；一园只能在一个组。
  'POST /api/district/communities': async (req, res) => {
    const user = guard(req, res); if (!user) return;
    const dk = districtOf(user, req, isAdmin);
    if (!dk) return json(res, 400, { error: 'no district on this account', code: 'no-district' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let c = id ? db.communities.find(x => x.id === id) : null;
    if (id && !c) return json(res, 404, { error: 'no such community' });
    if (c && c.district !== dk) return json(res, 403, { error: 'not in your district', code: 'district' });
    const name = str(body.name, 60);
    if (name.length < 2) return json(res, 400, { error: 'name needs 2+ characters', code: 'name' });
    const inDistrict = new Map(districtOrgsOf(db, dk).map(o => [o.key, o.name]));
    const keys = [...new Set((Array.isArray(body.orgs) ? body.orgs : []).map(o => (typeof o === 'string' ? o : o?.key)).filter(Boolean))];
    if (keys.length < MIN_ORGS || keys.length > MAX_ORGS) return json(res, 400, { error: `${MIN_ORGS}–${MAX_ORGS} orgs`, code: 'count' });
    const outside = keys.filter(k => !inDistrict.has(k));
    if (outside.length) return json(res, 400, { error: 'org not in this district', code: 'outside', orgs: outside });
    const elsewhere = keys.filter(k => { const o = C.ofOrg(k); return o && o.district === dk && (!c || o.id !== c.id); });
    if (elsewhere.length) return json(res, 409, { error: 'org already in another community', code: 'taken', orgs: elsewhere });
    const lead = keys.includes(str(body.lead, 200)) ? str(body.lead, 200) : null;
    const orgs = keys.map(k => ({ key: k, name: inDistrict.get(k) }));
    if (c) Object.assign(c, { name, orgs, lead, note: str(body.note, 500), updatedAt: now() });
    else { c = { id: newId(), district: dk, name, orgs, lead, note: str(body.note, 500), by: user.id, byName: user.name, at: now(), updatedAt: now() }; db.communities.push(c); }
    saveDb();
    audit(req, id ? 'community.edit' : 'community.new', { user, msg: c.id });
    json(res, 200, { community: pub(c) });
  },
  'POST /api/district/communities/delete': async (req, res) => {
    const user = guard(req, res); if (!user) return;
    const dk = districtOf(user, req, isAdmin);
    const body = await readBody(req);
    const c = db.communities.find(x => x.id === str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such community' });
    if (c.district !== dk && !isAdmin(user)) return json(res, 403, { error: 'not in your district', code: 'district' });
    db.communities = db.communities.filter(x => x.id !== c.id);
    // 面向这个共同体的研讨题收回成本区管理员可见的历史：改成只面向出题人园所不合适，直接删题与作答
    const drillIds = new Set((db.drills || []).filter(d => d.scope === 'community:' + c.id).map(d => d.id));
    if (drillIds.size) { db.drills = db.drills.filter(d => !drillIds.has(d.id)); db.drillAnswers = (db.drillAnswers || []).filter(a => !drillIds.has(a.drillId)); }
    saveDb();
    audit(req, 'community.delete', { user, msg: c.id });
    json(res, 200, { ok: true, drillsRemoved: drillIds.size });
  },
  // 我的园在哪个共同体（任何成员）：名单与组长园，没有数
  'GET /api/me/community': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const c = C.ofOrg(orgKeyOf(user));
    if (!c) return json(res, 200, { community: null });
    const keys = new Set(c.orgs.map(o => o.key));
    json(res, 200, { community: { ...pub(c), cases: (db.cases || []).filter(x => x.status === 'approved' && keys.has(x.org)).length, drills: (db.drills || []).filter(d => d.scope === 'community:' + c.id && d.openAt <= now()).length } });
  }
  };
}
