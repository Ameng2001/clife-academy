/* 课程成果（docs/POSITIONING.md）：教师在教研工坊做出来、在班里用过的课程，分享到幼师学坊。专家案例是「一件事怎么做」，课程成果是「一门课怎么来的」。
 *
 * db.works: { id, title, pipeline:'theme'|'pbl'|'activity', age, weeks, domains:[五大领域], summary, changes:[string], files:[{name,url}],
 *             source:{ kind:'workshop'|'own'|'token', courseId?, url?, via?, tokenId? }, message?, allowAdapt, filesScope, by, byName, org, orgName, status, note, at, consent, curated }
 *   message    分享者给同行的一句话（≤ 80 字，可空）：不是评价不是总结，显示在卡片与详情上（docs/WORKSHOP-SHARE-DESIGN.md）
 *   allowAdapt 允许别人改编（默认 true）；filesScope 文件外链对谁可见：all 全平台 / community 本共同体 / org 本园（默认 all）。简介与「改了什么」始终全平台可见
 *   status  同专家案例：consent 待园长同意 → pending 待审核 → approved 已入库 | rejected 退回
 *   changes 教师在 AI 起草稿上改了什么（至少一条）：这是成果的「人」的部分，没有就不收。工坊起草不算成果，用过并改过才算。
 *   files   外链（工坊的 docx 下载地址或园所网盘），不上传文件；最多 20 条，只收 https。
 * db.workUses: { workId, uid, name, orgName, note, at } 「用过，有效」，数只给分享者本人、本园园长与管理员看，不排行。
 * 入库记一次分享者的事件，积分按 points.js 规则到账（课程成果默认比案例多：一门课比一件事重）。教研工坊按 docs/WORKSHOP-SHARE.md 用投稿令牌直接投（POST /api/works）。
 * 实名、全平台可见；不出现幼儿姓名与正脸；不显示人数、不排名。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { titlesOf } from './honors.js';

export const PIPELINES = Object.freeze({ theme: '主题式课程', pbl: '项目式课程', activity: '单节活动' });
export const FIVE = Object.freeze({ lang: '语言', social: '社会', health: '健康', art: '艺术', sci: '科学' });
const AGES = ['小班', '中班', '大班', '混龄'];
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
const isCurator = (u, isAdmin) => !!u && (u.academy?.curator === true || isAdmin(u));
const isDirector = (u, isAdmin) => !!u && (u.academy?.role === 'director' || isAdmin(u));

export const FILES_SCOPES = Object.freeze({ all: '全平台', community: '本共同体', org: '本园' });

export function workRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, ledger = null, communities = null }) {
  db.works = db.works || []; db.workUses = db.workUses || [];
  const usesOf = id => db.workUses.filter(u => u.workId === id);
  const seesUses = (user, w) => !!user && (w.by === user.id || isAdmin(user) || (isDirector(user, isAdmin) && w.org && w.org === orgKeyOf(user)));
  const scopeOf = w => FILES_SCOPES[w.filesScope] ? w.filesScope : 'all';
  const seesFiles = (user, w) => scopeOf(w) === 'all' || !!user && (w.by === user.id || isAdmin(user) || (scopeOf(w) === 'org' ? !!w.org && w.org === orgKeyOf(user) : !!communities && communities.sameCommunity(w.org, orgKeyOf(user))));
  const pub = (w, user) => ({
    id: w.id, title: w.title, pipeline: w.pipeline, pipelineName: PIPELINES[w.pipeline], age: w.age, weeks: w.weeks, domains: w.domains, domainNames: w.domains.map(d => FIVE[d]),
    summary: w.summary, changes: w.changes, files: seesFiles(user, w) ? w.files : [], filesScope: scopeOf(w), filesScopeName: FILES_SCOPES[scopeOf(w)], filesHidden: !seesFiles(user, w) && w.files.length > 0,
    message: w.message || null, allowAdapt: w.allowAdapt !== false, source: { kind: w.source.kind, url: w.source.url || null, via: w.source.via || null },
    byName: w.byName, orgName: w.orgName, status: w.status, note: w.note || null, at: w.at,
    consent: w.consent ? { byName: w.consent.byName, at: w.consent.at } : null, curated: w.curated ? { byName: w.curated.byName, at: w.curated.at } : null,
    mine: !!user && w.by === user.id, byTitles: titlesOf(db, w.by).map(t => t.label),
    ...(seesUses(user, w) ? { uses: usesOf(w.id).map(u => ({ name: u.name, orgName: u.orgName, note: u.note, at: u.at })) } : {}),
    usedByMe: !!user && usesOf(w.id).some(u => u.uid === user.id)
  });
  const filesOf = body => (Array.isArray(body.files) ? body.files : []).map(f => ({ name: str(f?.name, 120), url: str(f?.url, 500) })).filter(f => f.name && /^https:\/\//.test(f.url)).slice(0, 20);
  const changesOf = body => (Array.isArray(body.changes) ? body.changes : []).map(x => str(x, 300)).filter(Boolean).slice(0, 10);
  const domainsOf = body => [...new Set((Array.isArray(body.domains) ? body.domains : []).filter(d => FIVE[d]))];

  return {
  // 已入库的；?pipeline=&age=&domain=&q=
  'GET /api/works': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const sp = new URL(req.url, 'http://x').searchParams;
    const pipeline = sp.get('pipeline'), age = sp.get('age'), domain = sp.get('domain'), q = norm(sp.get('q'));
    const rows = db.works.filter(w => w.status === 'approved')
      .filter(w => (!pipeline || w.pipeline === pipeline) && (!age || w.age === age) && (!domain || w.domains.includes(domain)))
      .filter(w => !q || norm([w.title, w.summary, ...w.changes, w.byName, w.orgName].join(' ')).includes(q))
      .sort((a, b) => (b.curated?.at || b.at) - (a.curated?.at || a.at));
    json(res, 200, { works: rows.map(w => pub(w, user)), total: rows.length, pipelines: PIPELINES, domains: FIVE, ages: AGES, filesScopes: FILES_SCOPES });
  },
  'GET /api/works/mine': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { works: db.works.filter(w => w.by === user.id).sort((a, b) => b.at - a.at).map(w => pub(w, user)) });
  },
  // 园长：本园待同意；审核人：待审核
  'GET /api/works/queue': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const key = orgKeyOf(user);
    const consent = isDirector(user, isAdmin) && key ? db.works.filter(w => w.status === 'consent' && w.org === key) : [];
    const pending = isCurator(user, isAdmin) ? db.works.filter(w => w.status === 'pending') : [];
    json(res, 200, { director: isDirector(user, isAdmin), curator: isCurator(user, isAdmin), consent: consent.map(w => pub(w, user)), pending: pending.map(w => pub(w, user)) });
  },
  // 交一门 / 改自己还没入库的：{ id?, title, pipeline, age?, weeks?, domains:[...], summary(≥50 字), changes:[≥1], files?:[{name,url}], source?:{ courseId?, url? }, message?(≤80 字), allowAdapt?(默认 true), filesScope?(all|community|org) }
  // 投稿令牌投来的（tokens.js scope submit）记 source.kind 'token' 与令牌标签；带 courseId/url 的记工坊课程
  'POST /api/works': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let w = id ? db.works.find(x => x.id === id) : null;
    if (id && !w) return json(res, 404, { error: 'no such work' });
    if (w && (w.by !== user.id || w.status === 'approved')) return json(res, 403, { error: 'not yours or already in the library', code: 'edit' });
    const title = str(body.title, 120), summary = str(body.summary, 3000);
    if (!title) return json(res, 400, { error: 'title required', code: 'title' });
    if (!PIPELINES[body.pipeline]) return json(res, 400, { error: 'pipeline must be theme | pbl | activity', code: 'pipeline' });
    if (!summary || summary.length < 50) return json(res, 400, { error: 'summary: at least 50 characters', code: 'summary' });
    const changes = changesOf(body);
    if (!changes.length) return json(res, 400, { error: 'say what you changed on the draft (changes[])', code: 'changes' });
    const domains = domainsOf(body);
    if (!domains.length) return json(res, 400, { error: 'at least one of the five domains', code: 'domains' });
    const age = AGES.includes(body.age) ? body.age : (w && body.age === undefined ? w.age : null);
    const weeks = Number.isInteger(body.weeks) && body.weeks > 0 && body.weeks <= 20 ? body.weeks : (w && body.weeks === undefined ? w.weeks : null);
    const files = (w && !Array.isArray(body.files)) ? w.files : filesOf(body);
    const src = body.source && typeof body.source === 'object' ? body.source : {};
    const courseId = str(src.courseId, 80), url = /^https:\/\//.test(str(src.url, 500)) ? str(src.url, 500) : '';
    const source = req.apiToken ? { kind: 'token', via: req.apiToken.label, tokenId: req.apiToken.id, ...(courseId ? { courseId } : {}), ...(url ? { url } : {}) }
      : courseId || url ? { kind: 'workshop', ...(courseId ? { courseId } : {}), ...(url ? { url } : {}) } : { kind: 'own' };
    const message = body.message === undefined && w ? (w.message || '') : str(body.message, 80);
    const allowAdapt = body.allowAdapt === undefined ? (w ? w.allowAdapt !== false : true) : body.allowAdapt !== false;
    const filesScope = FILES_SCOPES[body.filesScope] ? body.filesScope : (w && body.filesScope === undefined ? scopeOf(w) : 'all');
    const now = Date.now();
    if (w) {
      Object.assign(w, { title, pipeline: body.pipeline, age, weeks, domains, summary, changes, files, message, allowAdapt, filesScope, updatedAt: now });
      if (courseId || url) w.source = source;
      if (w.status === 'rejected') { w.status = isDirector(user, isAdmin) ? 'pending' : 'consent'; w.note = null; }
    } else {
      const directorSelf = isDirector(user, isAdmin);
      w = { id: crypto.randomBytes(9).toString('base64url'), title, pipeline: body.pipeline, age, weeks, domains, summary, changes, files, source, message, allowAdapt, filesScope,
        by: user.id, byName: user.name, org: orgKeyOf(user), orgName: user.academy?.org?.name || null, status: directorSelf ? 'pending' : 'consent', note: null, at: now,
        consent: directorSelf ? { by: user.id, byName: user.name, at: now } : null, curated: null };
      db.works.push(w);
    }
    saveDb();
    audit(req, id ? 'work.edit' : 'work.new', { user, msg: w.id });
    json(res, 200, { work: pub(w, user) });
  },
  // 园长同意 / 审核人入库或退回：{ id, action: 'consent' | 'approve' | 'reject', note? }
  'POST /api/works/decide': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const w = db.works.find(x => x.id === str(body.id, 40));
    if (!w) return json(res, 404, { error: 'no such work' });
    const note = str(body.note, 500), now = Date.now();
    if (body.action === 'consent') {
      if (w.status !== 'consent') return json(res, 400, { error: 'not waiting for consent', code: 'state' });
      if (!isDirector(user, isAdmin) || !w.org || w.org !== orgKeyOf(user)) return json(res, 403, { error: 'director of that kindergarten only', code: 'org' });
      w.status = 'pending'; w.consent = { by: user.id, byName: user.name, at: now };
    } else if (body.action === 'approve' || body.action === 'reject') {
      if (!isCurator(user, isAdmin)) return json(res, 403, { error: 'curator only', code: 'curator' });
      if (w.status !== 'pending' && !(w.status === 'consent' && isAdmin(user))) return json(res, 400, { error: 'not waiting for review', code: 'state' });
      if (body.action === 'reject' && !note) return json(res, 400, { error: 'say why', code: 'note' });
      if (body.action === 'approve') { if (w.status === 'consent') w.consent = w.consent || { by: user.id, byName: user.name, at: now }; w.status = 'approved'; w.curated = { by: user.id, byName: user.name, at: now }; w.note = note || null; if (ledger) ledger.grant(w.by, 'work', w.id, 3, '课程成果入库：' + w.title); }
      else { w.status = 'rejected'; w.note = note; }
    } else return json(res, 400, { error: 'action: consent | approve | reject', code: 'action' });
    saveDb();
    audit(req, 'work.' + body.action, { user, msg: w.id });
    json(res, 200, { work: pub(w, user) });
  },
  // 本人删还没入库的；管理员能删任何
  'POST /api/works/delete': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const w = db.works.find(x => x.id === str(body.id, 40));
    if (!w) return json(res, 404, { error: 'no such work' });
    if (!(isAdmin(user) || (w.by === user.id && w.status !== 'approved'))) return json(res, 403, { error: 'not yours, or already in the library', code: 'edit' });
    db.works = db.works.filter(x => x.id !== w.id); db.workUses = db.workUses.filter(u => u.workId !== w.id);
    saveDb(); audit(req, 'work.delete', { user, msg: w.id });
    json(res, 200, { ok: true });
  },
  // 「用过，有效」：{ id, note? }，一人一门记一次
  'POST /api/works/used': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const w = db.works.find(x => x.id === str(body.id, 40) && x.status === 'approved');
    if (!w) return json(res, 404, { error: 'no such work' });
    if (w.by === user.id) return json(res, 400, { error: 'your own', code: 'own' });
    if (!usesOf(w.id).some(u => u.uid === user.id)) {
      const note = str(body.note, 300);
      db.workUses.push({ workId: w.id, uid: user.id, name: user.name, orgName: user.academy?.org?.name || null, note, at: Date.now() }); saveDb();
      if (ledger?.interact) { ledger.interact(w.by, 'used', `work:${w.id}:${user.id}`, `「${w.title.slice(0, 24)}」被 ${user.name} 标「用过，有效」`, 'work:' + w.id); if (note) ledger.interact(user.id, 'usedBy', `work:${w.id}`, `标「${w.title.slice(0, 24)}」用过并写了怎么改`); }
    }
    json(res, 200, { work: pub(w, user) });
  }
  };
}
