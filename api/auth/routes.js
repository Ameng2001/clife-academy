/* 大课堂的登录路由：微信小程序、平台账号、开发桩。
 *
 * 三条路都落到同一件事：找到或建立 db.users 里的一个用户，发一张 session（cookie 给网页，token 给
 * 小程序，两者同一个 makeSession），把岗位与园所记在 user.academy 上。密码与 passkey 路由不动。
 *
 * user.academy = { role, org:{id,name}|null, source:'wechat'|'platform'|'dev', linkedAt }
 * 身份键：user.wx.openid（微信）、user.platform.uid（平台）。同一个人两条路登录会是两个用户——
 * 合并留给平台方做 unionid/手机号对账，首期不做。 */
import crypto from 'node:crypto';
import { wechatConfigured, code2session, WechatError } from './wechat.js';
import { platformConfigured, verifyTicket, roleOf, ROLES, PlatformError, PLATFORM_LOGIN_URL } from './platform.js';

export const DEV_LOGIN = /^(1|true|yes|on)$/i.test(process.env.DEV_LOGIN || '');

export const authConfig = () => ({
  auth: {
    wechat: wechatConfigured(), platform: platformConfigured(), dev: DEV_LOGIN,
    ...(PLATFORM_LOGIN_URL ? { platform_login_url: PLATFORM_LOGIN_URL } : {})
  }
});

export const academyOf = u => (u?.academy && typeof u.academy === 'object'
  ? { role: ROLES.includes(u.academy.role) ? u.academy.role : 'teacher', org: u.academy.org || null, source: u.academy.source || null }
  : null);

export function authRoutes({ json, readBody, db, saveDb, makeSession, sessionCookie, publicUser, audit, text, claimFirstAdmin }) {
  const newId = () => crypto.randomBytes(12).toString('base64url');
  const answer = (req, res, user, ev) => {
    audit(req, ev, { user });
    json(res, 200, { user: { ...publicUser(user), academy: academyOf(user) }, token: makeSession(user) }, { 'Set-Cookie': sessionCookie(user) });
  };
  const disabled = (req, res, user, ev) => {
    audit(req, ev, { ok: false, user, msg: 'account-disabled' });
    json(res, 403, { error: 'this account has been disabled', code: 'disabled' });
  };

  // 路由表的写法与 server.js 一致（'METHOD /path': async (req, res) =>），test/openapi-routes.test.js 按这个样子数路由。
  const wechat = {
  'POST /api/login/wechat': async (req, res) => {
    const body = await readBody(req);
    let s;
    try { s = await code2session(body.code); }
    catch (e) {
      const code = e instanceof WechatError ? e.code : 'upstream';
      audit(req, 'auth.wechat.fail', { ok: false, msg: code });
      return json(res, code === 'bad-code' || code.startsWith('wx:') ? 401 : 502, { error: 'wechat sign-in failed', code });
    }
    let user = db.users.find(u => u.wx?.openid === s.openid);
    if (user?.disabled) return disabled(req, res, user, 'auth.wechat.fail');
    if (!user) {
      const created = new Date().toISOString();
      const name = text(body.name).trim().slice(0, 40) || '微信用户';
      user = { id: newId(), name, created, wx: { openid: s.openid, ...(s.unionid ? { unionid: s.unionid } : {}) },
        academy: { role: 'teacher', org: null, source: 'wechat', linkedAt: created } };
      claimFirstAdmin(req, user);
      db.users.push(user);
      saveDb();
      audit(req, 'auth.register.ok', { user, msg: 'wechat' });
    } else if (s.unionid && !user.wx.unionid) { user.wx.unionid = s.unionid; saveDb(); }
    answer(req, res, user, 'auth.wechat.ok');
  }
  };

  const platform = {
  'POST /api/login/platform': async (req, res) => {
    const body = await readBody(req);
    let p;
    try { p = await verifyTicket(body.ticket); }
    catch (e) {
      const code = e instanceof PlatformError ? e.code : 'upstream';
      audit(req, 'auth.platform.fail', { ok: false, msg: code });
      return json(res, code === 'bad-ticket' || code === 'rejected' ? 401 : 502, { error: 'platform sign-in failed', code });
    }
    let user = db.users.find(u => u.platform?.uid === p.uid);
    if (user?.disabled) return disabled(req, res, user, 'auth.platform.fail');
    const now = new Date().toISOString();
    if (!user) {
      user = { id: newId(), name: p.name, created: now, platform: { uid: p.uid },
        academy: { role: p.role, org: p.org, source: 'platform', linkedAt: now } };
      claimFirstAdmin(req, user);
      db.users.push(user);
      audit(req, 'auth.register.ok', { user, msg: 'platform' });
    } else {
      // 平台是岗位与园所的权威来源：每次登录以平台为准，园长在大课堂里改的岗位不保留。
      user.name = p.name;
      user.academy = { ...(user.academy || {}), role: p.role, org: p.org, source: 'platform' };
    }
    saveDb();
    answer(req, res, user, 'auth.platform.ok');
  }
  };

  // 开发桩：DEV_LOGIN=1 时才有。名字＋岗位＋园所直接进，不验任何东西。生产环境绝不能开。
  const dev = {
  'POST /api/login/dev': async (req, res) => {
    const body = await readBody(req);
    const name = text(body.name).trim().slice(0, 40);
    if (!name) return json(res, 400, { error: 'name required', code: 'missing' });
    const role = roleOf(body.role);
    const orgName = text(body.org).trim().slice(0, 80) || '演示幼儿园';
    let user = db.users.find(u => u.dev && u.name === name);
    const now = new Date().toISOString();
    if (!user) {
      user = { id: newId(), name, created: now, dev: true, academy: { role, org: { id: null, name: orgName }, source: 'dev', linkedAt: now } };
      claimFirstAdmin(req, user);
      db.users.push(user);
    } else {
      user.academy = { ...(user.academy || {}), role, org: { id: null, name: orgName }, source: 'dev' };
    }
    saveDb();
    answer(req, res, user, 'auth.dev.ok');
  }
  };

  return {
    ...(wechatConfigured() ? wechat : {}),
    ...(platformConfigured() ? platform : {}),
    ...(DEV_LOGIN ? dev : {})
  };
}
