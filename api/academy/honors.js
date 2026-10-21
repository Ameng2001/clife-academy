/* 学分台账、勋章与荣誉称号（docs/ROADMAP.md 第七节「荣誉与勋章」「分享激励」）。
 *
 * 学分：关卡学分在客户端状态里（progress → credits），这里只记关卡以外的：案例入库 +2、研讨作答被精选 +2。
 *   db.credits: { uid, kind:'case'|'drill', ref, n, note, at }，同一 (kind, ref) 只记一次。
 * 勋章：不存，按记录算（条件公开，见 BADGES）。成长勋章看路径完成；贡献勋章看案例、精选、点评次数、带教。
 *   不按在线时长、登录天数发任何东西；不做勋章墙排行。
 * 荣誉称号：人授。db.titles: { id, uid, name, org, title, label, reason, by, byName, at }
 *   园长授本园的人，管理员（本地运营方）授任何人；必须写授予理由；颁发在大讲堂或园内活动上，线上只是记录。
 * 称号与勋章显示在本人页、案例署名旁、研讨作答署名旁。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { ROLE_PATH, PATH_LEN, PATH_NAMES } from './events-data.js';
import { earnedOf, KIND_LABEL } from './certificates.js';

export const TITLES = Object.freeze({ seed: '种子教师', sharer: '年度分享者', contest: '同课异构入选', studio: '名师工作室成员', custom: '' });
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** 关卡以外的学分台账。 */
export function createLedger(db) {
  db.credits = db.credits || [];
  return {
    grant(uid, kind, ref, n, note) {
      if (db.credits.some(c => c.uid === uid && c.kind === kind && c.ref === ref)) return false;
      db.credits.push({ uid, kind, ref, n, note: str(note, 120), at: Date.now() }); return true;
    },
    of: uid => db.credits.filter(c => c.uid === uid).sort((a, b) => b.at - a.at),
    total: uid => db.credits.filter(c => c.uid === uid).reduce((s, c) => s + c.n, 0)
  };
}

