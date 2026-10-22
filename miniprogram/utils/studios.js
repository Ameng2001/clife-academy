// 名师工作室与市级展示：GET /api/studios（列表、申请）、GET /api/showcases（上台作品与名师点评）。建室、办展、上台、点评在网页端 /studios。
const api = require('./api.js');
async function studios() { return api.request('/api/studios'); }
async function showcases() { return api.request('/api/showcases'); }
async function apply(id, note) { return api.request('/api/studios/apply', { method: 'POST', body: { id, note: note || '' } }); }
module.exports = { studios, showcases, apply };
