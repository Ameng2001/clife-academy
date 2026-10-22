#!/usr/bin/env node
/* 教研工坊 ↔ 幼师学坊 积分扣减、钱包页与改编来源联调（docs/WORKSHOP-TODO.md 第 9、10、12–15 条；接口 docs/POINTS-DESIGN.md 第三节）。
 *
 * 给工坊服务端的同学用：对着学坊测试环境把「查余额 → 按管线扣减 → 重复调用不再扣 → 不够答 409 → 园所额度先扣 → 改编半价」跑一遍，
 * 每步打印请求、应答与判定，最后一行 PASS / FAIL。扣掉的积分只在测试账号上。
 *
 *   ACADEMY_URL=https://xueshe.example.cn TOOLS_API_KEY=… node scripts/workshop-spend-check.mjs --uid <教师 uid> [--work <学坊成果 id>]   # uid 传平台账号的 uid（统一登录）或学坊的 user.id 都行；--work 给一门入库成果验改编半价
 *   ACADEMY_URL=http://127.0.0.1:3000 TOOLS_API_KEY=… node scripts/workshop-spend-check.mjs --dev 联调老师 [--admin 赵园长]   # 本机开发桩：建账号、推 3 关攒 30 分；--admin 是本机 db 里的管理员，用来充园所额度
 *   node scripts/workshop-spend-check.mjs --price theme 3            # 只算价：主题式 3 周
 *
 * 定价：主题式 30 / 周、项目式 40 / 周、单节活动 10；改编一门入库成果 5 折（向上取整）。工坊可以自己算 n（priceOf 是参考实现），
 * 也可以只传 pipeline / weeks / adaptedFrom 让学坊算（GET /api/points/quote 报价、POST /api/points/spend 直接扣）；改编要传 adaptedFrom（学坊成果 id），学坊核过入库且允许改编才打折。
 * ref 的约定：`course:<courseId>:<stage>`，同一 ref 重复调用学坊答 duplicate:true、不再扣；一门课分阶段扣就换 stage。 */

const PRICE = { theme: { per: 'week', n: 30, name: '主题式课程' }, pbl: { per: 'week', n: 40, name: '项目式课程' }, activity: { per: 'once', n: 10, name: '单节活动' } };

/** 工坊服务端的算价参考实现：pipeline、周数、是否改编（?from= 开的课）。 */
export function priceOf(pipeline, weeks = 1, adapted = false) {
  const p = PRICE[pipeline];
  if (!p) throw new Error('pipeline must be theme | pbl | activity');
  const w = p.per === 'week' ? Math.min(20, Math.max(1, Math.floor(Number(weeks) || 1))) : 1;
  const full = p.n * w;
  return { pipeline, weeks: w, full, n: adapted ? Math.ceil(full / 2) : full, adapted, note: `${p.name}${p.per === 'week' ? ` ${w} 周` : ''}${adapted ? ' · 改编 5 折' : ''}` };
}

const args = process.argv.slice(2);
const flag = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (args.includes('--price')) {
  const i = args.indexOf('--price');
  console.log(JSON.stringify(priceOf(args[i + 1], args[i + 2], args.includes('--adapted')), null, 2));
  process.exit(0);
}

