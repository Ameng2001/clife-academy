/* 园长大讲堂（docs/ROADMAP.md 第四节）：每月一场，政策解读、园所建设路径、课程领导力。
 * 直播在第三方（腾讯会议、视频号等），平台只做三件事：预约、回放列表、讲义。
 *
 * db.lectures: { id, title, desc, who, speaker, at(开播时间戳), minutes, liveUrl, replayUrl, slides:{url}|{file:{hash,name,type,size,owner}}|null,
 *                notes, caseIds:[案例 id], titleIds:[称号记录 id], by, byName, createdAt, updatedAt, bookings:[uid], reminded:[uid] }
 * caseIds 是这场展示的入库案例（斗课入选作品、分享者案例），titleIds 是这场颁发的荣誉称号；都只是记录，颁发在直播里。
 * 谁能排场：管理员（本地运营方）。谁能看：所有人（没登录也能看安排与回放，预约要登录）。
 * 预约提醒：开播前 30 分钟给预约且订阅过「lecture」模板的人发一条订阅消息（notify.js，WX_TMPL_LECTURE）；没配模板就只是记名。
 * 不催：只在本人预约的那一场开播前发，不发「今天有课」。
 *
 * 讲堂包（ROADMAP 第十三节）：一场讲堂不只是一场直播，配讲前预习卡、讲后三五条微课切片、一张知识海报。
 * l.pack: { script(讲稿), preview:{ points:[≤5] }, clips:[{ id, title, desc, start? }](≤6), poster:{ headline, lines:[≤6] }, draftedAt, model:boolean, updatedAt }
 * 草稿由规则从讲稿切出来（段落→要点、切片、海报），接了模型只改措辞不改结构；管理员改定后保存。
 * 对外：预习卡随场次一直可见；切片与海报等讲完（phase=done）才给；讲稿只有管理员看得到。切片进微课库「讲堂微课」一节（GET /api/lectures/clips）。 */
import crypto from 'node:crypto';
import { TITLES } from './honors.js';
import { orgKeyOf } from './org.js';
import * as assistant from './assistant.js';
import { systemRules } from './policy.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const HASH = /^[0-9a-f]{64}$/;
const URL_OK = /^https?:\/\/\S+$/i;
export const REMIND_BEFORE_MS = 30 * 60 * 1000;
export const SHARER_USES_MIN = 3, SHARER_CASES_MIN = 3;
export const PACK_SCRIPT_MIN = 40, PACK_POINTS_MAX = 5, PACK_CLIPS_MAX = 6, PACK_LINES_MAX = 6;

