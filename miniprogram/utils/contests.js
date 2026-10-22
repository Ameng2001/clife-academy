// 斗课园内赛：GET /api/contests、/one?id=，应战 POST /api/contests/enter（文字设计；片段在网页端传），互评 POST /api/contests/rate。
// 主持（出题、编组、对照、入选、收官）在网页端。
const api = require('./api.js');
async function list() { return api.request('/api/contests'); }
async function one(id) { return api.request('/api/contests/one?id=' + encodeURIComponent(id)); }
async function enter(id, design, note) { return api.request('/api/contests/enter', { method: 'POST', body: { id, design, note } }); }
async function rate(entryId, scores, comment) { return api.request('/api/contests/rate', { method: 'POST', body: { entryId, scores, comment } }); }
module.exports = { list, one, enter, rate };
