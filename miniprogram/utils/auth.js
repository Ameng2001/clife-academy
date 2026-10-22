// 微信登录：wx.login() 的 code → POST /api/login/wechat → token＋user 存本地。
// 之后每次打开先 GET /api/me：会话过半时服务端带回新 token，收到就替换；401 就当没登录。
const api = require('./api.js');

const ROLE_KEYS = ['nurse', 'teacher', 'care', 'it', 'director', 'district'];

function wxCode() {
  return new Promise((resolve, reject) => wx.login({
    success: r => (r.code ? resolve(r.code) : reject(Object.assign(new Error('微信没有给 code'), { code: 'wx-login' }))),
    fail: e => reject(Object.assign(new Error((e && e.errMsg) || '微信登录失败'), { code: 'wx-login' }))
  }));
}

// name 只在首次建档时用作显示名；之后以账号里的为准。
async function login(name) {
  const code = await wxCode();
  const r = await api.request('/api/login/wechat', { method: 'POST', body: Object.assign({ code }, name ? { name } : {}) });
  api.setToken(r.token);
  api.setUser(r.user);
  return r.user;
}

// 平台登录态进小程序：平台小程序跳过来（wx.navigateToMiniProgram 的 extraData.ticket）或场景二维码带 ticket，
// 换成大课堂的会话。岗位与园所以平台为准。
async function loginPlatform(ticket) {
  const r = await api.request('/api/login/platform', { method: 'POST', body: { ticket } });
  api.setToken(r.token);
  api.setUser(r.user);
  return r.user;
}
// 启动参数里有没有平台票据：onLaunch/onShow 的 options。
function ticketFrom(options) {
  const o = options || {};
  return (o.query && o.query.ticket) || (o.referrerInfo && o.referrerInfo.extraData && o.referrerInfo.extraData.ticket) || null;
}

// 园长看板：本园各岗位汇总（园长账号才有，其他岗位 403）
function orgSummary() { return api.request('/api/org/summary'); }
// 点评时效（园长本园；GET /api/review/stats）：待点评、超两个工作日、近 30 天中位时长、答疑队列
function reviewStats() { return api.request('/api/review/stats'); }
// 园所间匿名中位数（园长；GET /api/org/cohort）：本园对全市其他园与本区其他园，≥ 3 所才给中位数，不排名、不点名
function orgCohort() { return api.request('/api/org/cohort'); }

// 已有 token：问一次 /api/me，顺手换新 token。没 token 或被拒：null。
async function me() {
  if (!api.getToken()) return null;
  try {
    const r = await api.request('/api/me');
    if (r.token) api.setToken(r.token);
    api.setUser(r.user);
    return r.user;
  } catch (e) {
    if (e.status === 401) return null;
    throw e;   // 网络不通：本地存的 user 还算数，由调用方决定
  }
}

async function logout() {
  try { await api.request('/api/logout', { method: 'POST', body: {} }); } catch (e) {}
  api.setToken(null);
  api.setUser(null);
}

// 改自己的岗位（平台账号 403，由平台定）。
async function setRole(role) {
  if (!ROLE_KEYS.includes(role)) throw new Error('unknown role');
  const r = await api.request('/api/me/academy', { method: 'PUT', body: { role } });
  const u = api.getUser();
  if (u) { u.academy = r.academy; api.setUser(u); }
  return r.academy;
}

const current = () => api.getUser();
const signedIn = () => !!api.getToken() && !!api.getUser();

// 本人的带教配对：{ mentor, mentees }
function pair() { return api.request('/api/me/pair'); }
module.exports = { orgCohort, login, loginPlatform, ticketFrom, me, logout, setRole, orgSummary, pair, current, signedIn, ROLE_KEYS, reviewStats };
