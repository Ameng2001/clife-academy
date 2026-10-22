/* 学分兑积分、工具扣减（academy/points.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-pts-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', FIRST_USER_ADMIN: '1', TOOLS_API_KEY: 'tools-secret' } });
  const h = { log: '' }; child.stdout.on('data', d => h.log += d); child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { auth: { Authorization: 'Bearer ' + r.json.token }, id: r.json.user.id }; };
  return { call, login };
}
const TEXT = '小班入园第二周，我们把早晨签到改成「找自己的照片贴到心情墙」。孩子进门先找照片，再选一个表情贴纸。两周后大部分孩子愿意自己走进活动室。注意：照片只给本班用。';

test('points: library events land as points at the rules; tools spend idempotently with the key; admins change a rule for later events only', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营'), t1 = await login('王老师', 'nurse', '柳北区示例幼儿园');
  let r = await call('GET', '/api/me/points', null, t1.auth); assert.equal(r.json.points, 0); assert.equal(r.json.rules.earn.case, 20); assert.equal(r.json.rules.earn.level, 10);
  assert.equal((await call('POST', '/api/me/points/exchange', { credits: 1 }, t1.auth)).status, 404, 'no credits, no exchange');
  r = await call('POST', '/api/cases', { title: '心情墙', domain: 'env', use: 'adapt', text: TEXT }, t1.auth); const cid = r.json.case.id;
  await call('POST', '/api/cases/decide', { id: cid, action: 'approve' }, admin.auth);
  r = await call('GET', '/api/me/points', null, t1.auth);
  assert.equal(r.json.points, 20); assert.equal(r.json.history[0].kind, 'earn'); assert.equal(r.json.history[0].sub, 'case'); assert.ok(r.json.history[0].note.includes('心情墙'));
  // 工具端：没密钥不行；扣减幂等；不够答 409
  const key = { Authorization: 'Bearer tools-secret' };
  assert.equal((await call('GET', '/api/points/balance?uid=' + t1.id)).status, 403);
  r = await call('GET', '/api/points/balance?uid=' + t1.id, null, key); assert.equal(r.json.points, 20);
  r = await call('POST', '/api/points/spend', { uid: t1.id, tool: 'workshop', n: 15, ref: 'ws-lesson-42', note: '生成一份活动设计' }, key); assert.equal(r.status, 200); assert.equal(r.json.points, 5);
  r = await call('POST', '/api/points/spend', { uid: t1.id, tool: 'workshop', n: 15, ref: 'ws-lesson-42' }, key); assert.equal(r.json.duplicate, true); assert.equal(r.json.points, 5);
  assert.equal((await call('POST', '/api/points/spend', { uid: t1.id, tool: 'bagel', n: 6, ref: 'b-1' }, key)).status, 409);
  assert.equal((await call('POST', '/api/points/spend', { uid: t1.id, tool: 'nope', n: 1, ref: 'x' }, key)).status, 400);
  r = await call('GET', '/api/me/points', null, t1.auth); assert.equal(r.json.points, 5); assert.equal(r.json.history.length, 2); assert.equal(r.json.history[0].tool, '教研工坊');
  r = await call('GET', '/api/points/of?uid=' + t1.id, null, admin.auth); assert.equal(r.json.points, 5);
  assert.equal((await call('GET', '/api/points/of?uid=' + t1.id, null, t1.auth)).status, 403);
  r = await call('GET', '/api/points/of?uid=' + t1.id, null, key); assert.equal(r.status, 200); assert.equal(r.json.history.length, 2);
  // 规则：管理员把案例入库改成 5，之前记的 20 不动，之后入库的一条按 5
  assert.equal((await call('POST', '/api/admin/points/rules', { earn: { case: 5 } }, t1.auth)).status, 403);
  assert.equal((await call('POST', '/api/admin/points/rules', { earn: { case: 1001 } }, admin.auth)).status, 400);
  r = await call('POST', '/api/admin/points/rules', { earn: { case: 5 } }, admin.auth); assert.equal(r.status, 200); assert.equal(r.json.rules.earn.case, 5); assert.equal(r.json.rules.earn.work, 30);
  r = await call('POST', '/api/cases', { title: '签到墙', domain: 'env', use: 'adapt', text: TEXT }, t1.auth);
  await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, admin.auth);
  r = await call('GET', '/api/me/points', null, t1.auth); assert.equal(r.json.points, 10); assert.equal(r.json.rules.earn.case, 5);
  assert.equal((await call('GET', '/api/admin/points/rules', null, admin.auth)).json.earnDefaults.case.n, 20);
});

test('learning points: passed levels settle from client progress, a finished path and its certificate land once, practice pass and camp graduation land through the ledger', async t => {
  const { call, login } = await startServer(t);
  const wang = await login('王老师', 'nurse', '甲园'), dir = await login('甲园长', 'director', '甲园'), seed = await login('甲种子', 'teacher', '甲园');
  const pts = async who => (await call('GET', '/api/me/points', null, who.auth)).json;
  // 过 2 关（客户端进度推上来）→ 20；再过到 16 关走完保健医路径 → 关 160 + 路径 50 + 岗位认证 100
  const now = Date.now(), prog = n => { const o = {}; for (let i = 0; i < n; i++) o[`nurse-${i}`] = { passedAt: now - (n - i) * 1000, credits: 1 }; return o; };
  const revs = {}; const put = async (who, progress) => { const r = await call('PUT', '/api/data', { state: { _ts: Date.now(), role: 'nurse', progress, sessions: [], credits: { nurse: Object.keys(progress).length } }, stamped: true, baseRev: revs[who.id] || 0 }, who.auth); if (r.status === 200) revs[who.id] = r.json.rev; return r; };
  let r = await put(wang, prog(2)); assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await pts(wang); assert.equal(r.points, 20); assert.equal(r.levelsPassed, 2); assert.equal(r.history[0].sub, 'level');
  assert.equal((await pts(wang)).points, 20, 'settle is idempotent');
  r = await put(wang, prog(16)); assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await pts(wang); assert.equal(r.points, 160 + 50 + 100, JSON.stringify(r.history.map(h => [h.sub, h.n])));
  assert.ok(r.history.some(h => h.sub === 'path' && h.n === 50)); assert.ok(r.history.some(h => h.sub === 'cert' && h.n === 100));
  assert.equal((await pts(wang)).points, 310, 'path and cert land once');
  // 实践关作品通过点评 +10（点评人 +3 是互动）
  await call('PUT', '/api/org/reviewer', { uid: seed.id, reviewer: true }, dir.auth);
  r = await call('POST', '/api/submissions', { levelId: 'obs-0', text: '事实：A 叠到第七块倒了。推断：他在练手眼协调。' }, wang.auth); const sid = r.json.submission.id;
  await call('POST', '/api/submissions/review', { id: sid, verdict: 'pass' }, seed.auth);
  assert.equal((await pts(wang)).points, 320); assert.equal((await pts(seed)).points, 3);
  // 结营 +20：发过帖的营员
  r = await call('POST', '/api/camps', { title: '21 天观察记录练习营', intro: '每天一条', days: ['写一条事实', '写一条推断', '写一条回应'], startAt: Date.now() - 1000 }, dir.auth); const campId = r.json.camp.id;
  await call('POST', '/api/camps/join', { id: campId }, wang.auth); await call('POST', '/api/camps/join', { id: campId }, seed.auth);
  await call('POST', '/api/camps/post', { id: campId, day: 0, text: '今天 A 在建构区叠了七块积木，第八块放上去倒了。' }, wang.auth);
  assert.equal((await pts(wang)).points, 321);
  r = await call('POST', '/api/camps/close', { id: campId, summary: '三天里大家都写出了有事实的记录，下次练推断。' }, dir.auth); assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await pts(wang)).points, 341); assert.equal((await pts(seed)).points, 3, 'no post, no graduation');
});

test('interaction points: used/usedBy with per-work-per-day and daily caps, adopted answer, reviewer, camp post; idempotent per ref; admin can zero one out', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const wang = await login('王老师', 'teacher', '甲园'), dir = await login('甲园长', 'director', '甲园'), seed = await login('甲种子', 'teacher', '甲园');
  const li = await login('李老师', 'teacher', '乙园'), zhao = await login('赵老师', 'teacher', '丙园');
  const pts = async who => (await call('GET', '/api/me/points', null, who.auth)).json;
  // 案例入库（王 +20）
  let r = await call('POST', '/api/cases', { title: '心情墙', domain: 'env', use: 'adapt', text: TEXT }, wang.auth); const cid = r.json.case.id;
  await call('POST', '/api/cases/decide', { id: cid, action: 'approve' }, admin.auth);
  assert.equal((await pts(wang)).points, 20);
  // 李标「用过」并写了一句：王 +5，李 +2；李再标同一条不重复；赵同一天再标同一条：王不再记（同一作品一天一次），赵没写一句不记 usedBy
  assert.equal((await call('POST', '/api/cases/used', { id: cid, note: '改成了中班的' }, li.auth)).status, 200);
  assert.equal((await pts(wang)).points, 25); assert.equal((await pts(li)).points, 2);
  await call('POST', '/api/cases/used', { id: cid, note: '又改了' }, li.auth);
  assert.equal((await pts(wang)).points, 25); assert.equal((await pts(li)).points, 2);
  await call('POST', '/api/cases/used', { id: cid }, zhao.auth);
  assert.equal((await pts(wang)).points, 25); assert.equal((await pts(zhao)).points, 0);
  const h = (await pts(wang)).history; assert.equal(h[0].kind, 'interact'); assert.equal(h[0].sub, 'used'); assert.ok(h[0].note.includes('李老师'));
  // usedBy 一天最多 3 次：李再标三条别的案例，只记前两条
  for (const title of ['案例二', '案例三', '案例四']) {
    r = await call('POST', '/api/cases', { title, domain: 'env', use: 'adapt', text: TEXT }, zhao.auth);
    await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, admin.auth);
    await call('POST', '/api/cases/used', { id: r.json.case.id, note: '用了' }, li.auth);
  }
  assert.equal((await pts(li)).points, 6);
  // 答疑被采纳：种子教师 +5
  await call('PUT', '/api/org/reviewer', { uid: seed.id, reviewer: true }, dir.auth);
  r = await call('POST', '/api/questions', { levelId: 'nurse-7', text: '康复结论在哪一步填？' }, wang.auth); const qid = r.json.question.id;
  r = await call('POST', '/api/questions/answer', { id: qid, text: '在「疾病登记」里填复课日期，保健医复核后生效。' }, seed.auth); const aid = r.json.question.answers[0].id;
  assert.equal((await call('POST', '/api/questions/accept', { id: qid, answerId: aid }, wang.auth)).status, 200);
  assert.equal((await pts(seed)).points, 5);
  // 点评人 +3，同一份提交只记一次
  r = await call('POST', '/api/submissions', { levelId: 'obs-0', text: '事实：A 叠到第七块倒了。推断：他在练手眼协调。' }, wang.auth); const sid = r.json.submission.id;
  assert.equal((await call('POST', '/api/submissions/review', { id: sid, verdict: 'revise', comment: '把推断和事实分开写' }, seed.auth)).status, 200);
  assert.equal((await call('POST', '/api/submissions/review', { id: sid, verdict: 'pass' }, seed.auth)).status, 200);
  assert.equal((await pts(seed)).points, 8); assert.equal((await pts(wang)).points, 35, 'practice pass +10 to the author');
  // 营帖 +1：园长办营，王入营发当天的帖
  r = await call('POST', '/api/camps', { title: '21 天观察记录练习营', intro: '每天一条', days: ['写一条事实', '写一条推断', '写一条回应'], startAt: Date.now() - 1000 }, dir.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json)); const campId = r.json.camp.id;
  assert.equal((await call('POST', '/api/camps/join', { id: campId }, wang.auth)).status, 200);
  r = await call('POST', '/api/camps/post', { id: campId, day: 0, text: '今天 A 在建构区叠了七块积木，第八块放上去倒了。' }, wang.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await pts(wang)).points, 36);
  await call('POST', '/api/camps/post', { id: campId, day: 0, text: '改一改：今天 A 在建构区叠了七块积木，第八块放上去倒了。' }, wang.auth);
  assert.equal((await pts(wang)).points, 36);
  // 管理员把 usedBy 配成 0：之后标别人不再记；看得到当前值与默认值
  r = await call('POST', '/api/admin/points/rules', { interact: { usedBy: 0 } }, admin.auth); assert.equal(r.status, 200); assert.equal(r.json.rules.interact.usedBy, 0); assert.equal(r.json.rules.earn.level, 10);
  assert.equal((await call('POST', '/api/admin/points/rules', { interact: { used: 101 } }, admin.auth)).status, 400);
  const zhaoBefore = (await pts(zhao)).points; assert.equal(zhaoBefore, 60 + 15, 'three cases in the library plus three used marks');
  r = await call('POST', '/api/cases', { title: '案例五', domain: 'env', use: 'adapt', text: TEXT }, wang.auth);
  await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, admin.auth);
  await call('POST', '/api/cases/used', { id: r.json.case.id, note: '用了' }, zhao.auth);
  assert.equal((await pts(zhao)).points, zhaoBefore); assert.equal((await pts(wang)).points, 36 + 20 + 5);
  r = await call('GET', '/api/admin/points/rules', null, admin.auth); assert.equal(r.json.interactDefaults.usedBy.n, 2); assert.equal(r.json.rules.interact.used, 5);
});

test('contribution points: the original author of an adapted case, a lecture sharer invited on stage; each once', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const wang = await login('王老师', 'teacher', '甲园'), li = await login('李老师', 'teacher', '乙园');
  const pts = async who => (await call('GET', '/api/me/points', null, who.auth)).json;
  let r = await call('POST', '/api/cases', { title: '心情墙', domain: 'env', use: 'adapt', text: TEXT }, wang.auth); const cid = r.json.case.id;
  await call('POST', '/api/cases/decide', { id: cid, action: 'approve' }, admin.auth);
  assert.equal((await pts(wang)).points, 20);
  // 李改编王的案例入库：李记 case 20，王记 adapted 20
  r = await call('POST', '/api/cases', { title: '心情墙（中班版）', domain: 'env', use: 'adapt', text: TEXT, adaptedFrom: cid, adaptNote: '照片换成名字卡' }, li.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json)); const aid = r.json.case.id;
  await call('POST', '/api/cases/decide', { id: aid, action: 'approve' }, admin.auth);
  assert.equal((await pts(li)).points, 20);
  r = await pts(wang); assert.equal(r.points, 40); assert.ok(r.history.some(h => h.sub === 'adapted' && h.n === 20 && h.note.includes('李老师')), JSON.stringify(r.history));
  // 讲堂邀上台：王记 lecture 50，再邀同一场不重复
  r = await call('POST', '/api/lectures', { title: '课程成果分享专场', at: Date.now() + 86400000, minutes: 60 }, admin.auth); assert.equal(r.status, 200, JSON.stringify(r.json)); const lid = r.json.lecture.id;
  r = await call('POST', '/api/lectures/invite', { id: lid, uid: wang.id, caseId: cid }, admin.auth); assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await pts(wang)).points, 90);
  await call('POST', '/api/lectures/invite', { id: lid, uid: wang.id }, admin.auth);
  assert.equal((await pts(wang)).points, 90);
  assert.equal((await call('GET', '/api/admin/points/rules', null, admin.auth)).json.rules.earn.lecture, 50);
});

test('quota: admin tops up a kindergarten, the director allocates and recalls, tool spends take the org quota first and then personal points; the mall never touches quota', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const zhao = await login('赵园长', 'director', '柳北区示例幼儿园'), wang = await login('王老师', 'teacher', '柳北区示例幼儿园'), other = await login('外园老师', 'teacher', '别的园');
  const key = { Authorization: 'Bearer tools-secret' };
  // 王老师先攒 20 积分（案例入库）
  let r = await call('POST', '/api/cases', { title: '心情墙', domain: 'env', use: 'adapt', text: TEXT }, wang.auth); await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, admin.auth);
  assert.equal((await call('GET', '/api/me/points', null, wang.auth)).json.points, 20);
  // 没充值：池子 0，分不出去
  r = await call('GET', '/api/org/quota', null, zhao.auth); assert.equal(r.json.pool, 0); assert.ok(r.json.members.some(m => m.id === wang.id)); assert.ok(!r.json.members.some(m => m.id === zhao.id), 'director is not in the allocation list');
  assert.equal((await call('POST', '/api/org/quota/alloc', { uid: wang.id, n: 10 }, zhao.auth)).status, 409);
  assert.equal((await call('GET', '/api/org/quota', null, wang.auth)).status, 403, 'teachers cannot see the pool');
  // 管理员充值 100；园长不能充
  const orgKey = (await call('GET', '/api/admin/quota', null, admin.auth)).json.orgs.find(o => o.name === '柳北区示例幼儿园').org;
  assert.equal((await call('POST', '/api/admin/quota/topup', { org: orgKey, n: 100, note: '合同 2026-A' }, zhao.auth)).status, 403);
  r = await call('POST', '/api/admin/quota/topup', { org: orgKey, n: 100, note: '合同 2026-A' }, admin.auth); assert.equal(r.status, 200); assert.equal(r.json.pool, 100);
  // 园长分 30 给王老师；不能分给外园、不能分给自己、不能超池子
  assert.equal((await call('POST', '/api/org/quota/alloc', { uid: other.id, n: 10 }, zhao.auth)).status, 403);
  assert.equal((await call('POST', '/api/org/quota/alloc', { uid: zhao.id, n: 10 }, zhao.auth)).status, 400);
  assert.equal((await call('POST', '/api/org/quota/alloc', { uid: wang.id, n: 101 }, zhao.auth)).status, 409);
  r = await call('POST', '/api/org/quota/alloc', { uid: wang.id, n: 30 }, zhao.auth); assert.equal(r.status, 200); assert.equal(r.json.pool, 70); assert.equal(r.json.members.find(m => m.id === wang.id).left, 30);
  r = await call('GET', '/api/me/points', null, wang.auth); assert.equal(r.json.points, 20); assert.equal(r.json.quota.left, 30);
  r = await call('GET', '/api/points/balance?uid=' + wang.id, null, key); assert.equal(r.json.quota, 30); assert.equal(r.json.total, 50);
  // 工具扣 40：先扣额度 30，再扣积分 10；重复调用不再扣
  r = await call('POST', '/api/points/spend', { uid: wang.id, tool: 'workshop', n: 40, ref: 'course-1' }, key);
  assert.equal(r.status, 200); assert.equal(r.json.fromQuota, 30); assert.equal(r.json.fromPoints, 10); assert.equal(r.json.points, 10); assert.equal(r.json.quota, 0);
  r = await call('POST', '/api/points/spend', { uid: wang.id, tool: 'workshop', n: 40, ref: 'course-1' }, key); assert.equal(r.json.duplicate, true); assert.equal(r.json.points, 10);
  // 流水里两笔都在：从额度扣的标 sub quota，从积分扣的不标；两边 tool 都显示「教研工坊」
  const hist = (await call('GET', '/api/points/of?uid=' + wang.id, null, key)).json.history.filter(h => h.kind === 'spend');
  assert.deepEqual(hist.map(h => [h.sub, h.n, h.tool]).sort(), [['quota', -30, '教研工坊'], [null, -10, '教研工坊']].sort());
  assert.equal((await call('GET', '/api/me/points', null, wang.auth)).json.history.filter(h => h.kind === 'spend').length, 2);
  // 工坊钱包页要的整包：姓名、两行余额、四栏小计、每笔的 group、入口链接
  const w = (await call('GET', '/api/points/of?uid=' + wang.id, null, key)).json;
  assert.equal(w.name, '王老师'); assert.equal(w.uid, wang.id); assert.equal(w.quota.orgName, '柳北区示例幼儿园');
  assert.deepEqual(w.sections.map(x => [x.key, x.label]), [['learn', '学与贡献'], ['interact', '互动'], ['tool', '工具扣减'], ['mall', '教学物料商城']]);
  assert.equal(w.sections.find(x => x.key === 'tool').n, -40); assert.equal(w.sections.find(x => x.key === 'tool').count, 2);
  assert.equal(w.sections.find(x => x.key === 'learn').n, 20);
  assert.ok(w.history.every(h => ['learn', 'interact', 'tool', 'mall'].includes(h.group)));
  assert.equal(w.links.mall, 'http://localhost:8080/#/mall'); assert.ok(w.links.honors.endsWith('/#/honors')); assert.equal(w.mallHint, '换教学物料');
  assert.equal(w.points, (await call('GET', '/api/me/points', null, wang.auth)).json.points, 'wallet balance equals what the teacher sees in 学坊');
  assert.equal((await call('POST', '/api/points/spend', { uid: wang.id, tool: 'workshop', n: 11, ref: 'course-2' }, key)).status, 409, 'quota 0 + points 10 < 11');
  // 再分 20，只用额度扣 5：个人积分不动；园长收回剩下的 15
  await call('POST', '/api/org/quota/alloc', { uid: wang.id, n: 20 }, zhao.auth);
  r = await call('POST', '/api/points/spend', { uid: wang.id, tool: 'observe', n: 5, ref: 'obs-1' }, key); assert.equal(r.json.fromQuota, 5); assert.equal(r.json.points, 10);
  assert.equal((await call('POST', '/api/org/quota/recall', { uid: wang.id, n: 16 }, zhao.auth)).status, 409);
  r = await call('POST', '/api/org/quota/recall', { uid: wang.id }, zhao.auth); assert.equal(r.status, 200); assert.equal(r.json.pool, 65); assert.equal(r.json.members.find(m => m.id === wang.id).left, 0); assert.equal(r.json.members.find(m => m.id === wang.id).used, 35);
  // 商城只看个人积分：额度 20 在手也换不了 25 分的物料
  await call('POST', '/api/org/quota/alloc', { uid: wang.id, n: 20 }, zhao.auth);
  r = await call('POST', '/api/mall/items', { title: '绘本', desc: '一本', points: 25, scope: 'all', deliver: 'org' }, admin.auth); assert.equal(r.status, 200);
  r = await call('POST', '/api/mall/redeem', { id: r.json.item.id }, wang.auth); assert.equal(r.status, 409, 'mall ignores org quota');
  r = await call('GET', '/api/me/points', null, wang.auth); assert.equal(r.json.points, 10); assert.equal(r.json.quota.left, 20);
});
