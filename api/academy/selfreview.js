/* 自评问卷与三方评（docs/ROADMAP.md 第五节「三方评」）：每学期一次。
 * 本人自评：七个领域各选一档（还没开始 / 在学 / 能独立做 / 能带别人），加一件下学期想练的事和一段反思。
 * 带教教师或教研主任评：看实践关作品写一段；园长评：看参与与反思写一段。
 * 平台只做收集与并置，不合成总分、不排名、不和考核挂钩；档次是本人对自己的判断，别人看得到但不能改。
 *
 * db.selfReviews: { id, uid, org, term, levels:{domainKey:0..3}, focus, reflection, at, updatedAt }
 * db.peerReviews: { id, uid(被评), by, byName, role:'mentor'|'director', term, text, at, updatedAt }
 * 谁看：本人看自己的与别人给自己的；带教教师看所带教师的；园长看本园的。管理员不看个人（看板只给「已自评人数」）。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { DOMAINS } from './events-data.js';

export const SCALE = Object.freeze(['还没开始', '在学', '能独立做', '能带别人']);
const STATEMENTS = {
  env: '按幼儿的使用调整区角与材料，墙面是幼儿的过程',
  life: '把过渡、进餐、午睡组织成幼儿自己会做的事',
  play: '看懂一段自主游戏，知道什么时候介入、怎么介入',
  plan: '设计一个集体活动或一个主题，目标可观察，做了会调',
  obs: '观察记录里事实与推断分开，能和家长说一条事实',
  comm: '日常反馈、家长会、个别约谈、冲突处理都接得住',
  reflect: '写得出教学反思，参加课例研讨，能带一位新教师'
};
export const ITEMS = Object.freeze(DOMAINS.map(d => ({ key: d.key, name: d.name, text: STATEMENTS[d.key] || d.name })));
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** 学期：9 月 1 日—1 月 31 日是秋季，2 月 1 日—8 月 31 日是春季。 */
export const termOf = ts => {
  const d = new Date(ts), y = d.getFullYear(), m = d.getMonth();
  if (m >= 8) return { key: `${y}-autumn`, label: `${y} 秋季学期`, from: new Date(y, 8, 1).getTime(), to: new Date(y + 1, 0, 31, 23, 59, 59).getTime() };
  if (m === 0) return { key: `${y - 1}-autumn`, label: `${y - 1} 秋季学期`, from: new Date(y - 1, 8, 1).getTime(), to: new Date(y, 0, 31, 23, 59, 59).getTime() };
  return { key: `${y}-spring`, label: `${y} 春季学期`, from: new Date(y, 1, 1).getTime(), to: new Date(y, 7, 31, 23, 59, 59).getTime() };
};

