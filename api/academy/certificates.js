/* 证书与认证期次（docs/ROADMAP.md 第五节「认证」、第七节「成长勋章」）。
 *
 * 三级：
 *   tool      岗位数智应用认证：完成本岗位工具路径、测验正确率 ≥ 80%。自动判定，电子证书。
 *   domain    领域研修证书：完成一条领域路径、实践关作品全部通过点评。自动判定 ＋ 点评记录。
 *   backbone  骨干教师认证：三条领域研修证书 ＋ 一份园本案例（入库）＋ 线下答辩。按学期开班（认证期次 db.cohorts），答辩结果由管理员记。
 * 证书只记「谁、哪一级、哪条路径、什么时候」，不含分数；有编号可核验（GET /api/certificates/verify?no=，只回证书名、姓名脱敏、日期）。
 * 前两级不存条件判断，按记录算（earnedOf 纯函数）；发证时才写 db.certificates 一行，给编号。证书可导出进发展档案。
 * db.certificates: { id, no, uid, name, org, orgName, kind, ref(path|cohortId), label, at, by, byName, cohortId }
 * db.cohorts:      { id, name, term, kind:'backbone', applyFrom, applyTo, defenseAt, place, note, by, byName, at, closedAt,
 *                    applicants:[{ uid, name, org, orgName, at, note, result:null|'pass'|'fail'|'absent', resultNote, resultAt }] } */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { ROLE_PATH, PATH_LEN, PATH_NAMES, PATH_KIND, LEVEL_TYPES, LEVEL_DOMAIN, DOMAINS } from './events-data.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const TOOL_QUIZ_MIN = 0.8, BACKBONE_DOMAINS = 3, BACKBONE_CASES = 1;
export const KIND_LABEL = Object.freeze({ tool: '岗位数智应用认证', domain: '领域研修证书', backbone: '骨干教师认证' });
const DOMAIN_PATHS = Object.keys(PATH_KIND).filter(p => PATH_KIND[p] === 'domain');
const ROLE_PATHS = Object.keys(PATH_KIND).filter(p => PATH_KIND[p] === 'role');

const finishedAt = (prog, path) => { const n = PATH_LEN[path] || 0; let d = 0; while (d < n && prog[`${path}-${d}`]?.passedAt) d++; return n > 0 && d >= n ? prog[`${path}-${n - 1}`].passedAt : null; };
const doneOf = (prog, path) => { const n = PATH_LEN[path] || 0; let d = 0; while (d < n && prog[`${path}-${d}`]?.passedAt) d++; return d; };
const latestSub = (subs, levelId) => subs.filter(s => s.levelId === levelId).sort((a, b) => b.at - a.at)[0] || null;

