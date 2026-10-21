/* 大课堂的状态文档走上游 GET/PUT /api/data：没有 workouts/routines 也收；baseRev 不对 409 并带回现文档。 */
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-state-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1' }
  });
  const h = { log: '' };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  return { call };
}

const passed = at => ({ passedAt: at, credits: 1, quiz: { right: 1, of: 1 } });

test('academy state round-trips through /api/data and a stale baseRev is a 409 with the current document', async t => {
  const { call } = await startServer(t);
  const login = await call('POST', '/api/login/dev', { name: '李老师', role: 'nurse', org: '测试园' });
  const auth = { Authorization: 'Bearer ' + login.json.token };

  const empty = await call('GET', '/api/data', null, auth);
  assert.equal(empty.status, 200);
  assert.equal(empty.json.state, null);
  assert.equal(empty.json.rev, 0);

  const s1 = { _ts: 100, theme: 'auto', role: 'nurse', progress: { 'nurse-0': passed(100) }, sessions: [{ id: 'a', levelId: 'nurse-0', end: 100 }], credits: { nurse: 1 } };
  const put1 = await call('PUT', '/api/data', { state: s1, stamped: true, baseRev: 0 }, auth);
  assert.equal(put1.status, 200, JSON.stringify(put1.json));
  assert.equal(put1.json.rev, 1);
  assert.ok(put1.json.wid);

  const got = await call('GET', '/api/data', null, auth);
  assert.equal(got.json.rev, 1);
  assert.deepEqual(got.json.state.progress, s1.progress);
  assert.deepEqual(got.json.state.credits, { nurse: 1 });
  assert.equal(got.json.state.role, 'nurse');
  assert.ok(!('_unstamped' in got.json.state) && !('_prior' in got.json.state));

  const rev = await call('GET', '/api/data/rev', null, auth);
  assert.equal(rev.json.rev, 1);
  assert.equal(rev.json.wid, put1.json.wid);

  // 另一台设备从 rev 0 推：拒收，带回 rev 1 的文档
  const stale = await call('PUT', '/api/data', { state: { ...s1, progress: { 'nurse-1': passed(200) } }, stamped: true, baseRev: 0 }, auth);
  assert.equal(stale.status, 409);
  assert.equal(stale.json.rev, 1);
  assert.deepEqual(Object.keys(stale.json.state.progress), ['nurse-0']);

  // 按 rev 1 再推（客户端已合并）
  const put2 = await call('PUT', '/api/data', { state: { ...s1, _ts: 200, progress: { 'nurse-0': passed(100), 'nurse-1': passed(200) } }, stamped: true, baseRev: 1, baseWid: put1.json.wid }, auth);
  assert.equal(put2.status, 200, JSON.stringify(put2.json));
  assert.equal(put2.json.rev, 2);
  const after = await call('GET', '/api/data', null, auth);
  assert.deepEqual(Object.keys(after.json.state.progress).sort(), ['nurse-0', 'nurse-1']);
});
