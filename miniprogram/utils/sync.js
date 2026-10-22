// 进度文档与同步：和网页端同一份结构（clife-academy frontend/src/store/useStore.js），同一个账号两端互通。
//   S = { _ts, role, progress: { [levelId]: { passedAt, credits, quiz, demo? } }, sessions: [...], credits: { [path]: n } }
// 登录后整份 PUT /api/data，带 baseRev/baseWid 做条件写；409 就按并集规则合并再推一次；
// 每次进前台 GET /api/data/rev，修订号动了才取整份。没登录时文档只在本机，预置演示进度（demo:true），登录时不带进账号。
const api = require('./api.js');
const auth = require('./auth.js');
const D = require('./data.js');

const KEY = 'clife-academy-mp-state-v1';
const BASE_KEY = 'clife-academy-mp-sync';
const DIRTY_KEY = 'clife-academy-mp-dirty';
const DEMO_PROG = { nurse: 5, teacher: 2, care: 1, it: 0, director: 2 };

const read = (k, d) => { try { const v = wx.getStorageSync(k); return v === '' || v == null ? d : v; } catch (e) { return d; } };
const write = (k, v) => { try { if (v == null) wx.removeStorageSync(k); else wx.setStorageSync(k, v); } catch (e) {} };
const clone = v => JSON.parse(JSON.stringify(v));
const isMap = v => v && typeof v === 'object' && !Array.isArray(v);
const levelId = (p, i) => p + '-' + i;

/* ---------------- 合并规则（与 lib/academy-merge.js 一致） ---------------- */
function mergeProgress(a, b) {
  const out = {}, pa = isMap(a) ? a : {}, pb = isMap(b) ? b : {};
  Object.keys(Object.assign({}, pa, pb)).forEach(k => {
    const x = isMap(pa[k]) && pa[k].passedAt ? pa[k] : null, y = isMap(pb[k]) && pb[k].passedAt ? pb[k] : null;
    if (x && y) out[k] = clone(Number(y.passedAt) < Number(x.passedAt) ? y : x);
    else if (x || y) out[k] = clone(x || y);
  });
  return out;
}
const sessionKey = s => (s && s.id != null ? 'id:' + s.id : 'lv:' + (s && s.levelId) + '|' + (s && s.end));
function mergeSessions(a, b) {
  const seen = {};
  [].concat(a || [], b || []).forEach(s => { if (s && typeof s === 'object') { const k = sessionKey(s); if (!seen[k]) seen[k] = clone(s); } });
  return Object.keys(seen).map(k => seen[k]).sort((x, y) => (Number(x.end) || 0) - (Number(y.end) || 0));
}
function creditsOf(progress) {
  const out = {};
  Object.keys(isMap(progress) ? progress : {}).forEach(id => {
    const e = progress[id]; if (!isMap(e) || !e.passedAt) return;
    const p = id.split('-')[0]; out[p] = (out[p] || 0) + (isFinite(Number(e.credits)) ? Number(e.credits) : 1);
  });
  return out;
}
function mergeStates(a, b, prefer) {
  if (!a) return b ? clone(b) : b;
  if (!b) return clone(a);
  const side = prefer || ((Number(b._ts) || 0) > (Number(a._ts) || 0) ? 'b' : 'a');
  const n = side === 'a' ? a : b, o = n === a ? b : a;
  const out = clone(n);
  out.progress = mergeProgress(n.progress, o.progress);
  out.sessions = mergeSessions(n.sessions, o.sessions);
  out.credits = creditsOf(out.progress);
  out._ts = Math.max(Number(a._ts) || 0, Number(b._ts) || 0);
  ['_rev', '_wid', '_wids'].forEach(k => { delete out[k]; });
  return out;
}

/* ---------------- 本地文档 ---------------- */
function fresh() { return { _ts: 0, role: 'teacher', progress: {}, sessions: [], credits: {} }; }
// 演示进度：每条路径前几关算通过，标 demo，登录时不带进账号。
function demoSeed() {
  const S = fresh(); S.role = 'nurse';
  const at = Date.now() - 7 * 86400000;
  Object.keys(DEMO_PROG).forEach(p => { for (let i = 0; i < DEMO_PROG[p]; i++) S.progress[levelId(p, i)] = { passedAt: at + i * 3600000, credits: 1, quiz: null, demo: true }; });
  S.credits = creditsOf(S.progress);
  return S;
}
let S = read(KEY, null);
if (!S || !isMap(S.progress)) { S = auth.signedIn() ? fresh() : demoSeed(); write(KEY, S); }
let base = read(BASE_KEY, null);
let dirty = read(DIRTY_KEY, 0) === 1;
const listeners = [];

function get() { return S; }
function onChange(fn) { listeners.push(fn); }
function emit() { listeners.forEach(fn => { try { fn(S); } catch (e) {} }); }
function persist(next) { S = next; write(KEY, S); emit(); }
function markDirty(v) { dirty = !!v; write(DIRTY_KEY, dirty ? 1 : null); }
function writeBase(rev, ts, wid) { base = rev == null ? null : Object.assign({ rev, ts: ts || 0 }, wid ? { wid } : {}); write(BASE_KEY, base); }

