#!/usr/bin/env node
/* 教研工坊 → 幼师学坊 分享联调（docs/WORKSHOP-TODO.md 第 1–8 条；契约 docs/WORKSHOP-SHARE.md）。
 *
 * 给工坊服务端的同学用：拿一枚教师的投稿令牌，对着学坊测试环境把「令牌自检 → 四栏表词表 → 字段错误各答什么 → 提交 → 署名一句 → 重交同一个 id → 查状态」跑一遍，
 * 每步打印请求、应答与判定，最后一行 PASS / FAIL。交上去的是测试课，园长不同意就留在「等园长同意」，不进库。
 *
 *   ACADEMY_URL=https://xueshe.example.cn ACADEMY_TOKEN=cla_… node scripts/workshop-share-check.mjs
 *   ACADEMY_URL=http://127.0.0.1:3000 node scripts/workshop-share-check.mjs --dev 联调老师   # 本机开发桩：建账号、建投稿令牌再跑
 *   加 --readonly-token cla_… 另验一枚只读令牌该被怎么拒 */

const args = process.argv.slice(2);
const flag = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BASE = (process.env.ACADEMY_URL || '').replace(/\/+$/, '');
if (!BASE) { console.error('需要环境变量 ACADEMY_URL'); process.exit(2); }

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? '✔' : '✘'} ${name}${detail ? '  ' + detail : ''}`); };
const call = async (method, path, body, headers = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch { /* 非 JSON */ }
  console.log(`  ${method} ${path}${body ? ' ' + JSON.stringify(body).slice(0, 160) : ''}\n  → ${r.status} ${JSON.stringify(json)?.slice(0, 300)}`);
  return { status: r.status, json };
};

let TOKEN = process.env.ACADEMY_TOKEN || '';
if (!TOKEN && flag('--dev')) {
  const t = (await call('POST', '/api/login/dev', { name: flag('--dev'), role: 'teacher', org: '联调幼儿园' })).json;
  const made = await call('POST', '/api/me/tokens', { label: '教研工坊', scope: 'submit' }, { Authorization: 'Bearer ' + t.token });
  TOKEN = made.json?.token || '';
}
if (!TOKEN) { console.error('给环境变量 ACADEMY_TOKEN（教师的投稿令牌，cla_ 开头），或本机开发桩用 --dev <姓名>'); process.exit(2); }
const tok = { Authorization: 'Bearer ' + TOKEN };
const stamp = Date.now().toString(36);

console.log(`\n学坊 ${BASE}\n`);

// 1. 令牌自检（第 1 条）：是谁的、是不是投稿令牌
let r = await call('GET', '/api/me/token', null, tok);
check('1 令牌自检 200，ok:true，scope submit，带 user.name / orgName', r.status === 200 && r.json?.ok === true && r.json.scope === 'submit' && typeof r.json.user?.name === 'string', r.json ? `${r.json.user?.name}（${r.json.user?.orgName}）· 标签「${r.json.label}」` : '');
if (r.status === 401) console.log('  令牌无效或已撤：请教师到学坊「设置 → 接口令牌」重建一枚投稿令牌');
if (r.status === 200 && r.json.ok === false) console.log('  这是只读令牌，不能投稿：' + r.json.hint);
const teacher = r.json?.user || {};
if (flag('--readonly-token')) {
  const ro = { Authorization: 'Bearer ' + flag('--readonly-token') };
  const a = await call('GET', '/api/me/token', null, ro); check('1b 只读令牌自检 ok:false，带 hint', a.status === 200 && a.json?.ok === false && !!a.json.hint);
  const b = await call('POST', '/api/works', { title: 'x', pipeline: 'theme' }, ro); check('1c 只读令牌投稿答 403 readonly', b.status === 403 && b.json?.code === 'readonly');
}

// 2. 四栏表词表与上限（第 3 条）
r = await call('GET', '/api/works/options', null, tok);
check('2 词表 200：pipelines / domains / ages / filesScopes / limits / changesHints', r.status === 200 && r.json?.pipelines?.theme && r.json.domains?.lang && Array.isArray(r.json.ages) && r.json.filesScopes?.all && r.json.limits?.summaryMin === 50 && r.json.changesHints?.length === 3, r.json ? `summary ≥ ${r.json.limits.summaryMin} · changes ${r.json.limits.changesMin}–${r.json.limits.changesMax} 条 · files ≤ ${r.json.limits.files}` : '');
const OPT = r.json || {};

// 3. 字段错误各答什么（第 7 条）
const summary = '从体测发现本班下肢力量薄弱出发，三周主题，户外以跨跳、攀爬为主，室内配儿歌与绘本，每周一次家园同做，三周后多数孩子能连续跨跳三格。';
const WORK = { title: `联调 ${stamp}：下肢力量`, pipeline: 'theme', age: '小班', weeks: 3, domains: ['health', 'lang'], summary, changes: ['把跨跳垫换成地面画格，因为小班怕高'],
  files: [{ name: '主题网络图.docx', url: 'https://example.invalid/课程/' + stamp + '/网络图.docx' }], source: { courseId: 'cj-' + stamp, url: 'https://example.invalid/teaching-workshop/x?id=' + stamp }, allowAdapt: true, filesScope: 'all' };
r = await call('POST', '/api/works', { ...WORK, changes: [] }, tok); check('3a changes 空答 400 changes（回第四栏）', r.status === 400 && r.json?.code === 'changes');
r = await call('POST', '/api/works', { ...WORK, summary: '太短' }, tok); check('3b summary 不到 50 字答 400 summary（回第二栏）', r.status === 400 && r.json?.code === 'summary');
r = await call('POST', '/api/works', { ...WORK, pipeline: 'nope' }, tok); check('3c pipeline 不认识答 400 pipeline', r.status === 400 && r.json?.code === 'pipeline');
r = await call('POST', '/api/works', { ...WORK, domains: [] }, tok); check('3d domains 空答 400 domains', r.status === 400 && r.json?.code === 'domains');
r = await call('POST', '/api/me/tokens', { label: 'x' }, tok); check('3e 投稿令牌调别的写接口答 403 scope', r.status === 403 && r.json?.code === 'scope');
r = await call('GET', '/api/me/token', null, { Authorization: 'Bearer cla_nope.nope' }); check('3f 无效令牌答 401', r.status === 401);

// 4. 提交（第 5 条）：应答带 work、url、next；署名是教师本人；source 记令牌标签与课程 id
r = await call('POST', '/api/works', WORK, tok);
check('4 提交 200：work.id、url /works?tab=mine&id=…、next', r.status === 200 && !!r.json?.work?.id && r.json.url === '/works?tab=mine&id=' + r.json.work.id && !!r.json.next, r.json?.next);
const W = r.json?.work || {};
check('4b 署名是教师本人，source.kind token、via 是令牌标签、courseId 带上了', W.byName === teacher.name && W.source?.kind === 'token' && !!W.source?.via && W.source?.courseId === WORK.source.courseId, `${W.byName} · via ${W.source?.via}`);
check('4c 不带的东西确实没有：应答里没有评分、送审次数、审核意见字段', W.id && !('score' in W) && !('reviews' in W) && !('submitCount' in W));
check('4d 状态 consent（等园长同意）或 pending（园长自己交）', ['consent', 'pending'].includes(W.status), W.status);
const bad = await call('POST', '/api/works', { ...WORK, title: `链接测试 ${stamp}`, changes: ['x'.repeat(10)], files: [{ name: 'a', url: 'http://not-https/x' }] }, tok);
check('4e 非 https 文件链接被丢掉（不报错，files 为空）', bad.status === 200 && bad.json?.work?.files?.length === 0);

// 5. 署名一句（第 6 条）：只带 id 与 message
r = await call('POST', '/api/works/message', { id: W.id, message: '中班也能用，把格子画小一点' }, tok);
check('5 署名一句 200，work.message 更新', r.status === 200 && r.json?.work?.message === '中班也能用，把格子画小一点');
r = await call('POST', '/api/works/message', { id: W.id, message: 'x'.repeat(100) }, tok);
check('5b 超 80 字被截到 80', r.status === 200 && r.json?.work?.message?.length === 80);

// 6. 重交同一个 id（第 5 条）：不生成第二条，字段更新
r = await call('POST', '/api/works', { ...WORK, id: W.id, title: WORK.title + '（改）' }, tok);
check('6 带 id 重交 200，同一个 id，标题更新', r.status === 200 && r.json?.work?.id === W.id && r.json.work.title === WORK.title + '（改）');

// 7. 查状态（第 5 条）：令牌可读本人的「我交的」
r = await call('GET', '/api/works/mine', null, tok);
const mine = (r.json?.works || []).filter(w => w.id === W.id);
check('7 /api/works/mine 200，这门课在里面、带 status', r.status === 200 && mine.length === 1 && !!mine[0].status, mine[0]?.status);
check('7b 只有一条（重交没生成第二条）', (r.json?.works || []).filter(w => w.title.startsWith(`联调 ${stamp}`)).length === 1);

summary_();
function summary_() {
  const bad = results.filter(x => !x.ok);
  console.log(`\n${bad.length ? 'FAIL' : 'PASS'}  ${results.length - bad.length}/${results.length}`);
  if (bad.length) { for (const b of bad) console.log('  ✘ ' + b.name); process.exit(1); }
}
