/* 园内教研组（docs/ROADMAP.md 第六节「园内教研组」）：教研主任发课例研讨任务，组员提交反思；记录进「反思与发展」领域的证据（certificates.js 七领域、portfolio.js 档案）。
 * 任务可以挂一条案例库里的案例（看这个案例，写你的反思），也可以只给题。先交再看别人的（同每周一题）；园长与出题人随时看。
 * 不评分、不排名；谁没交只有出题人看得到，不推送催交。
 *
 * db.studyTasks: { id, org, orgName, title, prompt, caseId|null, dueAt, by, byName, at, closedAt, replies:[{ uid, name, text, at, updatedAt }] }
 * 谁能发：有点评权的人（教研主任 = reviewer）、园长、管理员（指定园）。谁能看：本园。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { canReview } from './submissions.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const WEEK = 7 * 86400000;
export const MIN_REPLY = 100;

export function studyGroupRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin }) {
  db.studyTasks = db.studyTasks || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const find = id => db.studyTasks.find(t => t.id === id);
  const hostsIt = (u, t) => isAdmin(u) || t.by === u.id || (canReview(u, isAdmin) && t.org === orgKeyOf(u));
  const caseOf = id => (id ? (db.cases || []).find(c => c.id === id && c.status === 'approved') : null);
  const pub = (t, user) => {
    const mine = t.replies.find(r => r.uid === user.id), host = hostsIt(user, t), c = caseOf(t.caseId);
    const open = !t.closedAt && now() < t.dueAt;
    return {
      id: t.id, title: t.title, prompt: t.prompt, case: c ? { id: c.id, title: c.title, byName: c.byName } : null, dueAt: t.dueAt, byName: t.byName, at: t.at, closedAt: t.closedAt || null, open,
      replies: t.replies.length, mine: mine ? { text: mine.text, at: mine.updatedAt || mine.at } : null, canHost: host,
      ...(mine || host ? { list: t.replies.sort((a, b) => a.at - b.at).map(r => ({ name: r.name, mine: r.uid === user.id, text: r.text, at: r.updatedAt || r.at })) } : {}),
      ...(host ? { missing: db.users.filter(u => !u.disabled && orgKeyOf(u) === t.org && !isAdmin(u) && u.academy?.role !== 'director' && !t.replies.some(r => r.uid === u.id)).map(u => u.name) } : {})
    };
  };

  return {
  'GET /api/studytasks': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const org = orgKeyOf(user);
    const list = db.studyTasks.filter(t => t.org === org || (isAdmin(user) && !org)).sort((a, b) => (a.closedAt ? 1 : 0) - (b.closedAt ? 1 : 0) || b.at - a.at);
    json(res, 200, { tasks: list.map(t => pub(t, user)), canHost: canReview(user, isAdmin) && !!org, minReply: MIN_REPLY });
  },
  // 发任务或改：{ id?, title, prompt, caseId?, dueAt? }
  'POST /api/studytasks': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const org = orgKeyOf(user);
    if (!canReview(user, isAdmin) || !org) return json(res, 403, { error: 'reviewers and directors of a kindergarten post tasks', code: 'host' });
    const body = await readBody(req);
    let t = body.id ? find(str(body.id, 40)) : null;
    if (body.id && !t) return json(res, 404, { error: 'no such task' });
    if (t && !hostsIt(user, t)) return json(res, 403, { error: 'not your task', code: 'host' });
    const title = str(body.title, 120), prompt = str(body.prompt, 3000);
    if (title.length < 4 || prompt.length < 10) return json(res, 400, { error: 'title and prompt required', code: 'title' });
    const caseId = str(body.caseId, 40) || null;
    if (caseId && !caseOf(caseId)) return json(res, 400, { error: 'no such approved case', code: 'case' });
    const dueAt = Number(body.dueAt) > 946684800000 ? Number(body.dueAt) : (t ? t.dueAt : now() + WEEK);
    if (t) Object.assign(t, { title, prompt, caseId, dueAt, updatedAt: now() });
    else { t = { id: newId(), org, orgName: user.academy?.org?.name || null, title, prompt, caseId, dueAt, by: user.id, byName: user.name, at: now(), closedAt: null, replies: [] }; db.studyTasks.push(t); }
    saveDb();
    audit(req, 'studytask.save', { user, msg: t.id });
    json(res, 200, { task: pub(t, user) });
  },
  // 交反思：{ id, text ≥ 100 字 }。截止前可改
  'POST /api/studytasks/reply': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const t = find(str(body.id, 40));
    if (!t || t.org !== orgKeyOf(user)) return json(res, 404, { error: 'no such task' });
    if (t.closedAt || now() >= t.dueAt) return json(res, 400, { error: 'past due', code: 'closed' });
    const text = str(body.text, 4000);
    if (text.length < MIN_REPLY) return json(res, 400, { error: `at least ${MIN_REPLY} characters`, code: 'text' });
    let r = t.replies.find(x => x.uid === user.id);
    if (r) Object.assign(r, { text, updatedAt: now() });
    else { r = { uid: user.id, name: user.name, text, at: now(), updatedAt: now() }; t.replies.push(r); }
    saveDb();
    audit(req, 'studytask.reply', { user, msg: t.id });
    json(res, 200, { task: pub(t, user) });
  },
  'POST /api/studytasks/close': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const t = find(str(body.id, 40));
    if (!t) return json(res, 404, { error: 'no such task' });
    if (!hostsIt(user, t)) return json(res, 403, { error: 'hosts only', code: 'host' });
    if (!t.closedAt) { t.closedAt = now(); saveDb(); audit(req, 'studytask.close', { user, msg: t.id }); }
    json(res, 200, { task: pub(t, user) });
  }
  };
}
