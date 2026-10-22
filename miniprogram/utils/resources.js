// 资源库：GET /api/resources（内置教育部文件 + 本园与公开的上传）。没登录也能取公开的；取不到时页面回落到演示资料。
const api = require('./api.js');
async function list(opts) {
  const o = opts || {}, qs = [];
  if (o.q) qs.push('q=' + encodeURIComponent(o.q)); if (o.kind) qs.push('kind=' + o.kind); if (o.domain) qs.push('domain=' + o.domain);
  return api.request('/api/resources' + (qs.length ? '?' + qs.join('&') : ''));
}
// 专家案例（已入库的，要登录）
async function cases(opts) {
  const o = opts || {}, qs = [];
  if (o.q) qs.push('q=' + encodeURIComponent(o.q)); if (o.domain) qs.push('domain=' + o.domain); if (o.use) qs.push('use=' + o.use);
  return api.request('/api/cases' + (qs.length ? '?' + qs.join('&') : ''));
}
// 课程成果（教研工坊做出来、班里用过的课，已入库的，要登录）
async function works(opts) {
  const o = opts || {}, qs = [];
  if (o.q) qs.push('q=' + encodeURIComponent(o.q)); if (o.pipeline) qs.push('pipeline=' + o.pipeline); if (o.domain) qs.push('domain=' + o.domain);
  return api.request('/api/works' + (qs.length ? '?' + qs.join('&') : ''));
}
// 合集（按主题攒的案例、关卡、讲堂微课；建与改在网页端）
async function collections() { return api.request('/api/collections'); }
module.exports = { list, cases, works, collections };
