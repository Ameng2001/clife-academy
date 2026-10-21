/* 研修项目期次（docs/ROADMAP.md 第九节「研修项目」）：寒暑假研修、园长研修、名师工作室集中研修等线下或直播项目。
 * 本地运营方建期次（时间、地点、名额、学时），教师报名，运营方定名单，结束时记谁完成；完成的学时进发展档案与学时证明（portfolio.js hoursOf）。
 * 名单只给运营方与本人看；不公布谁没被录取。
 *
 * db.programs: { id, title, kind, term, from, to, place, hours, capacity, note, by, byName, at, closedAt,
 *                applicants:[{ uid, name, orgName, at, status:'applied'|'accepted'|'declined'|'completed', updatedAt }] } */
import crypto from 'node:crypto';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const KINDS = Object.freeze(['寒暑假研修', '园长研修', '名师工作室研修', '专题培训', '其他']);
const STATUS = ['applied', 'accepted', 'declined', 'completed'];

export function programRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin }) {
  db.programs = db.programs || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const find = id => db.programs.find(p => p.id === id);
  const phase = p => (p.closedAt ? 'done' : now() < p.from ? 'upcoming' : now() <= p.to ? 'running' : 'ended');
  const pub = (p, user) => {
    const mine = p.applicants.find(a => a.uid === user.id);
    const accepted = p.applicants.filter(a => a.status === 'accepted' || a.status === 'completed').length;
    return {
      id: p.id, title: p.title, kind: p.kind, term: p.term, from: p.from, to: p.to, place: p.place, hours: p.hours, capacity: p.capacity, note: p.note, byName: p.byName, phase: phase(p), closedAt: p.closedAt || null,
      applied: p.applicants.filter(a => a.status === 'applied').length, accepted, mine: mine ? { status: mine.status, at: mine.at } : null,
      canApply: !mine && phase(p) === 'upcoming' && (!p.capacity || accepted < p.capacity),
      ...(isAdmin(user) ? { roster: p.applicants.sort((a, b) => a.at - b.at).map(a => ({ uid: a.uid, name: a.name, orgName: a.orgName, status: a.status, at: a.at })) } : {})
    };
  };

  return {
  'GET /api/programs': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const list = db.programs.sort((a, b) => (a.closedAt ? 1 : 0) - (b.closedAt ? 1 : 0) || b.from - a.from);
    json(res, 200, { programs: list.map(p => pub(p, user)), kinds: KINDS, canHost: isAdmin(user) });
  },
  // 建期次或改：{ id?, title, kind, term, from, to, place?, hours, capacity?, note? }
  'POST /api/programs': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    let p = body.id ? find(str(body.id, 40)) : null;
    if (body.id && !p) return json(res, 404, { error: 'no such program' });
    const title = str(body.title, 120);
    if (title.length < 4) return json(res, 400, { error: 'title too short', code: 'title' });
    const from = Number(body.from), to = Number(body.to);
    if (!(from > 946684800000) || !(to >= from)) return json(res, 400, { error: 'from/to required', code: 'dates' });
    const hours = Math.round(Number(body.hours) * 2) / 2;
    if (!(hours >= 0 && hours <= 200)) return json(res, 400, { error: 'hours 0–200', code: 'hours' });
    const capacity = Math.max(0, Math.round(Number(body.capacity) || 0));
    const fields = { title, kind: KINDS.includes(body.kind) ? body.kind : (p ? p.kind : KINDS[0]), term: str(body.term, 40), from, to, place: str(body.place, 120), hours, capacity, note: str(body.note, 2000), updatedAt: now() };
    if (p) Object.assign(p, fields);
    else { p = { id: newId(), ...fields, by: user.id, byName: user.name, at: now(), closedAt: null, applicants: [] }; db.programs.push(p); }
    saveDb();
    audit(req, 'program.save', { user, msg: p.id });
    json(res, 200, { program: pub(p, user) });
  },
  // 报名 / 撤回：{ id, withdraw? }
  'POST /api/programs/apply': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const p = find(str(body.id, 40));
    if (!p) return json(res, 404, { error: 'no such program' });
    const i = p.applicants.findIndex(a => a.uid === user.id);
    if (body.withdraw) { if (i >= 0 && p.applicants[i].status !== 'completed') { p.applicants.splice(i, 1); saveDb(); } return json(res, 200, { program: pub(p, user) }); }
    if (phase(p) !== 'upcoming') return json(res, 400, { error: 'applications closed', code: 'closed' });
    if (i < 0) { p.applicants.push({ uid: user.id, name: user.name, orgName: user.academy?.org?.name || null, at: now(), status: 'applied', updatedAt: now() }); saveDb(); audit(req, 'program.apply', { user, msg: p.id }); }
    json(res, 200, { program: pub(p, user) });
  },
  // 定名单 / 记完成：{ id, uid, status:'accepted'|'declined'|'completed' }
  'POST /api/programs/roster': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const p = find(str(body.id, 40));
    if (!p) return json(res, 404, { error: 'no such program' });
    const a = p.applicants.find(x => x.uid === str(body.uid, 40));
    if (!a) return json(res, 404, { error: 'not an applicant', code: 'uid' });
    const status = STATUS.includes(body.status) ? body.status : null;
    if (!status || status === 'applied') return json(res, 400, { error: 'status accepted|declined|completed', code: 'status' });
    if (status === 'completed' && a.status !== 'accepted' && a.status !== 'completed') return json(res, 400, { error: 'accept first', code: 'status' });
    a.status = status; a.updatedAt = now();
    if (status === 'completed') a.completedAt = a.completedAt || now();
    saveDb();
    audit(req, 'program.roster', { user, msg: `${p.id} ${a.uid} ${status}` });
    json(res, 200, { program: pub(p, user) });
  },
  'POST /api/programs/close': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const p = find(str(body.id, 40));
    if (!p) return json(res, 404, { error: 'no such program' });
    if (!p.closedAt) { p.closedAt = now(); saveDb(); audit(req, 'program.close', { user, msg: p.id }); }
    json(res, 200, { program: pub(p, user) });
  }
  };
}
