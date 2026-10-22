/* 园所额度池（docs/POINTS-DESIGN.md 第五节）：没学够的教师也要用工坊。
 *
 * 本地运营方按合同给园所充额度（合同里的事，不是教师的积分）；园长在园长看板把额度分给本园教师，可收回没用掉的；
 * 教师在工具里花的时候先扣园所分配给他的，再扣自己赚的积分（points.js 的 POST /api/points/spend 调 quota.spend）。
 * 园所额度不进商城，只能用在接入的工具上；不转赠、不排行、不进个人积分余额。
 *
 * 一张流水：db.orgQuotaLog: { id, org(园所键 orgKeyOf), orgName, kind:'topup'|'alloc'|'recall'|'spend', n(正数), uid?, name?, tool?, ref?, note, by, byName, at }
 *   池子余额 = topup − alloc + recall（园所层）；某人剩余 = alloc − recall − spend（人层）。 */
import { orgKeyOf } from './org.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const intIn = (v, lo, hi) => { const n = Math.floor(Number(v)); return n >= lo && n <= hi ? n : null; };
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function createQuota(db, saveDb) {
  db.orgQuotaLog = Array.isArray(db.orgQuotaLog) ? db.orgQuotaLog : [];
  const log = () => db.orgQuotaLog;
  const ofOrg = org => log().filter(r => r.org === org);
  const sum = (rows, kind) => rows.filter(r => r.kind === kind).reduce((s, r) => s + r.n, 0);
  const pool = org => { const rs = ofOrg(org); return sum(rs, 'topup') - sum(rs, 'alloc') + sum(rs, 'recall'); };
  const topup = org => sum(ofOrg(org), 'topup');
  const ofUser = uid => log().filter(r => r.uid === uid);
  const left = uid => { const rs = ofUser(uid); return sum(rs, 'alloc') - sum(rs, 'recall') - sum(rs, 'spend'); };
  const used = uid => sum(ofUser(uid), 'spend');
  const push = row => { const r = { id: newId(), at: Date.now(), ...row }; db.orgQuotaLog.push(r); saveDb(); return r; };
  /** 工具扣减时先扣园所额度：答实际扣掉的数（0 到 n）。幂等由 points.js 按 (tool, ref) 在两本账上一起查。 */
  const spend = (u, n, tool, ref, note) => {
    const org = orgKeyOf(u); if (!org) return 0;
    const take = Math.min(left(u.id), n); if (take < 1) return 0;
    push({ org, orgName: u.academy?.org?.name || null, kind: 'spend', n: take, uid: u.id, name: u.name, tool, ref, note, by: u.id, byName: u.name });
    return take;
  };
  const spent = (uid, tool, ref) => ofUser(uid).some(r => r.kind === 'spend' && r.tool === tool && r.ref === ref);
  return { pool, topup, left, used, spend, spent, push, ofOrg, ofUser, log };
}