const HEADING = /^(第?[一二三四五六七八九十\d]+[、．.：:节章部分]|[一二三四五六七八九十\d]+[、．.]|[（(][一二三四五六七八九十\d]+[)）]|#+\s*)/;
const stripHeading = t => t.replace(HEADING, '').trim();
const firstSentence = t => { const m = /^[^。！？!?；;\n]+/.exec(t); return (m ? m[0] : t).trim(); };
const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
/** 讲稿切段：空行分段；没空行就按换行；还不够就按句号。去掉空段与纯标题行后合并到相邻段。 */
export function paragraphsOf(script) {
  let parts = String(script || '').replace(/\r/g, '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  if (parts.length < 3) parts = String(script || '').replace(/\r/g, '').split(/\n/).map(x => x.trim()).filter(Boolean);
  if (parts.length < 3) parts = String(script || '').replace(/\s+/g, ' ').split(/(?<=[。！？!?])/).map(x => x.trim()).filter(Boolean);
  // 单独一行的小标题并到下一段前面当引子
  const isHead = t => t.length <= 24 && !/[。！？!?]/.test(t) && (HEADING.test(t) || true);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.length <= 24 && HEADING.test(p) && i + 1 < parts.length) { out.push({ head: stripHeading(p), text: parts[++i] }); continue; }
    // 段首自带一行小标题
    const nl = p.indexOf('\n');
    if (nl > 0 && isHead(p.slice(0, nl).trim())) { out.push({ head: stripHeading(p.slice(0, nl).trim()), text: p.slice(nl + 1).trim() }); continue; }
    out.push({ head: '', text: p.replace(/\s*\n\s*/g, ' ') });
  }
  return out;
}
/** 规则草稿：预习卡要点＝前几段首句；切片＝段落分成 3–5 组，组标题取小标题或首句；海报＝标题＋要点。不加内容，只搬讲稿里的话。 */
export function packDraftOf(l, script) {
  const paras = paragraphsOf(script);
  const points = paras.map(p => clip(p.head || firstSentence(p.text), 60)).filter(Boolean).slice(0, PACK_POINTS_MAX);
  const groups = paras.length <= 5 ? paras.map(p => [p]) : (() => { const n = 5, size = Math.ceil(paras.length / n), g = []; for (let i = 0; i < paras.length; i += size) g.push(paras.slice(i, i + size)); return g; })();
  const clips = groups.filter(g => g.length).map((g, i) => ({ id: 'c' + (i + 1), title: clip(g[0].head || firstSentence(g[0].text), 30), desc: clip(g.map(p => p.text).join(' '), 200), start: null })).slice(0, PACK_CLIPS_MAX);
  const poster = { headline: clip(l.title || '', 40), lines: [...points.slice(0, 4), ...(l.speaker ? [l.speaker + ' 主讲 · 园长大讲堂'] : [])].slice(0, PACK_LINES_MAX) };
  return { preview: { points }, clips, poster };
}
export const PACK_SYSTEM = `你在整理一场幼儿园园长大讲堂的「讲堂包」：讲前预习卡要点、讲后微课切片的标题与一句话简介、一张知识海报的标题与几行字。
${systemRules(['ai-drafts', 'child-data', 'child-screen', 'real-name', 'plain'])}
结构照草稿：points 条数不变；clips 条数与 id 不变，只改 title（≤ 30 字）和 desc（≤ 200 字）；poster.lines 条数不变。只输出 JSON，不要别的。`;
export async function polishPack(draft, l, script) {
  if (!assistant.configured()) return { pack: draft, model: false };
  try {
    const text = await assistant.complete({ system: PACK_SYSTEM, prompt: `讲座：${l.title}${l.speaker ? '，' + l.speaker + ' 主讲' : ''}\n\n讲稿：${String(script).slice(0, 6000)}\n\n草稿：${JSON.stringify(draft)}`, maxTokens: 1800 });
    const j = assistant.parseJson(text?.text || text);
    if (!j || typeof j !== 'object') return { pack: draft, model: false };
    const out = { preview: { points: [...draft.preview.points] }, clips: draft.clips.map(c => ({ ...c })), poster: { ...draft.poster, lines: [...draft.poster.lines] } };
    const strs = (a, n, max) => (Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, n)).slice(0, max) : null);
    const pts = strs(j.preview?.points, 60, PACK_POINTS_MAX); if (pts && pts.length === draft.preview.points.length) out.preview.points = pts;
    if (Array.isArray(j.clips)) out.clips = out.clips.map(c => { const m = j.clips.find(x => x && x.id === c.id); return m ? { ...c, title: str(m.title, 30) || c.title, desc: str(m.desc, 200) || c.desc } : c; });
    if (j.poster && typeof j.poster === 'object') { const h = str(j.poster.headline, 40); if (h) out.poster.headline = h; const ls = strs(j.poster.lines, 60, PACK_LINES_MAX); if (ls && ls.length === draft.poster.lines.length) out.poster.lines = ls; }
    return { pack: out, model: true };
  } catch { return { pack: draft, model: false }; }
}
/** 管理员交来的改定稿：只收三块，长度与条数收口。 */
export function cleanPack(p) {
  if (!p || typeof p !== 'object') return null;
  const strs = (a, n, max) => (Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, n)).slice(0, max);
  const clips = (Array.isArray(p.clips) ? p.clips : []).map((c, i) => c && typeof c === 'object' ? { id: str(c.id, 12) || 'c' + (i + 1), title: str(c.title, 30), desc: str(c.desc, 200), start: Number.isFinite(Number(c.start)) && c.start !== null && c.start !== '' ? Math.max(0, Math.floor(Number(c.start))) : null } : null).filter(c => c && c.title).slice(0, PACK_CLIPS_MAX);
  return { preview: { points: strs(p.preview?.points, 60, PACK_POINTS_MAX) }, clips, poster: { headline: str(p.poster?.headline, 40), lines: strs(p.poster?.lines, 60, PACK_LINES_MAX) } };
}

