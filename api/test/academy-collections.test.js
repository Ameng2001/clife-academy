/* 合集：范围与权限、条目按看的人过滤、改删（academy/collections.js）。 */
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-coll-'));
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
  const login = async (name, role, org, district) => { const r = await call('POST', '/api/login/dev', { name, role, org, district }); return { Authorization: 'Bearer ' + r.json.token }; };
  return { call, login };
}
const TEXT = '之前午睡前孩子们总是吵，老师要喊好几遍。后来我们在入睡前加了十分钟安静角，先听一段故事。现在大部分孩子十分钟内能躺下。';

test('collections: scopes by role, items resolve and filter, org collection visible to the org only, edit and delete', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const dirA = await login('甲园长', 'director', '甲园', '柳北区');
  const tchA = await login('甲一', 'teacher', '甲园', '柳北区');
  const dirB = await login('乙园长', 'director', '乙园', '柳南区');
  // 一条入库案例、一条待审核案例
  let r = await call('POST', '/api/cases', { title: '安静角', domain: 'life', use: 'adapt', text: TEXT }, dirA); const ok = r.json.case.id;
  assert.equal((await call('POST', '/api/cases/decide', { id: ok, action: 'approve' }, admin)).status, 200);
  r = await call('POST', '/api/cases', { title: '还没入库', domain: 'life', use: 'adapt', text: TEXT }, dirA); const pending = r.json.case.id;
  // 教师不能建；园长只能本园
  r = await call('GET', '/api/collections', null, tchA); assert.deepEqual(r.json.scopes, []);
  r = await call('GET', '/api/collections', null, dirA); assert.deepEqual(r.json.scopes.map(s => s.key), ['org']);
  assert.equal((await call('POST', '/api/collections', { title: '午睡专题', scope: 'all', items: [{ kind: 'level', id: 'nurse-0' }] }, dirA)).json.code, 'scope');
  assert.equal((await call('POST', '/api/collections', { title: '午睡专题', scope: 'org', items: [{ kind: 'case', id: pending }] }, dirA)).json.code, 'items'); // 没入库的不算
  r = await call('POST', '/api/collections', { title: '午睡专题', desc: '从安静角到起床', scope: 'org', items: [{ kind: 'case', id: ok, note: '先看这条' }, { kind: 'level', id: 'nurse-0' }, { kind: 'level', id: 'nurse-0' }, { kind: 'resource', id: 'seed:eval' }, { kind: 'clip', id: 'nope:c1' }] }, dirA);
  assert.equal(r.status, 200); const id = r.json.collection.id;
  assert.equal(r.json.collection.scopeName, '本园'); assert.equal(r.json.collection.where, '甲园'); assert.deepEqual(r.json.collection.items.map(i => i.kind), ['case', 'level', 'resource']); assert.equal(r.json.collection.items[0].title, '安静角'); assert.equal(r.json.collection.items[1].to, '/level/nurse-0');
  // 同园教师看得到，别园园长看不到，管理员看得到
  assert.equal((await call('GET', '/api/collections', null, tchA)).json.collections.length, 1);
  assert.equal((await call('GET', '/api/collections', null, dirB)).json.collections.length, 0);
  assert.equal((await call('GET', '/api/collections?id=' + id, null, dirB)).status, 404);
  assert.equal((await call('GET', '/api/collections', null, admin)).json.collections[0].canEdit, true);
  // 管理员建全平台的，谁都看得到；教师看到的 canEdit 为假
  r = await call('POST', '/api/collections', { title: '评估指南读本', scope: 'all', items: [{ kind: 'resource', id: 'seed:eval' }] }, admin); assert.equal(r.status, 200);
  r = await call('GET', '/api/collections', null, dirB); assert.equal(r.json.collections.length, 1); assert.equal(r.json.collections[0].canEdit, false);
  // 改：教师不能，园长能；删
  assert.equal((await call('POST', '/api/collections', { id, title: '改名', items: [{ kind: 'level', id: 'nurse-1' }] }, tchA)).json.code, 'who');
  r = await call('POST', '/api/collections', { id, title: '午睡专题 2', items: [{ kind: 'level', id: 'nurse-1' }] }, dirA); assert.equal(r.json.collection.title, '午睡专题 2'); assert.equal(r.json.collection.items.length, 1);
  assert.equal((await call('POST', '/api/collections/delete', { id }, tchA)).json.code, 'who');
  assert.equal((await call('POST', '/api/collections/delete', { id }, dirA)).json.ok, true);
  assert.equal((await call('GET', '/api/collections', null, tchA)).json.collections.length, 1);
});
