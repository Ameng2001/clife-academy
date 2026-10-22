// 页面用的状态：身份、各路径游标、过关数、单关四段草稿、预约/作答/工单。
// 进度与过关数来自 sync.js 的文档（登录后随账号同步）；四段草稿（seg/zuo/right）只留本机，通关即清。
const D = require('./data.js');
const auth = require('./auth.js');
const sync = require('./sync.js');
const events = require('./events.js');
const submissions = require('./submissions.js');
const notify = require('./notify.js');
const capability = require('./capability.js');
const resources = require('./resources.js');
const lectures = require('./lectures.js');
const drills = require('./drills.js');
const honors = require('./honors.js');
const contests = require('./contests.js');
const checkup = require('./checkup.js');
const district = require('./district.js');
const certs = require('./certs.js');
const questions = require('./questions.js');
const studios = require('./studios.js');
const portfolio = require('./portfolio.js');
const growth = require('./growth.js');
const KEY = 'clife-academy-mp-local-v1';

function freshLocal() {
  return { lv: {}, live: {}, drill: {}, asked: [], tickets: [{ id: 'GD-1206', t: '额温枪离线（小一班）', s: '处理中' }] };
}
let L = freshLocal();
try { const s = wx.getStorageSync(KEY); if (s && s.lv) L = Object.assign(freshLocal(), s); } catch (e) {}

function save() { try { wx.setStorageSync(KEY, L); } catch (e) {} }
// 兼容老页面的 ST.prog / ST.credits / ST.role：每次 get() 现算。
function get() {
  const S = sync.get();
  const prog = {}; Object.keys(D.PATHS).forEach(p => { prog[p] = sync.cursor(p); });
  const credits = {}; Object.keys(D.PATHS).forEach(p => { credits[p] = (S.credits && S.credits[p]) || 0; });
  const u = auth.current();
  const role = (u && u.academy && u.academy.role) || S.role || 'nurse';
  return Object.assign(L, { role: D.ROLES[role] ? role : 'teacher', prog, credits, user: u, signedIn: auth.signedIn() });
}
// 重置：访客重置演示进度；登录状态只清本机草稿，账号进度不动。
function reset() { L = freshLocal(); save(); return sync.resetDemo(); }
function setRole(r) {
  sync.setRole(r);
  if (auth.signedIn()) auth.setRole(r).catch(e => { wx.showToast({ title: e.code === 'platform' ? '岗位由平台设定' : '岗位没能保存到账号', icon: 'none' }); });
}
// 顶栏显示的身份：登录后是「岗位 · 姓名」，没登录是示例人物。
function roleLabel(r) {
  const role = r || get().role, u = auth.current();
  return u ? D.PATHN[role] + ' · ' + u.name : D.ROLES[role].label;
}
function myPath() { return D.ROLES[get().role].path; }
function status(p, i) { const d = sync.cursor(p); return i < d ? 'done' : (i === d ? 'current' : 'locked'); }
function lvState(p, i) { const k = p + '-' + i; return L.lv[k] || (L.lv[k] = { seg: 'jiang', zuo: false, right: [] }); }
function level(p, i) { return D.PATHS[p][i]; }
function title(p, i) { const l = level(p, i); return l.featured ? '全日观察与疾病登记' : l.t; }
function qsOf(p, i) { const l = level(p, i); return l.featured ? D.OBS.qs : l.qs; }
// 录屏时间戳：每步 25 秒，写成 m:ss（原来 '0:' + 秒数，第四步起会出 0:75、0:100）
const mmss = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
function stepsOf(p, i) { const l = level(p, i); return l.featured ? D.OBS.steps : l.steps; }
function scenesOf(p, i) {
  const l = level(p, i);
  if (l.featured) return D.OBS.scenes.map(s => ({ t: s.t, name: s.name, subs: s.subs }));
  return l.steps.map((s, k) => ({ t: mmss(k * 25), name: '第 ' + (k + 1) + ' 步', subs: [s, ''] }));
}
function chaptersOf(p, i) {
  const l = level(p, i);
  if (l.featured) return D.OBS.chapters.map(c => ({ t: c[0], text: c[1], target: c[2] }));
  return l.steps.map((s, k) => ({ t: mmss(k * 25), text: s, target: k === 0 ? 'menu' : k === 1 ? 'btn' : 'form' }));
}
function fmtDay(ts) { const d = new Date(ts); return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'; }
function passedAt(p, i) { const t = sync.passedAt(p + '-' + i); return t ? fmtDay(t) : null; }
// 通关：做过、测验全对、正是当前关。进度进文档（登录后随之推送），草稿清掉。
// 「做」完成：平台回传了这关的事件，或本机模拟过
// 实践关 / 研讨关按提交判（实践关要点评通过；研讨关交了就算）
function isSub(l) { return l.type === 'practice' || l.type === 'seminar'; }
function zuoDone(p, i) {
  const st = lvState(p, i), l = level(p, i);
  if (isSub(l)) { const d = submissions.get(p + '-' + i); return submissions.done(l, d && d.submissions); }
  return !!st.zuo || !String(l.event || '').trim() || events.has(l.event);
}
function tryPass(p, i) {
  const st = lvState(p, i), qs = qsOf(p, i);
  if (zuoDone(p, i) && st.right.length >= qs.length && status(p, i) === 'current') {
    const ok = sync.recordPass(p, i, { right: st.right.length, of: qs.length });
    if (ok) { delete L.lv[p + '-' + i]; save(); }
    return ok;
  }
  return false;
}
function fmtTime() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

module.exports = { get, save, reset, setRole, roleLabel, myPath, status, lvState, zuoDone, isSub, level, title, qsOf, stepsOf, scenesOf, chaptersOf, tryPass, passedAt, fmtDay, fmtTime, D, auth, sync, events, submissions, notify, capability, resources, lectures, drills, honors, contests, checkup, district, certs, questions, studios, portfolio, growth };
