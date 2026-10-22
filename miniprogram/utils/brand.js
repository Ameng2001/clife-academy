// 平台名称：从 /api/config 的 brand 取（运营方在网页运营后台改），缓存在本机；没拿到前用默认。
// 顶栏的名字、地区副题和导航栏标题都从这里取。
const api = require('./api.js');
const KEY = 'brand';
const FALLBACK = { name: '幼师学坊', short: '幼师学坊', region: '', tagline: '按岗位走关，在平台上做一次就算一次。', credit: '' };
let B = null;
function get() {
  if (B) return B;
  try { const c = wx.getStorageSync(KEY); if (c && c.name) B = Object.assign({}, FALLBACK, c); } catch (e) {}
  return B || FALLBACK;
}
function applyTitle() { try { wx.setNavigationBarTitle({ title: get().short }); } catch (e) {} }
// 启动时问一次；拿到就存、刷新导航栏标题，并通知顶栏重画。
async function refresh() {
  try {
    const r = await api.request('/api/config');
    if (r && r.brand && r.brand.name) { B = Object.assign({}, FALLBACK, r.brand); try { wx.setStorageSync(KEY, B); } catch (e) {} applyTitle(); }
  } catch (e) { /* 离线：用缓存 */ }
  return get();
}
module.exports = { get, refresh, applyTitle, FALLBACK };
