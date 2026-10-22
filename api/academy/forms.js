/* 轻形态（docs/ROADMAP.md 第十三节第 1 条）：入库案例是一篇篇文字，拿到班里还要自己改。三种拿来就能用的形态，从案例正文切出来：
 *   parents    家长会十分钟课件：5 页（为什么做、我们怎么做、孩子的变化、家长可以配合的、常见问题）
 *   transition 过渡环节「改前改后」对比卡：场景、改前几条、改后几条、为什么
 *   memo       《评估指南》条文记忆卡：按案例领域配 2–3 条关键指标，每条一句要义＋案例里对应的做法
 * db.caseForms: { id, caseId, kind, content, by, byName, at, updatedAt, model }
 * 谁能做：案例作者、审核人（curator）、管理员，只对已入库案例；谁能看：登录用户（与案例库同）。
 * 草稿由规则从正文切出来，只搬案例里的话；接了模型只改措辞、不改结构、不加内容。不出现幼儿姓名；改编仍要署原作者（形态挂在案例下，署名随案例）。 */
import crypto from 'node:crypto';
import * as assistant from './assistant.js';
import { systemRules } from './policy.js';
import { isCurator } from './cases.js';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const KINDS = Object.freeze({ parents: '家长会十分钟课件', transition: '过渡环节改前改后对比卡', memo: '《评估指南》条文记忆卡' });

/* 《幼儿园保育教育质量评估指南》（教基〔2022〕1 号）关键指标，按案例领域配。只写指标名与一句要义，原文请看资源库里的文件。 */
export const GUIDE = Object.freeze({
  env: [{ clause: '环境创设 · 空间设施', gist: '空间按幼儿活动需要划分，便于自主取放与游戏' }, { clause: '环境创设 · 玩具材料', gist: '材料低结构、可组合，随幼儿兴趣与季节更换' }, { clause: '教育过程 · 活动组织', gist: '以游戏为基本活动，一日安排动静交替' }],
  life: [{ clause: '保育与安全 · 生活照料', gist: '盥洗、进餐、午睡有序，尊重个体差异，不催不罚' }, { clause: '保育与安全 · 卫生保健', gist: '晨午检、消毒、传染病预防按制度落实' }, { clause: '保育与安全 · 安全防护', gist: '设施安全排查有记录，突发情况有预案' }],
  play: [{ clause: '教育过程 · 活动组织', gist: '保证每天充足的自主游戏时间，不以集体教学替代' }, { clause: '教育过程 · 师幼互动', gist: '教师观察在先，介入适度，支持幼儿自己解决问题' }, { clause: '环境创设 · 玩具材料', gist: '材料充足、可及，支持多种玩法' }],
  plan: [{ clause: '教育过程 · 活动组织', gist: '活动来自幼儿生活与兴趣，目标与过程一致' }, { clause: '办园方向 · 科学理念', gist: '不提前教授小学内容，不以知识记忆为目标' }, { clause: '教育过程 · 师幼互动', gist: '提问开放、等待回应，给幼儿表达与尝试的机会' }],
  obs: [{ clause: '教育过程 · 师幼互动', gist: '教师能理解幼儿行为背后的需要，回应及时而不替代' }, { clause: '教师队伍 · 专业发展', gist: '以观察与分析幼儿为教研常态，记录服务于调整教育' }, { clause: '办园方向 · 科学理念', gist: '评价幼儿以过程性观察为主，不排名、不贴标签' }],
  comm: [{ clause: '教育过程 · 家园共育', gist: '定期家长会与个别沟通，家长知道幼儿在园情况与教育理念' }, { clause: '教育过程 · 家园共育', gist: '家长有渠道参与园所活动并提出意见' }, { clause: '办园方向 · 科学理念', gist: '向家长宣传科学育儿，不迎合超前教育要求' }],
  reflect: [{ clause: '教师队伍 · 专业发展', gist: '园本教研围绕真实问题，教师有反思与改进的记录' }, { clause: '教师队伍 · 激励机制', gist: '专业成长有通道，评价重过程与实绩' }, { clause: '教师队伍 · 师德师风', gist: '尊重幼儿、公平对待，不体罚与变相体罚' }]
});

const firstSentence = t => { const m = /^[^。！？!?；;\n]+/.exec(t); return (m ? m[0] : t).trim(); };
const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
/** 正文切句：去掉空白，按句号问号感叹号分，太短的并到前一句。 */
export function sentencesOf(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').split(/(?<=[。！？!?；;])/).map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const s of raw) { if (out.length && s.length < 8) out[out.length - 1] += s; else out.push(s); }
  return out;
}
const pick = (sents, re, n = 3) => sents.filter(s => re.test(s)).slice(0, n);
const rest = (sents, used, n) => sents.filter(s => !used.has(s)).slice(0, n);

