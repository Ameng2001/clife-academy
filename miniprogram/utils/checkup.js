// 探针体检卡：园长 GET /api/org/checkup；任何成员 GET /api/me/checkup（本园体检推给我这个岗位的关）。取不到回落演示数（data.js 的 PROBES）。
const api = require('./api.js');
async function org() { return api.request('/api/org/checkup'); }
async function mine() { return api.request('/api/me/checkup'); }
module.exports = { org, mine };
