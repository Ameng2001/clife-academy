/* 平台实操事件回传：POST /api/events。
 *
 * 一关的「做」是在柳州数智幼教平台上实际操作一次（批量调整、保存全日观察……）。平台做完后把事件回传到这里，
 * 关卡页看到对应事件就把「做」打勾，不要截图、不要手工登记。事件名是闭合清单（events-data.js，由课程包生成），
 * 不在清单上的拒收。契约全文给平台接口人的版本在 docs/PLATFORM-EVENTS.md。
 *
 * 两种调用方：
 *   平台（服务端到服务端）  Authorization: Bearer {PLATFORM_EVENTS_KEY}
 *                            { "uid": "<平台用户标识>", "event": "...", "at"?: ISO|ms, "ref"?: "<平台侧记录 id>", "id"?: "<幂等键>" }
 *                            或 { "events": [ …同上… ] }，一次最多 100 条
 *   本人（DEV_LOGIN=1 时）    带自己的会话，{ "event": "...", "ref"? }：网页与小程序的「模拟回传（演示）」按钮用，生产不开
 *
 * 幂等：同一用户同一 id 只收一次；没 id 的按 (event, ref) 去重，ref 为空则不去重（平台每次回传算一次）。
 * 存储：db.events，每用户最多 EVENTS_PER_USER 条，超出丢最旧的。
 * GET /api/events?since=<ms>：本人的事件，按收到时间升序，最多 500 条。
 * GET /api/org/recent-events?days=7：本园最近触发过的事件名，按次数从多到少，只给事件名与关卡 id，不给次数、不给人。给精品微课「本周常查」用。 */
import crypto from 'node:crypto';
import { EVENTS } from './events-data.js';
import { orgKeyOf } from './org.js';

const KEY = process.env.PLATFORM_EVENTS_KEY || '';
export const EVENTS_PER_USER = 2000;
const MAX_BATCH = 100;

export const eventsConfig = DEV_LOGIN => (KEY || DEV_LOGIN ? { events: { ...(KEY ? { platform: true } : {}), ...(DEV_LOGIN ? { demo: true } : {}) } } : {});
export const knownEvent = e => Object.prototype.hasOwnProperty.call(EVENTS, e);
export const levelsOfEvent = e => EVENTS[e] || [];

function platformKeyOk(req) {
  if (!KEY) return false;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return false;
  const given = Buffer.from(h.slice(7).trim()), want = Buffer.from(KEY);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' ? String(v) : '');
function timeOf(v, fallback) {
  if (v == null || v === '') return fallback;
  const t = typeof v === 'number' ? v : Date.parse(String(v));
  return Number.isFinite(t) && t > 0 ? t : null;
}

export function academyEventRoutes({ json, readBody, db, saveDb, readSession, audit, DEV_LOGIN }) {
  db.events = db.events || [];
  const newId = () => crypto.randomBytes(9).toString('base64url');

  // 一条事件入库。返回 'accepted' | 'duplicate' | 错误码。
  function accept(user, item, src, now) {
    const event = str(item.event, 120);
    if (!event) return 'missing-event';
    if (!knownEvent(event)) return 'unknown-event';
    const at = timeOf(item.at, now);
    if (at === null) return 'bad-time';
    const ref = str(item.ref, 120) || null;
    const id = str(item.id, 120) || null;
    const mine = db.events.filter(e => e.uid === user.id);
    if (id && mine.some(e => e.key === id)) return 'duplicate';
    if (!id && ref && mine.some(e => e.event === event && e.ref === ref)) return 'duplicate';
    db.events.push({ id: newId(), key: id, uid: user.id, event, at, ref, src, received: now });
    if (mine.length + 1 > EVENTS_PER_USER) {
      let drop = mine.length + 1 - EVENTS_PER_USER;
      db.events = db.events.filter(e => e.uid !== user.id || !(drop > 0 && drop--));
    }
    return 'accepted';
  }

  const forClient = e => ({ id: e.id, event: e.event, at: e.at, ref: e.ref, src: e.src, received: e.received, levels: levelsOfEvent(e.event) });

  return {
  'POST /api/events': async (req, res) => {
    const body = await readBody(req);
    const now = Date.now();
    if (platformKeyOk(req)) {
      const items = Array.isArray(body.events) ? body.events : [body];
      if (items.length === 0 || items.length > MAX_BATCH) return json(res, 400, { error: `1 to ${MAX_BATCH} events per call`, code: 'batch' });
      const out = { accepted: 0, duplicates: 0, rejected: [] };
      for (let i = 0; i < items.length; i++) {
        const item = items[i] && typeof items[i] === 'object' ? items[i] : {};
        const uid = str(item.uid, 64);
        const user = uid ? db.users.find(u => u.platform?.uid === uid && !u.disabled) : null;
        if (!user) { out.rejected.push({ i, code: uid ? 'no-user' : 'missing-uid' }); continue; }
        const r = accept(user, item, 'platform', now);
        if (r === 'accepted') out.accepted++;
        else if (r === 'duplicate') out.duplicates++;
        else out.rejected.push({ i, code: r });
      }
      if (out.accepted) saveDb();
      audit(req, 'events.platform', { msg: `${out.accepted} accepted, ${out.duplicates} dup, ${out.rejected.length} rejected` });
      // 单条调用：有拒绝就按拒绝码答，平台好排错
      if (!Array.isArray(body.events) && out.rejected.length) {
        const code = out.rejected[0].code;
        return json(res, code === 'no-user' || code === 'missing-uid' ? 404 : 400, { error: 'event refused', code });
      }
      return json(res, 200, out);
    }
    // 演示：本人给自己回传
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!DEV_LOGIN) return json(res, 403, { error: 'events come from the platform', code: 'platform-only' });
    const r = accept(user, body, 'demo', now);
    if (r !== 'accepted' && r !== 'duplicate') return json(res, 400, { error: 'event refused', code: r });
    if (r === 'accepted') saveDb();
    const mine = db.events.filter(e => e.uid === user.id).map(forClient);
    json(res, 200, { accepted: r === 'accepted' ? 1 : 0, duplicates: r === 'duplicate' ? 1 : 0, rejected: [], events: mine });
  },

  'GET /api/org/recent-events': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const key = orgKeyOf(user);
    const days = Math.min(90, Math.max(1, Number(new URL(req.url, 'http://x').searchParams.get('days') || 7) || 7));
    const since = Date.now() - days * 86400000;
    const uids = new Set(key ? db.users.filter(u => !u.disabled && orgKeyOf(u) === key).map(u => u.id) : [user.id]);
    const count = new Map();
    for (const e of db.events) if (uids.has(e.uid) && e.at >= since) count.set(e.event, (count.get(e.event) || 0) + 1);
    const events = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh')).slice(0, 20).map(([event]) => ({ event, levels: levelsOfEvent(event) }));
    json(res, 200, { days, events, scope: key ? 'org' : 'self' });
  },

  'GET /api/events': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const since = Number(new URL(req.url, 'http://x').searchParams.get('since') || 0) || 0;
    const mine = db.events.filter(e => e.uid === user.id && e.received > since).sort((a, b) => a.received - b.received).slice(-500);
    json(res, 200, { events: mine.map(forClient), now: Date.now() });
  }
  };
}
