/* 柳州数智幼教平台账号登录。平台的账号是「手机号＋验证码」，三端（电脑、小程序、PAD）共用；
 * 大课堂不碰手机号和验证码，只拿平台已经登录过的人：平台把身份交给我们，我们按 uid 找到或建立用户。
 *
 * 两种交法，由 PLATFORM_AUTH_MODE 选（契约全文与待对齐清单见 docs/PLATFORM-AUTH.md）：
 *
 *   ticket（默认）  平台签发一次性票据，我们拿票据去问平台这是谁
 *     POST {PLATFORM_AUTH_URL}   Authorization: Bearer {PLATFORM_AUTH_KEY}   { "ticket": "..." }
 *     200 → 用户档案（字段位置可配，见 PLATFORM_FIELDS）；非 200 或 PLATFORM_OK 不满足 = 票据无效
 *
 *   oauth2         标准授权码：跳平台授权页 → 带 code 回来 → 换 access_token → 取用户信息
 *     PLATFORM_OAUTH_AUTHORIZE_URL / PLATFORM_OAUTH_TOKEN_URL / PLATFORM_OAUTH_USERINFO_URL
 *     PLATFORM_CLIENT_ID / PLATFORM_CLIENT_SECRET / PLATFORM_REDIRECT_URI（默认 {ORIGIN}/login/platform）
 *
 * 档案字段按名取、不透传：PLATFORM_FIELDS 是 JSON，值是答复里的点路径，缺省
 *   { "uid":"uid", "name":"name", "orgId":"org.id", "orgName":"org.name", "role":"role" }
 * 例如平台答 { code:0, data:{ userId, realName, orgCode, orgName, roleName } } 就设
 *   PLATFORM_FIELDS={"uid":"data.userId","name":"data.realName","orgId":"data.orgCode","orgName":"data.orgName","role":"data.roleName"}
 *   PLATFORM_OK=code=0            # 200 之外还要这个字段等于这个值才算成功（可省）
 * 岗位名映射在 ROLE_ALIASES，中文岗位名也认；认不出落到 teacher。
 * 平台是岗位与园所的权威来源：每次登录以平台为准（routes.js）。 */
const MODE = (process.env.PLATFORM_AUTH_MODE || 'ticket').toLowerCase();
const URL_ = process.env.PLATFORM_AUTH_URL || '';
const KEY = process.env.PLATFORM_AUTH_KEY || '';
const OAUTH = {
  authorize: process.env.PLATFORM_OAUTH_AUTHORIZE_URL || '',
  token: process.env.PLATFORM_OAUTH_TOKEN_URL || '',
  userinfo: process.env.PLATFORM_OAUTH_USERINFO_URL || '',
  clientId: process.env.PLATFORM_CLIENT_ID || '',
  clientSecret: process.env.PLATFORM_CLIENT_SECRET || '',
  scope: process.env.PLATFORM_OAUTH_SCOPE || '',
  redirectUri: process.env.PLATFORM_REDIRECT_URI || ((process.env.ORIGIN || '').replace(/\/$/, '') + '/login/platform'),
  tokenPath: process.env.PLATFORM_TOKEN_PATH || 'access_token'
};
export const PLATFORM_LOGIN_URL = process.env.PLATFORM_LOGIN_URL || '';
export const PLATFORM_MODE = MODE === 'oauth2' ? 'oauth2' : 'ticket';

export const platformConfigured = () => (PLATFORM_MODE === 'oauth2'
  ? !!(OAUTH.authorize && OAUTH.token && OAUTH.userinfo && OAUTH.clientId)
  : !!URL_);

// 网页端「平台账号登录」按钮跳去的地址。ticket 模式由平台自己的登录页带 redirect 跳回；
// oauth2 模式是授权页，前端再拼上 state。
export function platformLoginUrl() {
  if (!platformConfigured()) return '';
  if (PLATFORM_MODE === 'oauth2') {
    const q = new URLSearchParams({ response_type: 'code', client_id: OAUTH.clientId, redirect_uri: OAUTH.redirectUri, ...(OAUTH.scope ? { scope: OAUTH.scope } : {}) });
    return OAUTH.authorize + (OAUTH.authorize.includes('?') ? '&' : '?') + q.toString();
  }
  return PLATFORM_LOGIN_URL;
}

