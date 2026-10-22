/* 只读接口令牌（tokens.js）：新建一次给、能读不能写、撤了失效、不放大权限。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { tokenUserOf, PREFIX } from '../academy/tokens.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-tokens-'));
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
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { auth: { Authorization: 'Bearer ' + r.json.token }, id: r.json.user.id }; };
  call.base = base;
  return { call, login };
}

test('tokenUserOf: wrong secret, revoked token and disabled user all give null', () => {
  const db = { users: [{ id: 'u1', name: '甲' }, { id: 'u2', name: '乙', disabled: true }], apiTokens: [] };
  assert.equal(tokenUserOf(db, 'nope'), null);
  assert.equal(tokenUserOf(db, PREFIX + 'x.y'), null);
});

test('a token reads as its owner, cannot write, is listed without its secret, and dies when revoked', async t => {
  const { call, login } = await startServer(t);
  const dir = await login('赵园长', 'director', '甲园');
  const tch = await login('甲一', 'teacher', '甲园');
  const made = await call('POST', '/api/me/tokens', { label: 'Claude Desktop' }, dir.auth);
  assert.equal(made.status, 200); assert.ok(made.json.token.startsWith(PREFIX)); assert.equal(made.json.item.label, 'Claude Desktop');
  const tok = { Authorization: 'Bearer ' + made.json.token };
  const me = await call('GET', '/api/me', null, tok);
  assert.equal(me.status, 200); assert.equal(me.json.user.id, dir.id); assert.equal(me.json.token, undefined);
  assert.equal((await call('GET', '/api/org/summary', null, tok)).status, 200);
  assert.equal((await call('POST', '/api/me/tokens', { label: 'x' }, tok)).status, 403);
  assert.equal((await call('POST', '/api/admin/notices', { title: '停电', text: '周五下午平台维护' }, tok)).json.code, 'readonly');
  const list = await call('GET', '/api/me/tokens', null, dir.auth);
  assert.equal(list.json.tokens.length, 1); assert.equal(JSON.stringify(list.json).includes(made.json.token.split('.')[1]), false);
  assert.ok(list.json.tokens[0].lastUsedAt);
  // 不放大权限：教师的令牌看不了园所看板
  const tm = await call('POST', '/api/me/tokens', {}, tch.auth);
  assert.equal((await call('GET', '/api/org/summary', null, { Authorization: 'Bearer ' + tm.json.token })).status, 403);
  // 撤
  assert.equal((await call('POST', '/api/me/tokens/revoke', { id: made.json.item.id }, tch.auth)).status, 404);
  assert.equal((await call('POST', '/api/me/tokens/revoke', { id: made.json.item.id }, dir.auth)).status, 200);
  assert.equal((await call('GET', '/api/me', null, tok)).status, 401);
  // 最多 5 枚
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/me/tokens', {}, dir.auth)).status, 200);
  assert.equal((await call('POST', '/api/me/tokens', {}, dir.auth)).json.code, 'max');
});

test('a submit token can post a case and light forms as its owner, nothing else; the case carries the token label', async t => {
  const { call, login } = await startServer(t);
  const dir = await login('赵园长', 'director', '甲园');
  const made = await call('POST', '/api/me/tokens', { label: '教研工坊', scope: 'submit' }, dir.auth);
  assert.equal(made.json.item.scope, 'submit');
  const tok = { Authorization: 'Bearer ' + made.json.token };
  assert.equal((await call('GET', '/api/me', null, tok)).status, 200);
  const text = '之前午睡前孩子们总是吵，老师要喊好几遍。后来我们在入睡前加了十分钟安静角，先听一段故事。现在大部分孩子十分钟内能躺下。';
  let r = await call('POST', '/api/cases', { title: '工坊投来的安静角', domain: 'life', use: 'adapt', text }, tok);
  assert.equal(r.status, 200); assert.equal(r.json.case.byName, '赵园长'); assert.deepEqual(r.json.case.source, { kind: 'token', via: '教研工坊', tokenId: made.json.item.id }); assert.equal(r.json.case.status, 'pending');
  // 别的写不行
  assert.equal((await call('POST', '/api/admin/notices', { title: 'x', text: 'yyyy' }, tok)).json.code, 'scope');
  assert.equal((await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, tok)).json.code, 'scope');
  assert.equal((await call('POST', '/api/me/tokens', { label: 'x' }, tok)).json.code, 'scope');
  // 入库后可以用投稿令牌做轻形态
  const admin = dir; // 第一个登录的是管理员
  assert.equal((await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, admin.auth)).status, 200);
  r = await call('POST', '/api/cases/forms/draft', { caseId: r.json.case.id, kind: 'memo' }, tok); assert.equal(r.status, 200);
  r = await call('POST', '/api/cases/forms', { id: r.json.form.id, content: r.json.form.content }, tok); assert.equal(r.status, 200);
  // 只读令牌仍然一律 403
  const ro = await call('POST', '/api/me/tokens', { label: 'MCP' }, dir.auth);
  assert.equal((await call('POST', '/api/cases', { title: 'x', domain: 'life', use: 'adapt', text }, { Authorization: 'Bearer ' + ro.json.token })).json.code, 'readonly');
  const list = await call('GET', '/api/me/tokens', null, dir.auth); assert.deepEqual(list.json.submitRoutes, ['POST /api/cases', 'POST /api/cases/forms/draft', 'POST /api/cases/forms', 'POST /api/works', 'POST /api/works/draft']);
});

test('the share skill is public markdown at /skill/share-work.md and /api/skill/share-work.md, and tells the agent to use the draft route and leave changes alone', async t => {
  const { call } = await startServer(t);
  for (const p of ['/skill/share-work.md', '/api/skill/share-work.md']) {
    const r = await fetch(call.base + p);
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /^text\/markdown/);
    const md = await r.text();
    assert.ok(md.startsWith('---\nname: share-work'), 'frontmatter');
    assert.ok(md.includes('/api/works/draft'), 'draft route');
    assert.ok(md.includes('不填 `changes`'), 'no changes');
    assert.ok(md.includes('cla_'), 'token prefix');
  }
});
