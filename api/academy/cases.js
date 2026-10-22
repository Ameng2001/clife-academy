/* 专家案例（docs/ROADMAP.md 第四节）：实践关与研讨关的优秀作品（园长同意后）、种子园做法、公开案例改编。
 *
 * db.cases: { id, title, domain, age, use, text, files:[{hash,name,type,owner}], source:{ kind:'submission'|'drill'|'contest'|'own'|'token', submissionId?, levelId?, answerId?, drillId?, contestId?, entryId?, tag?, selected?, via?(投稿令牌标签) },
 * adaptedFrom: { caseId, note } 改编来源链（ROADMAP 第十三节第 3 条）：改自哪条入库案例、改了什么。原作者与改编者都署名；改编案例入库时给原案例记一次「用过，有效」（改编者不是原作者时）。
 *   链可以多级（改自改编的），对外给 chain（往上最多 5 级）与 adaptations（改自这条的已入库案例）。
 * db.caseUses: { caseId, uid, name, orgName, note, at }  「用过，有效」：别的教师用了这份案例标一次、留一句怎么改的；数只给分享者本人、本园园长与管理员看，不排行。
 * 入库记一次分享者的事件（honors.js，一条案例只记一次），积分按 points.js 规则到账。
 *             by, byName, org, orgName, status, note, at, consent:{by,byName,at}|null, curated:{by,byName,at}|null }
 *   status  'consent'  待本园园长同意（教师自荐）
 *           'pending'  待审核（园长同意或园长直接推荐）
 *           'approved' 已入库，所有登录用户可见
 *           'rejected' 退回（note 里写原因，本人可改后再交）
 *   use     'direct' 可直接用 | 'adapt' 需改编 | 'idea' 只看思路
 *   age     '小班' | '中班' | '大班' | '混龄' | null
 * 审核人：管理员，或 academy.curator === true（由管理员标，本地运营方指定）。
 * 实名、全平台可见；素材规则同实践关（不出现幼儿姓名与正脸）。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { LEVELS, LEVEL_TYPES } from './events-data.js';
import { titlesOf } from './honors.js';

const DOMAINS = ['env', 'life', 'play', 'plan', 'obs', 'comm', 'reflect'];
const AGES = ['小班', '中班', '大班', '混龄'];
export const USES = Object.freeze({ direct: '可直接用', adapt: '需改编', idea: '只看思路' });
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const HASH = /^[0-9a-f]{64}$/;
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');

export const isCurator = (u, isAdmin) => !!u && (u.academy?.curator === true || isAdmin(u));
const isDirector = (u, isAdmin) => !!u && (u.academy?.role === 'director' || isAdmin(u));

export function caseRoutes({ communities = null, json, readBody, db, saveDb, readSession, audit, isAdmin, MEDIA, sendMediaFile, ledger = null }) {
  db.cases = db.cases || []; db.caseUses = db.caseUses || [];
  const usesOf = id => db.caseUses.filter(u => u.caseId === id);
  const seesUses = (user, c) => !!user && (c.by === user.id || isAdmin(user) || (isDirector(user, isAdmin) && c.org && c.org === orgKeyOf(user)));
  const pub = (c, user) => ({
    id: c.id, title: c.title, domain: c.domain, age: c.age, use: c.use, text: c.text, files: c.files.map(f => ({ hash: f.hash, name: f.name, type: f.type })),
    source: c.source, byName: c.byName, orgName: c.orgName, status: c.status, note: c.note || null, at: c.at,
    consent: c.consent ? { byName: c.consent.byName, at: c.consent.at } : null, curated: c.curated ? { byName: c.curated.byName, at: c.curated.at } : null,
    mine: !!user && c.by === user.id, byTitles: titlesOf(db, c.by).map(t => t.label), ...(c.showcase ? { showcase: c.showcase } : {}),
    canEdit: !!user && c.by === user.id && c.status !== 'approved',
    usedByMe: !!user && usesOf(c.id).some(u => u.uid === user.id),
    adaptedFrom: adaptedOf(c), chain: chainOf(c), adaptations: db.cases.filter(x => x.status === 'approved' && x.adaptedFrom?.caseId === c.id).map(x => ({ id: x.id, title: x.title, byName: x.byName, orgName: x.orgName, note: x.adaptedFrom.note || '' })),
    ...(seesUses(user, c) ? { used: usesOf(c.id).length, uses: usesOf(c.id).sort((a, b) => b.at - a.at).map(u => ({ name: u.name, orgName: u.orgName, note: u.note, at: u.at })) } : {})
  });
  // 来源链：改自谁的哪一条（原案例被删了也留标题）
  const adaptedOf = c => { if (!c.adaptedFrom) return null; const o = db.cases.find(x => x.id === c.adaptedFrom.caseId); return { id: c.adaptedFrom.caseId, title: o ? o.title : c.adaptedFrom.title || '（已删）', byName: o ? o.byName : c.adaptedFrom.byName || '', orgName: o ? o.orgName : null, note: c.adaptedFrom.note || '', available: !!o && o.status === 'approved' }; };
  const chainOf = c => { const out = []; let cur = c; const seen = new Set([c.id]); while (cur?.adaptedFrom && out.length < 5) { const o = db.cases.find(x => x.id === cur.adaptedFrom.caseId); if (!o || seen.has(o.id)) break; seen.add(o.id); out.push({ id: o.id, title: o.title, byName: o.byName, orgName: o.orgName, available: o.status === 'approved' }); cur = o; } return out; };
  const canSee = (user, c) => c.status === 'approved' || (!!user && (c.by === user.id || isCurator(user, isAdmin) || (isDirector(user, isAdmin) && c.org && c.org === orgKeyOf(user))));
  const now0 = () => Date.now();
  const filesOf = (body, owner) => (Array.isArray(body.files) ? body.files : []).slice(0, 6)
    .map(f => ({ hash: str(f?.hash, 64), name: str(f?.name, 120), type: str(f?.type, 60), owner })).filter(f => HASH.test(f.hash) && MEDIA.file(owner, f.hash));

  return {
  // 已入库的案例：?q=&domain=&age=&use=  要登录（实名共享，不对外）
  'GET /api/cases': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const sp = new URL(req.url, 'http://x').searchParams;
    const q = norm(sp.get('q')), domain = sp.get('domain') || '', age = sp.get('age') || '', use = sp.get('use') || '';
    // ?community=1：只看本园所在共同体各园入库的案例（ROADMAP 第六节：共同体内共享专家案例）
    const community = communities ? communities.ofOrg(orgKeyOf(user)) : null;
    let list = db.cases.filter(c => c.status === 'approved');
    if (sp.get('community') === '1' && community) { const keys = new Set(community.orgs.map(o => o.key)); list = list.filter(c => keys.has(c.org)); }
    if (sp.get('showcase') === '1') list = list.filter(c => c.showcase);
    if (domain) list = list.filter(c => c.domain === domain);
    if (age) list = list.filter(c => c.age === age);
    if (use) list = list.filter(c => c.use === use);
    if (q) list = list.filter(c => norm([c.title, c.text, c.byName, c.orgName, LEVELS[c.source?.levelId] || ''].join(' ')).includes(q));
    list.sort((a, b) => (b.curated?.at || b.at) - (a.curated?.at || a.at));
    json(res, 200, { cases: list.map(c => pub(c, user)), uses: USES, ages: AGES, total: db.cases.filter(c => c.status === 'approved').length, community: community ? { id: community.id, name: community.name } : null, showcased: db.cases.filter(c => c.status === 'approved' && c.showcase).length });
  },
  // 本人的（含待同意、待审核、退回的）
  'GET /api/cases/mine': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { cases: db.cases.filter(c => c.by === user.id).sort((a, b) => b.at - a.at).map(c => pub(c, user)) });
  },
  // 待办：园长看本园待同意的；审核人看待审核的
  'GET /api/cases/queue': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const director = isDirector(user, isAdmin), curator = isCurator(user, isAdmin);
    if (!director && !curator) return json(res, 403, { error: 'directors and curators only', code: 'queue' });
    const org = orgKeyOf(user);
    const consent = director && org ? db.cases.filter(c => c.status === 'consent' && c.org === org && c.by !== user.id) : [];
    const pending = curator ? db.cases.filter(c => c.status === 'pending') : [];
    json(res, 200, { consent: consent.sort((a, b) => a.at - b.at).map(c => pub(c, user)), pending: pending.sort((a, b) => a.at - b.at).map(c => pub(c, user)), director, curator });
  },
  // 交一个案例（自荐）或改自己的：{ id?, title, domain, age?, use, text, files?, submissionId? }
  // 园长交自己的也要过审核；园长从本园已通过的实践关作品推荐（submissionId 不是自己的）时，作者是提交的教师，园长同意视为已给。
  'POST /api/cases': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let c = id ? db.cases.find(x => x.id === id) : null;
    if (id && !c) return json(res, 404, { error: 'no such case' });
    if (c && (c.by !== user.id || c.status === 'approved')) return json(res, 403, { error: 'not yours or already in the library', code: 'edit' });
    const title = str(body.title, 120), text = str(body.text, 6000);
    if (!title) return json(res, 400, { error: 'title required', code: 'title' });
    if (!text || text.length < 50) return json(res, 400, { error: 'write at least 50 characters', code: 'text' });
    if (!DOMAINS.includes(body.domain)) return json(res, 400, { error: 'domain required', code: 'domain' });
    const use = USES[body.use] ? body.use : (c ? c.use : 'idea');
    const age = AGES.includes(body.age) ? body.age : (c && body.age === undefined ? c.age : null);
    // 从实践关作品推荐；投稿令牌（tokens.js scope submit）投来的记 kind 'token' 与令牌标签
    let author = user, source = req.apiToken ? { kind: 'token', via: req.apiToken.label, tokenId: req.apiToken.id } : { kind: 'own' }, files = [];
    const subId = str(body.submissionId, 40);
    if (subId) {
      const s = (db.submissions || []).find(x => x.id === subId);
      if (!s) return json(res, 404, { error: 'no such submission' });
      if (s.status !== 'pass') return json(res, 400, { error: 'only reviewed and passed works', code: 'not-passed' });
      if (s.uid !== user.id) {
        // 园长推荐本园教师的作品
        if (!isDirector(user, isAdmin) || !s.org || s.org !== orgKeyOf(user)) return json(res, 403, { error: 'only your own work, or your kindergarten\'s as the director', code: 'org' });
        author = db.users.find(u => u.id === s.uid) || user;
      }
      source = { kind: 'submission', submissionId: s.id, levelId: s.levelId };
      files = s.files.map(f => ({ ...f, owner: s.uid }));
    }
    // 从研讨作答推荐（本人的，或园长推荐本园被精选的）
    const ansId = str(body.answerId, 40);
    if (ansId && !subId) {
      const a = (db.drillAnswers || []).find(x => x.id === ansId);
      if (!a) return json(res, 404, { error: 'no such answer' });
      if (a.uid !== user.id) {
        if (!isDirector(user, isAdmin) || !a.org || a.org !== orgKeyOf(user)) return json(res, 403, { error: 'only your own answer, or your kindergarten\'s as the director', code: 'org' });
        author = db.users.find(u => u.id === a.uid) || user;
      }
      source = { kind: 'drill', answerId: a.id, drillId: a.drillId };
    }
    // 改编来源：{ adaptedFrom: caseId|null, adaptNote? }。只能改自已入库的、不是这条自己的；不带就不动
    let adaptedFrom = c ? c.adaptedFrom || null : null;
    if (body.adaptedFrom !== undefined) {
      const fid = str(body.adaptedFrom, 40);
      if (!fid) adaptedFrom = null;
      else {
        const o = db.cases.find(x => x.id === fid && x.status === 'approved');
        if (!o) return json(res, 400, { error: 'adapt from an approved case', code: 'adapt' });
        if (c && o.id === c.id) return json(res, 400, { error: 'cannot adapt from itself', code: 'adapt' });
        adaptedFrom = { caseId: o.id, title: o.title, byName: o.byName, note: str(body.adaptNote, 300), at: now0() };
      }
    } else if (c && body.adaptNote !== undefined && c.adaptedFrom) adaptedFrom = { ...c.adaptedFrom, note: str(body.adaptNote, 300) };
    // 改的时候没带 files：附图不动
    files = (c && !subId && !Array.isArray(body.files)) ? c.files : files.concat(filesOf(body, user.id)).slice(0, 6);
    if (c && ansId && !subId) c.source = source;
    const now = Date.now();
    if (c) {
      Object.assign(c, { title, domain: body.domain, age, use, text, files, adaptedFrom, updatedAt: now });
      if (c.status === 'rejected') { c.status = isDirector(user, isAdmin) ? 'pending' : 'consent'; c.note = null; }
    } else {
      const org = orgKeyOf(author), orgName = author.academy?.org?.name || null;
      const directorSelf = isDirector(user, isAdmin);
      c = { id: crypto.randomBytes(9).toString('base64url'), title, domain: body.domain, age, use, text, files, source,
        by: author.id, byName: author.name, org, orgName, status: directorSelf ? 'pending' : 'consent', note: null, at: now, adaptedFrom,
        consent: directorSelf ? { by: user.id, byName: user.name, at: now } : null, curated: null };
      db.cases.push(c);
    }
    saveDb();
    audit(req, id ? 'case.edit' : 'case.new', { user, msg: c.id });
    json(res, 200, { case: pub(c, user) });
  },
  // 园长同意 / 审核人入库或退回：{ id, action: 'consent' | 'approve' | 'reject', note? }
  'POST /api/cases/decide': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = db.cases.find(x => x.id === str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such case' });
    const note = str(body.note, 1000), now = Date.now();
    if (body.action === 'consent') {
      if (!isDirector(user, isAdmin) || !c.org || c.org !== orgKeyOf(user)) return json(res, 403, { error: 'the kindergarten\'s director only', code: 'org' });
      if (c.status !== 'consent') return json(res, 400, { error: 'not waiting for consent', code: 'state' });
      c.status = 'pending'; c.consent = { by: user.id, byName: user.name, at: now };
    } else if (body.action === 'approve' || body.action === 'reject') {
      if (!isCurator(user, isAdmin) && !(body.action === 'reject' && c.status === 'consent' && isDirector(user, isAdmin) && c.org === orgKeyOf(user))) return json(res, 403, { error: 'curators only', code: 'curator' });
      if (c.status === 'approved') return json(res, 400, { error: 'already in the library', code: 'state' });
      if (body.action === 'reject' && !note) return json(res, 400, { error: 'say why', code: 'note' });
      if (body.action === 'approve') { if (c.status === 'consent') c.consent = c.consent || { by: user.id, byName: user.name, at: now }; c.status = 'approved'; c.curated = { by: user.id, byName: user.name, at: now }; c.note = note || null; if (ledger) ledger.grant(c.by, 'case', c.id, 2, '案例入库：' + c.title); }
      else { c.status = 'rejected'; c.note = note; }
      // 改编入库：给原案例记一次「用过，有效」（改编者不是原作者、没记过才记）
      if (body.action === 'approve' && c.adaptedFrom) {
        const o = db.cases.find(x => x.id === c.adaptedFrom.caseId);
        if (o && o.by !== c.by && !db.caseUses.some(u => u.caseId === o.id && u.uid === c.by)) db.caseUses.push({ caseId: o.id, uid: c.by, name: c.byName, orgName: c.orgName, note: `改编为《${c.title}》`, at: now });
      }
    } else return json(res, 400, { error: 'action must be consent, approve or reject', code: 'action' });
    saveDb();
    audit(req, 'case.' + body.action, { user, msg: c.id });
    json(res, 200, { case: pub(c, user) });
  },
  'POST /api/cases/delete': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = db.cases.find(x => x.id === str(body.id, 40));
    if (!c) return json(res, 404, { error: 'no such case' });
    if (!(c.by === user.id && c.status !== 'approved') && !isCurator(user, isAdmin)) return json(res, 403, { error: 'not allowed', code: 'edit' });
    db.cases = db.cases.filter(x => x.id !== c.id); saveDb();
    audit(req, 'case.delete', { user, msg: c.id });
    json(res, 200, { ok: true });
  },
  // 「用过，有效」：{ id, note? }。只对已入库、不是自己的；一人一条，再标就是改一句。
  'POST /api/cases/used': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = db.cases.find(x => x.id === str(body.id, 40));
    if (!c || c.status !== 'approved') return json(res, 404, { error: 'no such case' });
    if (c.by === user.id) return json(res, 403, { error: 'not your own', code: 'self' });
    const note = str(body.note, 300);
    let u = db.caseUses.find(x => x.caseId === c.id && x.uid === user.id);
    if (u) { u.note = note; u.at = Date.now(); }
    else { u = { caseId: c.id, uid: user.id, name: user.name, orgName: user.academy?.org?.name || null, note, at: Date.now() }; db.caseUses.push(u); }
    saveDb();
    // 互动给分（只记积分）：分享者 +used；标的人写了一句才 +usedBy
    if (ledger?.interact) { ledger.interact(c.by, 'used', `case:${c.id}:${user.id}`, `「${c.title.slice(0, 24)}」被 ${user.name} 标「用过，有效」`, 'case:' + c.id); if (note) ledger.interact(user.id, 'usedBy', `case:${c.id}`, `标「${c.title.slice(0, 24)}」用过并写了怎么改`); }
    audit(req, 'case.used', { user, msg: c.id });
    json(res, 200, { case: pub(c, user) });
  },
  // 管理员标审核人：{ uid, curator: true|false }
  'PUT /api/cases/curator': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const t = db.users.find(u => u.id === String(body.uid || ''));
    if (!t) return json(res, 404, { error: 'no such user' });
    t.academy = { ...(t.academy || { role: 'teacher', org: null, source: null }), curator: body.curator === true };
    if (!t.academy.curator) delete t.academy.curator;
    saveDb();
    audit(req, 'case.curator', { user, msg: `${t.id} ${body.curator === true ? 'on' : 'off'}` });
    json(res, 200, { id: t.id, curator: body.curator === true });
  },
  'GET /api/cases/file': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const q = new URL(req.url, 'http://x').searchParams;
    const c = db.cases.find(x => x.id === q.get('id'));
    const hash = q.get('hash') || '';
    if (!c || !canSee(user, c)) return json(res, 404, { error: 'not found' });
    const f = c.files.find(x => x.hash === hash);
    if (!f) return json(res, 404, { error: 'not found' });
    const m = MEDIA.file(f.owner, hash);
    if (!m) return json(res, 404, { error: 'media-missing' });
    await sendMediaFile(res, m, hash);
  }
  };
}
