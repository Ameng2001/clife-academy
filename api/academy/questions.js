/* 答疑：问种子教师 ＋ 答疑助手（docs/ROADMAP.md 第六节「问种子教师」；AI 只做整理，不做陪聊答疑）。
 *
 * 产品形态是一个带上下文的助手，不是聊天框：每关底部「问一问」，问题带关卡；提交后助手立刻做三件事——
 *   1. 整理：归类（操作 / 口径 / 合规 / 内容 / 其他）、找本园与共同体里相似的已答问题、本关要点与引用条文、相关案例
 *   2. 起草：接了模型时，只依据上面这些材料起草一条回答，标注引用与把握（高 / 低）；没把握就只给材料
 *   3. 分流：转给本园种子教师（点评人）、园长、带教教师；两个工作日无人答转本地讲师（管理员）
 * 助手的草稿不算回答：种子教师「确认」（可改）后才成为回答；提问人可「采纳」一条回答；答疑被采纳计贡献勋章。
 * 不做：陪聊、追问式对话、生成观察记录或评价幼儿、离开本关与课程范围的问题（助手会说转人工）。
 * db.questions: { id, uid, name, org, orgName, levelId, levelTitle, path, text, at, status:'open'|'answered'|'closed', escalatedAt,
 *                 assistant:{ category, summary, draft, confidence, sources:[{kind,id,title,text?}], model, at, note } | null,
 *                 answers:[{ id, by, byName, role, text, at, fromAssistant, accepted, acceptedAt }], closedAt, closedBy, resolvedNote } */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { canReview } from './submissions.js';
import { LEVELS, LEVEL_INFO, PATH_NAMES, LEVEL_DOMAIN, DOMAINS } from './events-data.js';
import { complete, configured, parseJson } from './assistant.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const norm = s => String(s || '').toLowerCase().replace(/[\s，。、？！：；“”「」（）()、,.?!:;]/g, '');
export const CATEGORIES = Object.freeze({ op: '平台操作', rule: '口径与规范', policy: '合规与边界', content: '课程内容', other: '其他' });
export const ESCALATE_WORKDAYS = 2;

/** 二元字 gram 重合度（0–1），中文短句够用。 */
export function similarity(a, b) {
  const g = s => { const t = norm(s); const out = new Set(); for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2)); return out; };
  const A = g(a), B = g(b); if (!A.size || !B.size) return 0;
  let hit = 0; for (const x of A) if (B.has(x)) hit++;
  return hit / Math.min(A.size, B.size);
}
/** 两个工作日之后（跳过周六日）的时间点。 */
export function workdaysLater(ts, n = ESCALATE_WORKDAYS) { const d = new Date(ts); let left = n; while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) left--; } return d.getTime(); }
const ROLE_LABEL = { admin: '本地讲师', director: '园长', reviewer: '种子教师', mentor: '带教教师', curator: '案例审核人' };