/** 规则草稿：只从案例正文搬句子，分到三种形态的格子里。 */
export function formDraftOf(c, kind) {
  const sents = sentencesOf(c.text), used = new Set();
  const take = (re, n) => { const r = pick(sents.filter(s => !used.has(s)), re, n); r.forEach(s => used.add(s)); return r; };
  const fill = (arr, n) => { const r = [...arr, ...rest(sents, used, Math.max(0, n - arr.length))]; r.forEach(s => used.add(s)); return r.map(s => clip(s, 80)); };
  if (kind === 'parents') {
    const why = fill(take(/因为|为了|发现|问题|原来|之前|以前|背景/, 2), 2);
    const how = fill(take(/我们|先|然后|接着|做法|步骤|每天|每周|把/, 3), 3);
    const change = fill(take(/变化|效果|现在|孩子|幼儿|开始|会了|能够|愿意/, 3), 2);
    const home = fill(take(/家长|家里|在家|配合|建议|可以/, 3), 2);
    return { title: clip(c.title, 30), slides: [
      { h: '为什么做这件事', lines: why.length ? why : ['（案例里没写，开会前补一句）'] }, { h: '我们在园里怎么做', lines: how.length ? how : ['（案例里没写，开会前补一句）'] }, { h: '孩子的变化', lines: change.length ? change : ['（案例里没写，开会前补一句）'] },
      { h: '家长在家可以配合的', lines: home.length ? home : ['在家用同样的说法与孩子聊这件事', '有变化或疑问随时和老师说'] },
      { h: '常见问题', lines: ['会不会耽误学习：这是幼儿园的本分，不是额外任务', '需要家长买东西吗：不需要', '多久能看到变化：因人而异，一般一个月'] }
    ], footer: `案例来自 ${c.byName}${c.orgName ? '（' + c.orgName + '）' : ''}${c.adaptedFrom ? '，改自 ' + c.adaptedFrom.byName + ' 的《' + c.adaptedFrom.title + '》' : ''} · 不出现幼儿姓名与正脸` };
  }
  if (kind === 'transition') {
    let before = take(/之前|以前|原来|过去|总是|常常|老是/, 3);
    const why = take(/发现|因为|原因|问题出在/, 1);
    let after = take(/现在|改成|改为|换成|变成|后来|加了|开始|效果/, 3);
    if (!before.length) before = fill([], 2); if (!after.length) after = fill([], 2);
    return { scene: clip(c.title, 24), before: before.map(s => clip(s, 80)), after: after.map(s => clip(s, 80)), why: why[0] ? clip(why[0], 120) : '', footer: `改自 ${c.byName} 的案例${c.orgName ? ' · ' + c.orgName : ''}${c.adaptedFrom ? '，再往上是 ' + c.adaptedFrom.byName + ' 的《' + c.adaptedFrom.title + '》' : ''}` };
  }
  if (kind === 'memo') {
    const g = GUIDE[c.domain] || GUIDE.obs;
    const doing = fill(take(/我们|现在|后来|每天|每周/, 3), 3);
    const cards = g.map((x, i) => ({ clause: x.clause, gist: x.gist, apply: doing[i] || doing[0] || '' }));
    return { title: clip(c.title, 30), cards, footer: '条文要义为概括，原文看资源库《幼儿园保育教育质量评估指南》' };
  }
  return null;
}

export const SYSTEM = `你在把一条幼儿园教师的入库案例改成拿来就用的轻形态（家长会课件页、过渡环节改前改后对比卡、《评估指南》条文记忆卡）。
${systemRules(['ai-drafts', 'child-data', 'child-screen', 'real-name', 'plain'])}
结构照草稿：slides 页数与标题 h 不变、每页 lines 条数不变；before/after 条数不变；cards 条数与 clause 不变，只改 gist 与 apply。只输出 JSON，不要别的。`;
export async function polishForm(draft, c, kind) {
  if (!assistant.configured()) return { content: draft, model: false };
  try {
    const text = await assistant.complete({ system: SYSTEM, prompt: `形态：${KINDS[kind]}\n案例标题：${c.title}\n正文：${String(c.text).slice(0, 5000)}\n\n草稿：${JSON.stringify(draft)}`, maxTokens: 1800 });
    const j = assistant.parseJson(text?.text || text);
    if (!j || typeof j !== 'object') return { content: draft, model: false };
    const out = cleanForm(kind, j, draft);
    return out ? { content: out, model: true } : { content: draft, model: false };
  } catch { return { content: draft, model: false }; }
}
/** 收口：按形态校验结构；传 base 时结构（页数、条数、clause）以 base 为准，只取文字。 */
export function cleanForm(kind, p, base = null) {
  if (!p || typeof p !== 'object') return null;
  const strs = (a, n, max) => (Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, n)).slice(0, max);
  if (kind === 'parents') {
    let slides = (Array.isArray(p.slides) ? p.slides : []).map(s => s && typeof s === 'object' ? { h: str(s.h, 30), lines: strs(s.lines, 120, 5) } : null).filter(s => s && s.h).slice(0, 6);
    if (base) slides = base.slides.map((b, i) => { const m = slides[i]; return m && m.lines.length === b.lines.length ? { h: b.h, lines: m.lines } : b; });
    if (!slides.length) return null;
    return { title: str(p.title, 30) || base?.title || '', slides, footer: base ? base.footer : str(p.footer, 120) };
  }
  if (kind === 'transition') {
    let before = strs(p.before, 120, 5), after = strs(p.after, 120, 5);
    if (base) { if (before.length !== base.before.length) before = base.before; if (after.length !== base.after.length) after = base.after; }
    if (!before.length && !after.length) return null;
    return { scene: str(p.scene, 24) || base?.scene || '', before, after, why: str(p.why, 200) || (base?.why ?? ''), footer: base ? base.footer : str(p.footer, 120) };
  }
  if (kind === 'memo') {
    let cards = (Array.isArray(p.cards) ? p.cards : []).map(x => x && typeof x === 'object' ? { clause: str(x.clause, 40), gist: str(x.gist, 80), apply: str(x.apply, 120) } : null).filter(x => x && x.clause).slice(0, 4);
    if (base) cards = base.cards.map((b, i) => { const m = cards[i]; return m ? { clause: b.clause, gist: m.gist || b.gist, apply: m.apply || b.apply } : b; });
    if (!cards.length) return null;
    return { title: str(p.title, 30) || base?.title || '', cards, footer: base ? base.footer : str(p.footer, 120) };
  }
  return null;
}

