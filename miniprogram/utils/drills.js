// 每周一题：GET /api/drills（要登录），作答 POST /api/drills/answer，同园作答 GET /api/drills/answers?id=（自己答了才看得到）。
// 点评在网页端。取不到时页面回落到演示题（data.js 的 DRILLS）。
const api = require('./api.js');
async function list() { return api.request('/api/drills'); }
async function answer(id, text) { return api.request('/api/drills/answer', { method: 'POST', body: { id, text } }); }
async function answers(id) { return api.request('/api/drills/answers?id=' + encodeURIComponent(id)); }
async function helpful(answerId, on) { return api.request('/api/drills/helpful', { method: 'POST', body: { answerId, on: on !== false } }); }
module.exports = { list, answer, answers, helpful };
