/* 学分台账、勋章、称号；案例「用过，有效」与从作答推荐（academy/honors.js、cases.js、drills.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { badgesOf, createLedger } from '../academy/honors.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-hon-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', FIRST_USER_ADMIN: '1' } });
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
const ORG = '柳北区示例幼儿园';
const TEXT = '小班入园第二周，我们把早晨签到改成「找自己的照片贴到心情墙」。孩子进门先找照片，再选一个表情贴纸。两周后大部分孩子愿意自己走进活动室。注意：照片只给本班用。';

test('honors: case approval and featured answer credit the author once; titles need a reason; uses are counted for the author', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const dir = await login('赵园长', 'director', ORG), t1 = await login('王老师', 'nurse', ORG), t2 = await login('李美丽', 'nurse', ORG);
  // 案例入库 +2
  let r = await call('POST', '/api/cases', { title: '心情墙', domain: 'env', use: 'adapt', text: TEXT }, t1.auth); const cid = r.json.case.id;
  await call('POST', '/api/cases/decide', { id: cid, action: 'consent' }, dir.auth);
  r = await call('POST', '/api/cases/decide', { id: cid, action: 'approve' }, admin.auth); assert.equal(r.json.case.status, 'approved');
  r = await call('GET', '/api/me/honors', null, t1.auth); assert.equal(r.json.creditsTotal, 2); assert.equal(r.json.credits[0].kind, 'case');
  assert.equal(r.json.badges.find(b => b.key === 'cases-1').on, true); assert.equal(r.json.badges.find(b => b.key === 'cases-5').progress, 1);
  // 「用过，有效」：不是自己的；作者看得到数与一句话，别人看不到
  assert.equal((await call('POST', '/api/cases/used', { id: cid, note: '我也试了' }, t1.auth)).status, 403);
  r = await call('POST', '/api/cases/used', { id: cid, note: '中班也行，贴纸换成天气' }, t2.auth); assert.equal(r.status, 200); assert.equal(r.json.case.usedByMe, true); assert.equal(r.json.case.used, undefined);
  await call('POST', '/api/cases/used', { id: cid, note: '改一句' }, t2.auth); // 一人一条
  r = await call('GET', '/api/cases/mine', null, t1.auth); assert.equal(r.json.cases[0].used, 1); assert.equal(r.json.cases[0].uses[0].note, '改一句');
  r = await call('GET', '/api/cases', null, dir.auth); assert.equal(r.json.cases[0].used, 1); // 本园园长看得到
  // 研讨作答精选 +2，只记一次
  r = await call('POST', '/api/drills', { title: '家长在群里公开质疑午睡安排，你第一条回复写什么？' }, admin.auth); const did = r.json.drill.id;
  r = await call('POST', '/api/drills/answer', { id: did, text: '先在群里回一句「谢谢您提出来，我私信您细说」，然后私聊说明依据。' }, t2.auth); const aid = r.json.drill.mine.id;
  await call('POST', '/api/drills/review', { answerId: aid, comment: '好', featured: true }, dir.auth);
  await call('POST', '/api/drills/review', { answerId: aid, comment: '再好', featured: true }, dir.auth);
  r = await call('GET', '/api/me/honors', null, t2.auth); assert.equal(r.json.creditsTotal, 2); assert.equal(r.json.badges.find(b => b.key === 'featured-1').on, true);
  // 园长从精选作答推荐进案例库：作者是作答人，直接待审核
  r = await call('POST', '/api/cases', { title: '群里质疑午睡怎么回', domain: 'comm', use: 'direct', text: TEXT, answerId: aid }, dir.auth);
  assert.equal(r.status, 200); assert.equal(r.json.case.status, 'pending'); assert.equal(r.json.case.byName, '李美丽'); assert.equal(r.json.case.source.kind, 'drill');
  assert.equal((await call('POST', '/api/cases', { title: 'x', domain: 'comm', use: 'direct', text: TEXT, answerId: aid }, t1.auth)).status, 403); // 别人的不行
  // 称号：园长授本园的人，要理由，不能授自己；署名旁带称号
  assert.equal((await call('POST', '/api/org/titles', { uid: t2.id, title: 'seed', reason: '短' }, dir.auth)).status, 400);
  assert.equal((await call('POST', '/api/org/titles', { uid: dir.id, title: 'seed', reason: '自己给自己' }, dir.auth)).status, 403);
  assert.equal((await call('POST', '/api/org/titles', { uid: t2.id, title: 'seed', reason: '老师不能授' }, t1.auth)).status, 403);
  r = await call('POST', '/api/org/titles', { uid: t2.id, title: 'seed', reason: '带了两位新教师，案例库有入库作品' }, dir.auth); assert.equal(r.status, 200); assert.equal(r.json.title.label, '种子教师'); const tid = r.json.title.id;
  r = await call('POST', '/api/org/titles', { uid: t2.id, title: 'custom', label: '环创能手', reason: '两次环创擂台入选' }, admin.auth); assert.equal(r.json.title.label, '环创能手');
  r = await call('GET', '/api/me/honors', null, t2.auth); assert.deepEqual(r.json.titles.map(x => x.label).sort(), ['环创能手', '种子教师']);
  r = await call('GET', '/api/drills/answers?id=' + did, null, dir.auth); assert.ok(r.json.answers[0].titles.includes('种子教师'));
  r = await call('GET', '/api/org/titles', null, dir.auth); assert.equal(r.json.titles.length, 2);
  // 大讲堂记录展示的案例与颁发的称号
  r = await call('POST', '/api/lectures', { title: '本月大讲堂', at: Date.now() + 86400000, caseIds: [cid, 'nope'], titleIds: [tid] }, admin.auth);
  assert.deepEqual(r.json.lecture.showcase.map(c => c.title), ['心情墙']); assert.deepEqual(r.json.lecture.honors.map(h => h.label), ['种子教师']);
  assert.equal((await call('POST', '/api/org/titles/revoke', { id: tid }, t1.auth)).status, 403);
  assert.equal((await call('POST', '/api/org/titles/revoke', { id: tid }, dir.auth)).status, 200);
  r = await call('GET', '/api/lectures'); assert.equal(r.json.upcoming[0].honors.length, 0);
});

test('honors: badges are computed from progress and records; the ledger records a (kind, ref) once', () => {
  const db = { users: [{ id: 'm', academy: { role: 'nurse' } }], cases: [], drillAnswers: [], submissions: [] };
  const prog = {}; for (let i = 0; i < 12; i++) prog[`nurse-${i}`] = { passedAt: 1000 + i };
  const stateOf = uid => (uid === 'm' ? { progress: prog } : { progress: {} });
  const pairs = { menteesOf: uid => (uid === 'u' ? ['m'] : []) };
  const b = badgesOf('u', { db, stateOf, pairs });
  assert.equal(b.find(x => x.key === 'path-nurse').on, false);
  assert.equal(b.find(x => x.key === 'mentor').on, true);
  assert.equal(badgesOf('m', { db, stateOf, pairs }).find(x => x.key === 'path-nurse').at, 1011);
  const L = createLedger(db);
  assert.equal(L.grant('u', 'case', 'c1', 2, 'x'), true); assert.equal(L.grant('u', 'case', 'c1', 2, 'x'), false); assert.equal(L.total('u'), 2);
});
