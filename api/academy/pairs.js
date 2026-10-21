/* 带教配对（docs/ROADMAP.md 第六节）：园内，新教师与骨干配对，由园长设；带教教师看得到对方的实践关作品并点评。
 *
 * db.pairs: { id, org, mentor, mentee, by, at, endedAt: null | ts }
 * 一个被带教的人同时只有一个带教教师：新配对会结束旧的。配对只在同园。
 * 带教教师的点评权只覆盖所带的人（submissions.js 用 mentorOf / menteesOf 判）。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';

export function createPairs(db) {
  db.pairs = db.pairs || [];
  const active = () => db.pairs.filter(p => !p.endedAt);
  return {
    mentorOf: uid => active().find(p => p.mentee === uid)?.mentor || null,
    menteesOf: uid => active().filter(p => p.mentor === uid).map(p => p.mentee),
    isMentorOf: (mentor, mentee) => active().some(p => p.mentor === mentor && p.mentee === mentee),
    inOrg: org => active().filter(p => p.org === org),
    all: active
  };
}

export function pairRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, pairs }) {
  const who = uid => { const u = db.users.find(x => x.id === uid); return u ? { id: u.id, name: u.name, role: u.academy?.role || null } : { id: uid, name: '（已不在）', role: null }; };
  const row = p => ({ id: p.id, mentor: who(p.mentor), mentee: who(p.mentee), at: p.at });
  const director = u => u.academy?.role === 'director' || isAdmin(u);
  return {
  // 本人的配对：带教教师是谁、带着谁
  'GET /api/me/pair': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const m = pairs.mentorOf(user.id);
    json(res, 200, { mentor: m ? who(m) : null, mentees: pairs.menteesOf(user.id).map(who) });
  },
  // 本园全部配对（园长、管理员）
  'GET /api/org/pairs': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!director(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const org = orgKeyOf(user);
    json(res, 200, { pairs: org ? pairs.inOrg(org).map(row) : [] });
  },
  // 配一对：{ mentor, mentee }；mentee 已有带教教师的，旧配对结束
  'PUT /api/org/pairs': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!director(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const org = orgKeyOf(user);
    if (!org && !isAdmin(user)) return json(res, 400, { error: 'your account has no kindergarten', code: 'org' });
    const body = await readBody(req);
    const mentor = db.users.find(u => u.id === String(body.mentor || '') && !u.disabled), mentee = db.users.find(u => u.id === String(body.mentee || '') && !u.disabled);
    if (!mentor || !mentee) return json(res, 404, { error: 'no such member' });
    if (mentor.id === mentee.id) return json(res, 400, { error: 'one cannot mentor oneself', code: 'self' });
    const key = org || orgKeyOf(mentor);
    if (!key || orgKeyOf(mentor) !== key || orgKeyOf(mentee) !== key) return json(res, 403, { error: 'both must be in your kindergarten', code: 'org' });
    if (pairs.isMentorOf(mentor.id, mentee.id)) return json(res, 200, { pair: row(pairs.all().find(p => p.mentor === mentor.id && p.mentee === mentee.id)), replaced: false });
    const now = Date.now();
    let replaced = false;
    for (const p of pairs.all()) if (p.mentee === mentee.id) { p.endedAt = now; replaced = true; }
    const p = { id: crypto.randomBytes(9).toString('base64url'), org: key, mentor: mentor.id, mentee: mentee.id, by: user.id, at: now, endedAt: null };
    db.pairs.push(p); saveDb();
    audit(req, 'org.pair', { user, msg: `${mentor.id} -> ${mentee.id}` });
    json(res, 200, { pair: row(p), replaced });
  },
  // 结束一对：{ id }
  'POST /api/org/pairs/end': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!director(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const body = await readBody(req);
    const p = pairs.all().find(x => x.id === String(body.id || ''));
    if (!p) return json(res, 404, { error: 'no such pair' });
    if (!isAdmin(user) && p.org !== orgKeyOf(user)) return json(res, 403, { error: 'not in your kindergarten', code: 'org' });
    p.endedAt = Date.now(); saveDb();
    audit(req, 'org.pair.end', { user, msg: p.id });
    json(res, 200, { ok: true });
  }
  };
}
