/* 合集（docs/ROADMAP.md 第十三节第 6 条）：按主题把案例、关卡、讲堂微课切片、大讲堂场次、资源攒成一份，给人按主题找东西用。
 * 没有点赞、收藏数、浏览数（口径库 no-social-currency）；排序只按更新时间。
 *
 * db.collections: { id, title, desc, scope:'all'|'district'|'community'|'org', district?, communityId?, org?,
 *                   items:[{ kind:'case'|'level'|'clip'|'lecture'|'resource', id, note? }](≤40), by, byName, createdAt, updatedAt }
 * 谁能建：管理员（任何范围）；区县管理员（本区、本区内的共同体）；园长（本园、本园所在的共同体）；种子教师 / 教研主任（academy.reviewer，本园）。
 * 谁能改删：建的人本人、管理员；园所范围的本园园长也能。
 * 谁能看：all 谁都能（登录）；org 同园；community 同共同体；district 同区县。条目按看的人再过滤一次：案例要已入库、资源要看得到，看不到的条目不给。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { LEVELS, LEVEL_INFO } from './events-data.js';
import { SEED } from './resources-seed.js';
import { districtKeyOf, districtOrgsOf, isDistrictAdmin } from './district.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const SCOPES = Object.freeze({ all: '全平台', district: '本区县', community: '共同体', org: '本园' });
export const KINDS = Object.freeze({ case: '案例', level: '关卡', clip: '讲堂微课', lecture: '大讲堂', resource: '资源' });
export const MAX_ITEMS = 40;

export function collectionRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, communities = null }) {
  db.collections = db.collections || [];
  const now = () => Date.now();
  const isDirector = u => u?.academy?.role === 'director';
  const isReviewer = u => !!u?.academy?.reviewer;
  const userDistrict = u => districtKeyOf(u) || (() => { const ok = orgKeyOf(u); if (!ok) return null; for (const m of db.orgDistricts || []) if (m.org === ok) return m.district; return null; })();
  const inDistrict = (u, dk) => !!dk && (districtKeyOf(u) === dk || districtOrgsOf(db, dk).some(o => o.key === orgKeyOf(u)));
  const myCommunity = u => (communities ? communities.ofOrg(orgKeyOf(u)) : null);

  // 看得到哪些
  const canSee = (u, c) => c.scope === 'all' || (c.scope === 'org' && c.org && c.org === orgKeyOf(u)) || (c.scope === 'community' && c.communityId && (myCommunity(u)?.id === c.communityId || isDistrictAdmin(u) && inDistrictCommunity(u, c.communityId))) || (c.scope === 'district' && inDistrict(u, c.district)) || isAdmin(u) || c.by === u.id;
  const inDistrictCommunity = (u, cid) => { const cm = communities?.byId(cid); const dk = districtKeyOf(u); return !!cm && !!dk && cm.orgs.some(o => districtOrgsOf(db, dk).some(x => x.key === o.key)); };
  // 能建什么范围
  const scopesFor = u => {
    if (!u) return [];
    if (isAdmin(u)) return ['all', 'district', 'community', 'org'];
    const out = [];
    if (isDistrictAdmin(u)) { out.push('district'); if (db.communities?.length) out.push('community'); }
    if (isDirector(u)) { out.push('org'); if (myCommunity(u)) out.push('community'); }
    else if (isReviewer(u) && orgKeyOf(u)) out.push('org');
    return out;
  };
  const mayEdit = (u, c) => !!u && (c.by === u.id || isAdmin(u) || (c.scope === 'org' && isDirector(u) && c.org === orgKeyOf(u)));

  // 条目解析：看不到的（案例没入库、资源非本园）不给
  const resolve = (it, u) => {
    if (it.kind === 'case') { const c = (db.cases || []).find(x => x.id === it.id && x.status === 'approved'); return c ? { ...it, title: c.title, sub: `${c.byName}${c.orgName ? ' · ' + c.orgName : ''}`, to: '/cases?q=' + encodeURIComponent(c.title) } : null; }
    if (it.kind === 'level') { const t = LEVELS[it.id]; return t ? { ...it, title: t, sub: LEVEL_INFO[it.id]?.scene || '', to: '/level/' + it.id } : null; }
    if (it.kind === 'clip') { const [lid, cid] = String(it.id).split(':'); const l = (db.lectures || []).find(x => x.id === lid); const c = l?.pack?.clips?.find(x => x.id === cid); return l && c ? { ...it, title: c.title, sub: l.title, to: l.replayUrl ? l.replayUrl + (c.start ? '#t=' + c.start : '') : '/lectures', external: !!l.replayUrl } : null; }
    if (it.kind === 'lecture') { const l = (db.lectures || []).find(x => x.id === it.id); return l ? { ...it, title: l.title, sub: l.speaker ? l.speaker + ' 主讲' : '园长大讲堂', to: '/lectures' } : null; }
    if (it.kind === 'resource') { const org = orgKeyOf(u); const r = SEED.find(x => x.id === it.id) || (db.resources || []).find(x => x.id === it.id && (x.scope === 'public' || x.org === org)); return r ? { ...it, title: r.title, sub: r.desc ? r.desc.slice(0, 60) : '', to: '/resources?q=' + encodeURIComponent(r.title) } : null; }
    return null;
  };
  const pub = (c, u) => ({ id: c.id, title: c.title, desc: c.desc, scope: c.scope, scopeName: SCOPES[c.scope], where: c.scope === 'org' ? c.orgName : c.scope === 'community' ? (communities?.byId(c.communityId)?.name || null) : c.scope === 'district' ? c.districtName : null,
    items: c.items.map(it => resolve(it, u)).filter(Boolean), total: c.items.length, byName: c.byName, createdAt: c.createdAt, updatedAt: c.updatedAt, canEdit: mayEdit(u, c) });
  const find = id => db.collections.find(c => c.id === id);

  return {
  'GET /api/collections': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    if (id) { const c = find(id); if (!c || !canSee(user, c)) return json(res, 404, { error: 'no such collection' }); return json(res, 200, { collection: pub(c, user) }); }
    const list = db.collections.filter(c => canSee(user, c)).sort((a, b) => b.updatedAt - a.updatedAt).map(c => pub(c, user));
    const cm = myCommunity(user);
    json(res, 200, { collections: list, scopes: scopesFor(user).map(s => ({ key: s, name: SCOPES[s] })), kinds: KINDS, max: MAX_ITEMS, community: cm ? { id: cm.id, name: cm.name } : null, communities: isAdmin(user) || isDistrictAdmin(user) ? (db.communities || []).map(x => ({ id: x.id, name: x.name })) : [] });
  },
  // 建或改：{ id?, title, desc?, scope, communityId?, items:[{kind,id,note?}] }
  'POST /api/collections': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let c = id ? find(id) : null;
    if (id && !c) return json(res, 404, { error: 'no such collection' });
    if (c && !mayEdit(user, c)) return json(res, 403, { error: 'not yours', code: 'who' });
    const title = str(body.title, 60);
    if (title.length < 2) return json(res, 400, { error: 'title ≥ 2 chars', code: 'title' });
    const scope = c && body.scope === undefined ? c.scope : str(body.scope, 12);
    if (!SCOPES[scope] || (!(c && scope === c.scope) && !scopesFor(user).includes(scope))) return json(res, 403, { error: 'scope not allowed for you', code: 'scope' });
    const where = {};
    if (scope === 'org') { where.org = c?.org && scope === c.scope ? c.org : orgKeyOf(user); where.orgName = user.academy?.org?.name || c?.orgName || null; if (!where.org) return json(res, 400, { error: 'no org', code: 'org' }); }
    if (scope === 'community') { const cid = str(body.communityId, 40) || c?.communityId || myCommunity(user)?.id; const cm = communities?.byId(cid); if (!cm) return json(res, 400, { error: 'pick a community', code: 'community' }); if (!isAdmin(user) && myCommunity(user)?.id !== cm.id && !(isDistrictAdmin(user) && inDistrictCommunity(user, cm.id))) return json(res, 403, { error: 'not your community', code: 'community' }); where.communityId = cm.id; }
    if (scope === 'district') { const dk = c?.district && scope === c.scope ? c.district : (districtKeyOf(user) || str(body.district, 80)); if (!dk) return json(res, 400, { error: 'no district', code: 'district' }); where.district = dk; where.districtName = user.academy?.district?.name || dk.replace(/^(id|name):/, ''); }
    const items = (Array.isArray(body.items) ? body.items : (c ? c.items : [])).map(it => it && typeof it === 'object' ? { kind: str(it.kind, 10), id: str(String(it.id || ''), 80), note: str(it.note, 120) } : null).filter(it => it && KINDS[it.kind] && it.id && resolve(it, user)).slice(0, MAX_ITEMS);
    const seen = new Set(); const uniq = items.filter(it => { const k = it.kind + ':' + it.id; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!uniq.length) return json(res, 400, { error: 'at least one visible item', code: 'items' });
    const t = now();
    if (c) { Object.assign(c, { title, desc: str(body.desc, 600), scope, org: null, orgName: null, communityId: null, district: null, districtName: null, ...where, items: uniq, updatedAt: t }); }
    else { c = { id: crypto.randomBytes(9).toString('base64url'), title, desc: str(body.desc, 600), scope, org: null, orgName: null, communityId: null, district: null, districtName: null, ...where, items: uniq, by: user.id, byName: user.name, createdAt: t, updatedAt: t }; db.collections.push(c); }
    saveDb(); audit(req, id ? 'collection.edit' : 'collection.new', { user, msg: c.id });
    json(res, 200, { collection: pub(c, user) });
  },
  'POST /api/collections/delete': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such collection' });
    if (!mayEdit(user, c)) return json(res, 403, { error: 'not yours', code: 'who' });
    db.collections = db.collections.filter(x => x.id !== c.id); saveDb(); audit(req, 'collection.delete', { user, msg: c.id });
    json(res, 200, { ok: true });
  }
  };
}
