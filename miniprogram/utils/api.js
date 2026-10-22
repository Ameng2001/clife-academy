// 同一套 api（clife-academy/api）：小程序没有 cookie，登录后拿到的 token 放 Authorization: Bearer。
// 非 2xx 走 reject，带 { status, data }（409 的 data 里有服务端整份状态）；401 把本地 token 清掉。
const { API_BASE } = require('./config.js');
const TOKEN_KEY = 'clife-academy-token';
const USER_KEY = 'clife-academy-user';

function getToken() { try { return wx.getStorageSync(TOKEN_KEY) || null; } catch (e) { return null; } }
function setToken(t) { try { if (t) wx.setStorageSync(TOKEN_KEY, t); else wx.removeStorageSync(TOKEN_KEY); } catch (e) {} }
function getUser() { try { return wx.getStorageSync(USER_KEY) || null; } catch (e) { return null; } }
function setUser(u) { try { if (u) wx.setStorageSync(USER_KEY, u); else wx.removeStorageSync(USER_KEY); } catch (e) {} }

function request(path, { method = 'GET', body = null, timeout } = {}) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.request({
      url: API_BASE + path,
      method,
      data: body == null ? undefined : body,
      header: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      timeout: timeout || (method === 'GET' ? 20000 : 60000),
      success(r) {
        const data = r.data && typeof r.data === 'object' ? r.data : null;
        if (r.statusCode >= 200 && r.statusCode < 300) {
          if (!data) return reject(Object.assign(new Error('服务器返回的不是大课堂数据'), { code: 'bad-response', status: r.statusCode }));
          return resolve(data);
        }
        if (r.statusCode === 401) { setToken(null); setUser(null); }
        reject(Object.assign(new Error((data && data.error) || ('HTTP ' + r.statusCode)), { status: r.statusCode, data: data || {}, code: data && data.code }));
      },
      fail(e) { reject(Object.assign(new Error((e && e.errMsg) || '网络不通'), { code: 'network' })); }
    });
  });
}

module.exports = { request, getToken, setToken, getUser, setUser, API_BASE };
