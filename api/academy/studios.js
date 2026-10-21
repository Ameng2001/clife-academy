/* 名师工作室与市级展示（docs/ROADMAP.md 第六节「名师工作室」、第七节三级赛制的第三级「市级展示」）。
 *
 * 名师工作室：市级，专家讲师主持，骨干教师参加，产出园本课程案例。管理员（本地运营方）建工作室、定主持人；
 *   有骨干教师认证的教师可申请，主持人或管理员通过后成为成员，并授「名师工作室成员」称号（db.titles，留理由）；
 *   主持人把成员的入库案例收为工作室产出（caseIds），案例署名旁多一个工作室名。
 * 市级展示：每年一次，由一个工作室主持。不是赛：没有评分、没有名次。主持人从各共同体赛的入选作品（与工作室产出）里
 *   挑作品上台展示，每件写一段名师点评；可授「年度分享者」称号（留理由）；收官后入选案例标「市级展示 · 年份」。
 *   全平台登录用户可看展示（作品与点评），不公布任何分数，不按园统计。
 * db.studios:   { id, name, focus, term, intro, hostUid, hostName, by, byName, at, closedAt, members:[{uid,name,org,orgName,at,titleId}],
 *                 applicants:[{uid,name,org,orgName,at,note}], caseIds:[] }
 * db.showcases: { id, studioId, studioName, year, title, theme, at(展示日期), place, note, by, byName, createdAt, closedAt, summary,
 *                 entries:[{ caseId, comment:{text,by,byName,at}|null, order }], sharers:[{uid,name,titleId,at}] } */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { TITLES } from './honors.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const MAX_ENTRIES = 12;