const THRESHOLDS = { cases: [1, 5, 20], featured: [1, 5], reviews: [20], answers: [10] };
export const HELPFUL_MIN = 5;
/** 一个人的勋章。stateOf(uid) 给客户端状态（progress）。 */
export function badgesOf(uid, { db, stateOf, pairs }) {
  const out = [];
  const S = stateOf(uid) || {}, prog = S.progress && typeof S.progress === 'object' ? S.progress : {};
  const finished = path => { const n = PATH_LEN[path] || 0; let d = 0; while (d < n && prog[`${path}-${d}`]?.passedAt) d++; return n > 0 && d >= n ? prog[`${path}-${n - 1}`].passedAt : null; };
  for (const path of Object.keys(PATH_LEN)) {
    const at = finished(path);
    const role = Object.values(ROLE_PATH).includes(path);
    out.push({ key: `path-${path}`, kind: 'growth', name: `${PATH_NAMES[path] || path}路径`, desc: role ? '完成本岗位路径全部关卡' : '完成这条领域路径全部关卡', on: !!at, at });
  }
  // 证书类成长勋章：岗位数智应用认证、各领域研修证书、七领域都有证据、骨干教师认证（条件在 certificates.js）
  const e = earnedOf(uid, { db, stateOf });
  if (e.tool) out.push({ key: 'cert-tool', kind: 'growth', name: KIND_LABEL.tool, desc: `完成${e.tool.name}路径，测验正确率 ≥ 80%`, on: e.tool.ok, at: e.tool.at, progress: e.tool.done, of: e.tool.total });
  for (const d of e.domains) out.push({ key: `cert-${d.path}`, kind: 'growth', name: `${d.name}研修证书`, desc: '走完这条领域路径，实践关作品全部通过点评', on: d.ok, at: d.at, progress: d.done + d.works, of: d.total + d.worksTotal });
  // 练习营结营（camps.js）：结营时发过帖的营员；中途退出的没有任何记录
  for (const c of (db.camps || [])) if (c.closedAt && (c.graduates || []).includes(uid)) out.push({ key: `camp-${c.id}`, kind: 'growth', name: `结营 · ${c.title}`, desc: '自愿练习营结营', on: true, at: c.closedAt });
  out.push({ key: 'seven', kind: 'growth', name: '七领域都有证据', desc: '七个专业领域各至少一条证据：通过的关、通过的作品或研讨作答', on: e.seven.ok, at: null, progress: e.seven.have, of: e.seven.of });
  out.push({ key: 'backbone', kind: 'growth', name: KIND_LABEL.backbone, desc: '三条领域研修证书 ＋ 一份园本案例 ＋ 线下答辩（按学期开班）', on: e.backbone.ok, at: e.backbone.at, progress: Math.min(e.backbone.domainCerts, 3) + Math.min(e.backbone.cases, 1), of: 4 });
  const cases = (db.cases || []).filter(c => c.by === uid && c.status === 'approved').map(c => c.curated?.at || c.at).sort((a, b) => a - b);
  for (const n of THRESHOLDS.cases) out.push({ key: `cases-${n}`, kind: 'contribution', name: n === 1 ? '第一条案例' : `案例 ${n} 条`, desc: `案例被采纳 ${n} 条`, on: cases.length >= n, at: cases[n - 1] || null, progress: Math.min(cases.length, n), of: n });
  const feat = (db.drillAnswers || []).filter(a => a.uid === uid && a.review?.featured).map(a => a.review.at).sort((a, b) => a - b);
  for (const n of THRESHOLDS.featured) out.push({ key: `featured-${n}`, kind: 'contribution', name: n === 1 ? '第一次精选' : `精选 ${n} 次`, desc: `研讨作答被标精选 ${n} 次`, on: feat.length >= n, at: feat[n - 1] || null, progress: Math.min(feat.length, n), of: n });
  // 点评 20 次且被标「有帮助」≥ 5 次（ROADMAP 第七节）：被标的是作品或作答的作者自己点的，点评人看不到谁没点
  const rv = [...(db.submissions || []).filter(s => s.review?.by === uid).map(s => s.review), ...(db.drillAnswers || []).filter(a => a.review?.by === uid).map(a => a.review)];
  const reviews = rv.map(r => r.at).sort((a, b) => a - b), helpful = rv.filter(r => r.helpful).map(r => r.helpful).sort((a, b) => a - b);
  for (const n of THRESHOLDS.reviews) { const ok = reviews.length >= n && helpful.length >= HELPFUL_MIN; out.push({ key: `reviews-${n}`, kind: 'contribution', name: `点评 ${n} 次且有帮助`, desc: `给同事的作品与作答写过 ${n} 次意见，其中至少 ${HELPFUL_MIN} 次被作者标「有帮助」 · 已点评 ${reviews.length}，被标 ${helpful.length}`, on: ok, at: ok ? Math.max(reviews[n - 1], helpful[HELPFUL_MIN - 1]) : null, progress: Math.min(reviews.length, n) + Math.min(helpful.length, HELPFUL_MIN), of: n + HELPFUL_MIN }); }
  const acc = (db.questions || []).flatMap(q => q.answers.filter(a => a.by === uid && a.accepted).map(a => a.acceptedAt || a.at)).sort((a, b) => a - b);
  for (const n of THRESHOLDS.answers) out.push({ key: `answers-${n}`, kind: 'contribution', name: `答疑被采纳 ${n} 次`, desc: `回答同事的提问，被提问人采纳 ${n} 次`, on: acc.length >= n, at: acc[n - 1] || null, progress: Math.min(acc.length, n), of: n });
  if (pairs) {
    const mentees = pairs.menteesOf(uid), done = mentees.map(m => { const u = (db.users || []).find(x => x.id === m); const path = u && ROLE_PATH[u.academy?.role]; const ats = [path ? finishedFor(m, path, stateOf) : null, PATH_LEN.onboard ? finishedFor(m, 'onboard', stateOf) : null].filter(Boolean); return ats.length ? Math.min(...ats) : null; }).filter(Boolean);
    out.push({ key: 'mentor', kind: 'contribution', name: '带出一个人', desc: '带教的新教师完成了入职路径或本岗位路径', on: done.length > 0, at: done.length ? Math.min(...done) : null, progress: done.length ? 1 : 0, of: 1 });
  }
  return out;
}
function finishedFor(uid, path, stateOf) { const S = stateOf(uid) || {}, prog = S.progress || {}; const n = PATH_LEN[path] || 0; let d = 0; while (d < n && prog[`${path}-${d}`]?.passedAt) d++; return n > 0 && d >= n ? prog[`${path}-${n - 1}`].passedAt : null; }

