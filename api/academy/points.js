/* 积分：平台唯一的资产（docs/POINTS-DESIGN.md，夜 59 起只保留积分，不再有学分）。
 *
 * 赚：学（过关、走完路径、取得证书、实践关作品通过点评、练习营结营）、贡献（案例 / 课程成果 / 赛作品入库、研讨作答被精选）、
 *     互动（被标「用过，有效」、标别人并写了一句、答疑被采纳、点评、营帖）。不奖签到、在线时长、浏览、点赞、关注、邀请。
 * 花：接入的工具（教研工坊、观察评价工具、贝果实验室）按 (tool, ref) 幂等扣减；之后加教学物料商城。
 * 规则：db.pointsRules 一张表（每类事件记多少），管理员 POST /api/admin/points/rules 改，只影响之后的，已记的不重算。
 * 到账：学与贡献的事件走 honors.js 的事件记录（ledger.grant），这里包一层，一记录就按规则记积分；
 *       过关在客户端状态里（progress），读余额时对账补记；路径走完、证书由 ledger.learn 按记录补记。
 * 钱包页与教研工坊统一（账号统一登录，同一 uid），学坊不单独做钱包页：工坊带 TOOLS_API_KEY 调 balance / of。
 * 不是货币：不能充值、提现、转赠；不排行、不公开、不与考核挂钩。
 *
 * 商城（mall.js）经 ledger.points.spend / refund 扣与退，流水 tool 'mall'。
 *
 * db.points: { uid, kind:'earn'|'interact'|'spend'|'refund'|'exchange'(旧), n(正为入、负为出), sub?, ref?, about?, levels?, tool?, note, at } */
import { orgKeyOf } from './org.js';

const TOOLS_KEY = (process.env.TOOLS_API_KEY || '').trim();
export const TOOLS = Object.freeze({ workshop: '教研工坊', observe: '观察评价工具', bagel: '贝果实验室' });
const TOOL_LABEL = { ...TOOLS, mall: '教学物料商城' };
// 学与贡献：事件 → 默认积分。键就是 ledger.grant 的 kind；level 是客户端的过关
export const EARN = Object.freeze({
  level:    { name: '关卡过关', n: 10 },
  path:     { name: '走完一条路径', n: 50 },
  cert:     { name: '取得证书', n: 100 },
  practice: { name: '实践关作品通过点评', n: 10 },
  camp:     { name: '练习营结营', n: 20 },
  case:     { name: '专家案例入库', n: 20 },
  work:     { name: '课程成果入库', n: 30 },
  drill:    { name: '研讨作答被精选', n: 20 },
  contest:  { name: '赛作品入库', n: 20 },
  adapted:  { name: '自己的案例被改编入库（原作者）', n: 20 },
  lecture:  { name: '名师讲堂上台分享', n: 50 },
  shareday: { name: '园所分享日交页（园长）', n: 20 }
});
// 互动：n 积分；day / month 本人每日 / 每月最多记几次；perAboutDay 同一作品每天最多记几次
export const INTERACT = Object.freeze({
  used:     { name: '作品被标「用过，有效」', n: 5, month: 20, perAboutDay: 1 },
  usedBy:   { name: '标别人「用过，有效」并写了一句', n: 2, day: 3 },
  adopted:  { name: '答疑被采纳', n: 5 },
  review:   { name: '点评别人的作品', n: 3, day: 5 },
  campPost: { name: '练习营帖子', n: 1 }
});
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const sameMonth = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth(); };
const intIn = (v, lo, hi) => { const n = Math.floor(Number(v)); return n >= lo && n <= hi ? n : null; };

