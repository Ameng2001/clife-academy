/* 点评时效看板（docs/ROADMAP.md 第八节每周「点评时效看板」、第九节点评队伍）。
 * 园长看本园，管理员（本地运营方）看全平台与各园一行。看的是队列与时效，不是人：不列点评人各自点了多少、不排名。
 *   待点评：实践关 status 'pending' 的提交；超期：交了两个工作日还没人点评（跳过周末，同答疑的口径）
 *   近 30 天：完成的点评数、从提交到点评的中位时长（小时）
 *   点评队伍：本园有点评权的人数（园长、点评人、带教教师）、近 30 天动过手的人数
 *   答疑：开放中的提问、已转讲师的、近 30 天首答中位时长 */
import { orgKeyOf, ORG_ROLES } from './org.js';
import { canReview } from './submissions.js';
import { workdaysLater } from './questions.js';
import { LEVELS } from './events-data.js';

const DAY = 86400000;
export const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const hours = ms => Math.round(ms / 3600000 * 10) / 10;

/** 纯函数：一组园所键的时效。 */
export function statsOf(orgKeys, { db, isAdmin, pairs = null, now = Date.now() }) {
  const inOrg = o => orgKeys === null || orgKeys.has(o);
  const since = now - 30 * DAY;
  const subs = (db.submissions || []).filter(s => s.type === 'practice' && inOrg(s.org));
  const pending = subs.filter(s => s.status === 'pending').map(s => ({ id: s.id, at: s.at, levelTitle: LEVELS[s.levelId] || s.levelId, orgName: (db.users.find(u => u.id === s.uid)?.academy?.org?.name) || null, overdue: now >= workdaysLater(s.at) }));
  const done = subs.filter(s => s.review && s.review.at >= since);
  const turnaround = done.map(s => s.review.at - s.at);
  const members = db.users.filter(u => !u.disabled && inOrg(orgKeyOf(u)) && !isAdmin(u));
  const reviewers = members.filter(u => canReview(u, isAdmin) || (pairs && pairs.menteesOf(u.id).length));
  const active = new Set(done.map(s => s.review.by)).size;
  const qs = (db.questions || []).filter(q => inOrg(q.org));
  const qOpen = qs.filter(q => q.status === 'open'), qEsc = qOpen.filter(q => q.escalatedAt);
  const firstAnswer = qs.filter(q => q.answers.length && q.answers[0].at >= since).map(q => q.answers[0].at - q.at);
  return { pending: pending.length, overdue: pending.filter(p => p.overdue).length, oldestAt: pending.length ? Math.min(...pending.map(p => p.at)) : null,
    done30: done.length, medianHours: turnaround.length ? hours(median(turnaround)) : null, within2d: done.length ? Math.round(done.filter(s => s.review.at < workdaysLater(s.at)).length / done.length * 100) : null,
    reviewers: reviewers.length, active30: active, members: members.length,
    questions: { open: qOpen.length, escalated: qEsc.length, answered30: firstAnswer.length, medianHours: firstAnswer.length ? hours(median(firstAnswer)) : null },
    queue: pending.sort((a, b) => a.at - b.at).slice(0, 20) };
}

export function reviewStatRoutes({ json, db, readSession, isAdmin, pairs = null }) {
  return {
  // 园长：本园；管理员：全平台 ＋ 各园一行（按超期多的在前，是工作队列不是名次）
  'GET /api/review/stats': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const director = user.academy?.role === 'director';
    if (!director && !isAdmin(user)) return json(res, 403, { error: 'directors and admins only', code: 'director' });
    const opts = { db, isAdmin, pairs };
    if (!isAdmin(user)) { const k = orgKeyOf(user); return json(res, 200, { scope: 'org', orgName: user.academy?.org?.name || null, at: Date.now(), ...statsOf(k ? new Set([k]) : new Set(), opts) }); }
    const keys = new Map();
    for (const u of db.users) { const k = orgKeyOf(u); if (k && !u.disabled && !keys.has(k)) keys.set(k, u.academy?.org?.name || k); }
    const orgs = [...keys].map(([k, name]) => ({ key: k, name, ...statsOf(new Set([k]), opts), queue: undefined })).filter(o => o.members || o.pending).sort((a, b) => b.overdue - a.overdue || b.pending - a.pending || a.name.localeCompare(b.name, 'zh'));
    json(res, 200, { scope: 'all', at: Date.now(), ...statsOf(null, opts), orgs });
  }
  };
}
