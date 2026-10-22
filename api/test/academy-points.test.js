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
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', FIRST_USER_ADMIN: '1', POINTS_PER_CREDIT: '10', TOOLS_API_KEY: 'tools-secret' } });
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

test('points: ledger credits land as points automatically at the rate; tools spend idempotently with the key; admins change the rate for later events only', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营'), t1 = await login('王老师', 'nurse', '柳北区示例幼儿园');
  let r = await call('GET', '/api/me/points', null, t1.auth); assert.equal(r.json.creditsAvailable, 0); assert.equal(r.json.rate, 10);
  assert.equal((await call('POST', '/api/me/points/exchange', { credits: 1 }, t1.auth)).status, 400);
  // 园长（管理员）直接交一条案例并入库 → 王老师没有；用管理员自己的：入库 +2
  r = await call('POST', '/api/cases', { title: '心情墙', domain: 'env', use: 'adapt', text: TEXT }, t1.auth); const cid = r.json.case.id;
  await call('POST', '/api/cases/decide', { id: cid, action: 'approve' }, admin.auth);
  r = await call('GET', '/api/me/points', null, t1.auth);
  assert.equal(r.json.creditsEarned, 2); assert.equal(r.json.creditsAvailable, 0); assert.equal(r.json.points, 20); assert.equal(r.json.auto, true);
  assert.equal(r.json.history[0].kind, 'earn'); assert.equal(r.json.history[0].credits, 2); assert.ok(r.json.history[0].note.includes('心情墙'));
  assert.equal((await call('POST', '/api/me/points/exchange', { credits: 1 }, t1.auth)).status, 400);
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
  // 比例：管理员改成 5，之前记的 20 不动，之后入库的一条按 5
  assert.equal((await call('POST', '/api/admin/points/rules', { rate: 5 }, t1.auth)).status, 403);
  assert.equal((await call('POST', '/api/admin/points/rules', { rate: 0 }, admin.auth)).status, 400);
  r = await call('POST', '/api/admin/points/rules', { rate: 5 }, admin.auth); assert.equal(r.status, 200); assert.equal(r.json.rules.rate, 5);
  r = await call('POST', '/api/cases', { title: '签到墙', domain: 'env', use: 'adapt', text: TEXT }, t1.auth);
  await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, admin.auth);
  r = await call('GET', '/api/me/points', null, t1.auth); assert.equal(r.json.points, 15); assert.equal(r.json.creditsEarned, 4); assert.equal(r.json.rate, 5);
  assert.equal((await call('GET', '/api/admin/points/rules', null, admin.auth)).json.rules.envRate, 10);
});

test('interaction points: used/usedBy with per-work-per-day and daily caps, adopted answer, reviewer, camp post; idempotent per ref; admin can zero one out', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const wang = await login('王老师', 'teacher', '甲园'), dir = await login('甲园长', 'director', '甲园'), seed = await login('甲种子', 'teacher', '甲园');
  const li = await login('李老师', 'teacher', '乙园'), zhao = await login('赵老师', 'teacher', '丙园');
  const pts = async who => (await call('GET', '/api/me/points', null, who.auth)).json;
  // 案例入库（王 +2 学分 → 20 积分）
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
  assert.equal((await pts(seed)).points, 8);
  // 营帖 +1：园长办营，王入营发当天的帖
  r = await call('POST', '/api/camps', { title: '21 天观察记录练习营', intro: '每天一条', days: ['写一条事实', '写一条推断', '写一条回应'], startAt: Date.now() - 1000 }, dir.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json)); const campId = r.json.camp.id;
  assert.equal((await call('POST', '/api/camps/join', { id: campId }, wang.auth)).status, 200);
  r = await call('POST', '/api/camps/post', { id: campId, day: 0, text: '今天 A 在建构区叠了七块积木，第八块放上去倒了。' }, wang.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await pts(wang)).points, 26);
  await call('POST', '/api/camps/post', { id: campId, day: 0, text: '改一改：今天 A 在建构区叠了七块积木，第八块放上去倒了。' }, wang.auth);
  assert.equal((await pts(wang)).points, 26);
  // 管理员把 usedBy 配成 0：之后标别人不再记；看得到当前值与默认值
  r = await call('POST', '/api/admin/points/rules', { interact: { usedBy: 0 } }, admin.auth); assert.equal(r.status, 200); assert.equal(r.json.rules.interact.usedBy, 0); assert.equal(r.json.rules.rate, 10);
  assert.equal((await call('POST', '/api/admin/points/rules', { interact: { used: 101 } }, admin.auth)).status, 400);
  const zhaoBefore = (await pts(zhao)).points; assert.equal(zhaoBefore, 60 + 15, 'three cases in the library plus three used marks');
  r = await call('POST', '/api/cases', { title: '案例五', domain: 'env', use: 'adapt', text: TEXT }, wang.auth);
  await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, admin.auth);
  await call('POST', '/api/cases/used', { id: r.json.case.id, note: '用了' }, zhao.auth);
  assert.equal((await pts(zhao)).points, zhaoBefore); assert.equal((await pts(wang)).points, 26 + 20 + 5);
  r = await call('GET', '/api/admin/points/rules', null, admin.auth); assert.equal(r.json.interactDefaults.usedBy.n, 2); assert.equal(r.json.rules.interact.used, 5);
});