const BASE = (process.env.ACADEMY_URL || '').replace(/\/+$/, '');
const KEY = process.env.TOOLS_API_KEY || '';
if (!BASE || !KEY) { console.error('需要环境变量 ACADEMY_URL 与 TOOLS_API_KEY（学坊运维给工坊服务端的密钥）'); process.exit(2); }

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? '✔' : '✘'} ${name}${detail ? '  ' + detail : ''}`); };
const call = async (method, path, body, headers = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch { /* 非 JSON */ }
  console.log(`  ${method} ${path}${body ? ' ' + JSON.stringify(body) : ''}\n  → ${r.status} ${JSON.stringify(json)}`);
  return { status: r.status, json };
};
const tools = { Authorization: 'Bearer ' + KEY };
const stamp = Date.now().toString(36);

let uid = flag('--uid');
let sessionAuth = null;
if (!uid && flag('--dev')) {
  // 本机开发桩：按姓名建教师账号，推 3 关过关进度（过关记积分，不用管理员）；有 --admin <姓名> 且那个账号是管理员时再充 15 分园所额度给他
  const name = flag('--dev');
  const t = (await call('POST', '/api/login/dev', { name, role: 'nurse', org: '联调幼儿园' })).json;
  uid = t.user.id; sessionAuth = { Authorization: 'Bearer ' + t.token };
  const progress = Object.fromEntries([0, 1, 2].map(i => [`nurse-${i}`, { passedAt: Date.now() - i, credits: 1 }]));
  await call('PUT', '/api/data', { state: { _ts: Date.now(), role: 'nurse', progress, sessions: [], credits: { nurse: 3 } }, stamped: true, baseRev: 0 }, sessionAuth);
  if (flag('--admin')) {
    const admin = (await call('POST', '/api/login/dev', { name: flag('--admin'), role: 'director', org: '本地运营' })).json;
    const zhao = (await call('POST', '/api/login/dev', { name: '联调园长', role: 'director', org: '联调幼儿园' })).json;
    const adminAuth = { Authorization: 'Bearer ' + admin.token }, zhaoAuth = { Authorization: 'Bearer ' + zhao.token };
    const q = await call('GET', '/api/admin/quota', null, adminAuth);
    const org = (q.json?.orgs || []).find(o => o.name === '联调幼儿园');
    if (org) { await call('POST', '/api/admin/quota/topup', { org: org.org, n: 15, note: '联调 ' + stamp }, adminAuth); await call('POST', '/api/org/quota/alloc', { uid, n: 15 }, zhaoAuth); }
    else console.log('  （--admin 给的账号不是管理员，跳过园所额度）');
    // 再给第 11、12 步备一门入库且允许改编的成果：园长自己交（不用等同意），管理员入库
    if (q.status === 200 && !flag('--work')) {
      const w = await call('POST', '/api/works', { title: `联调原课 ${stamp}`, pipeline: 'theme', age: '小班', weeks: 3, domains: ['health'], source: { courseId: 'cj-orig-' + stamp },
        summary: '从体测发现本班下肢力量薄弱出发，三周主题，户外以跨跳、攀爬为主，室内配儿歌与绘本，每周一次家园同做，三周后多数孩子能连续跨跳三格。', changes: ['把跨跳垫换成地面画格，因为小班怕高'] }, zhaoAuth);
      if (w.json?.work?.id) await call('POST', '/api/works/decide', { id: w.json.work.id, action: 'approve' }, adminAuth);
    }
  }
}
if (!uid) { console.error('给 --uid <教师 uid>，或本机开发桩用 --dev <姓名>'); process.exit(2); }

console.log(`\n学坊 ${BASE} · 教师 ${uid}\n`);

// 0. 握手（待办第 12 条）：密钥对不对、学坊叫什么、uid 怎么传
let r = await call('GET', '/api/tools/ping', null, tools);
check('0 握手 /api/tools/ping 200，ok:true，认 workshop', r.status === 200 && r.json?.ok === true && r.json.tools?.workshop === '教研工坊', r.json ? `${r.json.academy?.short} · uid 认 ${r.json.uid?.accepts?.join(' / ')}` : '');
if (r.status === 404) console.log('  学坊没配 TOOLS_API_KEY，工具接口关着；先让学坊运维配上再联调');
if (r.status === 403) console.log('  密钥不对：核对 TOOLS_API_KEY 是不是学坊运维给的那一枚');

// 1. 没密钥不行
r = await call('GET', `/api/points/balance?uid=${encodeURIComponent(uid)}`);
check('1 没带 TOOLS_API_KEY 答 403', r.status === 403);

// 2. 查余额：points 个人积分、quota 园所额度、total 合计
r = await call('GET', `/api/points/balance?uid=${encodeURIComponent(uid)}`, null, tools);
check('2 查余额 200，带 points / quota / total', r.status === 200 && typeof r.json?.points === 'number' && typeof r.json?.quota === 'number' && r.json.total === r.json.points + r.json.quota, `points ${r.json?.points} quota ${r.json?.quota}`);
const start = r.json;
if (r.status !== 200) { summary(); process.exit(1); }

// 3. 按管线算价并扣：单节活动 10（最小一笔，账户穷也能过）
const p1 = priceOf('activity');
const ref1 = `course:cj-${stamp}:draft`;
r = await call('POST', '/api/points/spend', { uid, tool: 'workshop', n: p1.n, ref: ref1, note: `${p1.note} · 联调` }, tools);
const enough = start.total >= p1.n;
if (enough) {
  check('3 扣减 200，fromQuota + fromPoints = n，园所额度先扣', r.status === 200 && r.json.fromQuota + r.json.fromPoints === p1.n && r.json.fromQuota === Math.min(start.quota, p1.n), `fromQuota ${r.json?.fromQuota} fromPoints ${r.json?.fromPoints}`);
  check('3b 应答余额对得上', r.json?.points === start.points - r.json?.fromPoints && r.json?.quota === start.quota - r.json?.fromQuota);
  // 4. 同一 ref 再调：duplicate，不再扣
  const again = await call('POST', '/api/points/spend', { uid, tool: 'workshop', n: p1.n, ref: ref1, note: '重复' }, tools);
  check('4 同一 ref 重复调用 duplicate:true，余额不变', again.status === 200 && again.json.duplicate === true && again.json.points === r.json.points && again.json.quota === r.json.quota);
} else {
  check('3 账户不够 10 分：答 409 insufficient（给测试账号学几关或充园所额度后再跑）', r.status === 409 && r.json?.code === 'insufficient');
}

// 5. 超额：答 409，带当前 points / quota
const big = (await call('GET', `/api/points/balance?uid=${encodeURIComponent(uid)}`, null, tools)).json;
r = await call('POST', '/api/points/spend', { uid, tool: 'workshop', n: big.total + 1, ref: `course:cj-${stamp}:too-much`, note: '超额' }, tools);
check('5 不够答 409 insufficient，带 points / quota', r.status === 409 && r.json?.code === 'insufficient' && typeof r.json.points === 'number' && typeof r.json.quota === 'number');

// 6. 字段校验
r = await call('POST', '/api/points/spend', { uid, tool: 'word', n: 10, ref: 'x' }, tools); check('6a tool 不认识答 400 tool', r.status === 400 && r.json?.code === 'tool');
r = await call('POST', '/api/points/spend', { uid, tool: 'workshop', n: 0, ref: 'x' }, tools); check('6b n 不是正整数答 400 n', r.status === 400 && r.json?.code === 'n');
r = await call('POST', '/api/points/spend', { uid, tool: 'workshop', n: 10 }, tools); check('6c 没 ref 答 400 ref', r.status === 400 && r.json?.code === 'ref');
r = await call('POST', '/api/points/spend', { uid: 'no-such-user', tool: 'workshop', n: 10, ref: 'x' }, tools); check('6d uid 不存在答 404', r.status === 404);

// 7. 算价参考：主题式 3 周 90、项目式 4 周 160、改编半价
check('7 算价：theme 3 周 = 90', priceOf('theme', 3).n === 90);
check('7b 算价：pbl 4 周 = 160', priceOf('pbl', 4).n === 160);
check('7c 算价：改编 theme 3 周 = 45', priceOf('theme', 3, true).n === 45);

// 8. 流水：工坊钱包页用 /api/points/of 取；tool 显示「教研工坊」
r = await call('GET', `/api/points/of?uid=${encodeURIComponent(uid)}`, null, tools);
check('8 流水 200，有 tool 为「教研工坊」的一笔', r.status === 200 && Array.isArray(r.json?.history) && (!enough || r.json.history.some(h => h.kind === 'spend' && h.tool === '教研工坊')));

// 9. 钱包页整包（待办第 15 条）：两行余额、四栏小计、每笔带 group、「换教学物料」入口
const W = r.json || {};
check('9 钱包页：name、points、quota.left / used / orgName', typeof W.name === 'string' && typeof W.points === 'number' && W.quota && typeof W.quota.left === 'number' && typeof W.quota.used === 'number' && 'orgName' in W.quota, `${W.name} · 积分 ${W.points} · 园所额度 ${W.quota?.left}`);
check('9b 四栏小计 sections：learn / interact / tool / mall，各带 label、n、count', Array.isArray(W.sections) && JSON.stringify(W.sections.map(x => x.key)) === JSON.stringify(['learn', 'interact', 'tool', 'mall']) && W.sections.every(x => x.label && typeof x.n === 'number' && typeof x.count === 'number'), W.sections?.map(x => `${x.label} ${x.n}`).join(' · '));
check('9c 每笔流水带 group，工坊的扣减在 tool 栏，从园所额度扣的 sub 为 quota', (W.history || []).every(h => ['learn', 'interact', 'tool', 'mall'].includes(h.group)) && (!enough || (W.history || []).some(h => h.group === 'tool' && h.tool === '教研工坊')));
check('9d 入口链接 links.mall 指向学坊 /#/mall，带 mallHint', typeof W.links?.mall === 'string' && W.links.mall.endsWith('/#/mall') && W.mallHint === '换教学物料', W.links?.mall);
const me = await call('GET', `/api/points/balance?uid=${encodeURIComponent(uid)}`, null, tools);
check('9e 钱包页余额与 balance 接口一致（也就是教师在学坊「我的」看到的）', me.json?.points === W.points && me.json?.quota === W.quota?.left);

// 10. 报价（待办第 14 条）：学坊算的价与本地 priceOf 一致；改编要有学坊成果 id
r = await call('GET', '/api/points/quote?pipeline=theme&weeks=3', null, tools);
check('10 报价 theme 3 周 = 90，与 priceOf 一致', r.status === 200 && r.json?.n === 90 && r.json.n === priceOf('theme', 3).n && r.json.full === 90);
r = await call('GET', '/api/points/quote?pipeline=nope', null, tools); check('10b pipeline 不认识答 400 pipeline', r.status === 400 && r.json?.code === 'pipeline');
r = await call('GET', '/api/points/quote?pipeline=theme&weeks=3&adaptedFrom=no-such-work', null, tools); check('10c adaptedFrom 不是入库成果答 400 adapt', r.status === 400 && r.json?.code === 'adapt');
// 11. 改编半价：要一门入库且允许改编的成果。--work <学坊成果 id> 指定；--dev 模式下在本机 db 里找一门
let workId = flag('--work');
if (!workId && sessionAuth) { const ws = await call('GET', '/api/works', null, sessionAuth); workId = (ws.json?.works || []).find(w => w.allowAdapt !== false)?.id || null; }
if (workId) {
  r = await call('GET', `/api/points/quote?pipeline=theme&weeks=3&adaptedFrom=${encodeURIComponent(workId)}&uid=${encodeURIComponent(uid)}`, null, tools);
  check('11 改编报价：theme 3 周 90 → 45，note 写「改编自《…》 5 折」，带 enough', r.status === 200 && r.json?.n === 45 && r.json.full === 90 && /^改编自《.+》 5 折/.test(r.json.note || '') && typeof r.json.enough === 'boolean', r.json?.note);
  const refA = `course:cj-${stamp}:adapt`;
  r = await call('POST', '/api/points/spend', { uid, tool: 'workshop', pipeline: 'activity', ref: refA, adaptedFrom: workId, note: '联调' }, tools);
  const bal = (await call('GET', `/api/points/balance?uid=${encodeURIComponent(uid)}`, null, tools)).json;
  if (r.status === 200) {
    check('11b 改编扣减：传 pipeline activity + adaptedFrom，学坊算 10 → 扣 5，note 带「改编自《…》 5 折」', r.json.n === 5 && r.json.full === 10 && r.json.adapted?.id === workId && /^改编自《.+》 5 折 · 单节活动 · 联调$/.test(r.json.note), r.json.note);
    const h = (await call('GET', `/api/points/of?uid=${encodeURIComponent(uid)}`, null, tools)).json.history || [];
    check('11c 流水里这一笔 -5，note 写「改编自《…》 5 折」', h.some(x => x.kind === 'spend' && x.n === -5 && /^改编自《/.test(x.note || '')));
  } else check('11b 改编扣减：账户不够 5 分答 409（给测试账号攒点分再跑）', r.status === 409 && r.json?.code === 'insufficient', `余额 ${bal?.total}`);
  // 12. 开改编课前核对来源（待办第 9、10 条）：?from 与这门成果的 courseId 对不对得上、能不能改编、「改编自」怎么标
  r = await call('GET', `/api/tools/work?id=${encodeURIComponent(workId)}&uid=${encodeURIComponent(uid)}`, null, tools);
  check('12 核对来源 /api/tools/work 200：canAdapt、label「改编自《…》· 谁（园）」、share.adaptedFrom 是这门成果 id', r.status === 200 && r.json?.canAdapt === true && /^改编自《.+》· /.test(r.json.label || '') && r.json.share?.adaptedFrom === workId && typeof r.json.own === 'boolean', r.json?.label);
  if (r.json?.source?.courseId) {
    const bad = await call('GET', `/api/tools/work?id=${encodeURIComponent(workId)}&from=not-this-course`, null, tools);
    check('12b ?from 与成果的 courseId 不一致：canAdapt false、why course-mismatch', bad.json?.canAdapt === false && bad.json?.why === 'course-mismatch');
  } else console.log('  （这门成果没有工坊课程 id，跳过 12b）');
  check('12c 没带密钥答 403', (await call('GET', `/api/tools/work?id=${encodeURIComponent(workId)}`)).status === 403);
} else console.log('  （没有可改编的入库成果，跳过第 11、12 步：传 --work <学坊成果 id> 指定一门）');

summary();

function summary() {
  const bad = results.filter(x => !x.ok);
  console.log(`\n${bad.length ? 'FAIL' : 'PASS'}  ${results.length - bad.length}/${results.length}`);
  if (bad.length) { for (const b of bad) console.log('  ✘ ' + b.name); process.exit(1); }
}
