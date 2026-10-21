/* 发展档案与学时证明（docs/ROADMAP.md 第五节「发展档案」、继续教育学时）。
 *
 * 发展档案：本人全部学习与作品记录，随人走。JSON 导出 ＋ 网页可打印成 PDF。
 *   含：通过的关（含测验对错数，本人可见）、实践与研讨作答及点评结论（点评人署名与一句意见）、入库案例、斗课作品与入选、
 *       研讨关作答数、证书、勋章、称号、学分台账、工作室与共同体、答疑被采纳数、预约过的大讲堂。
 *   不含：幼儿数据（平台本来就没有）、AI 的中间判断（答疑助手草稿、Coach 建议都不进档案）、别人的测验分。
 * 学时证明：按本地运营方与市教育局谈定的格式出具。格式与计时规则是可配的（db.hoursRule，管理员改），默认：
 *   1 学时 = 45 分钟；工具关按关卡时长；实践关另加 60 分钟（作品）；研讨关另加 30 分钟（作答）；骨干认证通过加 240 分钟（答辩）；
 *   大讲堂预约不计（没有到场记录）。学时按 0.5 向下取整。证明有编号可核验，出具时把规则快照存下来，规则以后改了旧证明不变。
 * db.hoursCerts: { id, no 'XS-<年>-<五位>', uid, name, orgName, from, to, hours, minutes, lines:[{kind,label,count,minutes}], rule, at } */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { LEVELS, LEVEL_TYPES, LEVEL_INFO, PATH_NAMES, PATH_LEN, PATH_KIND } from './events-data.js';
import { earnedOf } from './certificates.js';
import { badgesOf, titlesOf } from './honors.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const DEFAULT_RULE = Object.freeze({ minutesPerHour: 45, practiceExtra: 60, seminarExtra: 30, backboneMinutes: 240, lectureCounts: false, roundTo: 0.5,
  title: '继续教育学时证明', issuer: '本地运营方（待与市教育局、教师发展中心确认出具方）', signer: '', note: '本证明所列学时按平台学习记录计算，计时规则见背面；证明编号可在平台核验。' });
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
export const sanitizeRule = r => ({ minutesPerHour: num(r.minutesPerHour, 45, 1, 600), practiceExtra: num(r.practiceExtra, 60, 0, 600), seminarExtra: num(r.seminarExtra, 30, 0, 600), backboneMinutes: num(r.backboneMinutes, 240, 0, 6000), lectureCounts: !!r.lectureCounts, roundTo: [0.25, 0.5, 1].includes(Number(r.roundTo)) ? Number(r.roundTo) : 0.5,
  title: str(r.title, 40) || DEFAULT_RULE.title, issuer: str(r.issuer, 80) || DEFAULT_RULE.issuer, signer: str(r.signer, 40), note: str(r.note, 400) });
/** 学年：9 月 1 日起。 */
export const schoolYearOf = ts => { const d = new Date(ts); const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return { label: `${y}–${y + 1} 学年`, from: new Date(y, 8, 1).getTime(), to: new Date(y + 1, 7, 31, 23, 59, 59).getTime() }; };

