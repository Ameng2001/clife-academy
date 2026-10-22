/* Coach 面向专业发展（docs/ROADMAP.md 第五节「Coach」）：迁移方案里的三个任务换对象。
 *   plan（create）：按阶段与本学期自评，排一学期（16 周）的路径——先接着没走完的线，再补自评里最弱的领域，每周两关左右。
 *   review：周回顾——哪条线停了（开始了但 14 天没过关）、哪类实践关反复不过（两次以上「改一改」）、待点评积压；提出变更。
 *   debrief：单关复盘——这一关学了什么、作品点评说了什么、下一步做什么。
 * 变更清单只有两类：add-practice（建议再做一次某个实践任务，带一句怎么做）、pair（建议园长给这个人配带教）。
 * 证据只来自学习记录与作品点评：进度表、提交与点评、每周一题作答、自评、带教配对。不读任何幼儿数据，不读案例正文。
 * 有模型（assistant.js 的 ASSISTANT_* 或 Coach 管理台配置）就让模型在草稿上改措辞与排序；没有就用规则草稿。结构始终由这里定：关卡 id 必须存在、周数 ≤ 20、变更只有两类。
 * 卡片存 db.coachCards；排好的学期计划要本人「采用」才生效（db.coachPlans[uid]），pair 建议要园长在带教配对里自己配。Coach 不代替人做决定。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { PATH_LEN, PATH_NAMES, PATH_KIND, LEVELS, LEVEL_TYPES, LEVEL_DOMAIN, LEVEL_INFO, DOMAINS, ROLE_PATH } from './events-data.js';
import { termOf, ITEMS } from './selfreview.js';
import * as assistant from './assistant.js';
import { systemRules } from './policy.js';

const DAY = 86400000;
export const STALL_DAYS = 14, REVISE_MIN = 2, WEEKS = 16, PER_WEEK = 2, MAX_WEEKS = 20;
const DOMAIN_NAME = Object.fromEntries(DOMAINS.map(d => [d.key, d.name]));
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** 证据：只有学习记录。 */
export function evidenceOf(uid, { db, stateOf, pairs = null, now = Date.now() }) {
  const user = db.users.find(u => u.id === uid) || {};
  const prog = (stateOf(uid) || {}).progress || {};
  const paths = Object.keys(PATH_LEN).filter(p => PATH_KIND[p] !== 'admin').map(p => {
    let d = 0; while (d < PATH_LEN[p] && prog[`${p}-${d}`]?.passedAt) d++;
    const lastAt = d ? prog[`${p}-${d - 1}`].passedAt : null;
    return { path: p, name: PATH_NAMES[p], kind: PATH_KIND[p], done: d, total: PATH_LEN[p], lastAt, stalled: d > 0 && d < PATH_LEN[p] && now - lastAt > STALL_DAYS * DAY, mine: ROLE_PATH[user.academy?.role] === p };
  });
  const subs = (db.submissions || []).filter(s => s.uid === uid);
  const byLevel = {};
  for (const s of subs) { const b = byLevel[s.levelId] = byLevel[s.levelId] || { levelId: s.levelId, title: LEVELS[s.levelId] || s.levelId, revise: 0, pending: 0, pass: false, lastComment: '' }; if (s.status === 'revise') b.revise++; if (s.status === 'pending') b.pending++; if (s.status === 'pass') b.pass = true; if (s.review?.comment || s.review?.text) b.lastComment = s.review.comment || s.review.text; }
  const practice = Object.values(byLevel);
  const drills = (db.drillAnswers || []).filter(a => a.uid === uid).length;
  const term = termOf(now), sr = (db.selfReviews || []).find(r => r.uid === uid && r.term === term.key) || null;
  const certs = (db.certificates || []).filter(c => c.uid === uid);
  const domainCerts = certs.filter(c => c.kind === 'domain').length;
  const stage = user.academy?.role === 'director' ? '管理' : certs.some(c => c.kind === 'backbone') ? '骨干' : domainCerts >= 3 ? '骨干' : (domainCerts >= 1 || paths.some(p => p.kind === 'role' && p.done === p.total)) ? '成长' : '入职';
  const mentor = pairs ? pairs.mentorOf(uid) : null;
  return { uid, name: user.name, role: user.academy?.role || null, stage, paths, practice, drills, selfReview: sr ? { levels: sr.levels, focus: sr.focus } : null, mentor: mentor ? (db.users.find(u => u.id === mentor)?.name || true) : null, now };
}

// 下一个没过的关（按路径）
const nextLevels = (p, from, n) => { const out = []; for (let i = from; i < PATH_LEN[p] && out.length < n; i++) out.push(`${p}-${i}`); return out; };
const pathsForDomain = key => Object.keys(PATH_LEN).filter(p => PATH_KIND[p] === 'domain' && Object.keys(LEVEL_DOMAIN).some(id => id.startsWith(p + '-') && LEVEL_DOMAIN[id] === key));