export function selfReviewRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, pairs = null }) {
  db.selfReviews = db.selfReviews || []; db.peerReviews = db.peerReviews || [];
  const now = () => Date.now();
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const mineOf = (uid, term) => db.selfReviews.find(r => r.uid === uid && r.term === term) || null;
  const pubSelf = r => (r ? { levels: r.levels, focus: r.focus, reflection: r.reflection, at: r.at, updatedAt: r.updatedAt } : null);
  const commentsOf = (uid, term) => db.peerReviews.filter(p => p.uid === uid && p.term === term).map(p => ({ role: p.role, byName: p.byName, by: p.by, text: p.text, at: p.updatedAt || p.at }));
  const director = u => u.academy?.role === 'director';
  // 我和这个人的关系：带教教师 / 园长 / 无
  const relation = (me, target) => {
    if (pairs && pairs.isMentorOf(me.id, target.id)) return 'mentor';
    if (director(me) && orgKeyOf(me) && orgKeyOf(me) === orgKeyOf(target)) return 'director';
    return null;
  };
  const pubPerson = (me, t, term) => {
    const r = mineOf(t.id, term), cs = commentsOf(t.id, term);
    return { uid: t.id, name: t.name, role: t.academy?.role || null, done: !!r, self: pubSelf(r), comments: cs.map(({ by, ...c }) => c), myComment: cs.find(c => c.by === me.id)?.text || '' };
  };

  return {
  // 本学期的问卷、我的自评、别人给我的两段话
  'GET /api/me/selfreview': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const term = termOf(now());
    const prev = db.selfReviews.filter(r => r.uid === user.id && r.term !== term.key).sort((a, b) => b.at - a.at).slice(0, 4).map(r => ({ term: r.term, ...pubSelf(r), comments: commentsOf(user.id, r.term).map(({ by, ...c }) => c) }));
    json(res, 200, { term, items: ITEMS, scale: SCALE, mine: pubSelf(mineOf(user.id, term.key)), comments: commentsOf(user.id, term.key).map(({ by, ...c }) => c), previous: prev });
  },
  // 交或改本学期自评：{ levels:{key:0..3}, focus, reflection }
  'POST /api/me/selfreview': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const levels = {};
    for (const it of ITEMS) { const n = Math.round(Number(body.levels?.[it.key])); if (!(n >= 0 && n <= SCALE.length - 1)) return json(res, 400, { error: `pick a level for ${it.name}`, code: 'levels' }); levels[it.key] = n; }
    const focus = str(body.focus, 200), reflection = str(body.reflection, 2000);
    if (focus.length < 2) return json(res, 400, { error: 'write one thing to practise next term', code: 'focus' });
    const term = termOf(now());
    let r = mineOf(user.id, term.key);
    if (r) Object.assign(r, { levels, focus, reflection, updatedAt: now() });
    else { r = { id: newId(), uid: user.id, org: orgKeyOf(user), term: term.key, levels, focus, reflection, at: now(), updatedAt: now() }; db.selfReviews.push(r); }
    saveDb();
    audit(req, 'selfreview.save', { user, msg: term.key });
    json(res, 200, { mine: pubSelf(r), term });
  },
  // 带教教师看所带教师、园长看本园：每人的自评与已有的两段话，并置
  'GET /api/selfreview/others': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const term = termOf(now());
    const org = orgKeyOf(user);
    let people = [];
    if (director(user) && org) people = db.users.filter(u => !u.disabled && u.id !== user.id && orgKeyOf(u) === org && !isAdmin(u));
    else if (pairs) people = pairs.menteesOf(user.id).map(id => db.users.find(u => u.id === id)).filter(Boolean);
    if (!people.length && !director(user)) return json(res, 403, { error: 'mentors and directors only', code: 'role' });
    json(res, 200, { term, items: ITEMS, scale: SCALE, as: director(user) ? 'director' : 'mentor', people: people.map(t => pubPerson(user, t, term.key)), done: people.filter(t => mineOf(t.id, term.key)).length });
  },
  // 给一个人写一段：{ uid, text }。带教教师看作品写，园长看参与与反思写；一人一段，再写就是改
  'POST /api/selfreview/comment': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const t = db.users.find(u => u.id === str(body.uid, 40) && !u.disabled);
    if (!t) return json(res, 404, { error: 'no such person' });
    const role = relation(user, t);
    if (!role) return json(res, 403, { error: 'only their mentor or director writes here', code: 'role' });
    const text = str(body.text, 2000);
    if (text.length < 20) return json(res, 400, { error: 'at least 20 characters', code: 'text' });
    const term = termOf(now());
    let p = db.peerReviews.find(x => x.uid === t.id && x.by === user.id && x.term === term.key);
    if (p) Object.assign(p, { text, role, updatedAt: now() });
    else { p = { id: newId(), uid: t.id, by: user.id, byName: user.name, role, term: term.key, text, at: now(), updatedAt: now() }; db.peerReviews.push(p); }
    saveDb();
    audit(req, 'selfreview.comment', { user, msg: `${t.id} ${role}` });
    json(res, 200, { person: pubPerson(user, t, term.key) });
  }
  };
}
