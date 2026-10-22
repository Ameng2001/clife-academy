// 答疑：GET /api/questions?level=（本关我的提问与本园已答的）、POST /api/questions 提问（助手整理，种子教师回答）、
// POST /api/questions/accept 采纳、POST /api/questions/close 已解决。回答与确认草稿在网页端 /questions。
const api = require('./api.js');
async function ofLevel(levelId) { return api.request('/api/questions?level=' + encodeURIComponent(levelId)); }
async function ask(levelId, text) { return api.request('/api/questions', { method: 'POST', body: { levelId, text } }); }
async function accept(id, answerId) { return api.request('/api/questions/accept', { method: 'POST', body: { id, answerId } }); }
async function close(id, note) { return api.request('/api/questions/close', { method: 'POST', body: { id, note: note || '' } }); }
module.exports = { ofLevel, ask, accept, close };