export function studioRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin }) {
  db.studios = db.studios || []; db.showcases = db.showcases || []; db.titles = db.titles || []; db.cases = db.cases || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const hostsStudio = (u, s) => isAdmin(u) || s.hostUid === u.id;
  const hostsAny = u => isAdmin(u) || db.studios.some(s => !s.closedAt && s.hostUid === u.id);
  const hasBackbone = uid => (db.certificates || []).some(c => c.uid === uid && c.kind === 'backbone');
  const memberOfAny = uid => db.studios.some(s => s.members.some(m => m.uid === uid));
  const caseBrief = c => ({ id: c.id, title: c.title, byUid: c.by, domain: c.domain, age: c.age, byName: c.byName, orgName: c.orgName, communityName: c.communityName || null, tag: c.source?.tag || null, at: c.at });
  const approvedCase = id => db.cases.find(c => c.id === id && c.status === 'approved');
  const grantTitle = (t, title, reason, by) => { const row = { id: newId(), uid: t.uid, name: t.name, org: t.org, title, label: TITLES[title], reason, by: by.id, byName: by.name, at: now() }; db.titles.push(row); return row; };
  const revokeTitle = id => { if (id) db.titles = db.titles.filter(t => t.id !== id); };

  const pubStudio = (s, user) => {
    const host = hostsStudio(user, s), me = s.members.find(m => m.uid === user.id), ap = s.applicants.find(a => a.uid === user.id);
    return { id: s.id, name: s.name, focus: s.focus, term: s.term, intro: s.intro, hostName: s.hostName, hostUid: s.hostUid, at: s.at, closedAt: s.closedAt,
      members: s.members.map(m => ({ uid: m.uid, name: m.name, orgName: m.orgName, at: m.at })), cases: s.caseIds.map(approvedCase).filter(Boolean).map(caseBrief),
      mine: host ? 'host' : me ? 'member' : ap ? 'applicant' : null, canHost: host, canApply: !s.closedAt && !host && !me && !ap && hasBackbone(user.id),
      ...(host ? { applicants: s.applicants.map(a => ({ uid: a.uid, name: a.name, orgName: a.orgName, at: a.at, note: a.note })), memberCases: db.cases.filter(c => c.status === 'approved' && s.members.some(m => m.uid === c.by) && !s.caseIds.includes(c.id)).map(caseBrief) } : {}) };
  };
  /** 市级展示的候选池：各共同体赛的入选作品 ＋ 本工作室产出，去掉已经上台的。 */
  const poolOf = (sc, studio) => db.cases.filter(c => c.status === 'approved' && !sc.entries.some(e => e.caseId === c.id) && ((c.source?.kind === 'contest' && c.source.selected && c.communityName) || (studio && studio.caseIds.includes(c.id))))
    .sort((a, b) => b.at - a.at).map(c => ({ ...caseBrief(c), from: c.source?.kind === 'contest' && c.communityName ? '共同体赛入选' : '工作室产出' }));
  const pubShowcase = (sc, user, full = false) => {
    const studio = db.studios.find(s => s.id === sc.studioId), host = studio ? hostsStudio(user, studio) : isAdmin(user);
    return { id: sc.id, studioId: sc.studioId, studioName: sc.studioName, year: sc.year, title: sc.title, theme: sc.theme, at: sc.at, place: sc.place, note: sc.note, byName: sc.byName, closedAt: sc.closedAt, summary: sc.summary || '',
      entries: sc.entries.map(e => { const c = approvedCase(e.caseId); return c ? { ...caseBrief(c), comment: e.comment ? { text: e.comment.text, byName: e.comment.byName, at: e.comment.at } : null, mine: c.by === user.id } : null; }).filter(Boolean),
      sharers: sc.sharers.map(x => ({ uid: x.uid, name: x.name, orgName: x.orgName, reason: x.reason, at: x.at })), canHost: host, entryCount: sc.entries.length,
      ...(full && host ? { pool: poolOf(sc, studio) } : {}) };
  };
  const studioOf = (res, id) => { const s = db.studios.find(x => x.id === id); if (!s) json(res, 404, { error: 'no such studio' }); return s; };
  const showcaseOf = (res, id) => { const s = db.showcases.find(x => x.id === id); if (!s) json(res, 404, { error: 'no such showcase' }); return s; };
  const hostOnly = (res, user, sc) => { const st = db.studios.find(s => s.id === sc.studioId); if (!(st ? hostsStudio(user, st) : isAdmin(user))) { json(res, 403, { error: 'the hosting studio only', code: 'host' }); return false; } return true; };

  return {
  // 工作室列表：全平台登录用户可看名称、方向、主持人、成员与产出；主持人多看申请人
  'GET /api/studios': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { studios: db.studios.sort((a, b) => (a.closedAt ? 1 : 0) - (b.closedAt ? 1 : 0) || b.at - a.at).map(s => pubStudio(s, user)), canManage: isAdmin(user), eligible: hasBackbone(user.id), member: memberOfAny(user.id),
      users: isAdmin(user) ? db.users.filter(u => !u.disabled).map(u => ({ id: u.id, name: u.name, orgName: u.academy?.org?.name || null })) : undefined });
  },
  // 建 / 改工作室（管理员）：{ id?, name, focus, term, intro, hostUid, closed? }
  'POST /api/studios': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const name = str(body.name, 40), focus = str(body.focus, 60), term = str(body.term, 20), intro = str(body.intro, 1000);
    if (name.length < 2) return json(res, 400, { error: 'name', code: 'name' });
    const host = db.users.find(u => u.id === String(body.hostUid || ''));
    if (!host) return json(res, 400, { error: 'pick a host (a platform user)', code: 'host' });
    let s = body.id ? db.studios.find(x => x.id === str(body.id, 40)) : null;
    if (body.id && !s) return json(res, 404, { error: 'no such studio' });
    if (s) Object.assign(s, { name, focus, term, intro, hostUid: host.id, hostName: host.name, closedAt: body.closed ? (s.closedAt || now()) : null });
    else { s = { id: newId(), name, focus, term, intro, hostUid: host.id, hostName: host.name, by: user.id, byName: user.name, at: now(), closedAt: null, members: [], applicants: [], caseIds: [] }; db.studios.push(s); }
    saveDb(); audit(req, 'studio.save', { user, msg: s.id });
    json(res, 200, { studio: pubStudio(s, user) });
  },
  // 申请加入：{ id, note }。要有骨干教师认证。
  'POST /api/studios/apply': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const s = studioOf(res, str(body.id, 40)); if (!s) return;
    if (s.closedAt) return json(res, 400, { error: 'closed', code: 'closed' });
    if (!hasBackbone(user.id)) return json(res, 403, { error: 'backbone certification required', code: 'eligible' });
    if (s.members.some(m => m.uid === user.id) || s.applicants.some(a => a.uid === user.id)) return json(res, 400, { error: 'already', code: 'dup' });
    s.applicants.push({ uid: user.id, name: user.name, org: orgKeyOf(user), orgName: user.academy?.org?.name || null, at: now(), note: str(body.note, 500) }); saveDb();
    audit(req, 'studio.apply', { user, msg: s.id });
    json(res, 200, { studio: pubStudio(s, user) });
  },
  // 成员管理（主持人 / 管理员）：{ id, uid, action:'accept'|'decline'|'add'|'remove', reason? }。accept/add 授「名师工作室成员」称号，remove 撤。
  'POST /api/studios/members': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const s = studioOf(res, str(body.id, 40)); if (!s) return;
    if (!hostsStudio(user, s)) return json(res, 403, { error: 'host only', code: 'host' });
    const uid = String(body.uid || ''), t = db.users.find(u => u.id === uid);
    if (!t) return json(res, 404, { error: 'no such user' });
    const action = String(body.action || '');
    if (action === 'accept' || action === 'add') {
      if (action === 'accept' && !s.applicants.some(a => a.uid === uid)) return json(res, 400, { error: 'not an applicant', code: 'applicant' });
      if (s.members.some(m => m.uid === uid)) return json(res, 400, { error: 'already a member', code: 'dup' });
      const reason = str(body.reason, 300) || `加入${s.name}`;
      const row = grantTitle({ uid: t.id, name: t.name, org: orgKeyOf(t) }, 'studio', reason, user);
      s.members.push({ uid: t.id, name: t.name, org: orgKeyOf(t), orgName: t.academy?.org?.name || null, at: now(), titleId: row.id });
      s.applicants = s.applicants.filter(a => a.uid !== uid);
    } else if (action === 'decline') s.applicants = s.applicants.filter(a => a.uid !== uid);
    else if (action === 'remove') { const m = s.members.find(x => x.uid === uid); if (m) revokeTitle(m.titleId); s.members = s.members.filter(x => x.uid !== uid); }
    else return json(res, 400, { error: 'action: accept | decline | add | remove', code: 'action' });
    saveDb(); audit(req, 'studio.member', { user, msg: `${s.id} ${action} ${uid}` });
    json(res, 200, { studio: pubStudio(s, user) });
  },
  // 收录产出（主持人）：{ id, caseIds }，只能是成员的已入库案例
  'POST /api/studios/cases': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const s = studioOf(res, str(body.id, 40)); if (!s) return;
    if (!hostsStudio(user, s)) return json(res, 403, { error: 'host only', code: 'host' });
    s.caseIds = (Array.isArray(body.caseIds) ? body.caseIds : []).map(x => str(String(x || ''), 40)).filter(id => { const c = approvedCase(id); return c && s.members.some(m => m.uid === c.by); });
    saveDb(); audit(req, 'studio.cases', { user, msg: `${s.id} ${s.caseIds.length}` });
    json(res, 200, { studio: pubStudio(s, user) });
  },
  // 市级展示列表（全平台）：进行中与往届；主持人可建
  'GET /api/showcases': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { showcases: db.showcases.sort((a, b) => (a.closedAt ? 1 : 0) - (b.closedAt ? 1 : 0) || b.at - a.at).map(s => pubShowcase(s, user)), canHost: hostsAny(user), studios: db.studios.filter(s => !s.closedAt && hostsStudio(user, s)).map(s => ({ id: s.id, name: s.name })) });
  },
  'GET /api/showcases/one': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const sc = showcaseOf(res, new URL(req.url, 'http://x').searchParams.get('id') || ''); if (!sc) return;
    json(res, 200, { showcase: pubShowcase(sc, user, true) });
  },
  // 建 / 改（主持人）：{ id?, studioId, year, title, theme, at, place, note }
  'POST /api/showcases': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    let sc = body.id ? db.showcases.find(x => x.id === str(body.id, 40)) : null;
    if (body.id && !sc) return json(res, 404, { error: 'no such showcase' });
    const studio = db.studios.find(s => s.id === str(body.studioId, 40) && !s.closedAt);
    if (!studio) return json(res, 400, { error: 'pick an open studio', code: 'studio' });
    if (!hostsStudio(user, studio)) return json(res, 403, { error: 'that studio\'s host only', code: 'host' });
    const fields = { year: str(body.year, 8) || String(new Date().getFullYear()), title: str(body.title, 60), theme: str(body.theme, 200), at: Number(body.at) || now(), place: str(body.place, 60), note: str(body.note, 1000) };
    if (fields.title.length < 2) return json(res, 400, { error: 'title', code: 'title' });
    if (sc) { if (sc.closedAt) return json(res, 400, { error: 'closed', code: 'closed' }); Object.assign(sc, fields, { studioId: studio.id, studioName: studio.name }); }
    else { sc = { id: newId(), studioId: studio.id, studioName: studio.name, ...fields, by: user.id, byName: user.name, createdAt: now(), closedAt: null, summary: '', entries: [], sharers: [] }; db.showcases.push(sc); }
    saveDb(); audit(req, 'showcase.save', { user, msg: sc.id });
    json(res, 200, { showcase: pubShowcase(sc, user, true) });
  },
  // 定上台作品（主持人）：{ id, caseIds }，顺序即出场顺序，最多 12 件；任何已入库案例都行，候选池只是建议
  'POST /api/showcases/entries': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const sc = showcaseOf(res, str(body.id, 40)); if (!sc || !hostOnly(res, user, sc)) return;
    if (sc.closedAt) return json(res, 400, { error: 'closed', code: 'closed' });
    const ids = [...new Set((Array.isArray(body.caseIds) ? body.caseIds : []).map(x => str(String(x || ''), 40)).filter(approvedCase))].slice(0, MAX_ENTRIES);
    sc.entries = ids.map((caseId, i) => ({ caseId, order: i, comment: sc.entries.find(e => e.caseId === caseId)?.comment || null }));
    saveDb(); audit(req, 'showcase.entries', { user, msg: `${sc.id} ${ids.length}` });
    json(res, 200, { showcase: pubShowcase(sc, user, true) });
  },
  // 名师点评（主持人）：{ id, caseId, text }。对作品，不对人。
  'POST /api/showcases/comment': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const sc = showcaseOf(res, str(body.id, 40)); if (!sc || !hostOnly(res, user, sc)) return;
    const e = sc.entries.find(x => x.caseId === str(body.caseId, 40));
    if (!e) return json(res, 404, { error: 'not on stage', code: 'entry' });
    const text = str(body.text, 2000);
    if (text.length < 10) return json(res, 400, { error: 'write the comment (10+ characters)', code: 'empty' });
    e.comment = { text, by: user.id, byName: user.name, at: now() }; saveDb();
    audit(req, 'showcase.comment', { user, msg: `${sc.id} ${e.caseId}` });
    json(res, 200, { showcase: pubShowcase(sc, user, true) });
  },
  // 授「年度分享者」（主持人）：{ id, uid, reason }。只能授上台作品的作者；留理由；不能授自己。
  'POST /api/showcases/sharer': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const sc = showcaseOf(res, str(body.id, 40)); if (!sc || !hostOnly(res, user, sc)) return;
    const uid = String(body.uid || ''), t = db.users.find(u => u.id === uid);
    if (!t) return json(res, 404, { error: 'no such user' });
    if (t.id === user.id) return json(res, 403, { error: 'not yourself', code: 'self' });
    if (!sc.entries.some(e => approvedCase(e.caseId)?.by === uid)) return json(res, 400, { error: 'only authors of works on stage', code: 'author' });
    if (sc.sharers.some(x => x.uid === uid)) return json(res, 400, { error: 'already', code: 'dup' });
    const reason = str(body.reason, 500);
    if (reason.length < 5) return json(res, 400, { error: 'write why', code: 'reason' });
    const row = grantTitle({ uid: t.id, name: t.name, org: orgKeyOf(t) }, 'sharer', `${sc.year} 市级展示：${reason}`, user);
    sc.sharers.push({ uid: t.id, name: t.name, orgName: t.academy?.org?.name || null, titleId: row.id, reason, at: now() }); saveDb();
    audit(req, 'showcase.sharer', { user, msg: `${sc.id} ${uid}` });
    json(res, 200, { showcase: pubShowcase(sc, user, true) });
  },
  // 收官（主持人）：{ id, summary }。上台案例标「市级展示 · 年份」。
  'POST /api/showcases/close': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const sc = showcaseOf(res, str(body.id, 40)); if (!sc || !hostOnly(res, user, sc)) return;
    if (sc.closedAt) return json(res, 400, { error: 'closed', code: 'closed' });
    sc.closedAt = now(); sc.summary = str(body.summary, 2000);
    for (const e of sc.entries) { const c = approvedCase(e.caseId); if (c) c.showcase = { id: sc.id, year: sc.year, title: sc.title, studioName: sc.studioName }; }
    saveDb(); audit(req, 'showcase.close', { user, msg: sc.id });
    json(res, 200, { showcase: pubShowcase(sc, user) });
  }
  };
}
