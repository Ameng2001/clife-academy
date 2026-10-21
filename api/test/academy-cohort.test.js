/* 园所间匿名中位数（cohort.js）：≥ 3 所其他园才给；只给中位数、不给别园的数；园长可看、教师不可。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { cohortOf, orgMetrics, MIN_OTHERS } from '../academy/cohort.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-cohort-'));
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
  const login = async (name, role, org, district) => { const r = await call('POST', '/api/login/dev', { name, role, org, district }); return { h: { Authorization: 'Bearer ' + r.json.token }, id: r.json.user.id }; };
  const put = (auth, progress, role = 'nurse') => call('PUT', '/api/data', { state: { _ts: Date.now(), role, progress, sessions: [], credits: {} }, stamped: true, baseRev: 0 }, auth);
  return { call, login, put };
}
const passed = () => ({ passedAt: Date.now(), credits: 1, quiz: { right: 1, of: 1 } });
const mk = (id, role, org) => ({ id, name: id, academy: { role, org: { name: org } } });

test('orgMetrics / cohortOf: medians across other orgs only from three, roles only where I have members, no other org named', () => {
  const now = Date.now();
  const st = { a1: { progress: { 'nurse-0': { passedAt: now }, 'nurse-1': { passedAt: now } } }, b1: { progress: { 'nurse-0': { passedAt: now - 40 * 86400000 } } }, c1: { progress: {} }, d1: { progress: { 'nurse-0': { passedAt: now }, 'nurse-1': { passedAt: now }, 'nurse-2': { passedAt: now }, 'nurse-3': { passedAt: now } } } };
  const stateOf = uid => st[uid] || null;
  const mine = { key: 'name:甲', name: '甲', members: [mk('a1', 'nurse', '甲')] };
  const B = { key: 'name:乙', name: '乙', members: [mk('b1', 'nurse', '乙')] }, C = { key: 'name:丙', name: '丙', members: [mk('c1', 'teacher', '丙')] }, D = { key: 'name:丁', name: '丁', members: [mk('d1', 'nurse', '丁')] };
  const m = orgMetrics(mine.members, stateOf, now);
  assert.equal(m.n, 1); assert.equal(Math.round(m.rate * 100), 13); assert.equal(m.domains.life, 1); assert.equal(m.active30, 1);
  const two = cohortOf(mine, [B, C], stateOf, now);
  assert.equal(two.enough, false); assert.equal(two.rate.median, null); assert.equal(two.rate.mine, 13);
  const three = cohortOf(mine, [B, C, D], stateOf, now);
  assert.equal(three.enough, true); assert.equal(three.others, 3);
  assert.equal(three.rate.median, 6);                   // 乙 6%、丙 0、丁 25 → 中位 6
  assert.equal(three.active30.median, 0);               // 乙 40 天前、丙没学、丁本月 → 0
  assert.deepEqual(three.roles.map(r => r.role), ['nurse']);
  assert.equal(three.roles[0].median, null);            // 只有乙、丁两所有保健医，不够 3 所
  assert.equal(three.domains.find(d => d.key === 'life').median, 0);
  assert.equal(JSON.stringify(three).includes('乙'), false); assert.equal(JSON.stringify(three).includes('丁'), false);
  assert.equal(MIN_OTHERS, 3);
});

test('GET /api/org/cohort: director only; medians appear once three other orgs exist; district row when the district has three', async t => {
  const { call, login, put } = await startServer(t);
  const dir = await login('甲园长', 'director', '甲园', '柳北区');
  const t1 = await login('甲一', 'nurse', '甲园', '柳北区'); await put(t1.h, { 'nurse-0': passed(), 'nurse-1': passed() });
  assert.equal((await call('GET', '/api/org/cohort', null, t1.h)).status, 403);
  let r = await call('GET', '/api/org/cohort', null, dir.h);
  assert.equal(r.status, 200); assert.equal(r.json.city.enough, false); assert.equal(r.json.city.rate.mine, 7);   // 园长 0/6 与保健医 2/16 按人加权 assert.equal(r.json.district.enough, false);
  for (const [o, d] of [['乙园', '柳北区'], ['丙园', '柳北区'], ['丁园', '柳南区']]) { const u = await login(o + '师', 'nurse', o, d); await put(u.h, { 'nurse-0': passed() }); }
  await new Promise(res => setTimeout(res, 80));
  r = await call('GET', '/api/org/cohort', null, dir.h);
  assert.equal(r.json.city.enough, true); assert.equal(r.json.city.others, 3); assert.equal(r.json.city.rate.median, 6);
  assert.equal(r.json.district.name, '柳北区'); assert.equal(r.json.district.enough, false); assert.equal(r.json.district.others, 2);
  assert.equal(JSON.stringify(r.json).includes('乙园'), false);
});