/** 纯函数：一个人在一段时间里的学时。 */
export function hoursOf(uid, { from, to, rule, db, stateOf }) {
  const inRange = t => t && t >= from && t <= to;
  const S = stateOf(uid) || {}, prog = S.progress || {};
  const lines = [];
  let tool = 0, toolMin = 0, pr = 0, prMin = 0, sem = 0, semMin = 0;
  for (const [id, p] of Object.entries(prog)) {
    if (!LEVELS[id] || !inRange(p?.passedAt)) continue;
    const m = LEVEL_INFO[id]?.minutes || 0, t = LEVEL_TYPES[id];
    if (t === 'practice') { pr++; prMin += m + rule.practiceExtra; } else if (t === 'seminar') { sem++; semMin += m + rule.seminarExtra; } else { tool++; toolMin += m; }
  }
  if (tool) lines.push({ kind: 'tool', label: '工具关通过（按关卡时长）', count: tool, minutes: toolMin });
  if (pr) lines.push({ kind: 'practice', label: `实践关作品通过点评（关卡时长 ＋ ${rule.practiceExtra} 分钟）`, count: pr, minutes: prMin });
  if (sem) lines.push({ kind: 'seminar', label: `研讨关作答（关卡时长 ＋ ${rule.seminarExtra} 分钟）`, count: sem, minutes: semMin });
  const bb = (db.certificates || []).filter(c => c.uid === uid && c.kind === 'backbone' && inRange(c.at));
  if (bb.length && rule.backboneMinutes) lines.push({ kind: 'backbone', label: '骨干教师认证答辩通过', count: bb.length, minutes: bb.length * rule.backboneMinutes });
  if (rule.lectureCounts) { const ls = (db.lectures || []).filter(l => l.bookings?.includes(uid) && inRange(l.at) && l.at + (l.minutes || 60) * 60000 < Date.now()); if (ls.length) lines.push({ kind: 'lecture', label: '园长大讲堂（预约且已开播）', count: ls.length, minutes: ls.reduce((a, l) => a + (l.minutes || 60), 0) }); }
  const pg = (db.programs || []).filter(p => p.hours > 0 && p.applicants.some(a => a.uid === uid && a.status === 'completed' && inRange(a.completedAt || p.closedAt || p.to)));
  if (pg.length) lines.push({ kind: 'program', label: '研修项目（完成，按期次学时）', count: pg.length, minutes: Math.round(pg.reduce((a, p) => a + p.hours, 0) * rule.minutesPerHour) });
  const minutes = lines.reduce((a, l) => a + l.minutes, 0);
  const raw = minutes / rule.minutesPerHour, hours = Math.floor(raw / rule.roundTo) * rule.roundTo;
  return { from, to, lines, minutes, hours: Number(hours.toFixed(2)), rule };
}

