/* 每周一题：出题权、作答、同园可见且先答再看、点评与精选（academy/drills.js）。 */
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-drill-'));
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
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { Authorization: 'Bearer ' + r.json.token }; };
  return { call, login };
}
const ORG = '柳北区示例幼儿园', OTHER = '鱼峰区示例幼儿园';
const Q = '家长在群里公开质疑午睡安排，你第一条回复写什么？';
const A1 = '先在群里回一句「谢谢您提出来，我私信您细说」，然后私聊说明午睡安排的依据，再约个时间面谈。';
const A2 = '公开回复感谢，说明园里午睡时长是按《指南》来的，欢迎家长来园看一次午睡环节。';

test('drills: admin posts for everyone, director only for own org; answers are org-visible after you answer', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const dir = await login('赵园长', 'director', ORG), t1 = await login('王老师', 'nurse', ORG), t2 = await login('李美丽', 'nurse', ORG), far = await login('外园老师', 'teacher', OTHER);
  assert.equal((await call('POST', '/api/drills', { title: Q }, t1)).status, 403);
  assert.equal((await call('POST', '/api/drills', { title: '太短' }, admin)).status, 400);
  let r = await call('POST', '/api/drills', { title: Q, role: 'teacher', domain: 'comm' }, admin); assert.equal(r.status, 200);
  const all = r.json.drill.id; assert.equal(r.json.drill.scope, 'all'); assert.equal(r.json.drill.phase, 'open');
  r = await call('POST', '/api/drills', { title: '本园的题：晨检时家长说孩子昨晚发烧但今早退了，你怎么办？', scope: 'all' }, dir); assert.equal(r.status, 200);
  const own = r.json.drill.id; assert.equal(r.json.drill.scope, 'org'); // 园长出的只能是本园
  // 可见范围
  r = await call('GET', '/api/drills', null, far); assert.deepEqual(r.json.current.map(d => d.id), [all]); assert.equal(r.json.canPost, false);
  r = await call('GET', '/api/drills', null, t1); assert.equal(r.json.current.length, 2); assert.equal(r.json.current[0].mine, null);
  // 没答看不到别人的
  assert.equal((await call('POST', '/api/drills/answer', { id: all, text: '短' }, t1)).status, 400);
  r = await call('POST', '/api/drills/answer', { id: all, text: A1 }, t1); assert.equal(r.status, 200); assert.equal(r.json.drill.mine.text, A1); assert.equal(r.json.drill.answered, 1);
  r = await call('GET', '/api/drills/answers?id=' + all, null, t2); assert.equal(r.json.locked, true); assert.equal(r.json.answers.length, 0);
  r = await call('POST', '/api/drills/answer', { id: all, text: A2 }, t2); assert.equal(r.json.drill.answered, 2);
  r = await call('GET', '/api/drills/answers?id=' + all, null, t2); assert.equal(r.json.locked, false); assert.deepEqual(r.json.answers.map(a => a.mine), [true, false]); // 新的在前
  // 外园答了也只看本园的
  await call('POST', '/api/drills/answer', { id: all, text: A1 }, far);
  r = await call('GET', '/api/drills/answers?id=' + all, null, far); assert.equal(r.json.answers.length, 1); assert.equal(r.json.answers[0].mine, true);
  r = await call('GET', '/api/drills', null, far); assert.equal(r.json.current[0].answered, 1);
  // 改自己的
  r = await call('POST', '/api/drills/answer', { id: all, text: A1 + ' 补一句：面谈时带上一周的午睡记录。' }, t1); assert.ok(r.json.drill.mine.text.endsWith('记录。'));
  // 园长不用先答就能看，点评、精选；老师不能点评；不能评自己
  r = await call('GET', '/api/drills/answers?id=' + all, null, dir); assert.equal(r.json.locked, false); assert.equal(r.json.answers.length, 2); assert.ok(r.json.answers.every(a => a.canReview));
  const a2 = r.json.answers.find(a => a.name === '李美丽').id;
  assert.equal((await call('POST', '/api/drills/review', { answerId: a2, comment: '好' }, t1)).status, 403);
  assert.equal((await call('POST', '/api/drills/review', { answerId: a2, comment: '' }, dir)).status, 400);
  r = await call('POST', '/api/drills/review', { answerId: a2, comment: '公开感谢＋邀请来园看，两步都对。', featured: true }, dir); assert.equal(r.status, 200); assert.equal(r.json.answer.review.featured, true);
  r = await call('GET', '/api/drills/answers?id=' + all, null, t1); assert.equal(r.json.answers[0].id, a2); // 精选在前
  r = await call('GET', '/api/drills', null, t1); assert.equal(r.json.current.find(d => d.id === all).featured, 1);
  // 删题连作答一起删；园长删不了管理员的
  assert.equal((await call('POST', '/api/drills/delete', { id: all }, dir)).status, 403);
  assert.equal((await call('POST', '/api/drills/delete', { id: own }, dir)).status, 200);
  assert.equal((await call('POST', '/api/drills/delete', { id: all }, admin)).status, 200);
  assert.equal((await call('GET', '/api/drills', null, t1)).json.current.length, 0);
});

test('drills: closed questions move to past, future ones are only visible to posters', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营'); const t1 = await login('王老师', 'nurse', ORG);
  const r1 = await call('POST', '/api/drills', { title: Q, openAt: Date.now() - 2 * 7 * 86400000, closeAt: Date.now() - 86400000 }, admin); assert.equal(r1.json.drill.phase, 'closed');
  const r2 = await call('POST', '/api/drills', { title: '下周的题：' + Q, openAt: Date.now() + 86400000 }, admin); assert.equal(r2.json.drill.phase, 'upcoming');
  let r = await call('GET', '/api/drills', null, t1); assert.equal(r.json.current.length, 0); assert.deepEqual(r.json.past.map(d => d.id), [r1.json.drill.id]); assert.equal(r.json.upcoming.length, 0);
  r = await call('GET', '/api/drills', null, admin); assert.deepEqual(r.json.upcoming.map(d => d.id), [r2.json.drill.id]);
  assert.equal((await call('POST', '/api/drills/answer', { id: r2.json.drill.id, text: A1 }, t1)).status, 400);
  assert.equal((await call('POST', '/api/drills/answer', { id: r1.json.drill.id, text: A1 }, t1)).status, 200); // 收了题还能晚答
});
