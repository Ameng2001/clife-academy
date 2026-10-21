/* 只读接口令牌（docs/ROADMAP.md 第十一节 E 期「MCP 只读桥」）：园长、教育局用自己的 LLM 客户端查进度，客户端跑 mcp/ 里的桥，
 * 桥拿这个令牌调本服务的 GET 接口。令牌只能读：带它来的非 GET 请求一律 403（server.js 分发处挡）；能看什么仍由各接口按账号判，
 * 令牌不放大权限。令牌本身只在新建时给一次，库里只存 sha256；撤了就失效；账号停用一起失效。
 *
 * db.apiTokens: { id, uid, hash, label, at, lastUsedAt, revokedAt } */
import crypto from 'node:crypto';

export const PREFIX = 'cla_';
export const MAX_LIVE = 5;
const hashOf = secret => crypto.createHash('sha256').update(secret).digest('hex');
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** 请求头里的 Bearer 是不是这种令牌（分发处用它挡写请求，不用查库）。 */
export const looksLikeToken = tok => typeof tok === 'string' && tok.startsWith(PREFIX);

/** 令牌 → 用户，不是或已撤、账号停用 → null。顺手记最后使用时间（不落盘，下次保存一起写）。 */
export function tokenUserOf(db, tok) {
  if (!looksLikeToken(tok)) return null;
  const [id, secret] = tok.slice(PREFIX.length).split('.');
  if (!id || !secret) return null;
  const t = (db.apiTokens || []).find(x => x.id === id && !x.revokedAt);
  if (!t) return null;
  const a = Buffer.from(t.hash, 'hex'), b = Buffer.from(hashOf(secret), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const user = db.users.find(u => u.id === t.uid);
  if (!user || user.disabled) return null;
  t.lastUsedAt = Date.now();
  return user;
}

export function tokenRoutes({ json, readBody, db, saveDb, readSession, audit }) {
  db.apiTokens = db.apiTokens || [];
  const pub = t => ({ id: t.id, label: t.label, at: t.at, lastUsedAt: t.lastUsedAt || null });
  const mine = user => db.apiTokens.filter(t => t.uid === user.id && !t.revokedAt).sort((a, b) => b.at - a.at);
  return {
  'GET /api/me/tokens': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { tokens: mine(user).map(pub), max: MAX_LIVE });
  },
  // 新建：{ label }，令牌只在这一次应答里给。
  'POST /api/me/tokens': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (mine(user).length >= MAX_LIVE) return json(res, 400, { error: `at most ${MAX_LIVE} live tokens`, code: 'max' });
    const body = await readBody(req);
    const label = str(body.label, 40) || 'MCP';
    const id = crypto.randomBytes(6).toString('base64url'), secret = crypto.randomBytes(24).toString('base64url');
    const t = { id, uid: user.id, hash: hashOf(secret), label, at: Date.now(), lastUsedAt: null, revokedAt: null };
    db.apiTokens.push(t); saveDb(); audit(req, 'academy.token.new', { user, msg: label });
    json(res, 200, { token: PREFIX + id + '.' + secret, item: pub(t) });
  },
  'POST /api/me/tokens/revoke': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const t = db.apiTokens.find(x => x.id === str(body.id, 40) && x.uid === user.id && !x.revokedAt);
    if (!t) return json(res, 404, { error: 'no such token' });
    t.revokedAt = Date.now(); saveDb(); audit(req, 'academy.token.revoke', { user, msg: t.label });
    json(res, 200, { ok: true });
  }
  };
}
