/* 研讨关「每周一题」（docs/ROADMAP.md 第六节：同园可见，作答、看他人作答、点评）。
 *
 * db.drills:       { id, title(题干), context(背景), role(面向岗位|''), domain, scope:'all'|<org key>|'community:<id>', orgName, communityName, openAt, closeAt, by, byName, at, updatedAt }
 * db.drillAnswers: { id, drillId, uid, name, role, org, orgName, text, at, updatedAt, review:{ by, byName, at, comment, featured } | null }
 *
 * 谁出题：管理员（本地运营方，面向全平台）、园长（只面向本园）、区县管理员（面向本区一个共同体：联合研讨关，组内各园互相看得到作答）。每周一题是运营节奏，不是系统限制：题可以多出，也可以晚答。
 * 谁能答：登录的人；一人一题一份，改了算最新（已点评的改了保留点评，点评人看得到改过）。
 * 谁能看别人的：同园、且自己已作答（先答再看，避免抄）；点评人与带教教师不用先答。
 * 点评：园长、点评人、管理员，或作答人的带教教师；只写一句意见，可标「精选」。评作品不评人：没有分数、没有排名、不公布人数以外的任何对比。
 * 作答被点评后给作答人一条订阅消息（review 模板）；被精选 +2 学分（honors.js 台账，一份作答只记一次）。不做「本周还没答」的催促。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { canReview } from './submissions.js';
import { titlesOf } from './honors.js';
import { isDistrictAdmin, districtKeyOf } from './district.js';

const DOMAINS = ['env', 'life', 'play', 'plan', 'obs', 'comm', 'reflect'];
const ROLES = ['director', 'nurse', 'teacher', 'care', 'it'];
const WEEK = 7 * 24 * 3600000;
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');

export function drillRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, notifier = null, pairs = null, ledger = null, communities = null }) {
  db.drills = db.drills || []; db.drillAnswers = db.drillAnswers || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const isDirector = u => u.academy?.role === 'director';
  const communityIdOf = d => (String(d.scope || '').startsWith('community:') ? d.scope.slice(10) : null);
  const communityOf = d => { const id = communityIdOf(d); return id && communities ? communities.byId(id) : null; };
  // 共同体题：本园在该组里就看得到；区县管理员看本区的组的题
  const visibleTo = (d, user) => d.scope === 'all' || d.scope === orgKeyOf(user) || (!!communityIdOf(d) && ((communities && communities.ofOrg(orgKeyOf(user))?.id === communityIdOf(d)) || (isDistrictAdmin(user) && communityOf(d)?.district === districtKeyOf(user))));
  const mayPost = user => isAdmin(user) || (isDirector(user) && !!orgKeyOf(user)) || (isDistrictAdmin(user) && !!communities && !!districtKeyOf(user));
  const mayEdit = (user, d) => isAdmin(user) || (d.by === user.id) || (isDirector(user) && d.scope === orgKeyOf(user)) || (isDistrictAdmin(user) && !!communityIdOf(d) && communityOf(d)?.district === districtKeyOf(user));
  // 同组：共同体题里，作答按组圈；其他题按园圈
  const peersOf = (d, user) => { const org = orgKeyOf(user); const id = communityIdOf(d); return id && communities ? new Set(communities.orgKeysOf(id)) : new Set(org ? [org] : []); };
  const answersOf = id => db.drillAnswers.filter(a => a.drillId === id);
  const myAnswer = (id, uid) => db.drillAnswers.find(a => a.drillId === id && a.uid === uid) || null;
  // 点评仍按园：共同体题里也只有本园的园长 / 点评人、作答人的带教教师能点评（评作品不评人，不跨园给意见）
  const mayReviewAnswer = (user, a) => (canReview(user, isAdmin) && (isAdmin(user) || a.org === orgKeyOf(user))) || !!(pairs && pairs.isMentorOf(user.id, a.uid));
  const pubAnswer = (a, user) => ({ id: a.id, uid: a.uid, name: a.name, titles: titlesOf(db, a.uid).map(t => t.label), role: a.role, orgName: a.orgName, text: a.text, at: a.at, updatedAt: a.updatedAt, review: a.review, mine: a.uid === user.id, canReview: a.uid !== user.id && mayReviewAnswer(user, a) });
  const pubDrill = (d, user) => {
    const t = now(), peers = peersOf(d, user);
    const all = answersOf(d.id), mine = myAnswer(d.id, user.id);
    return {
      id: d.id, title: d.title, context: d.context, role: d.role, domain: d.domain, scope: d.scope === 'all' ? 'all' : communityIdOf(d) ? 'community' : 'org', orgName: d.orgName, communityName: d.communityName || null, communityId: communityIdOf(d), openAt: d.openAt, closeAt: d.closeAt, byName: d.byName,
      phase: t < d.openAt ? 'upcoming' : t < d.closeAt ? 'open' : 'closed',
      mine: mine ? pubAnswer(mine, user) : null,
      // 人数只给本园的（同园可见）；管理员看全部
      answered: isAdmin(user) ? all.length : all.filter(a => peers.has(a.org)).length,
      featured: all.filter(a => a.review?.featured).length,
      canEdit: mayEdit(user, d)
    };
  };
  const find = id => db.drills.find(d => d.id === id);

  return {
  // 本人看得到的题：current（开放中，按开放时间倒序，第一条是本周）与 past；?q= 搜题干
  'GET /api/drills': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const q = norm(new URL(req.url, 'http://x').searchParams.get('q'));
    let list = db.drills.filter(d => visibleTo(d, user) && d.openAt <= now());
    if (q) list = list.filter(d => norm(d.title + d.context).includes(q));
    const rows = list.map(d => pubDrill(d, user));
    const current = rows.filter(d => d.phase === 'open').sort((a, b) => b.openAt - a.openAt);
    const past = rows.filter(d => d.phase === 'closed').sort((a, b) => b.closeAt - a.closeAt);
    const upcoming = mayPost(user) ? db.drills.filter(d => visibleTo(d, user) && d.openAt > now()).map(d => pubDrill(d, user)).sort((a, b) => a.openAt - b.openAt) : [];
    json(res, 200, { current, past, upcoming, canPost: mayPost(user), postScope: isAdmin(user) ? 'all' : isDistrictAdmin(user) ? 'community' : 'org' });
  },
  // 出题或改：{ id?, title, context?, role?, domain?, openAt?, closeAt? }。管理员面向全平台，园长只面向本园。默认今天开放、七天后收。
  'POST /api/drills': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!mayPost(user)) return json(res, 403, { error: 'admins and directors only', code: 'poster' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let d = id ? find(id) : null;
    if (id && !d) return json(res, 404, { error: 'no such drill' });
    if (d && !mayEdit(user, d)) return json(res, 403, { error: 'not yours', code: 'owner' });
    const title = str(body.title, 600);
    if (title.length < 10) return json(res, 400, { error: 'the question needs at least 10 characters', code: 'title' });
    const openAt = Number.isFinite(Number(body.openAt)) && Number(body.openAt) > 946684800000 ? Number(body.openAt) : (d ? d.openAt : now());
    const closeAt = Number.isFinite(Number(body.closeAt)) && Number(body.closeAt) > openAt ? Number(body.closeAt) : (d && d.closeAt > openAt ? d.closeAt : openAt + WEEK);
    const fields = { title, context: str(body.context, 2000), role: ROLES.includes(body.role) ? body.role : '', domain: DOMAINS.includes(body.domain) ? body.domain : (d ? d.domain : 'comm'), openAt, closeAt, updatedAt: now() };
    if (d) Object.assign(d, fields);
    else {
      let scope, communityName = null;
      if (isDistrictAdmin(user) && !isAdmin(user)) {
        const c = communities.byId(str(body.communityId, 40));
        if (!c || c.district !== districtKeyOf(user)) return json(res, 400, { error: 'pick a community of your district', code: 'community' });
        scope = 'community:' + c.id; communityName = c.name;
      } else scope = isAdmin(user) && body.scope !== 'org' ? 'all' : orgKeyOf(user);
      d = { id: newId(), ...fields, scope, orgName: scope === 'all' || communityName ? null : (user.academy?.org?.name || null), communityName, by: user.id, byName: user.name, at: now() };
      db.drills.push(d);
    }
    saveDb();
    audit(req, id ? 'drill.edit' : 'drill.new', { user, msg: d.id });
    json(res, 200, { drill: pubDrill(d, user) });
  },
  'POST /api/drills/delete': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const d = find(str(body.id, 40));
    if (!d) return json(res, 404, { error: 'no such drill' });
    if (!mayEdit(user, d)) return json(res, 403, { error: 'not yours', code: 'owner' });
    db.drills = db.drills.filter(x => x.id !== d.id); db.drillAnswers = db.drillAnswers.filter(a => a.drillId !== d.id); saveDb();
    audit(req, 'drill.delete', { user, msg: d.id });
    json(res, 200, { ok: true });
  },
  // 作答或改自己的：{ id, text ≥ 20 字 }
  'POST /api/drills/answer': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const d = find(str(body.id, 40));
    if (!d || !visibleTo(d, user)) return json(res, 404, { error: 'no such drill' });
    if (d.openAt > now()) return json(res, 400, { error: 'not open yet', code: 'closed' });
    const text = str(body.text, 2000);
    if (text.length < 20) return json(res, 400, { error: 'say more: at least 20 characters', code: 'empty' });
    let a = myAnswer(d.id, user.id);
    if (a) { a.text = text; a.updatedAt = now(); }
    else { a = { id: newId(), drillId: d.id, uid: user.id, name: user.name, role: user.academy?.role || '', org: orgKeyOf(user), orgName: user.academy?.org?.name || null, text, at: now(), updatedAt: now(), review: null }; db.drillAnswers.push(a); }
    saveDb();
    audit(req, 'drill.answer', { user, msg: d.id });
    json(res, 200, { drill: pubDrill(d, user) });
  },
  // 一题的作答：同园的（自己先答了才看得到，点评人与带教教师例外）；管理员看全部。精选在前，其余按时间。
  'GET /api/drills/answers': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const d = find(new URL(req.url, 'http://x').searchParams.get('id') || '');
    if (!d || !visibleTo(d, user)) return json(res, 404, { error: 'no such drill' });
    const peers = peersOf(d, user), mine = myAnswer(d.id, user.id);
    const reviewer = canReview(user, isAdmin), mentees = pairs ? pairs.menteesOf(user.id) : [];
    // 区县管理员看本区共同体题的作答（出题人要看题答得怎么样），不用先答
    const host = isDistrictAdmin(user) && !!communityIdOf(d) && communityOf(d)?.district === districtKeyOf(user);
    if (!mine && !reviewer && !mentees.length && !host) return json(res, 200, { drill: pubDrill(d, user), answers: [], locked: true });
    let list = answersOf(d.id).filter(a => isAdmin(user) || host || peers.has(a.org) || mentees.includes(a.uid));
    if (!mine && !reviewer && !host) list = list.filter(a => mentees.includes(a.uid));
    list.sort((a, b) => (b.review?.featured ? 1 : 0) - (a.review?.featured ? 1 : 0) || b.at - a.at);
    json(res, 200, { drill: pubDrill(d, user), answers: list.slice(0, 200).map(a => pubAnswer(a, user)), locked: false });
  },
  // 点评一份作答：{ answerId, comment, featured? }。一句意见即可；精选的在列表里排前面。
  // 作答人标点评「有帮助」：{ answerId, on:true|false }
  'POST /api/drills/helpful': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const a = db.drillAnswers.find(x => x.id === String(body.answerId || '') && x.uid === user.id);
    if (!a) return json(res, 404, { error: 'no such answer' });
    if (!a.review) return json(res, 400, { error: 'not reviewed yet', code: 'review' });
    a.review.helpful = body.on === false ? null : (a.review.helpful || now());
    saveDb();
    audit(req, 'drill.helpful', { user, msg: `${a.id} ${a.review.helpful ? 'on' : 'off'}` });
    json(res, 200, { answer: pubAnswer(a, user) });
  },
  'POST /api/drills/review': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const a = db.drillAnswers.find(x => x.id === str(body.answerId, 40));
    if (!a) return json(res, 404, { error: 'no such answer' });
    if (a.uid === user.id) return json(res, 403, { error: 'not your own', code: 'self' });
    if (!mayReviewAnswer(user, a)) return json(res, 403, { error: 'not in your kindergarten', code: 'org' });
    const comment = str(body.comment, 1000);
    if (!comment) return json(res, 400, { error: 'write a comment', code: 'comment' });
    a.review = { by: user.id, byName: user.name, at: now(), comment, featured: body.featured === true };
    const d0 = find(a.drillId);
    if (a.review.featured && ledger) ledger.grant(a.uid, 'drill', a.id, 2, '研讨作答被精选：' + (d0 ? d0.title.slice(0, 30) : ''));
    saveDb();
    audit(req, 'drill.review', { user, msg: a.id });
    const d = find(a.drillId);
    json(res, 200, { answer: pubAnswer(a, user) });
    if (notifier && d) notifier.send(a.uid, 'review', { title: d.title, verdict: a.review.featured ? '精选' : '点评', at: a.review.at, comment, by: user.name }, 'pages/drill/drill');
  }
  };
}
