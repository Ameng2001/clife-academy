/* 自愿练习营（docs/ROADMAP.md 第七节「分享激励 · 自愿练习营」）：「21 天观察记录练习营」这类短期活动。
 * 报名、每天一个小任务、营内互看、营末讲师总评；中途退出无任何记录（人和帖子一起删）；结营给成长勋章（honors.js 按 graduates 发）。
 * 不做打卡：没发的那天什么都不记，不提醒、不统计连续天数；只有发了的帖子。
 *
 * db.camps: { id, title, intro, days:[任务文字], startAt, org|null(全平台), orgName, by, byName, at, closedAt, summary, graduates:[uid],
 *             members:[{ uid, name, orgName, joinedAt }], posts:[{ id, uid, name, day, text, at, updatedAt }] }
 * 谁能办：管理员（全平台或指定本园）、园长（本园）。谁能看：范围内的人；帖子只有营员看（营内互看）。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { LEARN } from './honors.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const DAY = 86400000;
export const MAX_DAYS = 30;

export function campRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, ledger = null }) {
  db.camps = db.camps || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const find = id => db.camps.find(c => c.id === id);
  const canHost = u => isAdmin(u) || u.academy?.role === 'director';
  const hostsIt = (u, c) => isAdmin(u) || (c.by === u.id) || (u.academy?.role === 'director' && c.org && c.org === orgKeyOf(u));
  const inScope = (u, c) => !c.org || c.org === orgKeyOf(u) || isAdmin(u);
  const dayOf = (c, t = now()) => Math.floor((t - c.startAt) / DAY);   // 第几天（0 起）；开营前为负
  const phase = c => (c.closedAt ? 'done' : now() < c.startAt ? 'upcoming' : dayOf(c) < c.days.length ? 'running' : 'ended');
  const pub = (c, user) => {
    const me = c.members.find(m => m.uid === user.id), today = dayOf(c);
    return {
      id: c.id, title: c.title, intro: c.intro, days: c.days, startAt: c.startAt, scope: c.org ? 'org' : 'all', orgName: c.orgName || null, byName: c.byName, phase: phase(c), closedAt: c.closedAt || null, summary: c.summary || '',
      members: c.members.length, mine: !!me, today: Math.max(0, Math.min(today, c.days.length - 1)), canHost: hostsIt(user, c), graduated: (c.graduates || []).includes(user.id),
      ...(me || hostsIt(user, c) ? { posts: c.posts.sort((a, b) => a.day - b.day || a.at - b.at).map(p => ({ id: p.id, day: p.day, name: p.name, mine: p.uid === user.id, text: p.text, at: p.updatedAt || p.at })) } : {})
    };
  };

  return {
  'GET /api/camps': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const list = db.camps.filter(c => inScope(user, c)).sort((a, b) => (a.closedAt ? 1 : 0) - (b.closedAt ? 1 : 0) || b.startAt - a.startAt);
    json(res, 200, { camps: list.map(c => pub(c, user)), canHost: canHost(user), maxDays: MAX_DAYS });
  },
  // 办一个或改：{ id?, title, intro?, days:[...], startAt, scope:'org'|'all' }。开营后只能改文案
  'POST /api/camps': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!canHost(user)) return json(res, 403, { error: 'admins and directors host camps', code: 'host' });
    const body = await readBody(req);
    let c = body.id ? find(str(body.id, 40)) : null;
    if (body.id && !c) return json(res, 404, { error: 'no such camp' });
    if (c && !hostsIt(user, c)) return json(res, 403, { error: 'not your camp', code: 'host' });
    const title = str(body.title, 80), intro = str(body.intro, 1000);
    if (title.length < 4) return json(res, 400, { error: 'title too short', code: 'title' });
    const days = (Array.isArray(body.days) ? body.days : []).map(d => str(d, 300)).filter(Boolean).slice(0, MAX_DAYS);
    if (days.length < 3) return json(res, 400, { error: 'at least 3 days of tasks', code: 'days' });
    const startAt = Number(body.startAt) > 946684800000 ? Number(body.startAt) : (c ? c.startAt : now() + DAY);
    const all = isAdmin(user) && body.scope === 'all';
    const org = all ? null : (c ? c.org : orgKeyOf(user));
    if (!all && !org) return json(res, 400, { error: 'your account has no kindergarten', code: 'org' });
    if (c) Object.assign(c, { title, intro, days: c.members.length && phase(c) !== 'upcoming' ? c.days : days, startAt: phase(c) === 'upcoming' ? startAt : c.startAt, updatedAt: now() });
    else { c = { id: newId(), title, intro, days, startAt, org, orgName: org ? (user.academy?.org?.name || null) : null, by: user.id, byName: user.name, at: now(), closedAt: null, summary: '', graduates: [], members: [], posts: [] }; db.camps.push(c); }
    saveDb();
    audit(req, 'camp.save', { user, msg: c.id });
    json(res, 200, { camp: pub(c, user) });
  },
  'POST /api/camps/join': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c || !inScope(user, c)) return json(res, 404, { error: 'no such camp' });
    if (c.closedAt || phase(c) === 'ended') return json(res, 400, { error: 'camp is over', code: 'closed' });
    if (!c.members.some(m => m.uid === user.id)) { c.members.push({ uid: user.id, name: user.name, orgName: user.academy?.org?.name || null, joinedAt: now() }); saveDb(); audit(req, 'camp.join', { user, msg: c.id }); }
    json(res, 200, { camp: pub(c, user) });
  },
  // 退营：人和帖子一起删，不留记录
  'POST /api/camps/leave': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such camp' });
    if (c.closedAt) return json(res, 400, { error: 'camp is closed', code: 'closed' });
    c.members = c.members.filter(m => m.uid !== user.id); c.posts = c.posts.filter(p => p.uid !== user.id);
    saveDb();
    json(res, 200, { camp: pub(c, user) });
  },
  // 发当天的小任务：{ id, day, text }。只能发到今天为止的那几天；一人一天一帖，再发就是改
  'POST /api/camps/post': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c || !c.members.some(m => m.uid === user.id)) return json(res, 404, { error: 'not in this camp', code: 'member' });
    if (c.closedAt) return json(res, 400, { error: 'camp is closed', code: 'closed' });
    const day = Math.round(Number(body.day));
    if (!(day >= 0 && day < c.days.length)) return json(res, 400, { error: 'no such day', code: 'day' });
    if (day > dayOf(c)) return json(res, 400, { error: 'that day has not come', code: 'early' });
    const text = str(body.text, 2000);
    if (text.length < 20) return json(res, 400, { error: 'at least 20 characters', code: 'text' });
    let p = c.posts.find(x => x.uid === user.id && x.day === day);
    if (p) Object.assign(p, { text, updatedAt: now() });
    else { p = { id: newId(), uid: user.id, name: user.name, day, text, at: now(), updatedAt: now() }; c.posts.push(p); if (ledger?.interact) ledger.interact(user.id, 'campPost', `camp:${c.id}:${day}`, `练习营「${c.title.slice(0, 20)}」第 ${day + 1} 天的帖子`); }
    saveDb();
    json(res, 200, { camp: pub(c, user) });
  },
  // 结营：{ id, summary }。讲师总评；发过帖的营员记为结营，成长勋章由 honors.js 按 graduates 算
  'POST /api/camps/close': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such camp' });
    if (!hostsIt(user, c)) return json(res, 403, { error: 'hosts only', code: 'host' });
    if (c.closedAt) return json(res, 400, { error: 'already closed', code: 'closed' });
    const summary = str(body.summary, 3000);
    if (summary.length < 20) return json(res, 400, { error: 'write the closing review (at least 20 characters)', code: 'summary' });
    c.summary = summary; c.closedAt = now();
    c.graduates = c.members.filter(m => c.posts.some(p => p.uid === m.uid)).map(m => m.uid);
    if (ledger?.grant) for (const uid of c.graduates) ledger.grant(uid, 'camp', c.id, LEARN.camp, `练习营「${c.title.slice(0, 20)}」结营`);
    saveDb();
    audit(req, 'camp.close', { user, msg: `${c.id} ${c.graduates.length}` });
    json(res, 200, { camp: pub(c, user) });
  }
  };
}
