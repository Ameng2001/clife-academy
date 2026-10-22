// 名师讲堂：GET /api/lectures（没登录也能看），预约 POST /api/lectures/book（要登录）。
// 直播在第三方，小程序里复制链接去浏览器或腾讯会议打开；取不到时页面回落到演示场次（data.js 的 LIVES / REPLAYS）。
const api = require('./api.js');
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const pad = n => String(n).padStart(2, '0');
function when(at, minutes) { const d = new Date(at), e = new Date(at + (minutes || 60) * 60000); return `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${WD[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}—${pad(e.getHours())}:${pad(e.getMinutes())}`; }
async function list() { return api.request('/api/lectures'); }
async function book(id, on) { return api.request('/api/lectures/book', { method: 'POST', body: { id, on: on !== false } }); }
module.exports = { list, book, when };