export function quotaRoutes({ json, readBody, db, readSession, audit, isAdmin, quota, tools }) {
  const TOOL_LABEL = tools || {};
  const pubRow = r => ({ id: r.id, kind: r.kind, n: r.n, uid: r.uid || null, name: r.name || null, tool: r.tool ? (TOOL_LABEL[r.tool] || r.tool) : null, note: r.note || '', byName: r.byName || null, at: r.at });
  const directorOnly = (req, res) => {
    const user = readSession(req); if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
    if (user.academy?.role !== 'director' && !isAdmin(user)) { json(res, 403, { error: 'directors only', code: 'director' }); return null; }
    return user;
  };
  const adminOnly = (req, res) => { const user = readSession(req); if (!user) { json(res, 401, { error: 'not signed in' }); return null; } if (!isAdmin(user)) { json(res, 403, { error: 'admins only', code: 'admin' }); return null; } return user; };
  const orgView = (org, orgName) => {
    const members = db.users.filter(u => !u.disabled && orgKeyOf(u) === org && u.academy?.role !== 'director')
      .map(u => ({ id: u.id, name: u.name, role: u.academy?.role || 'teacher', left: quota.left(u.id), used: quota.used(u.id) }))
      .sort((a, b) => (b.left - a.left) || a.name.localeCompare(b.name, 'zh'));
    return { org, orgName, pool: quota.pool(org), topup: quota.topup(org), allocated: members.reduce((s, m) => s + m.left, 0), members, log: quota.ofOrg(org).sort((a, b) => b.at - a.at).slice(0, 50).map(pubRow) };
  };
  // 全平台有人的园所（管理员充值时选）
  const allOrgs = () => { const m = new Map(); for (const u of db.users) { if (u.disabled) continue; const k = orgKeyOf(u); if (!k) continue; const o = m.get(k) || { org: k, name: u.academy.org.name || k, members: 0 }; o.members++; m.set(k, o); } return [...m.values()]; };

  return {
  // 园长：本园池子、每人剩余与用掉的、最近流水
  'GET /api/org/quota': async (req, res) => {
    const user = directorOnly(req, res); if (!user) return;
    const org = orgKeyOf(user);
    if (!org) return json(res, 200, { org: null, orgName: null, pool: 0, topup: 0, allocated: 0, members: [], log: [] });
    json(res, 200, orgView(org, user.academy.org.name || null));
  },
  // 园长分配：{ uid, n }，从池子里拿，只能给本园的人，一次最多 10000
  'POST /api/org/quota/alloc': async (req, res) => {
    const user = directorOnly(req, res); if (!user) return;
    const body = await readBody(req), org = orgKeyOf(user);
    const target = db.users.find(u => u.id === String(body.uid || '') && !u.disabled);
    if (!target) return json(res, 404, { error: 'no such member' });
    if (!org || orgKeyOf(target) !== org) return json(res, 403, { error: 'not in your kindergarten', code: 'org' });
    if (target.id === user.id) return json(res, 400, { error: 'allocate to teachers, not yourself', code: 'self' });
    const n = intIn(body.n, 1, 10000); if (n === null) return json(res, 400, { error: 'n must be an integer 1–10000', code: 'n' });
    if (quota.pool(org) < n) return json(res, 409, { error: 'pool too small', code: 'pool', pool: quota.pool(org) });
    quota.push({ org, orgName: user.academy.org.name || null, kind: 'alloc', n, uid: target.id, name: target.name, note: str(body.note, 80), by: user.id, byName: user.name });
    audit(req, 'quota.alloc', { user, msg: `${target.id} +${n}` });
    json(res, 200, orgView(org, user.academy.org.name || null));
  },
  // 园长收回没用掉的：{ uid, n? } 不带 n 就全收
  'POST /api/org/quota/recall': async (req, res) => {
    const user = directorOnly(req, res); if (!user) return;
    const body = await readBody(req), org = orgKeyOf(user);
    const target = db.users.find(u => u.id === String(body.uid || ''));
    if (!target) return json(res, 404, { error: 'no such member' });
    if (!org || orgKeyOf(target) !== org) return json(res, 403, { error: 'not in your kindergarten', code: 'org' });
    const cur = quota.left(target.id);
    const n = body.n === undefined || body.n === null || body.n === '' ? cur : intIn(body.n, 1, 10000);
    if (n === null || n < 1) return json(res, 400, { error: 'nothing to recall', code: 'n' });
    if (n > cur) return json(res, 409, { error: 'more than left', code: 'left', left: cur });
    quota.push({ org, orgName: user.academy.org.name || null, kind: 'recall', n, uid: target.id, name: target.name, note: str(body.note, 80), by: user.id, byName: user.name });
    audit(req, 'quota.recall', { user, msg: `${target.id} -${n}` });
    json(res, 200, orgView(org, user.academy.org.name || null));
  },
  // 管理员：各园池子一览与可选园所
  'GET /api/admin/quota': async (req, res) => {
    if (!adminOnly(req, res)) return;
    const orgs = allOrgs().map(o => ({ ...o, pool: quota.pool(o.org), topup: quota.topup(o.org) })).sort((a, b) => (b.topup - a.topup) || a.name.localeCompare(b.name, 'zh'));
    json(res, 200, { orgs, log: quota.log().filter(r => r.kind === 'topup').sort((a, b) => b.at - a.at).slice(0, 50).map(r => ({ ...pubRow(r), orgName: r.orgName })) });
  },
  // 管理员充值：{ org(园所键), n(1–100000), note(合同号之类) }
  'POST /api/admin/quota/topup': async (req, res) => {
    const user = adminOnly(req, res); if (!user) return;
    const body = await readBody(req);
    const org = str(body.org, 120), o = allOrgs().find(x => x.org === org);
    if (!o) return json(res, 404, { error: 'no such kindergarten', code: 'org' });
    const n = intIn(body.n, 1, 100000); if (n === null) return json(res, 400, { error: 'n must be an integer 1–100000', code: 'n' });
    quota.push({ org, orgName: o.name, kind: 'topup', n, note: str(body.note, 120), by: user.id, byName: user.name });
    audit(req, 'quota.topup', { user, msg: `${org} +${n} ${str(body.note, 120)}` });
    json(res, 200, { org, name: o.name, pool: quota.pool(org), topup: quota.topup(org) });
  }
  };
}
