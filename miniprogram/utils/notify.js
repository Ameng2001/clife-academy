// 订阅消息：服务端 GET /api/notify 给模板 ID；用户点一次「允许」记一次额度（POST /api/notify/subscribe）。
// 只有两类、都是事件触发：review 实践关被点评了，queue 本园有新的实践关提交。没有定时催学。
// 平台账号在小程序里没有 openid：订阅时顺带 wx.login() 的 code，服务端换 openid 绑上，只用于推送。
const api = require('./api.js');
const auth = require('./auth.js');
let cfg = null;

async function templates() {
  if (cfg) return cfg;
  try { cfg = await api.request('/api/notify'); } catch (e) { cfg = { templates: {}, mine: null }; }
  return cfg;
}
function code() { return new Promise(resolve => wx.login({ success: r => resolve(r.code || null), fail: () => resolve(null) })); }
/** 问用户要 kinds 里有模板的那几类；返回服务端记下的额度，没模板或没登录返回 null。 */
async function ask(kinds) {
  if (!auth.signedIn()) return null;
  const c = await templates();
  const ids = kinds.map(k => c.templates[k]).filter(Boolean);
  if (!ids.length || typeof wx.requestSubscribeMessage !== 'function') return null;
  const res = await new Promise(resolve => wx.requestSubscribeMessage({ tmplIds: ids, success: r => resolve(r), fail: () => resolve({}) }));
  const results = {};
  kinds.forEach(k => { const id = c.templates[k]; if (id && (res[id] === 'accept' || res[id] === 'reject')) results[k] = res[id]; });
  if (!Object.keys(results).length) return null;
  const body = { results };
  const u = auth.current();
  if (u && !(u.wx && u.wx.openid) && u.academy && u.academy.source !== 'wechat') body.code = await code();
  try { const r = await api.request('/api/notify/subscribe', { method: 'POST', body }); cfg = Object.assign({}, cfg, { mine: r.mine }); return r.mine; }
  catch (e) { return null; }
}
function reset() { cfg = null; }
module.exports = { templates, ask, reset };
