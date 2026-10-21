/* 微信小程序订阅消息（docs/ROADMAP.md 第九节「提醒」：不催、不计在线时长）。
 *
 * 只做事件触发的两类，没有定时的「今日一关」：
 *   review  实践关被点评了 → 通知提交的教师（通过 / 需修改、一句意见）
 *   queue   本园有新的实践关提交 → 通知园长与点评人
 *
 * 订阅消息是一次性的：小程序里用户每点一次「允许」，服务端记一次额度（db.subscriptions），
 * 发一条用掉一条；用户点「拒绝」额度清零；微信答 43101（用户拒收）也清零。
 * 模板 ID 与字段映射走环境变量（模板从公共模板库选，字段名因模板而异）：
 *   WX_TMPL_REVIEW=xxx   WX_TMPL_REVIEW_DATA='{"thing1":"title","phrase2":"verdict","time3":"at","thing4":"comment"}'
 *   WX_TMPL_QUEUE=yyy    WX_TMPL_QUEUE_DATA='{"thing1":"title","name2":"who","time3":"at"}'
 * 逻辑字段：review → title verdict at comment by；queue → title who at note。
 * 值按微信的字段规则截断：thing ≤ 20 字、name ≤ 10、phrase ≤ 5、character_string ≤ 32、time 为「年月日 时:分」。
 * 发送要 openid：微信登录的账号自带；平台账号在小程序里订阅时带 wx.login() 的 code，服务端换 openid 绑到该账号（只用于推送）。
 * 发送失败只记日志，绝不影响提交与点评本身。 */
import { wechatConfigured, code2session, WechatError } from '../auth/wechat.js';
import { orgKeyOf } from './org.js';

const APPID = process.env.WX_APPID || '', SECRET = process.env.WX_SECRET || '';
const BASE = (process.env.WX_API_BASE || 'https://api.weixin.qq.com').replace(/\/+$/, '');
const MP_STATE = /^(developer|trial|formal)$/.test(process.env.WX_MP_STATE || '') ? process.env.WX_MP_STATE : 'formal';
const KINDS = ['review', 'queue'];
const DEFAULT_DATA = {
  review: { thing1: 'title', phrase2: 'verdict', time3: 'at', thing4: 'comment' },
  queue: { thing1: 'title', name2: 'who', time3: 'at' }
};
const GRANT_CAP = 50;

function parseData(kind) {
  const raw = process.env[`WX_TMPL_${kind.toUpperCase()}_DATA`];
  if (!raw) return DEFAULT_DATA[kind];
  try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : DEFAULT_DATA[kind]; } catch { return DEFAULT_DATA[kind]; }
}
export const TEMPLATES = Object.freeze(Object.fromEntries(KINDS.map(k => [k, (process.env[`WX_TMPL_${k.toUpperCase()}`] || '').trim()]).filter(([, v]) => v)));
export const notifyConfigured = () => wechatConfigured() && Object.keys(TEMPLATES).length > 0;