/** 档案的组装，portfolioRoutes 与 transfer.js（迁移包）共用。 */
export function createPortfolioOf({ db, readStateCached, pairs = null, ledger = null, communities = null }) {
  const now = () => Date.now();

  const portfolioOf = user => {
    const uid = user.id, S = readStateCached(uid) || {}, prog = S.progress || {};
    const levels = Object.entries(prog).filter(([id, p]) => LEVELS[id] && p?.passedAt).map(([id, p]) => ({ id, title: LEVELS[id], path: id.split(/-(?=\d+$)/)[0], pathName: PATH_NAMES[id.split(/-(?=\d+$)/)[0]], type: LEVEL_TYPES[id], minutes: LEVEL_INFO[id]?.minutes || 0, passedAt: p.passedAt, quiz: p.quiz && p.quiz.of > 0 ? { right: Number(p.quiz.right) || 0, of: Number(p.quiz.of) || 0 } : null })).sort((a, b) => a.passedAt - b.passedAt);
    const paths = Object.keys(PATH_LEN).map(p => { let d = 0; while (d < PATH_LEN[p] && prog[`${p}-${d}`]?.passedAt) d++; return { path: p, name: PATH_NAMES[p], kind: PATH_KIND[p], done: d, total: PATH_LEN[p], finishedAt: d >= PATH_LEN[p] ? prog[`${p}-${PATH_LEN[p] - 1}`].passedAt : null }; }).filter(x => x.done > 0);
    const subs = (db.submissions || []).filter(s => s.uid === uid).map(s => ({ id: s.id, levelId: s.levelId, levelTitle: LEVELS[s.levelId] || s.levelId, type: s.type, text: s.text, files: (s.files || []).length, status: s.status, at: s.at, review: s.review ? { byName: s.review.byName, verdict: s.review.verdict || s.review.status || null, comment: s.review.comment || s.review.text || '', at: s.review.at } : null }));
    const cases = (db.cases || []).filter(c => c.by === uid).map(c => ({ id: c.id, title: c.title, domain: c.domain, age: c.age, status: c.status, at: c.at, tag: c.source?.tag || null, selected: !!c.source?.selected, showcase: c.showcase || null, communityName: c.communityName || null }));
    const entries = (db.entries || []).filter(e => e.uid === uid).map(e => { const c = (db.contests || []).find(x => x.id === e.contestId); return { contest: c ? c.title : e.contestId, level: c?.level || 'org', month: c?.month || null, at: e.at, selected: !!c?.selected?.includes(e.id) }; });
    const e = earnedOf(uid, { db, stateOf: readStateCached, user });
    const certificates = (db.certificates || []).filter(c => c.uid === uid).map(c => ({ no: c.no, kind: c.kind, label: c.label, at: c.at, byName: c.byName || null }));
    const badges = badgesOf(uid, { db, stateOf: readStateCached, pairs }).filter(b => b.on).map(b => ({ key: b.key, kind: b.kind, name: b.name, at: b.at }));
    const titles = (db.titles || []).filter(t => t.uid === uid).map(t => ({ label: t.label, reason: t.reason, byName: t.byName, at: t.at }));
    const credits = ledger ? ledger.of(uid).map(c => ({ kind: c.kind, n: c.n, note: c.note, at: c.at })) : [];
    const studios = (db.studios || []).filter(s => s.members.some(m => m.uid === uid) || s.hostUid === uid).map(s => ({ name: s.name, role: s.hostUid === uid ? '主持人' : '成员', at: s.members.find(m => m.uid === uid)?.at || s.at }));
    const community = communities ? communities.ofOrg(orgKeyOf(user)) : null;
    const lectures = (db.lectures || []).filter(l => l.bookings?.includes(uid)).map(l => ({ title: l.title, speaker: l.speaker, at: l.at, minutes: l.minutes }));
    const studyReplies = (db.studyTasks || []).filter(t => t.replies.some(r => r.uid === uid)).map(t => { const r = t.replies.find(x => x.uid === uid); return { title: t.title, text: r.text, at: r.updatedAt || r.at }; });
    const programs = (db.programs || []).filter(p => p.applicants.some(a => a.uid === uid && (a.status === 'accepted' || a.status === 'completed'))).map(p => { const a = p.applicants.find(x => x.uid === uid); return { title: p.title, kind: p.kind, term: p.term, from: p.from, to: p.to, hours: p.hours, status: a.status, completedAt: a.completedAt || null }; });
    const camps = (db.camps || []).filter(c => c.closedAt && (c.graduates || []).includes(uid)).map(c => ({ title: c.title, days: c.days.length, posts: c.posts.filter(p => p.uid === uid).length, closedAt: c.closedAt }));
    const selfReviews = (db.selfReviews || []).filter(r => r.uid === uid).map(r => ({ term: r.term, levels: r.levels, focus: r.focus, reflection: r.reflection, at: r.updatedAt || r.at, comments: (db.peerReviews || []).filter(p => p.uid === uid && p.term === r.term).map(p => ({ role: p.role, byName: p.byName, text: p.text, at: p.updatedAt || p.at })) }));
    const answersAccepted = (db.questions || []).reduce((n, q) => n + q.answers.filter(a => a.by === uid && a.accepted).length, 0);
    const drillAnswers = (db.drillAnswers || []).filter(a => a.uid === uid).length;
    const sharers = (db.showcases || []).filter(s => s.sharers.some(x => x.uid === uid)).map(s => ({ title: s.title, year: s.year }));
    return { format: 'clife-academy-portfolio/1', exportedAt: now(), person: { name: user.name, orgName: user.academy?.org?.name || null, role: user.academy?.role || null, districtName: user.academy?.district?.name || null },
      summary: { levels: levels.length, minutes: levels.reduce((a, l) => a + l.minutes, 0), works: subs.filter(s => s.type === 'practice' && s.status === 'pass').length, seminars: subs.filter(s => s.type === 'seminar').length, cases: cases.filter(c => c.status === 'approved').length, certificates: certificates.length, badges: badges.length, titles: titles.length, creditsTotal: ledger ? ledger.total(uid) : 0, drillAnswers, answersAccepted },
      paths, levels, submissions: subs, cases, contests: entries, showcases: sharers, certificates, progress: { tool: e.tool, domains: e.domains, seven: e.seven, backbone: e.backbone }, badges, titles, credits, studios, community: community ? { name: community.name } : null, lectures, studyReplies, programs, camps, selfReviews,
      history: (user.academy?.history || []).map(h => ({ orgName: h.orgName, role: h.role, from: h.from, to: h.to })),
      imports: (db.imports || []).filter(i => i.uid === uid).map(i => ({ id: i.id, issuer: i.issuer, issuedAt: i.issuedAt, person: i.person, summary: i.summary, verified: i.verified, at: i.at })),
      excluded: ['幼儿数据（平台不采集）', 'AI 中间判断（答疑助手草稿、Coach 建议）', '他人的测验分与点评'] };
  };
  return portfolioOf;
}