/** 规则草稿：plan。 */
export function draftPlan(ev) {
  const queue = [];   // [{ path, why }]
  const mine = ev.paths.find(p => p.mine && p.done < p.total); if (mine) queue.push({ path: mine.path, why: mine.done ? '本岗位路径还没走完，先接着走' : '本岗位路径先走起来' });
  for (const p of ev.paths.filter(p => p.stalled && !queue.some(q => q.path === p.path))) queue.push({ path: p.path, why: `「${p.name}」停了 ${Math.round((ev.now - p.lastAt) / DAY)} 天，接上` });
  if (ev.selfReview) {
    const weak = Object.entries(ev.selfReview.levels).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k]) => k);
    for (const k of weak) for (const p of pathsForDomain(k)) { const x = ev.paths.find(y => y.path === p); if (x && x.done < x.total && !queue.some(q => q.path === p)) queue.push({ path: p, why: `自评里「${DOMAIN_NAME[k]}」最弱` }); }
  }
  if (ev.stage === '入职' && PATH_LEN.onboard && !queue.some(q => q.path === 'onboard')) { const x = ev.paths.find(y => y.path === 'onboard'); if (x && x.done < x.total) queue.push({ path: 'onboard', why: '入职阶段先把新教师入职路径走完' }); }
  if (ev.stage === '管理' && PATH_LEN.manage && !queue.some(q => q.path === 'manage')) { const x = ev.paths.find(y => y.path === 'manage'); if (x && x.done < x.total) queue.push({ path: 'manage', why: '管理阶段：园所管理路径' }); }
  if (ev.stage === '骨干' && PATH_LEN.backbone && !queue.some(q => q.path === 'backbone')) { const x = ev.paths.find(y => y.path === 'backbone'); if (x && x.done < x.total) queue.push({ path: 'backbone', why: '骨干阶段：主题与项目课程' }); }
  for (const p of ev.paths.filter(p => p.kind === 'domain' && p.done < p.total && !queue.some(q => q.path === p.path))) queue.push({ path: p.path, why: '还没开始的领域路径' });
  const cursor = Object.fromEntries(ev.paths.map(p => [p.path, p.done]));
  const weeks = [];
  let qi = 0;
  for (let w = 1; w <= WEEKS && queue.length; w++) {
    const levelIds = [];
    let guard = 0;
    while (levelIds.length < PER_WEEK && guard++ < queue.length * 2) {
      const q = queue[qi % queue.length]; qi++;
      const ids = nextLevels(q.path, cursor[q.path], 1);
      if (!ids.length) continue;
      if (LEVEL_TYPES[ids[0]] === 'practice') { if (levelIds.length) { qi--; break; } cursor[q.path]++; levelIds.push(ids[0]); break; }   // 实践关那周只排一关
      cursor[q.path]++; levelIds.push(ids[0]);
    }
    if (!levelIds.length) break;
    weeks.push({ week: w, levelIds, why: queue.find(q => levelIds[0].startsWith(q.path + '-'))?.why || '' });
  }
  const focus = ev.selfReview?.focus ? `你自己定的：${ev.selfReview.focus}` : '';
  return { kind: 'plan', stage: ev.stage, term: termOf(ev.now).label, summary: `${ev.stage}阶段，一学期 ${weeks.length} 周，每周 ${PER_WEEK} 关左右，实践关那周只排一关。${focus}`.trim(), lines: queue.slice(0, 6).map(q => `${PATH_NAMES[q.path]}：${q.why}`), weeks, changes: [] };
}

/** 规则草稿：review。 */
export function draftReview(ev) {
  const changes = [], notes = [];
  const stalled = ev.paths.filter(p => p.stalled);
  for (const p of stalled) notes.push(`「${p.name}」走到第 ${p.done} 关后停了 ${Math.round((ev.now - p.lastAt) / DAY)} 天`);
  for (const b of ev.practice.filter(b => b.revise >= REVISE_MIN && !b.pass)) changes.push({ type: 'add-practice', levelId: b.levelId, why: `「${b.title}」改了 ${b.revise} 次还没过${b.lastComment ? '，点评说：' + b.lastComment.slice(0, 60) : ''}`, how: '先别重交：把上一次点评里的那一条单独练一次，交之前找带教教师或同事看一眼。' });
  const pending = ev.practice.filter(b => b.pending).length; if (pending) notes.push(`${pending} 份作品在等点评`);
  if (!ev.mentor && (ev.stage === '入职' || changes.length)) changes.push({ type: 'pair', why: ev.stage === '入职' ? '入职阶段还没有带教教师' : '实践关反复不过，有人看着改会快一些', how: '由园长在园长看板「带教配对」里配；Coach 只提建议。' });
  if (!ev.drills) notes.push('这学期还没答过每周一题');
  const nochange = !changes.length && !stalled.length;
  const summary = nochange ? `这周没什么要调：${ev.paths.filter(p => p.done).length} 条路径在走，作品没有反复不过的。` : `${stalled.length ? stalled.length + ' 条线停了' : ''}${stalled.length && changes.length ? '，' : ''}${changes.length ? changes.length + ' 条建议' : ''}。`;
  return { kind: 'review', nochange, summary, notes, changes, stalled: stalled.map(p => ({ path: p.path, name: p.name, done: p.done, total: p.total, days: Math.round((ev.now - p.lastAt) / DAY) })) };
}

