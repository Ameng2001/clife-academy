/* 区县看板：只给区县管理员；园所只有名单；中位数要 ≥ 3 园；手工挂园；summarizeDistrict 纯函数（academy/district.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { summarizeDistrict, median, MIN_ORGS } from '../academy/district.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-dist-'));
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
  const login = async (name, role, org, district) => { const r = await call('POST', '/api/login/dev', { name, role, org, district }); return { h: { Authorization: 'Bearer ' + r.json.token }, user: r.json.user }; };
  const put = (auth, progress) => call('PUT', '/api/data', { state: { _ts: Date.now(), role: 'nurse', progress, sessions: [], credits: {} }, stamped: true, baseRev: 0 }, auth);
  return { call, login, put };
}
const passed = () => ({ passedAt: Date.now(), credits: 1, quiz: { right: 1, of: 1 } });

test('district: role, no org, directors refused, org list without numbers, medians only from three orgs, manual attach', async t => {
  const { call, login, put } = await startServer(t);
  const d = await login('区县小李', 'district', '', '柳北区');
  assert.equal(d.user.academy.role, 'district'); assert.equal(d.user.academy.org, null); assert.equal(d.user.academy.district.name, '柳北区');
  const dir = await login('赵园长', 'director', '甲园', '柳北区');
  assert.equal((await call('GET', '/api/district/summary', null, dir.h)).status, 403);
  const a1 = await login('甲一', 'nurse', '甲园', '柳北区'); await put(a1.h, { 'nurse-0': passed(), 'nurse-1': passed() });
  const b1 = await login('乙一', 'nurse', '乙园', '柳北区'); await put(b1.h, { 'nurse-0': passed(), 'nurse-1': passed() });
  await login('外区', 'nurse', '丙园', '鱼峰区');
  let r = (await call('GET', '/api/district/summary', null, d.h)).json;
  assert.deepEqual(r.orgs.map(o => o.name), ['甲园', '乙园']);
  assert.equal(r.orgCount, 2); assert.equal(r.members_total, 3); assert.equal(r.medians, false);
  assert.ok(r.domains.every(x => x.median === null)); assert.equal(r.rateMedian, null);
  assert.ok(!('rate' in r.orgs[0]) && !('members' in r.orgs[0])); // 园所行没有数
  // 手工挂第三所园（它的成员没带区县）
  const c1 = await login('丁一', 'teacher', '丁园'); await put(c1.h, {});
  r = (await call('PUT', '/api/district/orgs', { orgs: [{ name: '丁园' }, {}] }, d.h)).json;
  assert.equal(r.added, 1); assert.deepEqual(r.rejected, [{ i: 1, code: 'no-org' }]);
  r = (await call('GET', '/api/district/summary', null, d.h)).json;
  assert.equal(r.orgCount, 3); assert.equal(r.medians, true); assert.equal(typeof r.rateMedian, 'number');
  // nurse-0 是平台工具关（无领域），nurse-1 属一日生活。三园覆盖率：甲 50%（甲一有、赵园长没有）、乙 100%、丁 0 → 中位 50
  const life = r.domains.find(x => x.key === 'life'); assert.equal(life.median, 50);
  r = (await call('GET', '/api/district/orgs', null, d.h)).json;
  assert.deepEqual(r.orgs.map(o => [o.name, o.via]), [['丁园', 'manual'], ['甲园', 'members'], ['乙园', 'members']]);
  assert.equal((await call('POST', '/api/district/orgs/remove', { org: 'name:甲园' }, d.h)).status, 404);
  assert.equal((await call('POST', '/api/district/orgs/remove', { org: 'name:丁园' }, d.h)).status, 200);
  assert.equal((await call('GET', '/api/district/summary', null, d.h)).json.orgCount, 2);
  // 园长看板不出现区县管理员这一组
  const org = (await call('GET', '/api/org/summary', null, dir.h)).json;
  assert.ok(!org.roles.some(x => x.role === 'district'));
});

test('summarizeDistrict: coverage per domain → median across orgs, certified counts domain paths, median()', () => {
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([1, 2, 3, 4]), 2.5); assert.equal(median([]), null);
  const u = (id, role = 'nurse') => ({ id, name: id, academy: { role, org: { id: null, name: 'x' } } });
  const states = {
    a: { progress: { 'nurse-1': passed(), 'obs-0': passed(), 'obs-1': passed() } }, // obs 走完 → 认证 1
    b: { progress: { 'nurse-1': passed() } }, c: { progress: {} }, d: { progress: { 'teacher-0': passed() } }
  };
  const orgs = [
    { key: 'A', name: 'A', members: [u('a'), u('b')] }, { key: 'B', name: 'B', members: [u('c')] }, { key: 'C', name: 'C', members: [u('d', 'teacher')] }
  ];
  const s = summarizeDistrict(orgs, id => states[id]);
  assert.equal(s.orgCount, 3); assert.equal(s.medians, true); assert.equal(s.members_total, 4); assert.equal(s.certified, 1);
  const by = Object.fromEntries(s.domains.map(x => [x.key, x.median]));
  assert.equal(by.obs, 0); // A 50%、B 0、C 0 → 中位 0
  assert.equal(by.life, 0); // nurse-1 属一日生活：A 100、B 0、C 0 → 中位 0；nurse-0 是平台工具关，不计领域
  assert.equal(summarizeDistrict(orgs.slice(0, 2), id => states[id]).medians, false);
  assert.equal(MIN_ORGS, 3);
});
