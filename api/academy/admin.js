/* 运营后台汇总（docs/ROADMAP.md 第九节「运营后台」，第十二节第 5 条已定：嵌管理端）。
 * 一页把管理员要管的事按六组摆开：用户与园所、研修期次、资源与案例、发题与点评、公告、审计。每组只给数字与入口，
 * 事情本身在各自页面做（/org、/programs、/cases、/drills、/ops …）。只有「公告」是这里新加的：平台级一句话通知，
 * 首页顶上一条，可带截止日；不推送、不统计谁看过。
 *
 * db.notices: { id, title, text, until|null, by, byName, at, updatedAt } */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { statsOf } from './reviewstats.js';
import { configured as assistantConfigured } from './assistant.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const DAY = 86400000;

/** 纯函数：整库 → 六组数字。导出便于测试。 */
export function overviewOf({ db, isAdmin, pairs = null, auditRows = [], now = Date.now() }) {
  const users = db.users || [];
  const live = users.filter(u => !u.disabled);
  const role = r => live.filter(u => u.academy?.role === r).length;
  const orgs = new Set(live.map(orgKeyOf).filter(Boolean));
  const programs = db.programs || [];
  const openProgram = p => !p.closedAt && now <= (p.to || p.from || 0);
  const review = statsOf(null, { db, isAdmin, pairs, now });
  const openQ = (db.questions || []).filter(q => q.status === 'open');
  const activeNotice = n => !n.until || n.until > now;
  const since = now - DAY;
  return {
    people: {
      users: live.length, disabled: users.length - live.length, admins: live.filter(isAdmin).length,
      directors: role('director'), reviewers: live.filter(u => u.academy?.reviewer === true).length, curators: live.filter(u => u.academy?.curator === true).length,
      district: role('district'), orgs: orgs.size, communities: (db.communities || []).length,
      pairs: (db.pairs || []).filter(p => !p.endedAt).length, invitesUnused: (db.invites || []).filter(i => !i.usedBy && !i.revoked).length
    },
    programs: {
      open: programs.filter(openProgram).length, applied: programs.filter(openProgram).reduce((n, p) => n + (p.applicants || []).filter(a => a.status === 'applied').length, 0),
      cohortsOpen: (db.cohorts || []).filter(c => !c.closedAt).length, campsOpen: (db.camps || []).filter(c => !c.closedAt).length,
      lecturesUpcoming: (db.lectures || []).filter(l => l.at > now).length, showcasesOpen: (db.showcases || []).filter(s => !s.closedAt).length,
      sharedaysOpen: (db.sharedays || []).filter(s => !s.closedAt).length
    },
    content: {
      resources: (db.resources || []).length, casesPending: (db.cases || []).filter(c => c.status === 'pending').length,
      casesApproved: (db.cases || []).filter(c => c.status === 'approved').length, caseUses: (db.caseUses || []).length, studios: (db.studios || []).length
    },
    review: {
      drillsOpen: (db.drills || []).filter(d => d.scope === 'all' && (!d.closeAt || d.closeAt > now)).length,
      contestsOpen: (db.contests || []).filter(c => !c.closedAt && now < c.dueAt).length, contestsReview: (db.contests || []).filter(c => !c.closedAt && now >= c.dueAt).length,
      pending: review.pending, overdue: review.overdue, questionsOpen: openQ.length, questionsEscalated: openQ.filter(q => q.escalatedAt).length,
      coach: assistantConfigured()
    },
    notices: { active: (db.notices || []).filter(activeNotice).length, total: (db.notices || []).length },
    audit: { day: auditRows.filter(r => r.ts >= since).length, dayFail: auditRows.filter(r => r.ts >= since && !r.ok).length, total: auditRows.length }
  };
}

export function adminRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, pairs = null, auditRows = () => [] }) {
  db.notices = db.notices || [];
  const now = () => Date.now();
  const pub = n => ({ id: n.id, title: n.title, text: n.text, until: n.until || null, byName: n.byName, at: n.updatedAt || n.at });
  const requireAdmin = (req, res) => {
    const user = readSession(req);
    if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
    if (!isAdmin(user)) { audit(req, 'admin.denied', { ok: false, user }); json(res, 403, { error: 'forbidden' }); return null; }
    return user;
  };

  return {
  // 六组数字（管理员）。
  'GET /api/admin/overview': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    json(res, 200, { overview: overviewOf({ db, isAdmin, pairs, auditRows: auditRows(), now: now() }), notices: db.notices.slice().sort((a, b) => b.at - a.at).map(pub), now: now() });
  },
  // 在用的公告（登录了就能看）：没到期的，新的在前，最多 5 条。
  'GET /api/notices': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const t = now();
    json(res, 200, { notices: db.notices.filter(n => !n.until || n.until > t).sort((a, b) => b.at - a.at).slice(0, 5).map(pub) });
  },
  // 发、改、撤一条：{ id?, title, text, until?, remove? }
  'POST /api/admin/notices': async (req, res) => {
    const user = requireAdmin(req, res); if (!user) return;
    const body = await readBody(req);
    const id = str(body.id, 40);
    if (body.remove) {
      const i = db.notices.findIndex(n => n.id === id);
      if (i < 0) return json(res, 404, { error: 'no such notice' });
      db.notices.splice(i, 1); saveDb(); audit(req, 'academy.notice.remove', { user, id });
      return json(res, 200, { ok: true });
    }
    const title = str(body.title, 40), text = str(body.text, 500);
    if (title.length < 2) return json(res, 400, { error: 'title ≥ 2 chars', code: 'title' });
    if (text.length < 4) return json(res, 400, { error: 'text ≥ 4 chars', code: 'text' });
    const until = Number.isFinite(+body.until) && +body.until > 0 ? +body.until : null;
    let n = id ? db.notices.find(x => x.id === id) : null;
    if (id && !n) return json(res, 404, { error: 'no such notice' });
    if (!n) { n = { id: crypto.randomBytes(9).toString('base64url'), by: user.id, byName: user.name, at: now() }; db.notices.push(n); }
    Object.assign(n, { title, text, until, updatedAt: now() });
    saveDb(); audit(req, 'academy.notice.save', { user, id: n.id });
    json(res, 200, { notice: pub(n) });
  }
  };
}
