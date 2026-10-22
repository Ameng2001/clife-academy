// 发展档案与学时证明：GET /api/me/portfolio（本人全部记录）、GET /api/me/hours（本学年学时预览与已出具的证明）。打印、下载 JSON、出具证明在网页端 /portfolio。
const api = require('./api.js');
async function get() { return api.request('/api/me/portfolio'); }
async function hours() { return api.request('/api/me/hours'); }
module.exports = { get, hours };