function update(mut) {
  const next = clone(S); mut(next);
  next._ts = Math.max(Date.now(), (base ? base.ts : 0) + 1, (Number(S._ts) || 0) + 1);
  persist(next); markDirty(true);
  if (auth.signedIn()) schedulePush();
}
function cursor(path) { const n = D.PATHS[path].length; let i = 0; while (i < n && S.progress[levelId(path, i)] && S.progress[levelId(path, i)].passedAt) i++; return i; }
function passedAt(id) { const e = S.progress[id]; return e && e.passedAt ? Number(e.passedAt) : null; }
// 通关：进度只增；session 只追加；过关数由进度推（字段名 credits 是历史遗留），积分由服务端按它对账。已通过的关不重复记。
function recordPass(path, i, quiz) {
  const id = levelId(path, i);
  if (passedAt(id)) return false;
  const now = Date.now();
  update(s => {
    s.progress[id] = { passedAt: now, credits: 1, quiz: quiz || null, src: 'mp' };
    s.sessions.push({ id: now.toString(36) + '-' + Math.random().toString(36).slice(2, 8), d: new Date(now).toISOString().slice(0, 10), levelId: id, start: now, end: now, quiz: quiz || null, src: 'mp' });
    s.credits = creditsOf(s.progress);
  });
  return true;
}
function setRole(role) { update(s => { s.role = role; }); }

/* ---------------- 推 / 拉 ---------------- */
let pushTm = null, pushing = null, pulling = null, lastCheck = 0;
function schedulePush() { clearTimeout(pushTm); pushTm = setTimeout(push, 1500); }
function takeServer(state, rev) {
  const next = Object.assign(fresh(), state || {});
  persist(next); writeBase(rev, next._ts, state && state._wid); markDirty(false);
}
function mergeInto(local, remote, rev, wid) {
  const ts = base ? base.ts : 0;
  const merged = mergeStates(local, remote);
  merged._ts = Math.max(Date.now(), Number(merged._ts) || 0);
  persist(merged); writeBase(rev, ts, wid || (remote && remote._wid)); markDirty(true);
}
async function doPush(attempt) {
  const cur = S, body = { state: cur, stamped: true };
  if (base) { body.baseRev = base.rev; if (base.wid) body.baseWid = base.wid; }
  try {
    const r = await api.request('/api/data', { method: 'PUT', body });
    writeBase(r.rev, cur._ts, r.wid); markDirty(false);
  } catch (e) {
    if (e.status === 409 && e.data && (attempt || 0) < 2) { mergeInto(S, e.data.state, e.data.rev || 0); return doPush((attempt || 0) + 1); }
    markDirty(true);
    throw e;
  }
}
function push() {
  if (!auth.signedIn()) return Promise.resolve();
  clearTimeout(pushTm); pushTm = null;
  if (pushing) return pushing;
  pushing = doPush(0).catch(() => {}).then(() => { pushing = null; });
  return pushing;
}
function pull() {
  if (!auth.signedIn()) return Promise.resolve();
  if (pulling) return pulling;
  pulling = (async () => {
    try {
      if (pushTm) { clearTimeout(pushTm); pushTm = null; await push(); }
      const r = await api.request('/api/data');
      lastCheck = Date.now();
      const state = r.state, rev = r.rev, cur = S;
      const changed = dirty || (!!base && (Number(cur._ts) || 0) > base.ts);
      if (!state) { writeBase(rev, 0); if (changed || Object.keys(cur.progress).length) { markDirty(true); await push(); } else markDirty(false); return; }
      if (!base) { if (changed && Object.keys(cur.progress).length) { mergeInto(cur, state, rev); await push(); } else takeServer(state, rev); return; }
      const moved = rev !== base.rev || (base.wid && state._wid && state._wid !== base.wid);
      if (!moved) { if (changed) await push(); return; }
      if (changed) { mergeInto(cur, state, rev); await push(); } else takeServer(state, rev);
    } catch (e) { /* 离线或被拒：本地照旧，下次再试 */ }
    finally { pulling = null; }
  })();
  return pulling;
}
// 进前台：3 秒内不重复；修订没动就不取整份。
async function check(force) {
  if (!auth.signedIn()) return;
  if (!force && Date.now() - lastCheck < 3000) return;
  lastCheck = Date.now();
  if (!base || dirty) return pull();
  try {
    const r = await api.request('/api/data/rev');
    if (r.rev !== base.rev || (base.wid && r.wid && r.wid !== base.wid)) return pull();
  } catch (e) {}
}

/* ---------------- 登录 / 退出时本地文档的去向 ---------------- */
// 登录后：演示进度丢掉；本机真通过的关（src:'mp'）比账号多出来的，问一句要不要记进账号。resolve 后文档已是账号的。
async function onLogin(ask) {
  const local = clone(S);
  Object.keys(local.progress).forEach(k => { if (local.progress[k].demo) delete local.progress[k]; });
  local.sessions = local.sessions.filter(s => !s.demo);
  local.credits = creditsOf(local.progress);
  let r;
  try { r = await api.request('/api/data'); } catch (e) { persist(local); markDirty(true); return; }
  const state = r.state, rev = r.rev;
  const u = auth.current();
  const role = u && u.academy && u.academy.role;
  if (!state) {
    local._ts = Date.now(); if (role) local.role = role;
    persist(local); writeBase(rev, 0); markDirty(true); await push(); return;
  }
  const extra = Object.keys(local.progress).filter(k => !(state.progress && state.progress[k] && state.progress[k].passedAt)).length;
  const keep = extra > 0 && typeof ask === 'function' ? !!(await ask(extra)) : false;
  if (keep) {
    const merged = mergeStates(state, local, 'a');
    merged._ts = Date.now(); if (role) merged.role = role;
    persist(merged); writeBase(rev, 0, state._wid); markDirty(true); await push();
  } else {
    takeServer(state, rev);
    if (role && S.role !== role) setRole(role);
  }
}
function onLogout() { persist(demoSeed()); writeBase(null); markDirty(false); try { require('./events.js').clear(); } catch (e) {} }
function resetDemo() { if (auth.signedIn()) return false; persist(demoSeed()); return true; }

module.exports = { get, onChange, update, cursor, passedAt, recordPass, setRole, creditsOf, mergeStates, push, pull, check, onLogin, onLogout, resetDemo, levelId };
