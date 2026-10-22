// 区县看板与跨园共同体：共同体 GET /api/district/communities（区县管理员）、GET /api/me/community（成员）。建组、改组在网页端 /district。
// 区县看板：区县管理员 GET /api/district/summary；园所名单 GET /api/district/orgs；挂接 PUT /api/district/orgs。
const api = require('./api.js');
async function summary() { return api.request('/api/district/summary'); }
async function orgs() { return api.request('/api/district/orgs'); }
async function communities() { return api.request('/api/district/communities'); }
async function myCommunity() { return api.request('/api/me/community'); }
async function attach(name) { return api.request('/api/district/orgs', { method: 'PUT', body: { orgs: [{ name }] } }); }
module.exports = { summary, orgs, attach, communities, myCommunity };
