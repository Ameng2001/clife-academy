// 专业发展：Coach（/api/me/coach）、自评与三方评（/api/me/selfreview）、园内教研组（/api/studytasks）、练习营（/api/camps）、研修项目（/api/programs）、园所分享日（/api/sharedays）、运营周报（/api/ops/weekly）。
// 发任务、办营、建期次、办分享日、写三方评在网页端；小程序做本人这一侧：看、填、交、报名。
const api = require('./api.js');
const get = p => api.request(p);
const post = (p, body) => api.request(p, { method: 'POST', body: body || {} });
module.exports = {
  coach: () => get('/api/me/coach'),
  coachPlan: () => post('/api/me/coach/plan'),
  coachReview: () => post('/api/me/coach/review'),
  coachDebrief: levelId => post('/api/me/coach/debrief', { levelId }),
  coachAccept: (id, on) => post('/api/me/coach/accept', { id, on }),
  selfReview: () => get('/api/me/selfreview'),
  saveSelfReview: (levels, focus, reflection) => post('/api/me/selfreview', { levels, focus, reflection }),
  studyTasks: () => get('/api/studytasks'),
  studyReply: (id, text) => post('/api/studytasks/reply', { id, text }),
  camps: () => get('/api/camps'),
  campJoin: id => post('/api/camps/join', { id }),
  campLeave: id => post('/api/camps/leave', { id }),
  campPost: (id, day, text) => post('/api/camps/post', { id, day, text }),
  programs: () => get('/api/programs'),
  programApply: (id, withdraw) => post('/api/programs/apply', { id, withdraw: !!withdraw }),
  sharedays: () => get('/api/sharedays'),
  weekly: () => get('/api/ops/weekly')
};