/** 规则草稿：debrief。 */
export function draftDebrief(ev, levelId, { db }) {
  const info = LEVEL_INFO[levelId] || {}, type = LEVEL_TYPES[levelId] || 'tool';
  const sub = (db.submissions || []).filter(s => s.uid === ev.uid && s.levelId === levelId).sort((a, b) => b.at - a.at)[0] || null;
  const points = [];
  if (info.goal) points.push(`这一关要能做到：${info.goal}`);
  if (type === 'practice') points.push(sub ? (sub.status === 'pass' ? '作品通过了点评' : sub.status === 'revise' ? '作品被退回改一改' : '作品还在等点评') : '还没交作品');
  if (sub?.review?.comment || sub?.review?.text) points.push(`点评说：${(sub.review.comment || sub.review.text).slice(0, 200)}`);
  if (type === 'seminar') points.push('研讨关：看别人怎么答，比自己答对更重要');
  const next = type === 'practice' && sub?.status === 'revise' ? '照点评里的那一条改，改一处就交' : type === 'practice' && !sub ? `按证据要求交一份：${info.steps?.[0] || ''}` : '下一关接着走，这一关的做法下周在班里再用一次';
  return { kind: 'debrief', levelId, title: LEVELS[levelId] || levelId, type, domain: LEVEL_DOMAIN[levelId] ? DOMAIN_NAME[LEVEL_DOMAIN[levelId]] : null, summary: points.join('；') || '这一关还没有记录。', next, changes: [] };
}

export const SYSTEM = `你是幼儿园教师专业发展的 Coach，只根据给你的学习记录（路径进度、作品点评、每周一题、自评、带教）说话。
${systemRules(['work-not-person', 'child-data', 'no-ranking', 'no-checkin', 'plain'])}
你收到一份规则草稿（JSON），只改措辞与排序，不改结构：关卡 id 不能换、不能加；changes 只能是草稿里已有的那几条，可以改 why 和 how 的措辞。
用简体中文，句子短。只输出 JSON，不要别的。`;

async function polish(draft, ev) {
  if (!assistant.configured()) return { card: draft, model: false };
  try {
    const text = await assistant.complete({ system: SYSTEM, prompt: `学习记录：${JSON.stringify({ stage: ev.stage, paths: ev.paths.filter(p => p.done || p.mine), practice: ev.practice, selfReview: ev.selfReview, mentor: !!ev.mentor })}\n\n草稿：${JSON.stringify(draft)}`, maxTokens: 1600 });
    const j = assistant.parseJson(text);
    if (!j || typeof j !== 'object') return { card: draft, model: false };
    // 结构照草稿，措辞取模型的
    const out = { ...draft };
    if (typeof j.summary === 'string' && j.summary.trim()) out.summary = j.summary.trim().slice(0, 600);
    if (Array.isArray(j.lines)) out.lines = j.lines.filter(x => typeof x === 'string').map(x => x.slice(0, 200)).slice(0, 8);
    if (Array.isArray(j.notes)) out.notes = j.notes.filter(x => typeof x === 'string').map(x => x.slice(0, 200)).slice(0, 8);
    if (typeof j.next === 'string' && draft.next !== undefined) out.next = j.next.trim().slice(0, 300);
    if (Array.isArray(j.changes) && draft.changes.length) out.changes = draft.changes.map((c, i) => { const m = j.changes.find(x => x && x.type === c.type && (!c.levelId || x.levelId === c.levelId)) || j.changes[i]; return m ? { ...c, why: str(m.why, 200) || c.why, how: str(m.how, 300) || c.how } : c; });
    if (Array.isArray(j.weeks) && draft.weeks) out.weeks = draft.weeks.map((w, i) => { const m = j.weeks.find(x => x && x.week === w.week) || j.weeks[i]; return m && typeof m.why === 'string' ? { ...w, why: m.why.slice(0, 200) } : w; });
    return { card: out, model: true };
  } catch { return { card: draft, model: false }; }
}