export function lectureRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, MEDIA, sendMediaFile, notifier = null }) {
  db.lectures = db.lectures || [];
  const now = () => Date.now();
  const endOf = l => l.at + (l.minutes || 60) * 60000;
  const phase = l => (now() < l.at ? 'upcoming' : now() < endOf(l) ? 'live' : 'done');
  const pub = (l, user) => ({
    id: l.id, title: l.title, desc: l.desc, who: l.who, speaker: l.speaker, at: l.at, minutes: l.minutes, phase: phase(l),
    liveUrl: l.liveUrl || null, replayUrl: l.replayUrl || null, slides: l.slides ? (l.slides.url ? { url: l.slides.url } : { file: { name: l.slides.file.name, type: l.slides.file.type, size: l.slides.file.size } }) : null,
    notes: l.notes || '', booked: !!user && l.bookings.includes(user.id), bookings: l.bookings.length,
    showcase: (l.caseIds || []).map(id => (db.cases || []).find(c => c.id === id && c.status === 'approved')).filter(Boolean).map(c => ({ id: c.id, title: c.title, byName: c.byName, orgName: c.orgName })),
    honors: (l.titleIds || []).map(id => (db.titles || []).find(t => t.id === id)).filter(Boolean).map(t => ({ id: t.id, name: t.name, label: t.label })),
    sharers: (l.sharers || []).map(s => ({ uid: s.uid, name: s.name, orgName: s.orgName, caseTitle: s.caseId ? ((db.cases || []).find(c => c.id === s.caseId)?.title || null) : null })),
    pack: packPub(l, user),
    ...(user && isAdmin(user) ? { bookedBy: l.bookings.map(id => db.users.find(u => u.id === id)?.name || id) } : {})
  });
  // 讲堂包对外：预习卡一直给；切片与海报讲完才给；讲稿只给管理员
  const packPub = (l, user) => {
    const p = l.pack; if (!p) return null;
    const admin = !!user && isAdmin(user), done = phase(l) === 'done';
    return { preview: p.preview || { points: [] }, clips: admin || done ? p.clips || [] : [], poster: admin || done ? p.poster || null : null, model: !!p.model, draftedAt: p.draftedAt || null, updatedAt: p.updatedAt || null, ...(admin ? { script: p.script || '' } : {}) };
  };
  const find = id => db.lectures.find(l => l.id === id);

  // 开播前 30 分钟提醒预约的人。每分钟跑一次；给过的人记在 reminded 里，重启也不重发。
  async function tick() {
    if (!notifier) return 0;
    const t = now(); let n = 0;
    for (const l of db.lectures) {
      if (l.at - t > REMIND_BEFORE_MS || l.at < t) continue;
      let changed = false;
      for (const uid of l.bookings) {
        if (l.reminded.includes(uid)) continue;
        l.reminded.push(uid); changed = true; n++;
        notifier.send(uid, 'lecture', { title: l.title, at: l.at, who: l.speaker || '园长大讲堂', url: l.liveUrl || '' }, 'pages/live/live');
      }
      if (changed) saveDb();
    }
    return n;
  }

  return {
  routes: {
  // 全部场次，按时间：upcoming（含正在直播）与 done（回放）。没登录也能看。
  'GET /api/lectures': async (req, res) => {
    const user = readSession(req);
    const list = db.lectures.map(l => pub(l, user));
    const upcoming = list.filter(l => l.phase !== 'done').sort((a, b) => a.at - b.at);
    const done = list.filter(l => l.phase === 'done').sort((a, b) => b.at - a.at);
    json(res, 200, { upcoming, done, canEdit: !!user && isAdmin(user), remindBefore: REMIND_BEFORE_MS / 60000 });
  },
  // 排一场或改：{ id?, title, desc?, who?, speaker?, at, minutes?, liveUrl?, replayUrl?, slides?:{url}|{file:{hash,name,type,size}}|null, notes? }
  'POST /api/lectures': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let l = id ? find(id) : null;
    if (id && !l) return json(res, 404, { error: 'no such lecture' });
    const title = str(body.title, 120);
    if (!title) return json(res, 400, { error: 'title required', code: 'title' });
    const at = Number(body.at);
    if (!Number.isFinite(at) || at < 946684800000) return json(res, 400, { error: 'at must be a timestamp (ms)', code: 'at' });
    const minutes = Math.min(600, Math.max(10, Number(body.minutes) || 60));
    const liveUrl = str(body.liveUrl, 1000), replayUrl = str(body.replayUrl, 1000);
    if ((liveUrl && !URL_OK.test(liveUrl)) || (replayUrl && !URL_OK.test(replayUrl))) return json(res, 400, { error: 'url must start with http(s)://', code: 'url' });
    let slides = body.slides === undefined ? (l ? l.slides : null) : null;
    if (body.slides && body.slides.url) {
      const u = str(body.slides.url, 1000);
      if (!URL_OK.test(u)) return json(res, 400, { error: 'slides url must start with http(s)://', code: 'url' });
      slides = { url: u };
    } else if (body.slides && body.slides.file && HASH.test(String(body.slides.file.hash || ''))) {
      const f = body.slides.file, owner = l?.slides?.file?.hash === f.hash ? l.slides.file.owner : user.id;
      if (!MEDIA.file(owner, f.hash)) return json(res, 400, { error: 'upload the file first', code: 'file' });
      slides = { file: { hash: f.hash, name: str(f.name, 120), type: str(f.type, 60), size: Number(f.size) || 0, owner } };
    }
    const ids = (k, pool) => (Array.isArray(body[k]) ? body[k] : (l ? l[k] : [])).map(x => str(String(x || ''), 40)).filter(id => pool.some(p => p.id === id)).slice(0, 20);
    const fields = { title, desc: str(body.desc, 2000), who: str(body.who, 60), speaker: str(body.speaker, 60), at, minutes, liveUrl: liveUrl || null, replayUrl: replayUrl || null, slides, notes: str(body.notes, 4000),
      caseIds: ids('caseIds', (db.cases || []).filter(c => c.status === 'approved')), titleIds: ids('titleIds', db.titles || []), updatedAt: now() };
    if (l) {
      // 改了开播时间就重新提醒
      if (l.at !== at) l.reminded = [];
      Object.assign(l, fields);
    } else {
      l = { id: crypto.randomBytes(9).toString('base64url'), ...fields, by: user.id, byName: user.name, createdAt: now(), bookings: [], reminded: [] };
      db.lectures.push(l);
    }
    saveDb();
    audit(req, id ? 'lecture.edit' : 'lecture.new', { user, msg: l.id });
    json(res, 200, { lecture: pub(l, user) });
  },
  // 讲堂包草稿：{ id, script }。规则从讲稿切出预习卡、切片、海报，接了模型只改措辞；存成这场的 pack，管理员再改定。
  'POST /api/lectures/pack/draft': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const l = find(str(body.id, 40));
    if (!l) return json(res, 404, { error: 'no such lecture' });
    const script = str(body.script, 20000);
    if (script.length < PACK_SCRIPT_MIN) return json(res, 400, { error: `script too short (≥ ${PACK_SCRIPT_MIN} chars)`, code: 'script' });
    const draft = packDraftOf(l, script);
    if (!draft.preview.points.length) return json(res, 400, { error: 'could not split the script', code: 'script' });
    const { pack, model } = await polishPack(draft, l, script);
    l.pack = { ...pack, script, draftedAt: now(), model, updatedAt: now() }; l.updatedAt = now(); saveDb();
    audit(req, 'lecture.pack.draft', { user, msg: l.id });
    json(res, 200, { lecture: pub(l, user) });
  },
  // 讲堂包改定：{ id, pack:{ preview:{points}, clips:[{id,title,desc,start?}], poster:{headline,lines} } }。pack 传 null 删掉这场的包。
  'POST /api/lectures/pack': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const l = find(str(body.id, 40));
    if (!l) return json(res, 404, { error: 'no such lecture' });
    if (body.pack === null) { delete l.pack; l.updatedAt = now(); saveDb(); audit(req, 'lecture.pack.remove', { user, msg: l.id }); return json(res, 200, { lecture: pub(l, user) }); }
    const p = cleanPack(body.pack);
    if (!p || (!p.preview.points.length && !p.clips.length)) return json(res, 400, { error: 'pack needs preview points or clips', code: 'pack' });
    l.pack = { ...(l.pack || { script: '', draftedAt: null, model: false }), ...p, updatedAt: now() }; l.updatedAt = now(); saveDb();
    audit(req, 'lecture.pack.save', { user, msg: l.id });
    json(res, 200, { lecture: pub(l, user) });
  },
  // 讲堂微课：讲完的场次的切片，给微课库「讲堂微课」一节与小程序。谁都能看。
  'GET /api/lectures/clips': async (req, res) => {
    const rows = db.lectures.filter(l => phase(l) === 'done' && l.pack?.clips?.length).sort((a, b) => b.at - a.at)
      .flatMap(l => l.pack.clips.map(c => ({ id: l.id + ':' + c.id, lectureId: l.id, lecture: l.title, speaker: l.speaker || '', at: l.at, title: c.title, desc: c.desc, start: c.start ?? null, replayUrl: l.replayUrl || null })));
    json(res, 200, { clips: rows });
  },
  'POST /api/lectures/delete': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const l = find(str(body.id, 40));
    if (!l) return json(res, 404, { error: 'no such lecture' });
    db.lectures = db.lectures.filter(x => x.id !== l.id); saveDb();
    audit(req, 'lecture.delete', { user, msg: l.id });
    json(res, 200, { ok: true });
  },
  // 预约 / 取消：{ id, on }。只能预约还没结束的场次。
  // 分享者候选（管理员）：入库案例被「用过，有效」多、或入库多的作者。是邀请用的工作名单，不公开、不排名
  'GET /api/lectures/sharers': async (req, res) => {
    const user = readSession(req);
    if (!user || !isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const by = new Map();
    for (const c of (db.cases || []).filter(c => c.status === 'approved' && c.by)) {
      const r = by.get(c.by) || { uid: c.by, name: c.byName, orgName: c.orgName || null, cases: 0, uses: 0, selected: 0, titles: [] };
      r.cases++; r.uses += (db.caseUses || []).filter(u => u.caseId === c.id).length; if (c.source?.selected) r.selected++;
      r.caseList = [...(r.caseList || []), { id: c.id, title: c.title, uses: (db.caseUses || []).filter(u => u.caseId === c.id).length }];
      by.set(c.by, r);
    }
    const list = [...by.values()].filter(r => r.uses >= SHARER_USES_MIN || r.cases >= SHARER_CASES_MIN || r.selected).map(r => ({ ...r, caseList: r.caseList.sort((a, b) => b.uses - a.uses).slice(0, 5), sharer: (db.titles || []).some(t => t.uid === r.uid && t.title === 'sharer'), invited: db.lectures.filter(l => (l.sharers || []).some(s => s.uid === r.uid)).map(l => l.title) }))
      .sort((a, b) => b.uses - a.uses || b.cases - a.cases);
    json(res, 200, { candidates: list, usesMin: SHARER_USES_MIN, casesMin: SHARER_CASES_MIN });
  },
  // 邀请上讲堂：{ id(场次), uid, caseId? }。记为这场的分享者，案例进这场展示，授「年度分享者」称号（已有的不重复）
  'POST /api/lectures/invite': async (req, res) => {
    const user = readSession(req);
    if (!user || !isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const l = find(str(body.id, 40));
    if (!l) return json(res, 404, { error: 'no such lecture' });
    const t = db.users.find(u => u.id === str(body.uid, 40) && !u.disabled);
    if (!t) return json(res, 404, { error: 'no such person' });
    const caseId = str(body.caseId, 40) || null;
    const c = caseId ? (db.cases || []).find(x => x.id === caseId && x.status === 'approved' && x.by === t.id) : null;
    if (caseId && !c) return json(res, 400, { error: 'pick one of their approved cases', code: 'case' });
    l.sharers = l.sharers || [];
    if (!l.sharers.some(s => s.uid === t.id)) l.sharers.push({ uid: t.id, name: t.name, orgName: t.academy?.org?.name || null, caseId, at: now() });
    if (c) { l.caseIds = l.caseIds || []; if (!l.caseIds.includes(c.id)) l.caseIds.push(c.id); }
    db.titles = db.titles || [];
    let title = db.titles.find(x => x.uid === t.id && x.title === 'sharer');
    if (!title) { title = { id: crypto.randomBytes(9).toString('base64url'), uid: t.id, name: t.name, org: orgKeyOf(t), title: 'sharer', label: TITLES.sharer, reason: `园长大讲堂分享：${l.title}`, by: user.id, byName: user.name, at: now() }; db.titles.push(title); }
    l.titleIds = l.titleIds || []; if (!l.titleIds.includes(title.id)) l.titleIds.push(title.id);
    l.updatedAt = now(); saveDb();
    audit(req, 'lecture.invite', { user, msg: `${l.id} ${t.id}` });
    json(res, 200, { lecture: pub(l, user) });
  },
  'POST /api/lectures/book': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const l = find(str(body.id, 40));
    if (!l) return json(res, 404, { error: 'no such lecture' });
    if (phase(l) === 'done') return json(res, 400, { error: 'this lecture is over; watch the replay', code: 'over' });
    const on = body.on !== false;
    l.bookings = l.bookings.filter(x => x !== user.id); l.reminded = l.reminded.filter(x => x !== user.id);
    if (on) l.bookings.push(user.id);
    saveDb();
    audit(req, on ? 'lecture.book' : 'lecture.unbook', { user, msg: l.id });
    json(res, 200, { lecture: pub(l, user), remind: on && !!notifier && notifier.remaining(user.id).lecture > 0 });
  },
  // 讲义文件：谁都能读
  'GET /api/lectures/file': async (req, res) => {
    const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
    const l = find(id);
    if (!l || !l.slides?.file) return json(res, 404, { error: 'not found' });
    const f = MEDIA.file(l.slides.file.owner, l.slides.file.hash);
    if (!f) return json(res, 404, { error: 'media-missing' });
    await sendMediaFile(res, f, l.slides.file.hash);
  }
  },
  tick
  };
}
