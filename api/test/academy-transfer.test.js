/* 发展档案随人迁移（transfer.js）：迁移包签名与核验、迁入本实例的包核得上、改一个字核不上、重复迁入 409、换园留痕。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { trimPackage, canonical, sha256, FORMAT } from '../academy/transfer.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-transfer-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', STATE_CACHE_TTL_MS: '50' } });
  const h = { log: '' }; child.stdout.on('data', d => h.log += d); child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null), disposition: r.headers.get('content-disposition') };
  };
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { h: { Authorization: 'Bearer ' + r.json.token }, id: r.json.user.id }; };
  const put = (auth, progress) => call('PUT', '/api/data', { state: { _ts: Date.now(), role: 'nurse', progress, sessions: [], credits: {} }, stamped: true, baseRev: 0 }, auth);
  return { call, login, put };
}
const passed = () => ({ passedAt: Date.now(), credits: 1, quiz: { right: 1, of: 1 } });

test('canonical sorts keys so the hash is stable; trimPackage keeps counts and titles, caps lists, drops text', () => {
  assert.equal(canonical({ b: 1, a: { d: 2, c: [3] } }), '{"a":{"c":[3],"d":2},"b":1}');
  assert.equal(sha256('x').length, 64);
  const t = trimPackage({ person: { name: '甲一', orgName: '甲园', role: 'nurse' }, portfolio: { summary: { levels: 3, minutes: 90, text: 'no' }, paths: [{ name: '保健医', done: 3, total: 16 }, { name: '园长', done: 0, total: 6 }], submissions: [{ text: '长文' }], levels: Array.from({ length: 250 }, (_, i) => ({ id: 'nurse-' + i, title: 't', passedAt: 1 })) } });
  assert.deepEqual(t.summary, { levels: 3, minutes: 90 }); assert.equal(t.paths.length, 1); assert.equal(t.levels.length, 200); assert.equal(JSON.stringify(t).includes('长文'), false);
});

test('package → verify → import on the same instance verifies; tampering fails; duplicates 409; remove', async t => {
  const { call, login, put } = await startServer(t);
  const a = await login('甲一', 'nurse', '甲园'); await put(a.h, { 'nurse-0': passed(), 'nurse-1': passed() });
  await new Promise(r => setTimeout(r, 80));
  const pk = await call('GET', '/api/me/portfolio/package', null, a.h);
  assert.equal(pk.status, 200); assert.equal(pk.json.format, FORMAT); assert.ok(pk.json.sig); assert.ok(pk.disposition.includes('attachment')); assert.equal(pk.json.portfolio.summary.levels, 2); assert.equal(pk.json.portfolio.imports, undefined);
  const { sig, ...body } = pk.json; const hash = sha256(canonical(body));
  const v = await call('GET', `/api/portfolio/verify?id=${pk.json.id}&hash=${hash}`);
  assert.equal(v.status, 200); assert.equal(v.json.valid, true); assert.equal(v.json.name, '甲*');
  assert.equal((await call('GET', `/api/portfolio/verify?id=${pk.json.id}&hash=${'0'.repeat(64)}`)).status, 404);
  // 新账号（换园、换手机号重开）迁入
  const b = await login('甲一新号', 'nurse', '乙园');
  const im = await call('POST', '/api/me/portfolio/import', { package: pk.json }, b.h);
  assert.equal(im.status, 200); assert.equal(im.json.item.verified, true); assert.equal(im.json.item.summary.levels, 2); assert.equal(im.json.item.person.orgName, '甲园'); assert.equal(im.json.item.levels, 2);
  assert.equal((await call('POST', '/api/me/portfolio/import', { package: pk.json }, b.h)).status, 409);
  const forged = { ...pk.json, portfolio: { ...pk.json.portfolio, summary: { ...pk.json.portfolio.summary, levels: 99 } }, id: pk.json.id + 'x' };
  const bad = await call('POST', '/api/me/portfolio/import', { package: forged }, b.h);
  assert.equal(bad.status, 200); assert.equal(bad.json.item.verified, false);
  assert.equal((await call('POST', '/api/me/portfolio/import', { package: { format: 'nope' } }, b.h)).json.code, 'format');
  // 迁入的只在档案里单列，不进进度
  const pf = await call('GET', '/api/me/portfolio', null, b.h);
  assert.equal(pf.json.imports.length, 2); assert.equal(pf.json.summary.levels, 0); assert.equal(pf.json.imports[0].verified, true);
  const li = await call('GET', '/api/me/portfolio/imports', null, b.h);
  assert.equal(li.json.imports.length, 2);
  assert.equal((await call('POST', '/api/me/portfolio/imports/remove', { id: forged.id }, b.h)).status, 200);
  assert.equal((await call('GET', '/api/me/portfolio/imports', null, b.h)).json.imports.length, 1);
  assert.equal((await call('POST', '/api/me/portfolio/imports/remove', { id: pk.json.id }, a.h)).status, 404);
});

test('same-instance org change leaves a history line in the portfolio', async t => {
  const { call, login } = await startServer(t);
  const a = await login('乙一', 'teacher', '甲园');
  const again = await call('POST', '/api/login/dev', { name: '乙一', role: 'teacher', org: '乙园' });
  assert.equal(again.json.user.id, a.id);
  const pf = await call('GET', '/api/me/portfolio', null, { Authorization: 'Bearer ' + again.json.token });
  assert.equal(pf.json.person.orgName, '乙园'); assert.equal(pf.json.history.length, 1); assert.equal(pf.json.history[0].orgName, '甲园'); assert.ok(pf.json.history[0].to);
});