export function portfolioRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, readStateCached, pairs = null, ledger = null, communities = null }) {
  db.hoursCerts = db.hoursCerts || [];
  const now = () => Date.now();
  const portfolioOf = createPortfolioOf({ db, readStateCached, pairs, ledger, communities });
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const ruleNow = () => sanitizeRule({ ...DEFAULT_RULE, ...(db.hoursRule || {}) });
  const nextNo = () => { const y = new Date().getFullYear(); const n = db.hoursCerts.filter(c => c.no.startsWith(`XS-${y}-`)).length + 1; return `XS-${y}-${String(n).padStart(5, '0')}`; };
  const pubCert = c => ({ id: c.id, no: c.no, name: c.name, orgName: c.orgName, from: c.from, to: c.to, hours: c.hours, minutes: c.minutes, lines: c.lines, rule: c.rule, at: c.at });

  return {
  // 发展档案：?download=1 作为文件下载
  'GET /api/me/portfolio': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const p = portfolioOf(user);
    const dl = new URL(req.url, 'http://x').searchParams.get('download') === '1';
    if (dl) audit(req, 'portfolio.export', { user, msg: 'json' });
    json(res, 200, p, dl ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`发展档案-${user.name}-${new Date().toISOString().slice(0, 10)}.json`)}` } : undefined);
  },
  // 学时规则与格式：全员可读（证明背面要印），管理员改
  'GET /api/hours/rule': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { rule: ruleNow(), canEdit: isAdmin(user), defaults: DEFAULT_RULE });
  },
  'PUT /api/hours/rule': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    db.hoursRule = sanitizeRule({ ...ruleNow(), ...body }); saveDb();
    audit(req, 'hours.rule', { user, msg: JSON.stringify(db.hoursRule).slice(0, 200) });
    json(res, 200, { rule: db.hoursRule });
  },
  // 本人学时：?from=&to=（时间戳；缺省本学年）→ 预览 ＋ 已出具的证明
  'GET /api/me/hours': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const sp = new URL(req.url, 'http://x').searchParams, sy = schoolYearOf(now());
    const from = Number(sp.get('from')) || sy.from, to = Number(sp.get('to')) || sy.to;
    const h = hoursOf(user.id, { from, to, rule: ruleNow(), db, stateOf: readStateCached });
    json(res, 200, { ...h, schoolYear: sy, certs: db.hoursCerts.filter(c => c.uid === user.id).sort((a, b) => b.at - a.at).map(pubCert) });
  },
  // 出具：{ from, to }。同一区间只出一份（再出就返回已有的）。
  'POST /api/me/hours/issue': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req), sy = schoolYearOf(now());
    const from = Number(body.from) || sy.from, to = Number(body.to) || sy.to;
    if (to <= from) return json(res, 400, { error: 'range', code: 'range' });
    let c = db.hoursCerts.find(x => x.uid === user.id && x.from === from && x.to === to);
    if (!c) {
      const h = hoursOf(user.id, { from, to, rule: ruleNow(), db, stateOf: readStateCached });
      if (!h.minutes) return json(res, 400, { error: 'nothing to certify in this range', code: 'empty' });
      c = { id: newId(), no: nextNo(), uid: user.id, name: user.name, org: orgKeyOf(user), orgName: user.academy?.org?.name || null, from, to, hours: h.hours, minutes: h.minutes, lines: h.lines, rule: h.rule, at: now() };
      db.hoursCerts.push(c); saveDb();
      audit(req, 'hours.issue', { user, msg: `${c.no} ${c.hours}` });
    }
    json(res, 200, { cert: pubCert(c) });
  },
  'GET /api/me/hours/one': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const c = db.hoursCerts.find(x => x.id === (new URL(req.url, 'http://x').searchParams.get('id') || '') && x.uid === user.id);
    if (!c) return json(res, 404, { error: 'no such certificate' });
    json(res, 200, { cert: pubCert(c) });
  },
  // 核验（公开，脱敏）
  'GET /api/hours/verify': async (req, res) => {
    const no = str(new URL(req.url, 'http://x').searchParams.get('no') || '', 20).toUpperCase();
    const c = db.hoursCerts.find(x => x.no === no);
    if (!c) return json(res, 404, { valid: false });
    json(res, 200, { valid: true, no: c.no, name: c.name.length > 1 ? c.name[0] + '*'.repeat(c.name.length - 1) : c.name, orgName: c.orgName, from: c.from, to: c.to, hours: c.hours, at: c.at, issuer: c.rule.issuer });
  }
  };
}
