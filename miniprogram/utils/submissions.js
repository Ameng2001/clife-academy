// 实践关、研讨关的提交（GET/POST /api/submissions）。服务端是权威，这里按关在内存里缓存一份。
// done(level, list)：实践关要最新一条点评通过；研讨关交了就算。
const api = require('./api.js');
const auth = require('./auth.js');
const byLevel = {};
const latest = list => (list && list.length ? list[0] : null);
function done(level, list) { const s = latest(list); if (!s) return false; return level.type === 'seminar' ? true : s.status === 'pass'; }
function get(levelId) { return byLevel[levelId] || null; }
async function load(levelId) {
  if (!auth.signedIn()) return null;
  try { const r = await api.request('/api/submissions?level=' + encodeURIComponent(levelId)); byLevel[levelId] = r; return r; }
  catch (e) { return byLevel[levelId] || null; }
}
async function submit(levelId, text, files) {
  const r = await api.request('/api/submissions', { method: 'POST', body: { levelId, text, files: files || [] } });
  await load(levelId);
  return r.submission;
}
let all = null;
async function loadAll() {
  if (!auth.signedIn()) { all = null; return []; }
  try { const r = await api.request('/api/submissions'); all = r.submissions || []; } catch (e) {}
  return all || [];
}
function getAll() { return all || []; }
function clear() { all = null; Object.keys(byLevel).forEach(k => delete byLevel[k]); }
const STATUS = { pending: '待点评', pass: '已通过', revise: '需修改' };
async function helpful(levelId, id, on) { const r = await api.request('/api/submissions/helpful', { method: 'POST', body: { id, on: on !== false } }); await load(levelId); return r.submission; }
module.exports = { get, load, submit, done, latest, loadAll, getAll, clear, STATUS, helpful };
