// 本人收到的平台实操事件：服务端 GET /api/events 是权威，本地只缓存（按账号）。
// 关卡页「做」这一段等回传时每 10 秒问一次；「模拟平台回传」在登录后走 POST /api/events（服务端 DEV_LOGIN=1 才收）。
const api = require('./api.js');
const auth = require('./auth.js');
const KEY = 'clife-academy-mp-events';

let cache = null;
function read() { if (cache) return cache; try { cache = wx.getStorageSync(KEY) || null; } catch (e) { cache = null; } return cache; }
function write(v) { cache = v; try { if (v) wx.setStorageSync(KEY, v); else wx.removeStorageSync(KEY); } catch (e) {} }

function list() { const c = read(), u = auth.current(); return c && u && c.uid === u.id ? c.events : []; }
function has(event) { const e = String(event || '').trim(); return !!e && list().some(x => x.event === e); }
function refs(event) { const e = String(event || '').trim(); return list().filter(x => x.event === e).map(x => (x.src === 'demo' ? 'demo:' : 'ev:') + x.id); }

let loading = null;
async function load() {
  const u = auth.current();
  if (!u || !auth.signedIn()) { if (cache) write(null); return []; }
  if (loading) return loading;
  loading = (async () => {
    try { const r = await api.request('/api/events'); write({ uid: u.id, events: r.events || [] }); return list(); }
    catch (e) { if (e.status === 401) write(null); return list(); }
    finally { loading = null; }
  })();
  return loading;
}
// 演示：本人给自己回传一条；服务端没开 DEV_LOGIN 是 403，调用方回落到本地模拟
async function demo(event) {
  const r = await api.request('/api/events', { method: 'POST', body: { event } });
  const u = auth.current();
  if (u && r.events) write({ uid: u.id, events: r.events });
  return r;
}
function clear() { write(null); }

module.exports = { list, has, refs, load, demo, clear };
