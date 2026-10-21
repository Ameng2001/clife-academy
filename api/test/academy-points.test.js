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

test('points: credits from the ledger exchange at the rate; tools spend idempotently with the key', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营'), t1 = await login('王老师', 'nurse', '柳北区示例幼儿园');
  let r = await call('GET', '/api/me/points', null, t1.auth); assert.equal(r.json.creditsAvailable, 0); assert.equal(r.json.rate, 10);
  assert.equal((await call('POST', '/api/me/points/exchange', { credits: 1 }, t1.auth)).status, 400);
  // 园长（管理员）直接交一条案例并入库 → 王老师没有；用管理员自己的：入库 +2
  r = await call('POST', '/api/cases', { title: '心情墙', domain: 'env', use: 'adapt', text: TEXT }, t1.auth); const cid = r.json.case.id;
  await call('POST', '/api/cases/decide', { id: cid, action: 'approve' }, admin.auth);
  r = await call('GET', '/api/me/points', null, t1.auth); assert.equal(r.json.creditsAvailable, 2);
  assert.equal((await call('POST', '/api/me/points/exchange', { credits: 3 }, t1.auth)).status, 400);
  r = await call('POST', '/api/me/points/exchange', { credits: 2 }, t1.auth); assert.equal(r.status, 200); assert.equal(r.json.points, 20); assert.equal(r.json.creditsAvailable, 0);
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
});
