// 证书与认证期次：GET /api/me/certificates（我的证书、三级条件进度、期次），POST /api/cohorts/apply 报名。开班与答辩结果在网页端。
const api = require('./api.js');
async function mine() { return api.request('/api/me/certificates'); }
async function apply(id, note) { return api.request('/api/cohorts/apply', { method: 'POST', body: { id, note: note || '' } }); }
module.exports = { mine, apply };
