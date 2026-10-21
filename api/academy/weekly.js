/* 运营周报（docs/ROADMAP.md 第七节运营节奏「每周」、第九节运营）：每周一上午把上一周的数给园长（本园）与管理员（全平台＋各园一行）。
 * 看的是园所层面的事：过了多少关、交了多少作品、点评了多少、还有多少超期、每周一题几人答、答疑开放几条、新入库几条案例。
 * 不列个人、不排名、不按在线时长；只是一周的账，给运营方决定下周做什么。
 * 推送：订阅消息 kind 'weekly'（notify.js，WX_TMPL_WEEKLY）；没模板就只在 /ops 看。一周只发一次，db.weeklySent 记周键。 */
import { orgKeyOf } from './org.js';
import { workdaysLater } from './questions.js';
import { LEVELS } from './events-data.js';

const DAY = 86400000, WEEK = 7 * DAY;
/** 上一周（周一 00:00 到周日 24:00）；now 落在哪周就取它前面那一周。 */
export const lastWeekOf = (now = Date.now()) => {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;                 // 周一 0
  const thisMonday = d.getTime() - dow * DAY;
  const from = thisMonday - WEEK, to = thisMonday - 1;
  const f = new Date(from);
  return { key: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`, from, to, label: `${f.getMonth() + 1}月${f.getDate()}日—${new Date(to).getMonth() + 1}月${new Date(to).getDate()}日` };
};

/** 纯函数：一组园所键在一周里的账。 */
export function weeklyOf(orgKeys, { db, stateOf, isAdmin, now = Date.now(), week = lastWeekOf(now) }) {
  const inOrg = o => orgKeys === null || orgKeys.has(o);
  const inWeek = t => t >= week.from && t <= week.to;
  const members = db.users.filter(u => !u.disabled && inOrg(orgKeyOf(u)) && !isAdmin(u) && orgKeyOf(u));
  let passes = 0; const active = new Set();
  for (const u of members) { const prog = (stateOf(u.id) || {}).progress || {}; for (const [id, p] of Object.entries(prog)) if (LEVELS[id] && p?.passedAt && inWeek(p.passedAt)) { passes++; active.add(u.id); } }
  const subs = (db.submissions || []).filter(s => s.type === 'practice' && inOrg(s.org));
  const submitted = subs.filter(s => inWeek(s.at)).length;
  const reviewed = subs.filter(s => s.review && inWeek(s.review.at)).length;
  const pending = subs.filter(s => s.status === 'pending'), overdue = pending.filter(s => now >= workdaysLater(s.at)).length;
  const drillAnswers = (db.drillAnswers || []).filter(a => inWeek(a.at) && inOrg(members.find(u => u.id === a.uid) ? orgKeyOf(members.find(u => u.id === a.uid)) : null)).length;
  const qs = (db.questions || []).filter(q => inOrg(q.org));
  const questionsNew = qs.filter(q => inWeek(q.at)).length, questionsOpen = qs.filter(q => q.status === 'open').length;
  const casesApproved = (db.cases || []).filter(c => c.status === 'approved' && inOrg(c.org) && inWeek(c.approvedAt || c.at)).length;
  const d = { week, members: members.length, active: active.size, passes, submitted, reviewed, pending: pending.length, overdue, drillAnswers, questionsNew, questionsOpen, casesApproved };
  d.text = textOf(d);
  return d;
}

export const textOf = d => {
  const parts = [`${d.week.label}：${d.members} 人在学，${d.active} 人过了关，共 ${d.passes} 关`, `交作品 ${d.submitted} 份，点评 ${d.reviewed} 次`];
  if (d.pending) parts.push(`待点评 ${d.pending} 份${d.overdue ? `，其中 ${d.overdue} 份超两个工作日` : ''}`);
  if (d.drillAnswers) parts.push(`每周一题 ${d.drillAnswers} 人答`);
  if (d.questionsNew || d.questionsOpen) parts.push(`答疑新提 ${d.questionsNew} 条，开放中 ${d.questionsOpen} 条`);
  if (d.casesApproved) parts.push(`新入库案例 ${d.casesApproved} 条`);
  return parts.join('；') + '。';
};

export function weeklyRoutes({ json, db, saveDb, readSession, isAdmin, readStateCached, notifier = null }) {
  db.weeklySent = db.weeklySent || {};
  const stateOf = uid => readStateCached(uid);
  const orgRows = (opts) => {
    const keys = new Map();
    for (const u of db.users) { const k = orgKeyOf(u); if (k && !u.disabled && !keys.has(k)) keys.set(k, u.academy?.org?.name || k); }
    return [...keys].map(([k, name]) => ({ key: k, name, ...weeklyOf(new Set([k]), opts) })).filter(o => o.members).sort((a, b) => b.overdue - a.overdue || a.name.localeCompare(b.name, 'zh'));
  };
  const reportFor = (user, now = Date.now()) => {
    const opts = { db, stateOf, isAdmin, now };
    if (isAdmin(user)) return { scope: 'all', at: now, ...weeklyOf(null, opts), orgs: orgRows(opts).map(o => ({ key: o.key, name: o.name, text: o.text, overdue: o.overdue })) };
    const k = orgKeyOf(user);
    return { scope: 'org', orgName: user.academy?.org?.name || null, at: now, ...weeklyOf(k ? new Set([k]) : new Set(), opts) };
  };

  /** 每周一 09:00 后、当周没发过：给园长发本园一条，给管理员发全平台一条。返回发了几条。 */
  async function pushWeekly(now = Date.now()) {
    if (!notifier) return 0;
    const d = new Date(now);
    if (d.getDay() !== 1 || d.getHours() < 9) return 0;
    const week = lastWeekOf(now);
    if (db.weeklySent[week.key]) return 0;
    db.weeklySent[week.key] = now; saveDb();
    let n = 0;
    for (const u of db.users) {
      if (u.disabled) continue;
      if (!(isAdmin(u) || u.academy?.role === 'director')) continue;
      const r = reportFor(u, now);
      const out = await notifier.send(u.id, 'weekly', { title: `运营周报 · ${r.scope === 'all' ? '全平台' : r.orgName || '本园'}`, text: r.text.slice(0, 20), at: now }, 'pages/home/home');
      if (out.sent) n++;
    }
    return n;
  }

  return {
    routes: {
    // 园长：本园上一周；管理员：全平台 ＋ 各园一行
    'GET /api/ops/weekly': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      if (user.academy?.role !== 'director' && !isAdmin(user)) return json(res, 403, { error: 'directors and admins only', code: 'director' });
      json(res, 200, reportFor(user));
    }
    },
    pushWeekly
  };
}
