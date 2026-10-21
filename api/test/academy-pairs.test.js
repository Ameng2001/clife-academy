/* 带教配对：园长配对、同园限制、一人一个带教教师、带教教师只看所带的人的提交并能点评（academy/pairs.js）。 */
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-pairs-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1' } });
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

test('pairs: directors pair within their kindergarten; a mentee has one mentor; the mentor sees and reviews only the mentee', async t => {
  const { call, login } = await startServer(t);
  const zhao = await login('赵', 'director', '甲园'), wang = await login('王', 'teacher', '甲园'), xin = await login('小新', 'teacher', '甲园'), chen = await login('陈', 'care', '甲园'), li = await login('李', 'teacher', '乙园'), qian = await login('钱', 'director', '乙园');
  assert.equal((await call('GET', '/api/org/pairs', null, wang.auth)).status, 403);
  assert.equal((await call('PUT', '/api/org/pairs', { mentor: wang.id, mentee: xin.id }, wang.auth)).status, 403);
  assert.equal((await call('PUT', '/api/org/pairs', { mentor: wang.id, mentee: li.id }, zhao.auth)).json.code, 'org');
  assert.equal((await call('PUT', '/api/org/pairs', { mentor: wang.id, mentee: xin.id }, qian.auth)).json.code, 'org');
  assert.equal((await call('PUT', '/api/org/pairs', { mentor: wang.id, mentee: wang.id }, zhao.auth)).json.code, 'self');
  assert.equal((await call('PUT', '/api/org/pairs', { mentor: 'nope', mentee: xin.id }, zhao.auth)).status, 404);
  const p = await call('PUT', '/api/org/pairs', { mentor: wang.id, mentee: xin.id }, zhao.auth);
  assert.equal(p.status, 200); assert.equal(p.json.replaced, false); assert.equal(p.json.pair.mentor.name, '王'); assert.equal(p.json.pair.mentee.name, '小新');
  assert.deepEqual((await call('GET', '/api/me/pair', null, xin.auth)).json.mentor, { id: wang.id, name: '王', role: 'teacher' });
  assert.deepEqual((await call('GET', '/api/me/pair', null, wang.auth)).json.mentees.map(m => m.name), ['小新']);
  assert.equal((await call('GET', '/api/org/pairs', null, zhao.auth)).json.pairs.length, 1);
  assert.equal((await call('GET', '/api/org/pairs', null, qian.auth)).json.pairs.length, 0);
  // 带教教师的队列只有所带的人的提交
  const s1 = (await call('POST', '/api/submissions', { levelId: 'obs-0', text: '小新的记录' }, xin.auth)).json.submission;
  await call('POST', '/api/submissions', { levelId: 'obs-0', text: '陈的记录' }, chen.auth);
  const q = (await call('GET', '/api/review/queue', null, wang.auth)).json;
  assert.equal(q.scope, 'mentees'); assert.deepEqual(q.pending.map(x => x.name), ['小新']); assert.equal(q.pending[0].mentee, true);
  assert.equal((await call('GET', '/api/review/queue', null, zhao.auth)).json.pending.length, 2, '园长看全园');
  assert.equal((await call('GET', '/api/review/queue', null, chen.auth)).status, 403);
  // 带教教师能点评所带的人，不能点评别人
  const other = (await call('GET', '/api/review/queue', null, zhao.auth)).json.pending.find(x => x.name === '陈');
  assert.equal((await call('POST', '/api/submissions/review', { id: other.id, verdict: 'pass' }, wang.auth)).json.code, 'org');
  assert.equal((await call('POST', '/api/submissions/review', { id: s1.id, verdict: 'pass', scores: [5, 5, 5, 5, 5] }, wang.auth)).json.submission.status, 'pass');
  // 换带教教师：旧配对结束
  const p2 = await call('PUT', '/api/org/pairs', { mentor: chen.id, mentee: xin.id }, zhao.auth);
  assert.equal(p2.json.replaced, true);
  assert.equal((await call('GET', '/api/me/pair', null, xin.auth)).json.mentor.name, '陈');
  assert.deepEqual((await call('GET', '/api/me/pair', null, wang.auth)).json.mentees, []);
  assert.equal((await call('GET', '/api/review/queue', null, wang.auth)).status, 403, '不再带人也不是点评人');
  // 结束
  assert.equal((await call('POST', '/api/org/pairs/end', { id: p2.json.pair.id }, qian.auth)).json.code, 'org');
  assert.equal((await call('POST', '/api/org/pairs/end', { id: p2.json.pair.id }, zhao.auth)).json.ok, true);
  assert.equal((await call('GET', '/api/me/pair', null, xin.auth)).json.mentor, null);
  assert.equal((await call('GET', '/api/org/pairs', null, zhao.auth)).json.pairs.length, 0);
});
