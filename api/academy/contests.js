/* 线上斗课——同课异构擂台，园内赛（docs/ROADMAP.md 第七节）。首期只做园内赛：教研主任（点评人）或园长出题，本园教师自愿应战。
 *
 * db.contests: { id, org, orgName, month('2026-12'), title(主题), age, activity(活动名), goal(目标), guide(《指南》条目), domain,
 *                openAt, dueAt(提交截止), reviewAt(互评截止), groups:[{ n, entryIds:[], review:{by,byName,text,at}|null }], selected:[entryId],
 *                closedAt, summary, by, byName, at, updatedAt }
 *   阶段 phase：open（应战中）→ review（截止后：编组、互评、对照点评、入选）→ done（收官：全部作品进案例库）
 * db.contestEntries: { id, contestId, uid, name, org, design(活动设计), video:{hash,name,type}|null, note, at, updatedAt,
 *                      ratings:[{ by, byName, scores:[5], comment, at }], caseId }
 * 规矩：票数与分数不公开——作者只看到自己的分与一句话，主持人看平均分用来定入选，谁都看不到别人的分；量表每一项对作品不对人；
 *       没入选的作品也进案例库，标「参赛作品」；入选的标「同课异构 · 月 · 年龄班 领域」，在大讲堂展示。
 * 素材：实施片段 ≤ 3 分钟，幼儿不露脸，拍教师与材料（前端提示，互评把关）。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { canReview } from './submissions.js';

export const RUBRIC = Object.freeze(['目标适切', '环节设计', '师幼互动', '材料运用', '反思']);
const DOMAINS = ['env', 'life', 'play', 'plan', 'obs', 'comm', 'reflect'];
const AGES = ['小班', '中班', '大班', '混龄'];
const WEEK = 7 * 24 * 3600000;
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const HASH = /^[0-9a-f]{64}$/;

export function contestRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, MEDIA, sendMediaFile, ledger = null }) {
  db.contests = db.contests || []; db.contestEntries = db.contestEntries || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const canHost = u => canReview(u, isAdmin);
  const phase = c => (c.closedAt ? 'done' : now() < c.dueAt ? 'open' : 'review');
  const inOrg = (u, c) => isAdmin(u) || orgKeyOf(u) === c.org;
  const entriesOf = id => db.contestEntries.filter(e => e.contestId === id);
  const find = id => db.contests.find(c => c.id === id);
  const avg = e => { const rs = e.ratings; if (!rs.length) return null; const s = rs.reduce((a, r) => a + r.scores.reduce((x, y) => x + (y || 0), 0) / r.scores.filter(Boolean).length, 0); return Math.round(s / rs.length * 10) / 10; };
  const pubEntry = (e, c, user) => {
    const mine = e.uid === user.id, host = canHost(user) && inOrg(user, c), ph = phase(c);
    const g = c.groups.find(x => x.entryIds.includes(e.id));
    const myRating = e.ratings.find(r => r.by === user.id) || null;
    return {
      id: e.id, name: e.name, at: e.at, updatedAt: e.updatedAt, group: g ? g.n : null, selected: c.selected.includes(e.id), caseId: e.caseId || null, mine,
      // 应战期间别人的设计不给看（避免照抄）；截止后同园都能看
      ...(mine || ph !== 'open' ? { design: e.design, video: e.video ? { name: e.video.name, type: e.video.type } : null, note: e.note } : {}),
      ratingsCount: e.ratings.length,
      myRating: myRating ? { scores: myRating.scores, comment: myRating.comment } : null,
      // 作者看自己的分与每条一句话（实名）；主持人看平均分定入选；别人什么分都看不到
      ...(mine ? { ratings: e.ratings.map(r => ({ byName: r.byName, scores: r.scores, comment: r.comment, at: r.at })) } : {}),
      ...(host ? { avg: avg(e) } : {}),
      canRate: ph === 'review' && !mine && inOrg(user, c)
    };
  };
  const pubContest = (c, user, withEntries = false) => {
    const es = entriesOf(c.id), ph = phase(c), host = canHost(user) && inOrg(user, c);
    const mine = es.find(e => e.uid === user.id);
    return {
      id: c.id, orgName: c.orgName, month: c.month, title: c.title, age: c.age, activity: c.activity, goal: c.goal, guide: c.guide, domain: c.domain,
      openAt: c.openAt, dueAt: c.dueAt, reviewAt: c.reviewAt, phase: ph, closedAt: c.closedAt || null, summary: c.summary || '', byName: c.byName,
      entries: es.length, mine: mine ? pubEntry(mine, c, user) : null, selectedCount: c.selected.length, canHost: host, rubric: RUBRIC,
      groups: c.groups.map(g => ({ n: g.n, entryIds: g.entryIds, review: g.review ? { byName: g.review.byName, text: g.review.text, at: g.review.at } : null })),
      ...(withEntries && (ph !== 'open' || host) ? { list: es.sort((a, b) => (c.selected.includes(b.id) ? 1 : 0) - (c.selected.includes(a.id) ? 1 : 0) || a.at - b.at).map(e => pubEntry(e, c, user)) } : {})
    };
  };
  const hostOf = (user, c, res) => { if (!canHost(user) || !inOrg(user, c)) { json(res, 403, { error: 'hosts only (director, reviewer, admin of this kindergarten)', code: 'host' }); return false; } return true; };

  return {
  // 本园的擂台：进行中（应战、互评）与已收官
  'GET /api/contests': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const org = orgKeyOf(user);
    const list = db.contests.filter(c => isAdmin(user) || c.org === org).map(c => pubContest(c, user));
    json(res, 200, { current: list.filter(c => c.phase !== 'done').sort((a, b) => b.openAt - a.openAt), past: list.filter(c => c.phase === 'done').sort((a, b) => b.closedAt - a.closedAt), canHost: canHost(user) && !!org, rubric: RUBRIC });
  },
  'GET /api/contests/one': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const c = find(new URL(req.url, 'http://x').searchParams.get('id') || '');
    if (!c || !inOrg(user, c)) return json(res, 404, { error: 'no such contest' });
    json(res, 200, { contest: pubContest(c, user, true) });
  },
  // 出题或改：{ id?, month, title, age, activity, goal, guide?, domain, dueAt?, reviewAt? }。默认两周后截止、再一周互评。
  'POST /api/contests': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!canHost(user)) return json(res, 403, { error: 'hosts only', code: 'host' });
    const org = orgKeyOf(user);
    if (!org && !isAdmin(user)) return json(res, 400, { error: 'your account has no kindergarten', code: 'org' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let c = id ? find(id) : null;
    if (id && !c) return json(res, 404, { error: 'no such contest' });
    if (c && !inOrg(user, c)) return json(res, 403, { error: 'not your kindergarten', code: 'org' });
    const title = str(body.title, 120), activity = str(body.activity, 120), goal = str(body.goal, 1000);
    if (!title || !activity) return json(res, 400, { error: 'title and activity required', code: 'title' });
    if (!goal) return json(res, 400, { error: 'goal required', code: 'goal' });
    const month = /^\d{4}-\d{2}$/.test(body.month || '') ? body.month : (c ? c.month : new Date().toISOString().slice(0, 7));
    const openAt = c ? c.openAt : now();
    // 截止时间可以改到现在之前：主持人用它提前收稿
    const dueAt = Number(body.dueAt) > 946684800000 ? Number(body.dueAt) : (c ? c.dueAt : openAt + 2 * WEEK);
    const reviewAt = Number(body.reviewAt) > dueAt ? Number(body.reviewAt) : (c && c.reviewAt > dueAt ? c.reviewAt : dueAt + WEEK);
    const fields = { month, title, age: AGES.includes(body.age) ? body.age : (c ? c.age : '中班'), activity, goal, guide: str(body.guide, 1000), domain: DOMAINS.includes(body.domain) ? body.domain : (c ? c.domain : 'plan'), dueAt, reviewAt, updatedAt: now() };
    if (c) Object.assign(c, fields);
    else { c = { id: newId(), org: org || 'admin', orgName: user.academy?.org?.name || null, openAt, ...fields, groups: [], selected: [], closedAt: null, summary: '', by: user.id, byName: user.name, at: now() }; db.contests.push(c); }
    saveDb();
    audit(req, id ? 'contest.edit' : 'contest.new', { user, msg: c.id });
    json(res, 200, { contest: pubContest(c, user, true) });
  },
  'POST /api/contests/delete': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such contest' });
    if (!hostOf(user, c, res)) return;
    if (c.closedAt) return json(res, 400, { error: 'closed contests stay (their works are in the library)', code: 'closed' });
    db.contests = db.contests.filter(x => x.id !== c.id); db.contestEntries = db.contestEntries.filter(e => e.contestId !== c.id); saveDb();
    audit(req, 'contest.delete', { user, msg: c.id });
    json(res, 200, { ok: true });
  },
  // 应战或改自己的：{ id, design(≥100 字), video?:{hash,name,type}|null, note? }。只在应战期。
  'POST /api/contests/enter': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c || !inOrg(user, c)) return json(res, 404, { error: 'no such contest' });
    if (phase(c) !== 'open') return json(res, 400, { error: 'entries are closed', code: 'closed' });
    const design = str(body.design, 8000);
    if (design.length < 100) return json(res, 400, { error: 'the design needs at least 100 characters', code: 'design' });
    let e = db.contestEntries.find(x => x.contestId === c.id && x.uid === user.id);
    let video = e ? e.video : null;
    if (body.video === null) video = null;
    else if (body.video && HASH.test(String(body.video.hash || ''))) {
      if (!MEDIA.file(user.id, body.video.hash)) return json(res, 400, { error: 'upload the clip first', code: 'file' });
      video = { hash: body.video.hash, name: str(body.video.name, 120), type: str(body.video.type, 60) };
    }
    if (e) Object.assign(e, { design, video, note: str(body.note, 1000), updatedAt: now() });
    else { e = { id: newId(), contestId: c.id, uid: user.id, name: user.name, org: orgKeyOf(user), design, video, note: str(body.note, 1000), at: now(), updatedAt: now(), ratings: [], caseId: null }; db.contestEntries.push(e); }
    saveDb();
    audit(req, 'contest.enter', { user, msg: c.id });
    json(res, 200, { contest: pubContest(c, user, true) });
  },
  // 互评：{ entryId, scores:[1..5 ×5], comment }。互评期、同园、不评自己；一人一份，再评就是改。
  'POST /api/contests/rate': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const e = db.contestEntries.find(x => x.id === str(body.entryId, 40));
    const c = e && find(e.contestId);
    if (!e || !c || !inOrg(user, c)) return json(res, 404, { error: 'no such entry' });
    if (phase(c) !== 'review') return json(res, 400, { error: 'rating is open after the deadline and before closing', code: 'phase' });
    if (e.uid === user.id) return json(res, 403, { error: 'not your own', code: 'self' });
    const scores = (Array.isArray(body.scores) ? body.scores : []).slice(0, RUBRIC.length).map(n => { const k = Math.round(Number(n)); return k >= 1 && k <= 5 ? k : null; });
    if (scores.length !== RUBRIC.length || scores.some(s => !s)) return json(res, 400, { error: 'score all five items 1–5', code: 'scores' });
    const comment = str(body.comment, 500);
    if (!comment) return json(res, 400, { error: 'one sentence about the work', code: 'comment' });
    e.ratings = e.ratings.filter(r => r.by !== user.id);
    e.ratings.push({ by: user.id, byName: user.name, scores, comment, at: now() });
    saveDb();
    audit(req, 'contest.rate', { user, msg: e.id });
    json(res, 200, { entry: pubEntry(e, c, user) });
  },
  // 编组：{ id, groups?:[[entryId,...],...] }。不带 groups 就按报名顺序每 3–4 人一组。截止后才能编。
  'POST /api/contests/group': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such contest' });
    if (!hostOf(user, c, res)) return;
    if (phase(c) === 'open') return json(res, 400, { error: 'group after the deadline', code: 'phase' });
    const ids = entriesOf(c.id).sort((a, b) => a.at - b.at).map(e => e.id);
    let groups;
    if (Array.isArray(body.groups)) groups = body.groups.map(g => (Array.isArray(g) ? g : []).map(x => str(String(x || ''), 40)).filter(x => ids.includes(x))).filter(g => g.length);
    else { const size = ids.length % 4 === 0 || ids.length % 4 >= 2 || ids.length < 6 ? 4 : 3; groups = []; for (let i = 0; i < ids.length; i += size) groups.push(ids.slice(i, i + size)); if (groups.length > 1 && groups.at(-1).length === 1) groups[groups.length - 2].push(groups.pop()[0]); }
    const old = new Map(c.groups.map(g => [g.entryIds.join(','), g.review]));
    c.groups = groups.map((entryIds, i) => ({ n: i + 1, entryIds, review: old.get(entryIds.join(',')) || null }));
    saveDb();
    audit(req, 'contest.group', { user, msg: `${c.id} ${groups.length}` });
    json(res, 200, { contest: pubContest(c, user, true) });
  },
  // 对照点评：{ id, group, text }。讲师或教研员对一组写一段「同课异构」对照：各自好在哪、换一个班怎么调。
  'POST /api/contests/review': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such contest' });
    if (!hostOf(user, c, res)) return;
    const g = c.groups.find(x => x.n === Number(body.group));
    if (!g) return json(res, 404, { error: 'no such group' });
    const text = str(body.text, 6000);
    if (text.length < 50) return json(res, 400, { error: 'write the comparison (at least 50 characters)', code: 'text' });
    g.review = { by: user.id, byName: user.name, text, at: now() };
    saveDb();
    audit(req, 'contest.review', { user, msg: `${c.id} g${g.n}` });
    json(res, 200, { contest: pubContest(c, user, true) });
  },
  // 定入选：{ id, entryIds:[...] }
  'POST /api/contests/select': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such contest' });
    if (!hostOf(user, c, res)) return;
    if (c.closedAt) return json(res, 400, { error: 'already closed', code: 'closed' });
    const ids = entriesOf(c.id).map(e => e.id);
    c.selected = (Array.isArray(body.entryIds) ? body.entryIds : []).map(x => str(String(x || ''), 40)).filter(x => ids.includes(x));
    saveDb();
    audit(req, 'contest.select', { user, msg: `${c.id} ${c.selected.length}` });
    json(res, 200, { contest: pubContest(c, user, true) });
  },
  // 收官：{ id, summary? }。全部作品进案例库（已入库状态，署名作者）：入选的标「同课异构 · 月 · 年龄班」，其余标「参赛作品」；每份 +2 学分。
  'POST /api/contests/close': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such contest' });
    if (!hostOf(user, c, res)) return;
    if (c.closedAt) return json(res, 400, { error: 'already closed', code: 'closed' });
    if (phase(c) === 'open') return json(res, 400, { error: 'close after the deadline', code: 'phase' });
    db.cases = db.cases || [];
    const t = now();
    for (const e of entriesOf(c.id)) {
      if (e.caseId) continue;
      const sel = c.selected.includes(e.id);
      const g = c.groups.find(x => x.entryIds.includes(e.id));
      const tag = sel ? `同课异构 · ${c.month} · ${c.age}` : '参赛作品';
      const author = db.users.find(u => u.id === e.uid) || { id: e.uid, name: e.name, academy: null };
      const text = `【${tag}】${c.title}（${c.activity}）\n目标：${c.goal}${c.guide ? '\n《指南》：' + c.guide : ''}\n\n${e.design}${e.note ? '\n\n反思：' + e.note : ''}${g?.review ? '\n\n同课异构对照（' + g.review.byName + '）：' + g.review.text : ''}`;
      const cs = { id: newId(), title: `${c.activity} · ${e.name}${sel ? '（入选）' : ''}`, domain: c.domain, age: c.age, use: sel ? 'adapt' : 'idea', text, files: e.video ? [{ hash: e.video.hash, name: e.video.name, type: e.video.type, owner: e.uid }] : [],
        source: { kind: 'contest', contestId: c.id, entryId: e.id, tag, selected: sel }, by: e.uid, byName: e.name, org: e.org, orgName: author.academy?.org?.name || c.orgName, status: 'approved', note: null, at: t,
        consent: { by: user.id, byName: user.name, at: t }, curated: { by: user.id, byName: user.name, at: t } };
      db.cases.push(cs); e.caseId = cs.id;
      if (ledger) ledger.grant(e.uid, 'case', cs.id, 2, '斗课作品入库：' + c.activity);
    }
    c.closedAt = t; c.summary = str(body.summary, 4000);
    saveDb();
    audit(req, 'contest.close', { user, msg: c.id });
    json(res, 200, { contest: pubContest(c, user, true) });
  },
  // 实施片段：同园、截止后；本人随时
  'GET /api/contests/file': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const q = new URL(req.url, 'http://x').searchParams;
    const e = db.contestEntries.find(x => x.id === q.get('id'));
    const c = e && find(e.contestId);
    if (!e || !c || !e.video || !inOrg(user, c)) return json(res, 404, { error: 'not found' });
    if (e.uid !== user.id && phase(c) === 'open') return json(res, 403, { error: 'after the deadline' });
    const f = MEDIA.file(e.uid, e.video.hash);
    if (!f) return json(res, 404, { error: 'media-missing' });
    await sendMediaFile(res, f, e.video.hash);
  }
  };
}