/** 纯函数：一个人已达到的证书条件与进度。返回 { earned:[{kind,ref,label,at}], tool, domains, backbone, seven }。 */
export function earnedOf(uid, { db, stateOf, user }) {
  const S = stateOf(uid) || {}, prog = S.progress && typeof S.progress === 'object' ? S.progress : {};
  const subs = (db.submissions || []).filter(s => s.uid === uid);
  const u = user || (db.users || []).find(x => x.id === uid);
  const earned = [];
  // 工具线：本岗位路径
  const rolePath = ROLE_PATH[u?.academy?.role];
  let tool = null;
  if (rolePath && PATH_KIND[rolePath] === 'role') {
    const n = PATH_LEN[rolePath], at = finishedAt(prog, rolePath);
    let right = 0, of = 0;
    for (let i = 0; i < n; i++) { const q = prog[`${rolePath}-${i}`]?.quiz; if (q && q.of > 0) { right += Number(q.right) || 0; of += Number(q.of) || 0; } }
    const quiz = of ? right / of : null;
    const ok = !!at && (quiz == null || quiz >= TOOL_QUIZ_MIN);
    tool = { path: rolePath, name: PATH_NAMES[rolePath], done: doneOf(prog, rolePath), total: n, quiz: quiz == null ? null : Math.round(quiz * 100), ok, at: ok ? at : null };
    if (ok) earned.push({ kind: 'tool', ref: rolePath, label: `${KIND_LABEL.tool} · ${PATH_NAMES[rolePath]}`, at });
  }
  // 领域路径：走完 ＋ 实践关作品全部通过
  const domains = DOMAIN_PATHS.map(path => {
    const n = PATH_LEN[path], at = finishedAt(prog, path);
    const practice = []; for (let i = 0; i < n; i++) if (LEVEL_TYPES[`${path}-${i}`] === 'practice') practice.push(`${path}-${i}`);
    const passed = practice.filter(id => latestSub(subs, id)?.status === 'pass');
    const ok = !!at && passed.length === practice.length;
    const when = ok ? Math.max(at, ...passed.map(id => latestSub(subs, id).review?.at || latestSub(subs, id).at)) : null;
    if (ok) earned.push({ kind: 'domain', ref: path, label: `${KIND_LABEL.domain} · ${PATH_NAMES[path]}`, at: when });
    return { path, name: PATH_NAMES[path], done: doneOf(prog, path), total: n, works: passed.length, worksTotal: practice.length, ok, at: when };
  });
  // 七领域都有证据（成长勋章）：每个领域至少一个通过的关或通过的作品或作答
  const evid = new Set();
  for (const id of Object.keys(prog)) if (prog[id]?.passedAt && LEVEL_DOMAIN[id]) evid.add(LEVEL_DOMAIN[id]);
  for (const s of subs) if (LEVEL_DOMAIN[s.levelId] && (s.status === 'pass' || LEVEL_TYPES[s.levelId] === 'seminar')) evid.add(LEVEL_DOMAIN[s.levelId]);
  for (const a of (db.drillAnswers || [])) if (a.uid === uid) { const d = (db.drills || []).find(x => x.id === a.drillId); if (d?.domain) evid.add(d.domain); }
  const seven = { have: evid.size, of: DOMAINS.length, ok: evid.size >= DOMAINS.length };
  // 骨干：三条领域证书 ＋ 一份入库案例 ＋ 答辩（期次里记）
  const domainCerts = domains.filter(d => d.ok).length;
  const cases = (db.cases || []).filter(c => c.by === uid && c.status === 'approved').length;
  const backboneCert = (db.certificates || []).find(c => c.uid === uid && c.kind === 'backbone') || null;
  const backbone = { domainCerts, domainsNeeded: BACKBONE_DOMAINS, cases, casesNeeded: BACKBONE_CASES, eligible: domainCerts >= BACKBONE_DOMAINS && cases >= BACKBONE_CASES, ok: !!backboneCert, at: backboneCert?.at || null };
  if (backboneCert) earned.push({ kind: 'backbone', ref: backboneCert.ref, label: KIND_LABEL.backbone, at: backboneCert.at });
  return { earned, tool, domains, seven, backbone };
}

