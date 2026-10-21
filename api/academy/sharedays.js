/* 园所分享日（docs/ROADMAP.md 第七节「分享激励 · 园所分享日」）：每学期一次，各园把本园入库案例汇成一页，共同体内交流。是展示，不是评比：
 * 不计票、不排名、不统计各园页数；页上只有案例与园长的一段话。
 *
 * db.sharedays: { id, community, communityName, district, at, place, theme, by, byName, createdAt, closedAt,
 *                 pages:[{ org, orgName, caseIds:[≤8], note, by, byName, at, updatedAt }] }
 * 谁能办：区县管理员（本区的共同体）、管理员。谁能交一页：共同体内各园的园长。谁能看：共同体内的人、区县管理员、管理员。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { isDistrictAdmin, districtKeyOf } from './district.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const MAX_CASES = 8;

export function shareDayRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, communities }) {
  db.sharedays = db.sharedays || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const find = id => db.sharedays.find(s => s.id === id);
  const sees = (u, s) => isAdmin(u) || (isDistrictAdmin(u) && districtKeyOf(u) === s.district) || communities.orgKeysOf(s.community).includes(orgKeyOf(u));
  const hostsIt = (u, s) => isAdmin(u) || (isDistrictAdmin(u) && districtKeyOf(u) === s.district);
  const caseOf = id => (db.cases || []).find(c => c.id === id && c.status === 'approved');
  const pub = (s, user) => {
    const org = orgKeyOf(user), myPage = s.pages.find(p => p.org === org);
    return {
      id: s.id, communityName: s.communityName, at: s.at, place: s.place, theme: s.theme, byName: s.byName, closedAt: s.closedAt || null, canHost: hostsIt(user, s),
      canPage: !s.closedAt && user.academy?.role === 'director' && !!org && communities.orgKeysOf(s.community).includes(org),
      orgs: communities.orgKeysOf(s.community).length, mine: myPage ? { caseIds: myPage.caseIds, note: myPage.note } : null,
      pages: s.pages.sort((a, b) => a.at - b.at).map(p => ({ orgName: p.orgName, note: p.note, byName: p.byName, at: p.updatedAt || p.at, cases: p.caseIds.map(caseOf).filter(Boolean).map(c => ({ id: c.id, title: c.title, byName: c.byName })) }))
    };
  };

  return {
  'GET /api/sharedays': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const list = db.sharedays.filter(s => sees(user, s)).sort((a, b) => b.at - a.at);
    const hostable = isAdmin(user) ? db.communities.map(c => ({ id: c.id, name: c.name })) : isDistrictAdmin(user) ? db.communities.filter(c => c.district === districtKeyOf(user)).map(c => ({ id: c.id, name: c.name })) : [];
    json(res, 200, { sharedays: list.map(s => pub(s, user)), communities: hostable, maxCases: MAX_CASES });
  },
  // 办一场或改：{ id?, communityId, at, place?, theme? }
  'POST /api/sharedays': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user) && !isDistrictAdmin(user)) return json(res, 403, { error: 'district admins host share days', code: 'host' });
    const body = await readBody(req);
    let s = body.id ? find(str(body.id, 40)) : null;
    if (body.id && !s) return json(res, 404, { error: 'no such share day' });
    if (s && !hostsIt(user, s)) return json(res, 403, { error: 'not your district', code: 'host' });
    const comm = s ? communities.byId(s.community) : communities.byId(str(body.communityId, 40));
    if (!comm || (!isAdmin(user) && comm.district !== districtKeyOf(user))) return json(res, 400, { error: 'pick a community of your district', code: 'community' });
    const at = Number(body.at) > 946684800000 ? Number(body.at) : (s ? s.at : null);
    if (!at) return json(res, 400, { error: 'date required', code: 'at' });
    const fields = { at, place: str(body.place, 120), theme: str(body.theme, 120), updatedAt: now() };
    if (s) Object.assign(s, fields);
    else { s = { id: newId(), community: comm.id, communityName: comm.name, district: comm.district, ...fields, by: user.id, byName: user.name, createdAt: now(), closedAt: null, pages: [] }; db.sharedays.push(s); }
    saveDb();
    audit(req, 'shareday.save', { user, msg: s.id });
    json(res, 200, { shareday: pub(s, user) });
  },
  // 本园的一页：{ id, caseIds:[≤8 本园入库案例], note }。园长交；再交就是改
  'POST /api/sharedays/page': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const s = find(str(body.id, 40));
    if (!s || !sees(user, s)) return json(res, 404, { error: 'no such share day' });
    if (s.closedAt) return json(res, 400, { error: 'share day is over', code: 'closed' });
    const org = orgKeyOf(user);
    if (user.academy?.role !== 'director' || !org || !communities.orgKeysOf(s.community).includes(org)) return json(res, 403, { error: 'directors of the community submit pages', code: 'director' });
    const ids = [...new Set((Array.isArray(body.caseIds) ? body.caseIds : []).map(x => str(x, 40)))].slice(0, MAX_CASES).filter(id => { const c = caseOf(id); return c && c.org === org; });
    const note = str(body.note, 600);
    if (!ids.length && note.length < 10) return json(res, 400, { error: 'pick cases or write a note', code: 'empty' });
    let p = s.pages.find(x => x.org === org);
    if (p) Object.assign(p, { caseIds: ids, note, by: user.id, byName: user.name, updatedAt: now() });
    else { p = { org, orgName: user.academy?.org?.name || null, caseIds: ids, note, by: user.id, byName: user.name, at: now(), updatedAt: now() }; s.pages.push(p); }
    saveDb();
    audit(req, 'shareday.page', { user, msg: s.id });
    json(res, 200, { shareday: pub(s, user) });
  },
  'POST /api/sharedays/close': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const s = find(str(body.id, 40));
    if (!s) return json(res, 404, { error: 'no such share day' });
    if (!hostsIt(user, s)) return json(res, 403, { error: 'hosts only', code: 'host' });
    if (!s.closedAt) { s.closedAt = now(); saveDb(); audit(req, 'shareday.close', { user, msg: s.id }); }
    json(res, 200, { shareday: pub(s, user) });
  }
  };
}