const pad = n => String(n).padStart(2, '0');
export const fmtTime = ts => { const d = new Date(ts); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const cut = (s, n) => { const a = [...String(s ?? '')]; return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
/** 按微信字段规则把逻辑字段装进模板字段。导出便于测试。 */
export function templateData(kind, fields) {
  const map = parseData(kind), out = {};
  for (const [key, logical] of Object.entries(map)) {
    let v = fields[logical];
    if (v == null || v === '') v = logical === 'comment' || logical === 'note' ? '无' : '—';
    const t = key.replace(/\d+$/, '');
    if (t === 'time') v = typeof v === 'number' ? fmtTime(v) : String(v);
    else if (t === 'thing') v = cut(v, 20);
    else if (t === 'name') v = cut(v, 10);
    else if (t === 'phrase') v = cut(v, 5);
    else if (t === 'character_string') v = cut(v, 32);
    else if (t === 'number') v = String(Number(v) || 0);
    else v = cut(v, 20);
    out[key] = { value: v };
  }
  return out;
}

export function createNotifier({ db, saveDb, fetchImpl = fetch, log = (...a) => console.log('notify:', ...a) }) {
  db.subscriptions = db.subscriptions || [];
  const row = (uid, kind, make) => {
    let r = db.subscriptions.find(x => x.uid === uid && x.kind === kind);
    if (!r && make) { r = { uid, kind, n: 0, at: 0 }; db.subscriptions.push(r); }
    return r;
  };
  let token = null, tokenUntil = 0;
  async function accessToken(force) {
    if (!force && token && Date.now() < tokenUntil) return token;
    const r = await fetchImpl(`${BASE}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(APPID)}&secret=${encodeURIComponent(SECRET)}`);
    const d = await r.json();
    if (!d?.access_token) throw new Error('token: ' + (d?.errmsg || 'no access_token'));
    token = d.access_token; tokenUntil = Date.now() + Math.max(60, (d.expires_in || 7200) - 300) * 1000;
    return token;
  }
  return {
    remaining: uid => Object.fromEntries(Object.keys(TEMPLATES).map(k => [k, row(uid, k)?.n || 0])),
    // 小程序回报 wx.requestSubscribeMessage 的结果：accept 记一次，reject 清零
    grant(uid, results) {
      for (const k of Object.keys(TEMPLATES)) {
        const v = results?.[k];
        if (v === 'accept') { const r = row(uid, k, true); r.n = Math.min(GRANT_CAP, r.n + 1); r.at = Date.now(); }
        else if (v === 'reject') { const r = row(uid, k, true); r.n = 0; r.at = Date.now(); }
      }
      saveDb();
      return this.remaining(uid);
    },
    // 发一条；用掉一次额度。返回 { sent, why }，从不抛。
    async send(uid, kind, fields, page) {
      if (!TEMPLATES[kind]) return { sent: false, why: 'no-template' };
      const user = db.users.find(u => u.id === uid);
      if (!user) return { sent: false, why: 'no-user' };
      if (!user.wx?.openid) return { sent: false, why: 'no-openid' };
      const r = row(uid, kind);
      if (!r || r.n <= 0) return { sent: false, why: 'no-grant' };
      r.n -= 1; saveDb();
      const body = { touser: user.wx.openid, template_id: TEMPLATES[kind], data: templateData(kind, fields), miniprogram_state: MP_STATE, lang: 'zh_CN', ...(page ? { page } : {}) };
      try {
        let d = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          const at = await accessToken(attempt > 0);
          const res = await fetchImpl(`${BASE}/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(at)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          d = await res.json().catch(() => null);
          if (d && (d.errcode === 40001 || d.errcode === 42001 || d.errcode === 40014)) continue;   // token 失效：换一个再试一次
          break;
        }
        if (!d || d.errcode) {
          if (d?.errcode === 43101) { r.n = 0; saveDb(); }   // 用户拒收：额度清零，不再发
          log(`send ${kind} to ${uid} failed: ${d?.errcode ?? 'no answer'} ${d?.errmsg || ''}`);
          return { sent: false, why: d?.errcode === 43101 ? 'refused' : 'wx:' + (d?.errcode ?? 'unknown') };
        }
        return { sent: true };
      } catch (e) { log(`send ${kind} to ${uid} failed: ${e.message}`); return { sent: false, why: 'upstream' }; }
    },
    /** 本园的点评人（园长、管理员、academy.reviewer），不含 except。 */
    reviewersOf(org, except, isAdmin) {
      if (!org) return [];
      return db.users.filter(u => !u.disabled && u.id !== except && orgKeyOf(u) === org && (u.academy?.role === 'director' || u.academy?.reviewer === true || isAdmin(u)));
    }
  };
}

export function notifyRoutes({ json, readBody, db, saveDb, readSession, audit, notifier }) {
  return {
  // 有哪些模板、本人各还剩几次额度
  'GET /api/notify': async (req, res) => {
    const user = readSession(req);
    json(res, 200, { templates: TEMPLATES, mine: user ? notifier.remaining(user.id) : null });
  },
  // 小程序回报订阅结果：{ results: { review: 'accept'|'reject', queue: … }, code? }
  // code 是 wx.login() 的 code：账号还没有 openid 时（平台账号登录的小程序）换一个绑上，只用于推送。
  'POST /api/notify/subscribe': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!notifyConfigured()) return json(res, 404, { error: 'subscribe messages are not configured', code: 'not-configured' });
    const body = await readBody(req);
    let bound = false;
    if (!user.wx?.openid && typeof body.code === 'string' && body.code) {
      try {
        const s = await code2session(body.code);
        // 这个 openid 已经是另一个账号的：不抢，推送仍走那一个
        if (!db.users.some(u => u.id !== user.id && u.wx?.openid === s.openid)) { user.wx = { ...(user.wx || {}), openid: s.openid, ...(s.unionid ? { unionid: s.unionid } : {}) }; bound = true; saveDb(); }
      } catch (e) { audit(req, 'notify.bind.fail', { ok: false, user, msg: e instanceof WechatError ? e.code : 'upstream' }); }
    }
    const mine = notifier.grant(user.id, body.results && typeof body.results === 'object' ? body.results : {});
    audit(req, 'notify.subscribe', { user, msg: Object.entries(mine).map(([k, n]) => `${k}=${n}`).join(' ') });
    json(res, 200, { mine, openid: !!user.wx?.openid, bound });
  }
  };
}
