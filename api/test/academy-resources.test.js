/* 资源库：内置条目、搜索、权限（谁能加、谁能改）、可见范围、文件（academy/resources.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { SEED } from '../academy/resources-seed.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-res-'));
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
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { Authorization: 'Bearer ' + r.json.token }; };
  const upload = async (auth, bytes) => { const hash = crypto.createHash('sha256').update(bytes).digest('hex'); const r = await fetch(`${base}/api/media/${hash}`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'image/png' }, body: bytes }); assert.ok(r.ok); return hash; };
  const raw = (p, headers) => fetch(base + p, { headers });
  return { call, login, upload, raw };
}

test('seed: the ministry documents are there for everyone, searchable by the short names levels cite', async t => {
  const { call } = await startServer(t);
  const r = await call('GET', '/api/resources');
  assert.equal(r.json.resources.length, SEED.length); assert.equal(r.json.canAdd, false);
  assert.ok(r.json.resources.every(x => x.seed && !x.canEdit && x.url));
  assert.equal((await call('GET', '/api/resources?q=' + encodeURIComponent('《指南》'))).json.resources[0].id, 'seed:guide-3-6');
  assert.equal((await call('GET', '/api/resources?kind=policy&domain=obs')).json.resources.map(x => x.id).join(), 'seed:eval');
});

test('add, scope, edit, delete, file: who may do what', async t => {
  const { call, login, upload, raw } = await startServer(t);
  const zhao = await login('赵', 'director', '甲园'), wang = await login('王', 'teacher', '甲园'), li = await login('李', 'teacher', '乙园'), qian = await login('钱', 'director', '乙园');
  assert.equal((await call('POST', '/api/resources', { kind: 'template', title: 'x', url: 'https://a.b/c' }, wang)).json.code, 'editor');
  assert.equal((await call('POST', '/api/resources', { kind: 'template', title: '', url: 'https://a.b/c' }, zhao)).json.code, 'title');
  assert.equal((await call('POST', '/api/resources', { kind: 'template', title: 'x' }, zhao)).json.code, 'empty');
  assert.equal((await call('POST', '/api/resources', { kind: 'template', title: 'x', url: 'javascript:alert(1)' }, zhao)).json.code, 'url');
  // 园长加一条本园的
  const a = (await call('POST', '/api/resources', { kind: 'template', title: '观察记录模板（五大领域）', domain: 'obs', desc: '三种格式', url: 'https://example.com/obs.docx', scope: 'org' }, zhao)).json.resource;
  assert.equal(a.scope, 'org'); assert.equal(a.canEdit, true); assert.equal(a.byName, '赵');
  assert.ok((await call('GET', '/api/resources?kind=template', null, wang)).json.resources.some(x => x.id === a.id), '同园看得到');
  assert.ok(!(await call('GET', '/api/resources?kind=template', null, li)).json.resources.some(x => x.id === a.id), '别园看不到');
  assert.ok(!(await call('GET', '/api/resources?kind=template')).json.resources.some(x => x.id === a.id), '没登录看不到');
  // 公开的
  const b = (await call('POST', '/api/resources', { kind: 'template', title: '家长会方案模板', url: 'https://example.com/pm.docx', scope: 'public' }, zhao)).json.resource;
  assert.equal(b.scope, 'public');
  assert.ok((await call('GET', '/api/resources?kind=template')).json.resources.some(x => x.id === b.id), '公开的没登录也看得到');
  // 改：别园园长不行；本园园长行；上传者行
  assert.equal((await call('POST', '/api/resources', { id: a.id, kind: 'template', title: '改', url: a.url }, qian)).json.code, 'editor');
  assert.equal((await call('POST', '/api/resources', { id: a.id, kind: 'template', title: '观察记录模板（改）', url: a.url, scope: 'org' }, zhao)).json.resource.title, '观察记录模板（改）');
  // 点评人能加，但公开范围降为本园
  await call('PUT', '/api/org/reviewer', { uid: (await call('GET', '/api/me', null, wang)).json.user.id, reviewer: true }, zhao);
  const c = (await call('POST', '/api/resources', { kind: 'template', title: '王的模板', url: 'https://example.com/w', scope: 'public' }, wang)).json.resource;
  assert.equal(c.scope, 'org'); assert.equal(c.mine, true);
  assert.equal((await call('POST', '/api/resources/delete', { id: c.id }, li)).json.code, 'editor');
  assert.equal((await call('POST', '/api/resources/delete', { id: c.id }, wang)).json.ok, true);
  assert.equal((await call('POST', '/api/resources/delete', { id: 'seed:eval' }, zhao)).status, 404, '内置的不能删');
  // 文件：先传再引用；同园能读，别园不能
  assert.equal((await call('POST', '/api/resources', { kind: 'template', title: '区角布局图', file: { hash: '0'.repeat(64), name: 'a.png', type: 'image/png' } }, zhao)).json.code, 'file');
  const hash = await upload(zhao, PNG);
  const d = (await call('POST', '/api/resources', { kind: 'template', title: '区角布局图', domain: 'env', file: { hash, name: 'a.png', type: 'image/png', size: PNG.length }, scope: 'org' }, zhao)).json.resource;
  assert.deepEqual(d.file, { name: 'a.png', type: 'image/png', size: PNG.length });
  assert.equal((await raw(`/api/resources/file?id=${d.id}`, wang)).status, 200);
  assert.equal((await raw(`/api/resources/file?id=${d.id}`, li)).status, 404);
  assert.equal((await raw(`/api/resources/file?id=${b.id}`)).status, 404, '链接类没有文件');
});
