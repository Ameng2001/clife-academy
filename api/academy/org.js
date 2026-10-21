/* 园长看板：GET /api/org/summary。本园教师在大课堂里的学习情况，按岗位汇总。
 *
 * 边界（docs/ROADMAP.md 第八节）：只给园长（academy.role === 'director'）和管理员看；按岗位汇总，
 * 人员列表只有「通过了几关、最近一次学习是哪天」，没有测验分；不跨园，不排名。
 * 探针体检卡要接平台数据，不在这里。
 *
 * 园所归属：user.academy.org 的 id，没有 id 用 name（开发桩与微信登录的账号只有 name）。 */
import { PATH_LEN, ROLE_PATH, PATH_NAMES, LEVELS, PATH_KIND } from './events-data.js';

// 园内岗位：ROLE_PATH 里走 role 路径的；区县管理员（admin 路径）不属于园所，不进园长看板的分组
export const ORG_ROLES = Object.freeze(Object.keys(ROLE_PATH).filter(r => PATH_KIND[ROLE_PATH[r]] === 'role'));

const WEEK = 7 * 86400000;
export const orgKeyOf = u => { const o = u?.academy?.org; return o ? (o.id ? 'id:' + o.id : o.name ? 'name:' + o.name : null) : null; };
const roleOf = u => (ORG_ROLES.includes(u?.academy?.role) ? u.academy.role : 'teacher');

/** 纯函数：成员与各自的状态文档 → 汇总。导出便于测试。 */
export function summarize(members, stateOf, now = Date.now()) {
  const roles = {};
  for (const r of ORG_ROLES) roles[r] = { role: r, name: PATH_NAMES[ROLE_PATH[r]] || r, path: ROLE_PATH[r], total: PATH_LEN[ROLE_PATH[r]] || 0, members: 0, finished: 0, started: 0, doneSum: 0, passes7d: 0, stuck: {} };
  const people = [];
  let passes7d = 0;
  for (const u of members) {
    const r = roleOf(u), g = roles[r], path = g.path;
    const S = stateOf(u.id) || {};
    const prog = S.progress && typeof S.progress === 'object' ? S.progress : {};
    let done = 0; while (done < g.total && prog[`${path}-${done}`]?.passedAt) done++;
    const times = Object.values(prog).map(p => Number(p?.passedAt) || 0).filter(Boolean);
    const lastAt = times.length ? Math.max(...times) : null;
    const recent = times.filter(t => now - t < WEEK).length;
    g.members++; g.doneSum += done; passes7d += recent; g.passes7d += recent;
    if (done >= g.total && g.total) g.finished++; else if (done > 0) g.started++;
    if (done < g.total) { const id = `${path}-${done}`; g.stuck[id] = (g.stuck[id] || 0) + 1; }
    people.push({ id: u.id, name: u.name, role: r, roleName: g.name, done, total: g.total, lastAt, reviewer: u.academy?.reviewer === true });
  }
  const out = Object.values(roles).map(g => {
    const top = Object.entries(g.stuck).sort((a, b) => b[1] - a[1])[0];
    const { stuck, doneSum, ...rest } = g;
    return { ...rest, avgDone: g.members ? Math.round(doneSum / g.members * 10) / 10 : 0,
      rate: g.members && g.total ? Math.round(doneSum / (g.members * g.total) * 100) : 0,
      next: top ? { levelId: top[0], title: LEVELS[top[0]] || top[0], count: top[1] } : null };
  });
  people.sort((a, b) => a.role.localeCompare(b.role) || (b.lastAt || 0) - (a.lastAt || 0));
  return { roles: out, members: people, passes7d, members_total: people.length };
}

export function orgRoutes({ json, readBody, saveDb, audit, readSession, db, readStateCached, isAdmin }) {
  return {
  // 指定 / 取消本园的点评人（academy.reviewer）：园长或管理员；园长只能指定本园的人；园长本来就有点评权，不用也不能标自己。
  'PUT /api/org/reviewer': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (user.academy?.role !== 'director' && !isAdmin(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const body = await readBody(req);
    const target = db.users.find(u => u.id === String(body.uid || ''));
    if (!target || target.disabled) return json(res, 404, { error: 'no such member' });
    if (target.id === user.id) return json(res, 400, { error: 'directors already review', code: 'self' });
    if (!isAdmin(user) && (!orgKeyOf(user) || orgKeyOf(target) !== orgKeyOf(user))) return json(res, 403, { error: 'not in your kindergarten', code: 'org' });
    const on = body.reviewer === true;
    target.academy = { ...(target.academy || { role: 'teacher', org: null, source: null }), reviewer: on };
    if (!on) delete target.academy.reviewer;
    saveDb();
    audit(req, 'org.reviewer', { user, msg: `${target.id} ${on ? 'on' : 'off'}` });
    json(res, 200, { id: target.id, reviewer: on });
  },
  'GET /api/org/summary': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (user.academy?.role !== 'director' && !isAdmin(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const key = orgKeyOf(user);
    if (!key) return json(res, 200, { org: null, at: Date.now(), ...summarize([], () => null) });
    const members = db.users.filter(u => !u.disabled && orgKeyOf(u) === key);
    const sum = summarize(members, uid => readStateCached(uid));
    json(res, 200, { org: user.academy.org, at: Date.now(), ...sum });
  }
  };
}
