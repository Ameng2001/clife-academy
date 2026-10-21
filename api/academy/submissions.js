/* 实践关与研讨关的提交与点评（docs/ROADMAP.md 第二节）。
 *
 *   practice  教师在班里做一件事，交证据（文字＋照片），种子教师 / 教研主任 / 园长按量表点评，通过才算「做」完成
 *   seminar   情景题作答；交了就算「做」完成，点评是加分项；交了以后能看同园他人的作答
 *
 * db.submissions: { id, uid, name, org, levelId, type, text, files:[{hash,name,type}], status:'pending'|'pass'|'revise',
 *                   at, review:{ by, byName, at, scores:[], comment } | null }
 * 一关可以多次提交（需修改后再交），最新一条算数。
 * 点评权：园长、管理员、academy.reviewer === true；只看本园（orgKeyOf 同一园），不点评自己的。
 * 证据照片走上游 media 存储（PUT /api/media/{hash} 存在提交者名下），这里加一条可被本园点评人读的出口。
 * 素材规则：不出现幼儿姓名与正脸，前端提示，审核在点评里把关。 */
import crypto from 'node:crypto';
import { LEVEL_TYPES, LEVELS, RUBRICS } from './events-data.js';
import { orgKeyOf } from './org.js';
import { fmtTime } from './notify.js';

const TEXT_MAX = 4000, FILES_MAX = 6, PER_USER_MAX = 500;
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const HASH = /^[0-9a-f]{64}$/;

export const canReview = (u, isAdmin) => !!u && (u.academy?.role === 'director' || u.academy?.reviewer === true || isAdmin(u));

