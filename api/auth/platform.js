/* 柳州数智幼教平台账号登录：平台签发的一次性票据（ticket）换用户档案。
 *
 * 契约（待与平台团队对齐，先按这个写）：
 *   POST {PLATFORM_AUTH_URL}   headers: Authorization: Bearer {PLATFORM_AUTH_KEY}
 *   body: { "ticket": "..." }
 *   200: { "uid": "p-123", "name": "李老师", "org": { "id": "o-1", "name": "柳北区示例幼儿园" },
 *          "role": "nurse" | "teacher" | "care" | "it" | "director" | <平台自己的岗位名> }
 *   其他状态码 = 票据无效。
 * 岗位名映射在 ROLE_ALIASES，平台用中文岗位名也认。认不出的岗位落到 teacher，由园长改。
 * 票据只用一次，由平台保证；这里不缓存。
 * PLATFORM_LOGIN_URL 是网页端「平台账号登录」按钮跳去的地址，平台登录完带 ticket 跳回 {ORIGIN}/#/login/platform?ticket=… */
const URL_ = process.env.PLATFORM_AUTH_URL || '';
const KEY = process.env.PLATFORM_AUTH_KEY || '';
export const PLATFORM_LOGIN_URL = process.env.PLATFORM_LOGIN_URL || '';

export const platformConfigured = () => !!URL_;

export const ROLES = ['nurse', 'teacher', 'care', 'it', 'director'];
const ROLE_ALIASES = {
  nurse: 'nurse', 保健医: 'nurse', 保健员: 'nurse', 保健老师: 'nurse', 卫生保健: 'nurse',
  teacher: 'teacher', 班级教师: 'teacher', 教师: 'teacher', 老师: 'teacher', 主班: 'teacher', 配班: 'teacher',
  care: 'care', 保育员: 'care', 保育: 'care',
  it: 'it', 信息接口人: 'it', 信息员: 'it', 信息管理员: 'it',
  director: 'director', 园长: 'director', 副园长: 'director', 业务园长: 'director', 保教主任: 'director'
};
export function roleOf(v) {
  const k = String(v || '').trim();
  return ROLE_ALIASES[k] || ROLE_ALIASES[k.toLowerCase()] || 'teacher';
}

export class PlatformError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** ticket → { uid, name, org:{id,name}|null, role }。字段按名取，不透传平台多给的东西。 */
export async function verifyTicket(ticket, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!platformConfigured()) throw new PlatformError('platform login is not configured', 'not-configured');
  const t = String(ticket || '').trim();
  if (!t || t.length > 512) throw new PlatformError('invalid ticket', 'bad-ticket');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let r, data;
  try {
    r = await fetchImpl(URL_, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(KEY ? { Authorization: 'Bearer ' + KEY } : {}) },
      body: JSON.stringify({ ticket: t })
    });
    data = await r.json().catch(() => null);
  } catch (e) {
    throw new PlatformError('platform did not answer', 'upstream');
  } finally { clearTimeout(timer); }
  if (!r.ok) throw new PlatformError('platform refused the ticket', 'rejected');
  const uid = str(data?.uid, 64);
  if (!uid) throw new PlatformError('no uid in answer', 'upstream');
  const org = data?.org && typeof data.org === 'object'
    ? { id: str(data.org.id, 64) || null, name: str(data.org.name, 80) || null } : null;
  return { uid, name: str(data?.name, 40) || '平台用户', org, role: roleOf(data?.role) };
}
