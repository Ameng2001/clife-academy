/* 微信小程序登录：wx.login() 的 code 换 openid（jscode2session）。
 *
 * 只做一件事：拿 code 问微信要 openid / unionid。用户查找与建档在 routes.js。
 * WX_APPID、WX_SECRET 不设时整个入口不出现（/api/config auth.wechat=false，路由 404）。
 * WX_API_BASE 只给测试用：把微信换成本地桩。 */
const APPID = process.env.WX_APPID || '';
const SECRET = process.env.WX_SECRET || '';
const BASE = (process.env.WX_API_BASE || 'https://api.weixin.qq.com').replace(/\/+$/, '');

export const wechatConfigured = () => !!(APPID && SECRET);

export class WechatError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

/** code → { openid, unionid|null }。微信侧的 errcode 原样带回（40029 code 无效，45011 频率）。 */
export async function code2session(code, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!wechatConfigured()) throw new WechatError('wechat login is not configured', 'not-configured');
  const c = String(code || '').trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(c)) throw new WechatError('invalid code', 'bad-code');
  const url = `${BASE}/sns/jscode2session?appid=${encodeURIComponent(APPID)}&secret=${encodeURIComponent(SECRET)}&js_code=${encodeURIComponent(c)}&grant_type=authorization_code`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let data;
  try {
    const r = await fetchImpl(url, { signal: ctl.signal });
    data = await r.json();
  } catch (e) {
    throw new WechatError('wechat did not answer', 'upstream');
  } finally { clearTimeout(timer); }
  if (!data || data.errcode) throw new WechatError(data?.errmsg || 'wechat refused the code', 'wx:' + (data?.errcode ?? 'unknown'));
  if (typeof data.openid !== 'string' || !data.openid) throw new WechatError('no openid in answer', 'upstream');
  return { openid: data.openid, unionid: typeof data.unionid === 'string' && data.unionid ? data.unionid : null };
}
