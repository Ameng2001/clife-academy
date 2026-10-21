/* 探针体检卡：平台回传、阈值与文字、近四周、连续两周推荐、新上线三项、学习项自算（academy/checkup.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { buildCard, weekOf, PROBES, PROBE_KEYS } from '../academy/checkup.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-chk-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', PLATFORM_EVENTS_KEY: 'plat-key' } });
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
const ORG = '柳北区示例幼儿园', PLAT = { Authorization: 'Bearer plat-key' };

test('checkup: platform pushes numbers, the card has statuses and texts, directors only, teachers get their role\'s recommendations', async t => {
  const { call, login } = await startServer(t);
  const dir = await login('赵园长', 'director', ORG), nurse = await login('王老师', 'nurse', ORG), far = await login('外园', 'director', '鱼峰区示例幼儿园');
  assert.equal((await call('POST', '/api/checkup', { org: { name: ORG }, probes: { disease: 5 } })).status, 403);
  assert.equal((await call('POST', '/api/checkup', { org: { name: ORG }, probes: { disease: 5 } }, dir)).status, 403);
  assert.deepEqual((await call('POST', '/api/checkup', { org: {}, probes: { disease: 5 } }, PLAT)).json.rejected, [{ i: 0, code: 'no-org' }]);
  const lastWeek = weekOf(Date.now() - 7 * 86400000);
  let r = await call('POST', '/api/checkup', { cards: [
    { org: { name: ORG }, week: lastWeek, probes: { disease: 3, devices: 0, accounts: 0.8, basics: 0.7 } },
    { org: { name: ORG }, probes: { disease: 5, tickets: 4, devices: 2, fitness: 0, morning: 1, meals: 1, accounts: 1, basics: 0.96, attendance: 0.98, sleep: 1, research: 14, bogus: 1 } }
  ] }, PLAT);
  assert.equal(r.json.accepted, 2); assert.deepEqual(r.json.rejected, [{ i: 1, code: 'unknown-probe', keys: ['bogus'], accepted: true }]);
  assert.equal((await call('GET', '/api/org/checkup', null, nurse)).status, 403);
  r = await call('GET', '/api/org/checkup', null, dir); const card = r.json.card;
  assert.equal(card.limited, true); // 刚上线：只开三项
  assert.deepEqual(card.probes.map(p => p.key), ['accounts', 'basics']); // devices 不是 early
  assert.equal((await call('GET', '/api/org/checkup', null, far)).json.card.generatedAt, null);
});

test('checkup: buildCard thresholds, four-week series, consecutive warn → recommendation, learning computed', () => {
  const now = Date.now(), w0 = weekOf(now), w1 = weekOf(now - 7 * 86400000), w2 = weekOf(now - 14 * 86400000);
  const rows = [
    { org: 'x', week: w2, probes: { disease: 0, morning: 0.6 }, at: 1 },
    { org: 'x', week: w1, probes: { disease: 3, morning: 0.8, devices: 1 }, at: 2 },
    { org: 'x', week: w0, probes: { disease: 5, tickets: 4, devices: 2, fitness: 0, morning: 1, meals: 1, accounts: 1, basics: 0.96, attendance: 0.98, sleep: 1, research: 14 }, at: 3 }
  ];
  const c = buildCard(rows, { learning: 1, firstAt: now - 30 * 86400000, now });
  assert.equal(c.limited, false); assert.equal(c.probes.length, 12); assert.equal(c.total, 12);
  const by = Object.fromEntries(c.probes.map(p => [p.key, p]));
  assert.equal(by.disease.status, 'warn'); assert.equal(by.disease.text, '5 条疾病记录未填写康复结论'); assert.deepEqual(by.disease.weeks, ['idle', 'ok', 'warn', 'warn']); assert.equal(by.disease.consecutive, true);
  assert.equal(by.disease.go.levelId, 'nurse-7'); assert.equal(by.disease.act, '推荐保健医第 8 关'); assert.equal(by.disease.go.role, 'nurse');
  assert.equal(by.devices.status, 'warn'); assert.deepEqual(by.devices.go, { local: true }); assert.equal(by.devices.act, '去报修'); assert.equal(by.devices.consecutive, true);
  assert.equal(by.fitness.status, 'idle'); assert.equal(by.morning.status, 'ok'); assert.equal(by.morning.consecutive, false);
  assert.equal(by.learning.status, 'ok'); assert.equal(by.learning.text, '各岗位路径均已开学');
  assert.deepEqual(c.sum, { ok: 8, warn: 3, idle: 1 }); // 疾病、工单、设备
  assert.deepEqual(c.recommendations.map(r => r.levelId), ['nurse-7']); // devices 走报修，不推关
  // 没回传的周不算；刚上线只开三项
  const early = buildCard(rows, { learning: null, firstAt: now - 86400000, now });
  assert.deepEqual(early.probes.map(p => p.key), ['accounts', 'basics']);
  assert.equal(PROBE_KEYS.length, 11); assert.ok(PROBES.every(p => p.computed || p.go || p.local));
});