export function formRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin }) {
  db.caseForms = db.caseForms || [];
  const now = () => Date.now();
  const caseOf = id => (db.cases || []).find(c => c.id === id && c.status === 'approved');
  const canMake = (user, c) => !!user && (c.by === user.id || isCurator(user, isAdmin));
  const pub = (f, user, c) => ({ id: f.id, caseId: f.caseId, kind: f.kind, kindName: KINDS[f.kind], content: f.content, byName: f.byName, at: f.at, updatedAt: f.updatedAt, model: !!f.model, canEdit: canMake(user, c), case: { id: c.id, title: c.title, byName: c.byName, orgName: c.orgName, domain: c.domain } });
  return {
  // 一条案例的轻形态：{ caseId } → { forms, kinds, canMake }
  'GET /api/cases/forms': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const c = caseOf(new URL(req.url, 'http://x').searchParams.get('caseId') || '');
    if (!c) return json(res, 404, { error: 'no such case' });
    json(res, 200, { forms: db.caseForms.filter(f => f.caseId === c.id).map(f => pub(f, user, c)), kinds: KINDS, canMake: canMake(user, c) });
  },
  // 生成草稿并存：{ caseId, kind }。已有同种形态就覆盖成新草稿。
  'POST /api/cases/forms/draft': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const c = caseOf(str(body.caseId, 40));
    if (!c) return json(res, 404, { error: 'no such approved case' });
    if (!canMake(user, c)) return json(res, 403, { error: 'author, curator or admin only', code: 'who' });
    const kind = str(body.kind, 20);
    if (!KINDS[kind]) return json(res, 400, { error: 'kind must be parents | transition | memo', code: 'kind' });
    const draft = formDraftOf(c, kind);
    const { content, model } = await polishForm(draft, c, kind);
    let f = db.caseForms.find(x => x.caseId === c.id && x.kind === kind);
    if (f) Object.assign(f, { content, model, by: user.id, byName: user.name, updatedAt: now() });
    else { f = { id: crypto.randomBytes(9).toString('base64url'), caseId: c.id, kind, content, model, by: user.id, byName: user.name, at: now(), updatedAt: now() }; db.caseForms.push(f); }
    saveDb(); audit(req, 'caseform.draft', { user, msg: `${c.id} ${kind}` });
    json(res, 200, { form: pub(f, user, c) });
  },
  // 改定：{ id, content } ；{ id, remove:true } 删
  'POST /api/cases/forms': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const f = db.caseForms.find(x => x.id === str(body.id, 40));
    if (!f) return json(res, 404, { error: 'no such form' });
    const c = caseOf(f.caseId);
    if (!c) return json(res, 404, { error: 'case no longer approved' });
    if (!canMake(user, c)) return json(res, 403, { error: 'author, curator or admin only', code: 'who' });
    if (body.remove === true) { db.caseForms = db.caseForms.filter(x => x.id !== f.id); saveDb(); audit(req, 'caseform.remove', { user, msg: f.id }); return json(res, 200, { ok: true }); }
    const content = cleanForm(f.kind, body.content);
    if (!content) return json(res, 400, { error: 'content does not fit this kind', code: 'content' });
    Object.assign(f, { content, updatedAt: now() }); saveDb();
    audit(req, 'caseform.save', { user, msg: f.id });
    json(res, 200, { form: pub(f, user, c) });
  },
  // 全库的轻形态清单（登录可见）：{ kind? } → 按时间，供案例库「拿来就用」筛选
  'GET /api/cases/forms/all': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const kind = new URL(req.url, 'http://x').searchParams.get('kind') || '';
    const rows = db.caseForms.filter(f => !kind || f.kind === kind).map(f => { const c = caseOf(f.caseId); return c ? pub(f, user, c) : null; }).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
    json(res, 200, { forms: rows, kinds: KINDS });
  }
  };
}