export function questionRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, pairs = null, communities = null, notifier = null }) {
  db.questions = db.questions || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const find = id => db.questions.find(q => q.id === id);
  const scopeOrgs = org => { const c = communities && org ? communities.ofOrg(org) : null; return new Set(c ? c.orgs.map(o => o.key) : (org ? [org] : [])); };
  const roleFor = (user, q) => (isAdmin(user) ? 'admin' : user.academy?.role === 'director' ? 'director' : pairs && pairs.isMentorOf(user.id, q.uid) ? 'mentor' : user.academy?.reviewer ? 'reviewer' : null);
  const mayAnswer = (user, q) => { const r = roleFor(user, q); if (!r) return false; if (r === 'admin' || r === 'mentor') return true; return !!orgKeyOf(user) && orgKeyOf(user) === q.org && canReview(user, isAdmin); };
  const maySee = (user, q) => q.uid === user.id || mayAnswer(user, q) || (q.status !== 'open' && scopeOrgs(orgKeyOf(user)).has(q.org));

  /** 规则整理：相似已答问题、本关要点、相关案例。 */
  const gather = (user, levelId, text) => {
    const scope = scopeOrgs(orgKeyOf(user));
    const answered = db.questions.filter(q => q.status !== 'open' && q.answers.some(a => a.accepted || a.fromAssistant) && (scope.has(q.org) || isAdmin(user)))
      .map(q => ({ q, s: similarity(text, q.text) + (q.levelId === levelId ? 0.15 : 0) })).filter(x => x.s >= 0.3).sort((a, b) => b.s - a.s).slice(0, 3);
    const info = LEVEL_INFO[levelId] || null;
    const cases = (db.cases || []).filter(c => c.status === 'approved').map(c => ({ c, s: similarity(text, c.title + ' ' + (c.text || '').slice(0, 200)) })).filter(x => x.s >= 0.25).sort((a, b) => b.s - a.s).slice(0, 2);
    const sources = [];
    if (info) sources.push({ kind: 'level', id: levelId, title: `本关「${LEVELS[levelId] || levelId}」要点`, text: [info.goal, ...info.steps.map((s, i) => `${i + 1}. ${s}`), ...info.refs.map(r => '引用：' + r)].filter(Boolean).join('\n') });
    for (const x of answered) { const best = x.q.answers.find(a => a.accepted) || x.q.answers.find(a => a.fromAssistant) || x.q.answers[0]; sources.push({ kind: 'question', id: x.q.id, title: `相似问题：${x.q.text.slice(0, 40)}`, text: best ? best.text : '' }); }
    for (const x of cases) sources.push({ kind: 'case', id: x.c.id, title: `案例：${x.c.title}`, text: (x.c.text || '').slice(0, 300) });
    return sources;
  };
  const SYSTEM = `你是「C-Life 学前大课堂」的答疑助手，服务对象是幼儿园教职工。你只做整理与起草，不聊天。
规则：
1. 只依据下面给的材料回答；材料里没有的，不要编，把 confidence 设为 low，并在 answer 里说明建议请种子教师或本地讲师回答。
2. 回答对象是教师本人的操作、口径、课程内容；不生成观察记录、不评价任何幼儿、不给幼儿贴标签、不涉及幼儿个人数据。遇到这类请求，answer 写明这不在助手范围，交人工。
3. 用平实的中文，不超过 200 字，先给做法再给依据；引用材料时写材料编号，如 [1]。
4. 只输出一个 JSON 对象：{"category":"op|rule|policy|content|other","summary":"一句话概括问题（≤30 字）","answer":"草稿或说明","confidence":"high|low","cites":[材料编号数组]}`;

  const runAssistant = async (user, q) => {
    const sources = gather(user, q.levelId, q.text);
    const base = { category: 'other', summary: null, draft: null, confidence: null, sources: sources.map(s => ({ kind: s.kind, id: s.id, title: s.title })), model: null, at: now(), note: '' };
    if (!configured()) return { ...base, note: '助手只做了整理（没有接模型）：相似问题、本关要点与相关案例在下面；问题已转给本园种子教师。' };
    const material = sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.text || ''}`).join('\n\n');
    const prompt = `关卡：${PATH_NAMES[q.path] || q.path} · ${q.levelTitle}${LEVEL_DOMAIN[q.levelId] ? ' · 领域：' + (DOMAINS.find(d => d.key === LEVEL_DOMAIN[q.levelId])?.name || '') : ''}\n提问人岗位：${user.academy?.role || ''}\n问题：${q.text}\n\n材料：\n${material || '（没有找到相关材料）'}`;
    const r = await complete({ system: SYSTEM, prompt });
    const j = r && parseJson(r.text);
    if (!j) return { ...base, note: r ? '助手没整理出可用的草稿，问题已转给本园种子教师。' : '助手暂时没连上模型，问题已转给本园种子教师。' };
    const cites = (Array.isArray(j.cites) ? j.cites : []).map(n => Number(n)).filter(n => n >= 1 && n <= sources.length);
    return { ...base, category: Object.hasOwn(CATEGORIES, j.category) ? j.category : 'other', summary: str(String(j.summary || ''), 60) || null, draft: str(String(j.answer || ''), 1200) || null, confidence: j.confidence === 'high' ? 'high' : 'low', cites, model: r.model, note: j.confidence === 'high' ? '助手按材料起草，种子教师确认后才算回答。' : '助手把握不大，先给材料；等种子教师回答。' };
  };
  const pubAnswer = a => ({ id: a.id, byName: a.byName, role: a.role, roleLabel: ROLE_LABEL[a.role] || a.role, text: a.text, at: a.at, fromAssistant: !!a.fromAssistant, accepted: !!a.accepted });
  const pub = (q, user) => ({ id: q.id, name: q.name, orgName: q.orgName, levelId: q.levelId, levelTitle: q.levelTitle, path: q.path, pathName: PATH_NAMES[q.path] || q.path, text: q.text, at: q.at, status: q.status, escalated: !!q.escalatedAt,
    assistant: q.assistant ? { ...q.assistant, categoryLabel: CATEGORIES[q.assistant.category] || '' } : null, answers: q.answers.map(pubAnswer), mine: q.uid === user.id, canAnswer: q.status !== 'closed' && mayAnswer(user, q) && q.uid !== user.id, resolvedNote: q.resolvedNote || '', closedAt: q.closedAt || null });
  const notifyOrg = (q, what) => { if (!notifier) return; for (const u of db.users) if (!u.disabled && u.id !== q.uid && orgKeyOf(u) === q.org && canReview(u, isAdmin)) notifier.send(u.id, 'queue', { title: q.levelTitle, name: q.name, what }, 'pages/level/level?p=' + q.path + '&i=' + q.levelId.split(/-(?=\d+$)/)[1]).catch?.(() => {}); };

  /** 两个工作日没人答的转本地讲师（导出给定时器与测试）。 */
  const escalateDue = (t = now()) => { let n = 0; for (const q of db.questions) if (q.status === 'open' && !q.escalatedAt && !q.answers.length && t >= workdaysLater(q.at)) { q.escalatedAt = t; n++; } if (n) saveDb(); return n; };

  const routes = {
  // 问之前先看看：相似的已答问题与本关要点（输入时调用）
  'GET /api/questions/similar': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const sp = new URL(req.url, 'http://x').searchParams;
    const levelId = str(sp.get('levelId') || '', 40), text = str(sp.get('q') || '', 300);
    if (!text) return json(res, 200, { sources: [] });
    json(res, 200, { sources: gather(user, levelId, text).filter(s => s.kind !== 'level').map(s => ({ kind: s.kind, id: s.id, title: s.title, text: (s.text || '').slice(0, 200) })) });
  },
  // 提问：{ levelId, text ≥ 5 字 }。助手立刻整理（有模型就起草），同时进本园种子教师队列。
  'POST /api/questions': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const levelId = str(body.levelId, 40);
    if (!LEVELS[levelId]) return json(res, 400, { error: 'unknown level', code: 'level' });
    const text = str(body.text, 600);
    if (text.length < 5) return json(res, 400, { error: 'say more: at least 5 characters', code: 'empty' });
    const open = db.questions.filter(q => q.uid === user.id && q.status === 'open').length;
    if (open >= 5) return json(res, 429, { error: 'five open questions already; wait for answers or close some', code: 'limit' });
    const q = { id: newId(), uid: user.id, name: user.name, org: orgKeyOf(user), orgName: user.academy?.org?.name || null, levelId, levelTitle: LEVELS[levelId], path: levelId.split(/-(?=\d+$)/)[0], text, at: now(), status: 'open', escalatedAt: null, assistant: null, answers: [], closedAt: null };
    db.questions.push(q); saveDb();
    q.assistant = await runAssistant(user, q); saveDb();
    audit(req, 'question.new', { user, msg: q.id });
    notifyOrg(q, '新提问');
    json(res, 200, { question: pub(q, user), assistantConfigured: configured() });
  },
  // 列表：mine 我的；queue 我能答的（本园开放的；带教的；管理员看转讲师的与全部开放的）；?level= 本关的（我的 ＋ 本园/共同体已答的）
  'GET /api/questions': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const level = str(new URL(req.url, 'http://x').searchParams.get('level') || '', 40);
    const mine = db.questions.filter(q => q.uid === user.id && (!level || q.levelId === level)).sort((a, b) => b.at - a.at);
    const queue = db.questions.filter(q => q.status === 'open' && q.uid !== user.id && mayAnswer(user, q) && (!isAdmin(user) || q.escalatedAt || true)).sort((a, b) => (b.escalatedAt ? 1 : 0) - (a.escalatedAt ? 1 : 0) || a.at - b.at);
    const scope = scopeOrgs(orgKeyOf(user));
    const faq = level ? db.questions.filter(q => q.levelId === level && q.uid !== user.id && q.status !== 'open' && q.answers.some(a => a.accepted) && scope.has(q.org)).sort((a, b) => b.at - a.at).slice(0, 5) : [];
    json(res, 200, { mine: mine.map(q => pub(q, user)), queue: queue.map(q => pub(q, user)), faq: faq.map(q => pub(q, user)), canAnswer: isAdmin(user) || canReview(user, isAdmin) || !!(pairs && pairs.menteesOf(user.id).length), assistantConfigured: configured(), escalated: queue.filter(q => q.escalatedAt).length });
  },
  'GET /api/questions/one': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const q = find(new URL(req.url, 'http://x').searchParams.get('id') || '');
    if (!q || !maySee(user, q)) return json(res, 404, { error: 'no such question' });
    json(res, 200, { question: pub(q, user), sources: q.assistant ? gather(user, q.levelId, q.text).map(s => ({ kind: s.kind, id: s.id, title: s.title, text: (s.text || '').slice(0, 600) })) : [] });
  },
  // 回答：{ id, text }。本园种子教师 / 园长 / 点评人、提问人的带教教师、管理员（本地讲师）。
  'POST /api/questions/answer': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const q = find(str(body.id, 40));
    if (!q) return json(res, 404, { error: 'no such question' });
    if (q.uid === user.id) return json(res, 403, { error: 'not your own question', code: 'self' });
    if (!mayAnswer(user, q)) return json(res, 403, { error: 'seed teachers, directors, mentors and lecturers answer', code: 'who' });
    if (q.status === 'closed') return json(res, 400, { error: 'closed', code: 'closed' });
    const text = str(body.text, 2000);
    if (text.length < 5) return json(res, 400, { error: 'write the answer', code: 'empty' });
    const a = { id: newId(), by: user.id, byName: user.name, role: roleFor(user, q), text, at: now(), fromAssistant: false, accepted: false };
    q.answers.push(a); saveDb();
    audit(req, 'question.answer', { user, msg: q.id });
    if (notifier) notifier.send(q.uid, 'review', { title: q.levelTitle, verdict: '答疑', at: a.at, comment: text.slice(0, 60), by: user.name }, 'pages/level/level').catch?.(() => {});
    json(res, 200, { question: pub(q, user) });
  },
  // 种子教师确认助手草稿（可改一改）：{ id, text? }。确认后成为这位教师署名的回答，标「据助手草稿」。
  'POST /api/questions/confirm': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const q = find(str(body.id, 40));
    if (!q) return json(res, 404, { error: 'no such question' });
    if (q.uid === user.id || !mayAnswer(user, q)) return json(res, 403, { error: 'not allowed', code: 'who' });
    if (!q.assistant?.draft) return json(res, 400, { error: 'no draft to confirm', code: 'draft' });
    const text = str(body.text, 2000) || q.assistant.draft;
    const a = { id: newId(), by: user.id, byName: user.name, role: roleFor(user, q), text, at: now(), fromAssistant: true, accepted: false };
    q.answers.push(a); saveDb();
    audit(req, 'question.confirm', { user, msg: q.id });
    if (notifier) notifier.send(q.uid, 'review', { title: q.levelTitle, verdict: '答疑', at: a.at, comment: text.slice(0, 60), by: user.name }, 'pages/level/level').catch?.(() => {});
    json(res, 200, { question: pub(q, user) });
  },
  // 采纳：{ id, answerId }。提问人；一题只采纳一条，可换。采纳后问题算已答。
  'POST /api/questions/accept': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const q = find(str(body.id, 40));
    if (!q || q.uid !== user.id) return json(res, 404, { error: 'no such question' });
    const a = q.answers.find(x => x.id === str(body.answerId, 40));
    if (!a) return json(res, 404, { error: 'no such answer' });
    for (const x of q.answers) { x.accepted = x.id === a.id; x.acceptedAt = x.id === a.id ? now() : null; }
    q.status = 'answered'; saveDb();
    audit(req, 'question.accept', { user, msg: `${q.id} ${a.id}` });
    json(res, 200, { question: pub(q, user) });
  },
  // 关闭：提问人「已解决」（可写一句怎么解决的，助手整理够用也算）；管理员可关任何。
  'POST /api/questions/close': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const q = find(str(body.id, 40));
    if (!q || (q.uid !== user.id && !isAdmin(user))) return json(res, 404, { error: 'no such question' });
    q.status = q.answers.some(a => a.accepted) ? 'answered' : 'closed'; q.closedAt = now(); q.closedBy = user.id; q.resolvedNote = str(body.note, 300);
    saveDb();
    audit(req, 'question.close', { user, msg: q.id });
    json(res, 200, { question: pub(q, user) });
  }
  };
  return { routes, escalateDue };
}
