/* 学分兑积分，积分是工具的使用额度（token）。
 *
 * 学分有两处：关卡学分在客户端状态里（progress → credits，readStateCached 读得到），关卡以外的在 honors.js 台账。
 * 积分：学分到账时按比例自动记积分（docs/POINTS-DESIGN.md，夜 57）：台账 grant 一发生就记一笔 earn；关卡学分在客户端状态里，
 * 读余额时对账补记（settle）。比例 db.pointsRules.rate（管理员 POST /api/admin/points/rules 改，默认取 POINTS_PER_CREDIT 或 10），
 * 改了只影响之后到账的，已记的不重算。积分只能在接入的工具里花——教研工坊、观察评价工具、创新课平台（贝果实验室）换特定资源，
 * 之后加教学物料商城。不排行、不公开、不与考核挂钩、不可转赠；这是使用额度，不是货币。
 *
 * db.points: { uid, kind:'earn'|'exchange'|'spend', n(正为入、负为出), credits?, tool?, ref?, note, at }
 * 手动兑换 POST /api/me/points/exchange 保留作过渡：自动到账以后可兑的学分总是 0，答 400。
 * 扣减：接入的工具服务端带 TOOLS_API_KEY 调 POST /api/points/spend { uid, tool, n, ref, note }；同一 (tool, ref) 只扣一次（幂等）。
 * 工具服务端拿 uid 的方式：教师在工具里用大课堂账号登录（/api/me 给 id），或 GET /api/points/balance?uid= 查。 */
import { orgKeyOf } from './org.js';

const ENV_RATE = Math.max(1, Math.floor(Number(process.env.POINTS_PER_CREDIT)) || 10);
const TOOLS_KEY = (process.env.TOOLS_API_KEY || '').trim();
export const TOOLS = Object.freeze({ workshop: '教研工坊', observe: '观察评价工具', bagel: '贝果实验室' });
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export function pointsRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, readStateCached, ledger }) {
  db.points = db.points || [];
  db.pointsRules = db.pointsRules && Number.isInteger(db.pointsRules.rate) ? db.pointsRules : { rate: ENV_RATE, at: 0, byName: null };
  const RATE = () => Math.min(100, Math.max(1, db.pointsRules.rate || ENV_RATE));
  const rows = uid => db.points.filter(p => p.uid === uid);
  const balance = uid => rows(uid).reduce((s, p) => s + p.n, 0);
  // 已记过积分的学分：手动兑的 + 自动到账的
  const exchanged = uid => rows(uid).filter(p => p.kind === 'exchange' || p.kind === 'earn').reduce((s, p) => s + (p.credits || 0), 0);
  const earn = (uid, credits, note) => { if (!(credits >= 1)) return; db.points.push({ uid, kind: 'earn', n: credits * RATE(), credits, note: str(note, 120) || `${credits} 学分到账`, at: Date.now() }); };
  // 台账一记学分就同步记积分（works/cases/drills/contests 都走 ledger.grant）
  if (ledger && typeof ledger.grant === 'function' && !ledger._points) {
    const orig = ledger.grant.bind(ledger);
    ledger.grant = (uid, kind, ref, n, note) => { const ok = orig(uid, kind, ref, n, note); if (ok) { earn(uid, n, note); saveDb(); } return ok; };
    ledger._points = true;
  }
  // 关卡学分在客户端状态里，读余额时对账补记；比例按补记当时的
  const settle = uid => { const delta = levelCredits(uid) + (ledger ? ledger.total(uid) : 0) - exchanged(uid); if (delta >= 1) { earn(uid, delta, `${delta} 学分到账（关卡过关，或改版前攒下的）`); saveDb(); } };
  const levelCredits = uid => { const S = readStateCached(uid) || {}; const c = S.credits && typeof S.credits === 'object' ? S.credits : {}; return Object.values(c).reduce((s, n) => s + (Number(n) || 0), 0); };
  const summary = uid => { settle(uid); const earned = levelCredits(uid) + ledger.total(uid), used = exchanged(uid); return { creditsEarned: earned, creditsExchanged: used, creditsAvailable: Math.max(0, earned - used), points: balance(uid), rate: RATE(), auto: true, tools: TOOLS }; };
  const toolAuth = req => TOOLS_KEY && (req.headers.authorization || '') === 'Bearer ' + TOOLS_KEY;

  return {
  'GET /api/me/points': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { ...summary(user.id), history: rows(user.id).sort((a, b) => b.at - a.at).slice(0, 100).map(p => ({ kind: p.kind, n: p.n, credits: p.credits || null, tool: p.tool ? (TOOLS[p.tool] || p.tool) : null, note: p.note, at: p.at })) });
  },
  // 兑换：{ credits } 整数，不超过可兑的
  'POST /api/me/points/exchange': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const credits = Math.floor(Number(body.credits));
    const s = summary(user.id);
    if (!(credits >= 1)) return json(res, 400, { error: 'credits must be a positive integer', code: 'credits' });
    if (credits > s.creditsAvailable) return json(res, 400, { error: `only ${s.creditsAvailable} credits available`, code: 'insufficient', available: s.creditsAvailable });
    db.points.push({ uid: user.id, kind: 'exchange', n: credits * RATE(), credits, note: `${credits} 学分兑 ${credits * RATE()} 积分`, at: Date.now() });
    saveDb();
    audit(req, 'points.exchange', { user, msg: `${credits}→${credits * RATE()}` });
    json(res, 200, summary(user.id));
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
    db.points.push({ uid, kind: 'spend', n: -n, tool, ref, note: str(body.note, 120), at: Date.now() });
    saveDb();
    audit(req, 'points.spend', { user: u, msg: `${tool} ${ref} -${n}` });
    json(res, 200, { ok: true, duplicate: false, points: balance(uid) });
  },
  // 一个人的积分流水：管理员对账用；工坊的钱包页（钱包页与工坊统一，学坊不单独做）带 TOOLS_API_KEY 取。?uid=
  'GET /api/points/of': async (req, res) => {
    if (!toolAuth(req)) {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    }
    const uid = new URL(req.url, 'http://x').searchParams.get('uid') || '';
    if (!db.users.some(x => x.id === uid)) return json(res, 404, { error: 'no such user' });
    json(res, 200, { ...summary(uid), history: rows(uid).sort((a, b) => b.at - a.at) });
  },
  // 比例（管理员）：GET 看，POST { rate } 改，1–100 的整数；只影响之后到账的
  'GET /api/admin/points/rules': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    json(res, 200, { rules: { ...db.pointsRules, rate: RATE(), envRate: ENV_RATE }, tools: TOOLS });
  },
  'POST /api/admin/points/rules': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const rate = Math.floor(Number(body.rate));
    if (!(rate >= 1 && rate <= 100)) return json(res, 400, { error: 'rate must be an integer 1–100', code: 'rate' });
    const before = RATE();
    db.pointsRules = { rate, at: Date.now(), by: user.id, byName: user.name };
    saveDb();
    audit(req, 'points.rules', { user, msg: `rate ${before}→${rate}` });
    json(res, 200, { rules: { ...db.pointsRules, envRate: ENV_RATE } });
  }
  };
}