export function coachRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, readStateCached, pairs = null }) {
  db.coachCards = db.coachCards || []; db.coachPlans = db.coachPlans || {};
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const pubCard = c => ({ id: c.id, kind: c.kind, at: c.at, model: c.model, accepted: c.accepted ?? null, ...c.card });
  const planOf = uid => { const p = db.coachPlans[uid]; if (!p) return null; const prog = (readStateCached(uid) || {}).progress || {}; const week = Math.min(p.weeks.length, Math.max(1, Math.floor((now() - p.acceptedAt) / (7 * DAY)) + 1)); const w = p.weeks.find(x => x.week === week) || null; return { cardId: p.cardId, acceptedAt: p.acceptedAt, term: p.term, weeks: p.weeks.length, week, levels: w ? w.levelIds.map(id => ({ id, title: LEVELS[id] || id, type: LEVEL_TYPES[id] || 'tool', passed: !!prog[id]?.passedAt })) : [], why: w?.why || '' }; };
  const run = async (user, kind, body) => {
    const ev = evidenceOf(user.id, { db, stateOf: readStateCached, pairs, now: now() });
    let draft;
    if (kind === 'plan') draft = draftPlan(ev);
    else if (kind === 'review') draft = draftReview(ev);
    else { const levelId = str(body.levelId, 40); if (!LEVELS[levelId]) return null; draft = draftDebrief(ev, levelId, { db }); }
    const { card, model } = await polish(draft, ev);
    const row = { id: newId(), uid: user.id, org: orgKeyOf(user), kind, at: now(), model, card, accepted: null };
    db.coachCards.push(row);
    db.coachCards = db.coachCards.filter(c => c.uid !== user.id || now() - c.at < 180 * DAY);
    saveDb();
    return row;
  };

  return {
  // 最近的卡片、采用中的学期计划、Coach 的边界说明
  'GET /api/me/coach': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const cards = db.coachCards.filter(c => c.uid === user.id).sort((a, b) => b.at - a.at).slice(0, 12).map(pubCard);
    json(res, 200, { cards, plan: planOf(user.id), model: assistant.configured(), evidence: '只读学习记录：路径进度、作品与点评、每周一题、自评、带教配对。不读幼儿数据，不读案例正文。', stage: evidenceOf(user.id, { db, stateOf: readStateCached, pairs }).stage });
  },
  // 排一学期：{}
  'POST /api/me/coach/plan': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const row = await run(user, 'plan', {});
    audit(req, 'coach.plan', { user, msg: row.id });
    json(res, 200, { card: pubCard(row) });
  },
  // 周回顾：{}
  'POST /api/me/coach/review': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const row = await run(user, 'review', {});
    audit(req, 'coach.review', { user, msg: row.id });
    json(res, 200, { card: pubCard(row) });
  },
  // 单关复盘：{ levelId }
  'POST /api/me/coach/debrief': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const row = await run(user, 'debrief', body);
    if (!row) return json(res, 404, { error: 'no such level', code: 'level' });
    audit(req, 'coach.debrief', { user, msg: row.id });
    json(res, 200, { card: pubCard(row) });
  },
  // 采用 / 不采用一张卡：{ id, on }。plan 采用后成为学期计划（首页「本周待学」）；review 的 pair 建议进园长看板；不采用就只是留着
  'POST /api/me/coach/accept': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = db.coachCards.find(x => x.id === str(body.id, 40) && x.uid === user.id);
    if (!c) return json(res, 404, { error: 'no such card' });
    c.accepted = body.on !== false;
    if (c.kind === 'plan') { if (c.accepted) db.coachPlans[user.id] = { cardId: c.id, acceptedAt: now(), term: c.card.term, weeks: c.card.weeks }; else if (db.coachPlans[user.id]?.cardId === c.id) delete db.coachPlans[user.id]; }
    saveDb();
    audit(req, 'coach.accept', { user, msg: `${c.id} ${c.accepted}` });
    json(res, 200, { card: pubCard(c), plan: planOf(user.id) });
  },
  // 园长：本园成员采用了的 review 里的 pair 建议（还没配对的）
  'GET /api/org/coach': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (user.academy?.role !== 'director' && !isAdmin(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const org = orgKeyOf(user);
    const rows = db.coachCards.filter(c => c.kind === 'review' && c.accepted && c.org === org && c.card.changes.some(x => x.type === 'pair') && !(pairs && pairs.mentorOf(c.uid)))
      .map(c => ({ uid: c.uid, name: db.users.find(u => u.id === c.uid)?.name || c.uid, at: c.at, why: c.card.changes.find(x => x.type === 'pair').why }));
    const seen = new Set();
    json(res, 200, { suggestions: rows.filter(r => !seen.has(r.uid) && seen.add(r.uid)) });
  }
  };
}