export const ROLES = ['nurse', 'teacher', 'care', 'it', 'director'];
const ROLE_ALIASES = {
  nurse: 'nurse', 保健医: 'nurse', 保健员: 'nurse', 保健老师: 'nurse', 卫生保健: 'nurse', 园医: 'nurse', 医务: 'nurse',
  teacher: 'teacher', 班级教师: 'teacher', 教师: 'teacher', 老师: 'teacher', 主班: 'teacher', 配班: 'teacher', 班主任: 'teacher',
  care: 'care', 保育员: 'care', 保育: 'care', 保育老师: 'care',
  it: 'it', 信息接口人: 'it', 信息员: 'it', 信息管理员: 'it', 管理员: 'it',
  director: 'director', 园长: 'director', 副园长: 'director', 业务园长: 'director', 保教主任: 'director', 教学园长: 'director'
};
export function roleOf(v) {
  // 平台可能给数组（多岗位）：取第一个认识的
  if (Array.isArray(v)) { for (const x of v) { const r = ROLE_ALIASES[String(x || '').trim()] || ROLE_ALIASES[String(x || '').trim().toLowerCase()]; if (r) return r; } return 'teacher'; }
  const k = String(v || '').trim();
  return ROLE_ALIASES[k] || ROLE_ALIASES[k.toLowerCase()] || 'teacher';
}

export class PlatformError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' ? String(v) : '');
const pathOf = (obj, p) => String(p || '').split('.').filter(Boolean).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

const FIELDS = (() => {
  const d = { uid: 'uid', name: 'name', orgId: 'org.id', orgName: 'org.name', role: 'role' };
  try { return { ...d, ...(process.env.PLATFORM_FIELDS ? JSON.parse(process.env.PLATFORM_FIELDS) : {}) }; } catch { return d; }
})();
const OK = (() => {
  const m = /^([^=]+)=(.*)$/.exec(process.env.PLATFORM_OK || '');
  return m ? { path: m[1].trim(), value: m[2].trim() } : null;
})();

/** 平台的答复 → { uid, name, org, role }。字段位置由 PLATFORM_FIELDS 定。 */
export function profileOf(data) {
  if (OK && String(pathOf(data, OK.path)) !== OK.value) throw new PlatformError('platform refused', 'rejected');
  const uid = str(pathOf(data, FIELDS.uid), 64);
  if (!uid) throw new PlatformError('no uid in answer', 'upstream');
  const orgId = str(pathOf(data, FIELDS.orgId), 64) || null, orgName = str(pathOf(data, FIELDS.orgName), 80) || null;
  return { uid, name: str(pathOf(data, FIELDS.name), 40) || '平台用户', org: orgId || orgName ? { id: orgId, name: orgName } : null, role: roleOf(pathOf(data, FIELDS.role)) };
}

async function call(fetchImpl, url, init, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, { ...init, signal: ctl.signal });
    const data = await r.json().catch(() => null);
    return { r, data };
  } catch { throw new PlatformError('platform did not answer', 'upstream'); }
  finally { clearTimeout(timer); }
}

/** ticket 模式：ticket → 档案。 */
export async function verifyTicket(ticket, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!platformConfigured() || PLATFORM_MODE !== 'ticket') throw new PlatformError('platform login is not configured', 'not-configured');
  const t = String(ticket || '').trim();
  if (!t || t.length > 512) throw new PlatformError('invalid ticket', 'bad-ticket');
  const { r, data } = await call(fetchImpl, URL_, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(KEY ? { Authorization: 'Bearer ' + KEY } : {}) },
    body: JSON.stringify({ ticket: t })
  }, timeoutMs);
  if (!r.ok) throw new PlatformError('platform refused the ticket', 'rejected');
  return profileOf(data);
}

/** oauth2 模式：授权码 → access_token → 用户信息 → 档案。 */
export async function exchangeCode(code, { redirectUri, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!platformConfigured() || PLATFORM_MODE !== 'oauth2') throw new PlatformError('platform login is not configured', 'not-configured');
  const c = String(code || '').trim();
  if (!c || c.length > 512) throw new PlatformError('invalid code', 'bad-ticket');
  const form = new URLSearchParams({ grant_type: 'authorization_code', code: c, client_id: OAUTH.clientId, redirect_uri: redirectUri || OAUTH.redirectUri, ...(OAUTH.clientSecret ? { client_secret: OAUTH.clientSecret } : {}) });
  const tok = await call(fetchImpl, OAUTH.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: form.toString() }, timeoutMs);
  if (!tok.r.ok) throw new PlatformError('platform refused the code', 'rejected');
  const access = str(pathOf(tok.data, OAUTH.tokenPath), 2048);
  if (!access) throw new PlatformError('no access token in answer', 'upstream');
  const info = await call(fetchImpl, OAUTH.userinfo, { method: 'GET', headers: { Authorization: 'Bearer ' + access, Accept: 'application/json' } }, timeoutMs);
  if (!info.r.ok) throw new PlatformError('platform refused the token', 'rejected');
  return profileOf(info.data);
}