export function certificateRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, readStateCached }) {
  db.certificates = db.certificates || []; db.cohorts = db.cohorts || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const nextNo = () => { const y = new Date().getFullYear(); const n = db.certificates.filter(c => c.no.startsWith(`CL-${y}-`)).length + 1; return `CL-${y}-${String(n).padStart(5, '0')}`; };
  const isDirector = u => u.academy?.role === 'director';
  const pubCert = c => ({ id: c.id, no: c.no, name: c.name, orgName: c.orgName, kind: c.kind, ref: c.ref, label: c.label, at: c.at, byName: c.byName || null, cohortId: c.cohortId || null });
  /** 把已达条件但还没发的（前两级）写成证书行，给编号。 */
  const ensureIssued = (u, e) => {
    let changed = false;
    for (const x of e.earned) {
      if (x.kind === 'backbone') continue;
      if (db.certificates.some(c => c.uid === u.id && c.kind === x.kind && c.ref === x.ref)) continue;
      db.certificates.push({ id: newId(), no: nextNo(), uid: u.id, name: u.name, org: orgKeyOf(u), orgName: u.academy?.org?.name || null, kind: x.kind, ref: x.ref, label: x.label, at: x.at || now(), by: null, byName: null, cohortId: null, issuedAt: now() });
      changed = true;
    }
    if (changed) saveDb();
  };
  const phaseOf = c => (c.closedAt ? 'closed' : now() < c.applyFrom ? 'upcoming' : now() <= c.applyTo ? 'open' : 'defense');
  const pubCohort = (c, user) => {
    const me = c.applicants.find(a => a.uid === user.id) || null;
    return { id: c.id, name: c.name, term: c.term, kind: c.kind, applyFrom: c.applyFrom, applyTo: c.applyTo, defenseAt: c.defenseAt, place: c.place, note: c.note, phase: phaseOf(c), byName: c.byName, applicants: c.applicants.length,
      passed: c.applicants.filter(a => a.result === 'pass').length, mine: me ? { at: me.at, note: me.note, result: me.result, resultNote: me.resultNote || '' } : null,
      ...(isAdmin(user) ? { list: c.applicants.map(a => ({ uid: a.uid, name: a.name, orgName: a.orgName, at: a.at, note: a.note, result: a.result, resultNote: a.resultNote || '', resultAt: a.resultAt || null })) } : {}) };
  };
  const find = id => db.cohorts.find(c => c.id === id);

  return {
  // 本人：已发的证书、三级条件的进度、开着的期次
  'GET /api/me/certificates': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const e = earnedOf(user.id, { db, stateOf: readStateCached, user });
    ensureIssued(user, e);
    const cohorts = db.cohorts.filter(c => !c.closedAt || c.applicants.some(a => a.uid === user.id)).sort((a, b) => b.applyFrom - a.applyFrom).map(c => pubCohort(c, user));
    json(res, 200, { certificates: db.certificates.filter(c => c.uid === user.id).sort((a, b) => b.at - a.at).map(pubCert), tool: e.tool, domains: e.domains, seven: e.seven, backbone: e.backbone, cohorts, kinds: KIND_LABEL });
  },
  // 核验（公开）：只回证书名、脱敏姓名、园所、日期
  'GET /api/certificates/verify': async (req, res) => {
    const no = str(new URL(req.url, 'http://x').searchParams.get('no') || '', 20).toUpperCase();
    const c = db.certificates.find(x => x.no === no);
    if (!c) return json(res, 404, { valid: false });
    json(res, 200, { valid: true, no: c.no, label: c.label, name: c.name.length > 1 ? c.name[0] + '*'.repeat(c.name.length - 1) : c.name, orgName: c.orgName, at: c.at });
  },
  // 园长看本园的证书（人名、哪一级、日期；没有分数）；管理员看全部或 ?org=
  'GET /api/org/certificates': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isDirector(user) && !isAdmin(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const q = new URL(req.url, 'http://x').searchParams.get('org');
    const org = (isAdmin(user) && q) || orgKeyOf(user);
    // 先把本园每个人达到条件的证书发出来（看板上才齐）
    for (const m of db.users.filter(u => !u.disabled && (isAdmin(user) && !q ? true : orgKeyOf(u) === org))) ensureIssued(m, earnedOf(m.id, { db, stateOf: readStateCached, user: m }));
    const list = db.certificates.filter(c => (isAdmin(user) && !q) || c.org === org).sort((a, b) => b.at - a.at);
    const counts = { tool: 0, domain: 0, backbone: 0 }; for (const c of list) counts[c.kind] = (counts[c.kind] || 0) + 1;
    json(res, 200, { org, counts, certificates: list.map(pubCert), kinds: KIND_LABEL });
  },
  // 期次：所有登录的人看得到开着的（报名窗口、答辩时间）；管理员看报名名单
  'GET /api/cohorts': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const list = db.cohorts.filter(c => isAdmin(user) || !c.closedAt || c.applicants.some(a => a.uid === user.id)).sort((a, b) => b.applyFrom - a.applyFrom);
    json(res, 200, { cohorts: list.map(c => pubCohort(c, user)), canHost: isAdmin(user) });
  },
  // 开班或改（管理员）：{ id?, name, term, applyFrom, applyTo, defenseAt?, place?, note? }
  'POST /api/cohorts': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let c = id ? find(id) : null;
    if (id && !c) return json(res, 404, { error: 'no such cohort' });
    const name = str(body.name, 80), term = str(body.term, 20);
    if (name.length < 2 || !term) return json(res, 400, { error: 'name and term required', code: 'name' });
    const applyFrom = Number(body.applyFrom) > 946684800000 ? Number(body.applyFrom) : (c ? c.applyFrom : now());
    const applyTo = Number(body.applyTo) > applyFrom ? Number(body.applyTo) : (c && c.applyTo > applyFrom ? c.applyTo : applyFrom + 14 * 86400000);
    const defenseAt = Number(body.defenseAt) > applyTo ? Number(body.defenseAt) : (c && c.defenseAt > applyTo ? c.defenseAt : null);
    const fields = { name, term, applyFrom, applyTo, defenseAt, place: str(body.place, 120), note: str(body.note, 1000), updatedAt: now() };
    if (c) Object.assign(c, fields);
    else { c = { id: newId(), kind: 'backbone', ...fields, by: user.id, byName: user.name, at: now(), closedAt: null, applicants: [] }; db.cohorts.push(c); }
    saveDb();
    audit(req, id ? 'cohort.edit' : 'cohort.new', { user, msg: c.id });
    json(res, 200, { cohort: pubCohort(c, user) });
  },
  // 报名：{ id, note? }。报名窗口内、条件达到（三条领域证书 ＋ 一份案例）；一人一次。
  'POST /api/cohorts/apply': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c || c.closedAt) return json(res, 404, { error: 'no such cohort' });
    if (phaseOf(c) !== 'open') return json(res, 400, { error: 'applications are closed', code: 'phase' });
    const e = earnedOf(user.id, { db, stateOf: readStateCached, user });
    if (e.backbone.ok) return json(res, 400, { error: 'already certified', code: 'done' });
    if (!e.backbone.eligible) return json(res, 400, { error: `needs ${BACKBONE_DOMAINS} domain certificates and ${BACKBONE_CASES} case in the library`, code: 'eligible', backbone: e.backbone });
    let a = c.applicants.find(x => x.uid === user.id);
    if (a) a.note = str(body.note, 500);
    else { a = { uid: user.id, name: user.name, org: orgKeyOf(user), orgName: user.academy?.org?.name || null, at: now(), note: str(body.note, 500), result: null, resultNote: '', resultAt: null }; c.applicants.push(a); }
    saveDb();
    audit(req, 'cohort.apply', { user, msg: c.id });
    json(res, 200, { cohort: pubCohort(c, user) });
  },
  // 记答辩结果（管理员）：{ id, uid, result:'pass'|'fail'|'absent', note? }。通过即发骨干教师认证。
  'POST /api/cohorts/result': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such cohort' });
    const a = c.applicants.find(x => x.uid === String(body.uid || ''));
    if (!a) return json(res, 404, { error: 'not an applicant' });
    if (!['pass', 'fail', 'absent'].includes(body.result)) return json(res, 400, { error: 'result: pass | fail | absent', code: 'result' });
    a.result = body.result; a.resultNote = str(body.note, 500); a.resultAt = now();
    if (a.result === 'pass' && !db.certificates.some(x => x.uid === a.uid && x.kind === 'backbone')) {
      const t = db.users.find(u => u.id === a.uid) || { id: a.uid, name: a.name, academy: null };
      db.certificates.push({ id: newId(), no: nextNo(), uid: a.uid, name: a.name, org: a.org, orgName: a.orgName, kind: 'backbone', ref: c.id, label: `${KIND_LABEL.backbone} · ${c.term}`, at: now(), by: user.id, byName: user.name, cohortId: c.id, issuedAt: now() });
      void t;
    }
    saveDb();
    audit(req, 'cohort.result', { user, msg: `${c.id} ${a.uid} ${a.result}` });
    json(res, 200, { cohort: pubCohort(c, user) });
  },
  'POST /api/cohorts/close': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const c = find(str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such cohort' });
    c.closedAt = now(); saveDb();
    audit(req, 'cohort.close', { user, msg: c.id });
    json(res, 200, { cohort: pubCohort(c, user) });
  }
  };
}