/** 园所集体荣誉（ROADMAP 第七节）：系统按园统计。全园该走这条路径的人都走完了（≥ 3 人才算）；本园案例被外园用过 ≥ 10 次。只给本园看，不跨园比。 */
export const ORG_USES_MIN = 10;
export function orgBadgesOf(orgKey, { db, stateOf, isAdmin, orgKeyOf }) {
  const out = [];
  const members = (db.users || []).filter(u => !u.disabled && orgKeyOf(u) === orgKey && !isAdmin(u));
  for (const path of Object.keys(PATH_LEN)) {
    const role = Object.values(ROLE_PATH).includes(path);
    const who = role ? members.filter(u => ROLE_PATH[u.academy?.role] === path) : members;
    if (who.length < 3) continue;
    const ats = who.map(u => finishedFor(u.id, path, stateOf));
    const done = ats.filter(Boolean).length;
    out.push({ key: `org-path-${path}`, name: `全园走完「${PATH_NAMES[path] || path}」`, desc: role ? `本园该岗位的 ${who.length} 人都走完本岗位路径` : `本园 ${who.length} 人都走完这条领域路径`, on: done === who.length, at: done === who.length ? Math.max(...ats) : null, progress: done, of: who.length });
  }
  const ids = new Set((db.cases || []).filter(c => c.status === 'approved' && c.org === orgKey).map(c => c.id));
  const uses = (db.caseUses || []).filter(u => ids.has(u.caseId)).filter(u => { const x = (db.users || []).find(y => y.id === u.uid); return x && orgKeyOf(x) !== orgKey; }).map(u => u.at).sort((a, b) => a - b);
  out.push({ key: 'org-uses', name: `本园案例被外园用过 ${ORG_USES_MIN} 次`, desc: '外园教师标「用过，有效」的次数', on: uses.length >= ORG_USES_MIN, at: uses[ORG_USES_MIN - 1] || null, progress: Math.min(uses.length, ORG_USES_MIN), of: ORG_USES_MIN });
  return out;
}

/** 一个人现有的称号（给署名旁用）。 */
export const titlesOf = (db, uid) => (db.titles || []).filter(t => t.uid === uid).map(t => ({ id: t.id, title: t.title, label: t.label, at: t.at }));

export function honorRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, readStateCached, pairs = null, ledger }) {
  db.titles = db.titles || [];
  const isDirector = u => u.academy?.role === 'director';
  const pubTitle = t => ({ id: t.id, uid: t.uid, name: t.name, title: t.title, label: t.label, reason: t.reason, byName: t.byName, at: t.at });
  return {
  // 本园集体荣誉：本园的人都能看；不跨园
  'GET /api/org/honors': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const org = orgKeyOf(user);
    if (!org) return json(res, 400, { error: 'your account has no kindergarten', code: 'org' });
    json(res, 200, { orgName: user.academy?.org?.name || null, badges: orgBadgesOf(org, { db, stateOf: readStateCached, isAdmin, orgKeyOf }) });
  },
  // 本人：勋章、称号、关卡以外的学分
  'GET /api/me/honors': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { badges: badgesOf(user.id, { db, stateOf: readStateCached, pairs }), titles: db.titles.filter(t => t.uid === user.id).sort((a, b) => b.at - a.at).map(pubTitle), credits: ledger.of(user.id), creditsTotal: ledger.total(user.id), titleNames: TITLES });
  },
  // 园长看本园授过的称号；管理员看全部
  'GET /api/org/titles': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isDirector(user) && !isAdmin(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const org = orgKeyOf(user);
    const list = db.titles.filter(t => isAdmin(user) || (org && t.org === org)).sort((a, b) => b.at - a.at);
    json(res, 200, { titles: list.map(pubTitle), titleNames: TITLES });
  },
  // 授称号：{ uid, title, label?, reason }。园长授本园的人，管理员授任何人；理由必填，不能授自己。
  'POST /api/org/titles': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isDirector(user) && !isAdmin(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const body = await readBody(req);
    const t = db.users.find(u => u.id === String(body.uid || ''));
    if (!t) return json(res, 404, { error: 'no such user' });
    if (t.id === user.id) return json(res, 403, { error: 'not yourself', code: 'self' });
    if (!isAdmin(user) && (!orgKeyOf(user) || orgKeyOf(t) !== orgKeyOf(user))) return json(res, 403, { error: 'not in your kindergarten', code: 'org' });
    const title = Object.hasOwn(TITLES, body.title) ? body.title : null;
    const label = title === 'custom' ? str(body.label, 20) : (title ? TITLES[title] : '');
    if (!title || !label) return json(res, 400, { error: 'pick a title (custom needs a label)', code: 'title' });
    const reason = str(body.reason, 500);
    if (reason.length < 5) return json(res, 400, { error: 'write why (at least 5 characters)', code: 'reason' });
    const row = { id: crypto.randomBytes(9).toString('base64url'), uid: t.id, name: t.name, org: orgKeyOf(t), title, label, reason, by: user.id, byName: user.name, at: Date.now() };
    db.titles.push(row); saveDb();
    audit(req, 'title.grant', { user, msg: `${t.id} ${label}` });
    json(res, 200, { title: pubTitle(row) });
  },
  'POST /api/org/titles/revoke': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const row = db.titles.find(t => t.id === str(body.id, 40));
    if (!row) return json(res, 404, { error: 'no such title' });
    if (!isAdmin(user) && !(isDirector(user) && row.org && row.org === orgKeyOf(user))) return json(res, 403, { error: 'not allowed', code: 'org' });
    db.titles = db.titles.filter(t => t.id !== row.id); saveDb();
    audit(req, 'title.revoke', { user, msg: row.id });
    json(res, 200, { ok: true });
  }
  };
}