export function submissionRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, MEDIA, sendMediaFile, notifier = null }) {
  db.submissions = db.submissions || [];
  const newId = () => crypto.randomBytes(9).toString('base64url');
  const pub = (s, { withUser = false } = {}) => ({
    id: s.id, levelId: s.levelId, type: s.type, text: s.text, files: s.files, status: s.status, at: s.at, review: s.review,
    ...(withUser ? { uid: s.uid, name: s.name, role: s.role } : {})
  });
  const mine = uid => db.submissions.filter(s => s.uid === uid);

  return {
  // 交一次：{ levelId, text, files:[{hash,name,type}] }
  'POST /api/submissions': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const levelId = str(body.levelId, 40);
    const type = LEVEL_TYPES[levelId];
    if (!type) return json(res, 400, { error: 'unknown level', code: 'level' });
    if (type === 'tool') return json(res, 400, { error: 'this level is passed by a platform event', code: 'tool-level' });
    const text = str(body.text, TEXT_MAX);
    const files = (Array.isArray(body.files) ? body.files : []).slice(0, FILES_MAX)
      .map(f => ({ hash: str(f?.hash, 64), name: str(f?.name, 120), type: str(f?.type, 60) })).filter(f => HASH.test(f.hash));
    if (!text && !files.length) return json(res, 400, { error: 'text or a file is required', code: 'empty' });
    if (type === 'seminar' && !text) return json(res, 400, { error: 'an answer is required', code: 'empty' });
    if (mine(user.id).length >= PER_USER_MAX) return json(res, 429, { error: 'too many submissions', code: 'limit' });
    const s = { id: newId(), uid: user.id, name: user.name, role: user.academy?.role || null, org: orgKeyOf(user), levelId, type, text, files,
      status: type === 'seminar' ? 'pass' : 'pending', at: Date.now(), review: null };
    db.submissions.push(s); saveDb();
    audit(req, 'submission.new', { user, msg: levelId });
    json(res, 200, { submission: pub(s) });
    // 实践关：通知本园点评人（订阅消息，有额度才发；失败不影响提交）
    if (type === 'practice' && notifier) for (const r of notifier.reviewersOf(s.org, user.id, isAdmin)) notifier.send(r.id, 'queue', { title: LEVELS[levelId] || levelId, who: user.name, at: s.at, note: text }, 'pages/home/home');
  },

  // 本人的提交；?level= 只要那一关。研讨关交过以后带同园他人的作答（others）。
  'GET /api/submissions': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const level = new URL(req.url, 'http://x').searchParams.get('level') || '';
    const list = mine(user.id).filter(s => !level || s.levelId === level).sort((a, b) => b.at - a.at).map(s => pub(s));
    let others = [];
    if (level && LEVEL_TYPES[level] === 'seminar' && list.length) {
      const org = orgKeyOf(user);
      others = org ? db.submissions.filter(s => s.levelId === level && s.uid !== user.id && s.org === org).sort((a, b) => b.at - a.at).slice(0, 50)
        .map(s => ({ id: s.id, name: s.name, text: s.text, at: s.at, review: s.review ? { comment: s.review.comment } : null })) : [];
    }
    json(res, 200, { submissions: list, others, ...(level ? { rubric: RUBRICS[level] || [], title: LEVELS[level] || null } : {}) });
  },

  // 点评队列：本园待点评的提交（先交先评），加最近点评过的 20 条
  'GET /api/review/queue': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!canReview(user, isAdmin)) return json(res, 403, { error: 'reviewers only', code: 'reviewer' });
    const org = orgKeyOf(user);
    const inOrg = org ? db.submissions.filter(s => s.org === org && s.uid !== user.id) : [];
    const pending = inOrg.filter(s => s.status === 'pending').sort((a, b) => a.at - b.at);
    const done = inOrg.filter(s => s.status !== 'pending' && s.type === 'practice').sort((a, b) => (b.review?.at || 0) - (a.review?.at || 0)).slice(0, 20);
    const row = s => ({ ...pub(s, { withUser: true }), title: LEVELS[s.levelId] || s.levelId, rubric: RUBRICS[s.levelId] || [] });
    json(res, 200, { pending: pending.map(row), done: done.map(row) });
  },

  // 点评：{ id, verdict:'pass'|'revise', scores:[1..5], comment }
  'POST /api/submissions/review': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!canReview(user, isAdmin)) return json(res, 403, { error: 'reviewers only', code: 'reviewer' });
    const body = await readBody(req);
    const s = db.submissions.find(x => x.id === str(body.id, 40));
    if (!s) return json(res, 404, { error: 'no such submission' });
    if (!s.org || s.org !== orgKeyOf(user) || s.uid === user.id) return json(res, 403, { error: 'not in your kindergarten', code: 'org' });
    const verdict = body.verdict === 'pass' ? 'pass' : body.verdict === 'revise' ? 'revise' : null;
    if (!verdict) return json(res, 400, { error: 'verdict must be pass or revise', code: 'verdict' });
    const rubric = RUBRICS[s.levelId] || [];
    const scores = (Array.isArray(body.scores) ? body.scores : []).slice(0, rubric.length).map(n => { const k = Math.round(Number(n)); return k >= 1 && k <= 5 ? k : null; });
    const comment = str(body.comment, 2000);
    if (verdict === 'revise' && !comment) return json(res, 400, { error: 'say what to change', code: 'comment' });
    s.status = verdict;
    s.review = { by: user.id, byName: user.name, at: Date.now(), scores, comment };
    saveDb();
    audit(req, 'submission.review', { user, msg: `${s.levelId} ${verdict}` });
    json(res, 200, { submission: pub(s, { withUser: true }) });
    if (notifier) { const [p, i] = s.levelId.split(/-(?=\d+$)/); notifier.send(s.uid, 'review', { title: LEVELS[s.levelId] || s.levelId, verdict: verdict === 'pass' ? '通过' : '需修改', at: s.review.at, comment, by: user.name }, `pages/level/level?p=${p}&i=${i}`); }
  },

  // 证据文件：提交者本人，或本园点评人
  'GET /api/submissions/file': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const q = new URL(req.url, 'http://x').searchParams;
    const s = db.submissions.find(x => x.id === q.get('id'));
    const hash = q.get('hash') || '';
    if (!s || !HASH.test(hash) || !s.files.some(f => f.hash === hash)) return json(res, 404, { error: 'not found' });
    if (s.uid !== user.id && !(canReview(user, isAdmin) && s.org && s.org === orgKeyOf(user))) return json(res, 403, { error: 'forbidden' });
    const f = MEDIA.file(s.uid, hash);
    if (!f) return json(res, 404, { error: 'media-missing' });
    await sendMediaFile(res, f, hash);
  }
  };
}