export function pointsRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, readStateCached, ledger }) {
  db.points = db.points || [];
  db.pointsRules = db.pointsRules && typeof db.pointsRules === 'object' ? db.pointsRules : { at: 0, byName: null };
  const earnN = k => { const v = db.pointsRules.earn?.[k]; return Number.isInteger(v) && v >= 0 ? v : EARN[k].n; };
  const interactN = k => { const v = db.pointsRules.interact?.[k]; return Number.isInteger(v) && v >= 0 ? v : INTERACT[k].n; };
  const rules = () => ({ earn: Object.fromEntries(Object.keys(EARN).map(k => [k, earnN(k)])), interact: Object.fromEntries(Object.keys(INTERACT).map(k => [k, interactN(k)])) });
  const rows = uid => db.points.filter(p => p.uid === uid);
  const balance = uid => rows(uid).reduce((s, p) => s + p.n, 0);
  const push = row => { db.points.push({ at: Date.now(), ...row }); };

  // 学与贡献：honors.js 的事件记录一记就按规则记积分（works / cases / drills / contests / submissions / camps / learn 都走 ledger.grant）
  if (ledger && typeof ledger.grant === 'function' && !ledger._points) {
    const orig = ledger.grant.bind(ledger);
    ledger.grant = (uid, kind, ref, n, note) => {
      const ok = orig(uid, kind, ref, n, note);
      if (ok) { const pts = EARN[kind] ? earnN(kind) : Math.max(0, Math.floor(Number(n)) || 0); if (pts > 0) { push({ uid, kind: 'earn', n: pts, sub: kind, ref, note: str(note, 120) || EARN[kind]?.name || kind }); saveDb(); } }
      return ok;
    };
    ledger._points = true;
  }
  // 互动给分：同一 (sub, ref) 只记一次；日 / 月上限；同一作品每天最多记 perAboutDay 次；配成 0 就不记。答 true 表示记了。
  const interact = (uid, sub, ref, note, about = null) => {
    const rule = INTERACT[sub]; if (!rule || !uid || !ref) return false;
    const n = interactN(sub); if (n < 1) return false;
    const t = Date.now(), mine = rows(uid).filter(p => p.kind === 'interact' && p.sub === sub);
    if (mine.some(p => p.ref === ref)) return false;
    if (rule.day && mine.filter(p => sameDay(p.at, t)).length >= rule.day) return false;
    if (rule.month && mine.filter(p => sameMonth(p.at, t)).length >= rule.month) return false;
    if (rule.perAboutDay && about && mine.filter(p => p.about === about && sameDay(p.at, t)).length >= rule.perAboutDay) return false;
    push({ uid, kind: 'interact', n, sub, ref, about, note: str(note, 120) || rule.name, at: t });
    saveDb(); return true;
  };
  if (ledger) ledger.interact = interact;
  // 商城等平台内的花与退：同一 ref 只扣一次、只退一次
  if (ledger) ledger.points = {
    balance: uid => { settle(uid); return balance(uid); },
    spend: (uid, n, ref, note) => { settle(uid); if (!(n >= 1) || db.points.some(p => p.uid === uid && p.kind === 'spend' && p.tool === 'mall' && p.ref === ref)) return false; if (balance(uid) < n) return false; push({ uid, kind: 'spend', n: -n, tool: 'mall', ref, note: str(note, 120) }); saveDb(); return true; },
    refund: (uid, n, ref, note) => { if (!(n >= 1) || db.points.some(p => p.uid === uid && p.kind === 'refund' && p.ref === ref)) return false; push({ uid, kind: 'refund', n, tool: 'mall', ref, note: str(note, 120) }); saveDb(); return true; }
  };

  // 过关在客户端状态里：progress 每关一条；读余额时对账补记没记过的关
  const levelsPassed = uid => { const S = readStateCached(uid) || {}; const c = S.credits && typeof S.credits === 'object' ? S.credits : {}; return Object.values(c).reduce((s, n) => s + (Number(n) || 0), 0); };
  const levelsSeen = uid => rows(uid).reduce((s, p) => s + (p.sub === 'level' ? (p.levels || 0) : (p.kind === 'exchange' || (p.kind === 'earn' && !p.sub)) ? (p.credits || 0) : 0), 0);
  const settle = uid => {
    let changed = false;
    if (ledger?.learn && ledger.learn(uid, readStateCached)) changed = true;
    const delta = levelsPassed(uid) - levelsSeen(uid);
    if (delta >= 1) { const n = delta * earnN('level'); if (n > 0) push({ uid, kind: 'earn', n, sub: 'level', levels: delta, note: `过了 ${delta} 关` }); else push({ uid, kind: 'earn', n: 0, sub: 'level', levels: delta, note: `过了 ${delta} 关` }); changed = true; }
    if (changed) saveDb();
  };
  const summary = uid => { settle(uid); return { points: balance(uid), levelsPassed: levelsPassed(uid), rules: rules(), tools: TOOLS }; };
  const pubRow = p => ({ kind: p.kind, sub: p.sub || null, n: p.n, tool: p.tool ? (TOOL_LABEL[p.tool] || p.tool) : null, note: p.note, at: p.at });
  const toolAuth = req => TOOLS_KEY && (req.headers.authorization || '') === 'Bearer ' + TOOLS_KEY;
  const adminOnly = (req, res) => { const user = readSession(req); if (!user) { json(res, 401, { error: 'not signed in' }); return null; } if (!isAdmin(user)) { json(res, 403, { error: 'admins only', code: 'admin' }); return null; } return user; };

  return {
  'GET /api/me/points': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { ...summary(user.id), history: rows(user.id).sort((a, b) => b.at - a.at).slice(0, 100).map(pubRow) });
  },
  // 工具服务端查余额：?uid=   （TOOLS_API_KEY）
  'GET /api/points/balance': async (req, res) => {
    if (!toolAuth(req)) return json(res, 403, { error: 'tools key required', code: 'tools-key' });
    const uid = new URL(req.url, 'http://x').searchParams.get('uid') || '';
    const u = db.users.find(x => x.id === uid);
    if (!u) return json(res, 404, { error: 'no such user' });
    settle(uid);
    json(res, 200, { uid, name: u.name, orgName: u.academy?.org?.name || null, points: balance(uid) });
  },
  // 工具服务端扣减：{ uid, tool, n(正整数), ref, note }。余额不够答 409；同一 (tool, ref) 重复调用答已扣过、不再扣。
  'POST /api/points/spend': async (req, res) => {
    if (!toolAuth(req)) return json(res, 403, { error: 'tools key required', code: 'tools-key' });
    const body = await readBody(req);
    const uid = String(body.uid || ''), tool = TOOLS[body.tool] ? body.tool : null, n = Math.floor(Number(body.n)), ref = str(body.ref, 120);
    const u = db.users.find(x => x.id === uid);
    if (!u) return json(res, 404, { error: 'no such user' });
    if (!tool) return json(res, 400, { error: 'tool must be one of ' + Object.keys(TOOLS).join(', '), code: 'tool' });
    if (!(n >= 1)) return json(res, 400, { error: 'n must be a positive integer', code: 'n' });
    if (!ref) return json(res, 400, { error: 'ref required (idempotency key)', code: 'ref' });
    settle(uid);
    const dup = db.points.find(p => p.uid === uid && p.kind === 'spend' && p.tool === tool && p.ref === ref);
    if (dup) return json(res, 200, { ok: true, duplicate: true, points: balance(uid) });
    if (balance(uid) < n) return json(res, 409, { error: 'insufficient points', code: 'insufficient', points: balance(uid) });
    push({ uid, kind: 'spend', n: -n, tool, ref, note: str(body.note, 120) });
    saveDb();
    audit(req, 'points.spend', { user: u, msg: `${tool} ${ref} -${n}` });
    json(res, 200, { ok: true, duplicate: false, points: balance(uid) });
  },
  // 一个人的流水：管理员对账用；工坊的钱包页（钱包页与工坊统一，学坊不单独做）带 TOOLS_API_KEY 取。?uid=
  'GET /api/points/of': async (req, res) => {
    if (!toolAuth(req)) { if (!adminOnly(req, res)) return; }
    const uid = new URL(req.url, 'http://x').searchParams.get('uid') || '';
    if (!db.users.some(x => x.id === uid)) return json(res, 404, { error: 'no such user' });
    json(res, 200, { ...summary(uid), history: rows(uid).sort((a, b) => b.at - a.at).map(pubRow) });
  },
  // 规则（管理员）：GET 看；POST { earn?: {…}, interact?: {…} } 改，学与贡献 0–1000、互动 0–100，0 是不给；只影响之后的
  'GET /api/admin/points/rules': async (req, res) => {
    if (!adminOnly(req, res)) return;
    json(res, 200, { rules: { ...rules(), at: db.pointsRules.at || 0, byName: db.pointsRules.byName || null }, earnDefaults: EARN, interactDefaults: INTERACT, tools: TOOLS });
  },
  'POST /api/admin/points/rules': async (req, res) => {
    const user = adminOnly(req, res); if (!user) return;
    const body = await readBody(req);
    const cur = rules(), earn = { ...cur.earn }, interact = { ...cur.interact };
    const eIn = body.earn && typeof body.earn === 'object' ? body.earn : {}, iIn = body.interact && typeof body.interact === 'object' ? body.interact : {};
    for (const k of Object.keys(EARN)) if (eIn[k] !== undefined) { const v = intIn(eIn[k], 0, 1000); if (v === null) return json(res, 400, { error: `earn.${k} must be an integer 0–1000`, code: 'earn' }); earn[k] = v; }
    for (const k of Object.keys(INTERACT)) if (iIn[k] !== undefined) { const v = intIn(iIn[k], 0, 100); if (v === null) return json(res, 400, { error: `interact.${k} must be an integer 0–100`, code: 'interact' }); interact[k] = v; }
    db.pointsRules = { earn, interact, at: Date.now(), by: user.id, byName: user.name };
    saveDb();
    audit(req, 'points.rules', { user, msg: JSON.stringify({ earn, interact }) });
    json(res, 200, { rules: { earn, interact, at: db.pointsRules.at, byName: user.name } });
  }
  };
}
