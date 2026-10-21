/* GET /api/org/summary：按园所汇总、只给园长、不跨园；summarize 纯函数。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { summarize } from '../academy/org.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-org-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', STATE_CACHE_TTL_MS: '50' } });
  const h = { log: '' }; child.stdout.on('data', d => h.log += d); child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { Authorization: 'Bearer ' + r.json.token }; };
  const put = (auth, progress) => call('PUT', '/api/data', { state: { _ts: Date.now(), role: 'nurse', progress, sessions: [], credits: {} }, stamped: true, baseRev: 0 }, auth);
  return { call, login, put };
}
const passed = at => ({ passedAt: at, credits: 1, quiz: { right: 1, of: 1 } });

test('summarize: per-role counts, completion, the level most people are stuck on, no quiz scores', () => {
  const now = Date.parse('2026-11-10T00:00:00Z');
  const members = [
    { id: 'a', name: '李', academy: { role: 'nurse' } }, { id: 'b', name: '张', academy: { role: 'nurse' } },
    { id: 'c', name: '王', academy: { role: 'teacher' } }, { id: 'd', name: '赵', academy: { role: 'director' } },
    { id: 'e', name: '周', academy: { role: 'nurse' } }
  ];
  const states = {
    a: { progress: { 'nurse-0': passed(now - 86400000), 'nurse-1': passed(now - 3600000) } },
    b: { progress: { 'nurse-0': passed(now - 30 * 86400000) } },
    c: null,
    d: { progress: Object.fromEntries([0, 1, 2, 3, 4, 5].map(i => [`director-${i}`, passed(now - 10 * 86400000)])) },
    e: { progress: { 'nurse-0': passed(now - 20 * 86400000) } }
  };
  const s = summarize(members, id => states[id], now);
  const nurse = s.roles.find(r => r.role === 'nurse');
  assert.equal(nurse.members, 3); assert.equal(nurse.started, 3); assert.equal(nurse.finished, 0);
  assert.equal(nurse.avgDone, 1.3); assert.equal(nurse.total, 12); assert.equal(nurse.rate, 11);
  assert.equal(nurse.passes7d, 2);
  // 两人卡在 nurse-1、一人卡在 nurse-2：补训建议指向 nurse-1
  assert.equal(nurse.next.levelId, 'nurse-1'); assert.equal(nurse.next.count, 2); assert.ok(nurse.next.title);
  assert.equal(s.roles.find(r => r.role === 'director').finished, 1);
  assert.equal(s.roles.find(r => r.role === 'teacher').members, 1);
  assert.equal(s.passes7d, 2);
  const li = s.members.find(m => m.id === 'a');
  assert.deepEqual(Object.keys(li).sort(), ['done', 'id', 'lastAt', 'name', 'role', 'roleName', 'total']);
  assert.equal(li.done, 2); assert.equal(li.lastAt, now - 3600000);
  assert.equal(s.members.find(m => m.id === 'c').lastAt, null);
});

test('GET /api/org/summary: directors see their own org only; others get 403', async t => {
  const { call, login, put } = await startServer(t);
  const director = await login('赵园长', 'director', '甲园');
  const nurse = await login('李保健', 'nurse', '甲园');
  const other = await login('外园老师', 'nurse', '乙园');
  assert.equal((await put(nurse, { 'nurse-0': passed(Date.now()) })).status, 200);
  assert.equal((await put(other, { 'nurse-0': passed(Date.now()), 'nurse-1': passed(Date.now()) })).status, 200);
  const r = await call('GET', '/api/org/summary', null, director);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.org.name, '甲园');
  assert.equal(r.json.members_total, 2);
  assert.deepEqual(r.json.members.map(m => m.name).sort(), ['李保健', '赵园长']);
  assert.equal(r.json.roles.find(x => x.role === 'nurse').avgDone, 1, 'the other kindergarten is not counted');
  assert.equal((await call('GET', '/api/org/summary', null, nurse)).status, 403);
  assert.equal((await call('GET', '/api/org/summary')).status, 401);
});
