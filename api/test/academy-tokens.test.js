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
