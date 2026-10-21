/* 大课堂登录三条路（auth/routes.js）：真 server.js 子进程，微信与平台用本地桩顶替。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { roleOf } from '../auth/platform.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 一个桩同时扮演微信（GET /sns/jscode2session）和平台（POST /sso/verify）。
function startStub() {
  const seen = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      seen.push({ path: u.pathname, auth: req.headers.authorization || '', body });
      const out = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (u.pathname === '/sns/jscode2session') {
        const c = u.searchParams.get('js_code');
        if (c === 'good-code-1') return out(200, { openid: 'o-aaa', unionid: 'u-aaa', session_key: 'x' });
        if (c === 'good-code-2') return out(200, { openid: 'o-aaa', session_key: 'x' });
        return out(200, { errcode: 40029, errmsg: 'invalid code' });
      }
      if (u.pathname === '/sso/verify') {
        const t = JSON.parse(body || '{}').ticket;
        if (t === 'tk-director') return out(200, { uid: 'p-1', name: '王园长', org: { id: 'o-1', name: '柳北区示例幼儿园' }, role: '园长', extra: 'dropped' });
        if (t === 'tk-nurse') return out(200, { uid: 'p-2', name: '李老师', org: { id: 'o-1', name: '柳北区示例幼儿园' }, role: 'nurse' });
        return out(401, { error: 'bad ticket' });
      }
      out(404, {});
    });
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}`, seen })));
}

async function startServer(t, stubBase, extraEnv = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-auth-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost',
      DEV_LOGIN: '1', WX_APPID: 'wx-test', WX_SECRET: 's', WX_API_BASE: stubBase,
      PLATFORM_AUTH_URL: stubBase + '/sso/verify', PLATFORM_AUTH_KEY: 'k-platform', ...extraEnv
    }
  });
  const h = { log: '' };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null), setCookie: r.headers.get('set-cookie') || '' };
  };
  return { call, dataDir };
}

test('roleOf maps platform role names, Chinese included, and falls back to teacher', () => {
  assert.equal(roleOf('园长'), 'director');
  assert.equal(roleOf('保健医'), 'nurse');
  assert.equal(roleOf('Nurse'), 'nurse');
  assert.equal(roleOf('保育员'), 'care');
  assert.equal(roleOf('信息接口人'), 'it');
  assert.equal(roleOf('厨师'), 'teacher');
  assert.equal(roleOf(undefined), 'teacher');
});

test('config announces which entrances exist', async t => {
  const stub = await startStub(); t.after(() => stub.srv.close());
  const { call } = await startServer(t, stub.base);
  const c = await call('GET', '/api/config');
  assert.deepEqual(c.json.auth, { wechat: true, platform: true, dev: true });
});

test('dev login creates a user with role and org, hands out a bearer token that /api/me accepts', async t => {
  const stub = await startStub(); t.after(() => stub.srv.close());
  const { call, dataDir } = await startServer(t, stub.base);
  const r = await call('POST', '/api/login/dev', { name: '张三', role: '保健医', org: '测试园' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.user.academy.role, 'nurse');
  assert.equal(r.json.user.academy.org.name, '测试园');
  assert.match(r.setCookie, /gymsid=/);
  assert.ok(r.json.token);
  const me = await call('GET', '/api/me', null, { Authorization: 'Bearer ' + r.json.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.academy.role, 'nurse');
  // 同名再登录是同一个人，岗位按这次给的改
  const again = await call('POST', '/api/login/dev', { name: '张三', role: 'director' });
  assert.equal(again.json.user.id, r.json.user.id);
  assert.equal(again.json.user.academy.role, 'director');
  const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.equal(db.users.length, 1);
  const missing = await call('POST', '/api/login/dev', { role: 'nurse' });
  assert.equal(missing.status, 400);
});

test('wechat: a good code makes a user keyed by openid, the same openid comes back to it, a bad code is 401', async t => {
  const stub = await startStub(); t.after(() => stub.srv.close());
  const { call, dataDir } = await startServer(t, stub.base);
  const a = await call('POST', '/api/login/wechat', { code: 'good-code-1', name: '李老师' });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.equal(a.json.user.name, '李老师');
  assert.equal(a.json.user.academy.source, 'wechat');
  assert.equal(a.json.user.academy.role, 'teacher');   // 微信登录不知道岗位，默认教师
  const b = await call('POST', '/api/login/wechat', { code: 'good-code-2' });
  assert.equal(b.json.user.id, a.json.user.id);
  const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.equal(db.users.length, 1);
  assert.equal(db.users[0].wx.openid, 'o-aaa');
  assert.equal(db.users[0].wx.unionid, 'u-aaa');
  const bad = await call('POST', '/api/login/wechat', { code: 'nope-nope-nope' });
  assert.equal(bad.status, 401);
  assert.equal(bad.json.code, 'wx:40029');
  const short = await call('POST', '/api/login/wechat', { code: 'x' });
  assert.equal(short.status, 401);
  assert.equal(short.json.code, 'bad-code');
  // 微信桩收到的是带 appid 的 jscode2session 调用
  assert.ok(stub.seen.some(s => s.path === '/sns/jscode2session'));
});

test('platform: a ticket makes a user with the platform role and org, re-login refreshes them, the key travels as a bearer', async t => {
  const stub = await startStub(); t.after(() => stub.srv.close());
  const { call, dataDir } = await startServer(t, stub.base);
  const a = await call('POST', '/api/login/platform', { ticket: 'tk-director' });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.equal(a.json.user.name, '王园长');
  assert.deepEqual(a.json.user.academy, { role: 'director', org: { id: 'o-1', name: '柳北区示例幼儿园' }, source: 'platform' });
  const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.equal(db.users[0].platform.uid, 'p-1');
  assert.equal(db.users[0].extra, undefined);
  assert.equal(stub.seen.find(s => s.path === '/sso/verify').auth, 'Bearer k-platform');
  const b = await call('POST', '/api/login/platform', { ticket: 'tk-nurse' });
  assert.equal(b.json.user.academy.role, 'nurse');
  assert.notEqual(b.json.user.id, a.json.user.id);
  const bad = await call('POST', '/api/login/platform', { ticket: 'tk-bad' });
  assert.equal(bad.status, 401);
  assert.equal(bad.json.code, 'rejected');
});

test('an entrance that is not configured is a plain 404 and absent from config', async t => {
  const stub = await startStub(); t.after(() => stub.srv.close());
  const { call } = await startServer(t, stub.base, { WX_APPID: '', WX_SECRET: '', PLATFORM_AUTH_URL: '', DEV_LOGIN: '' });
  const c = await call('GET', '/api/config');
  assert.deepEqual(c.json.auth, { wechat: false, platform: false, dev: false });
  assert.equal((await call('POST', '/api/login/wechat', { code: 'good-code-1' })).status, 404);
  assert.equal((await call('POST', '/api/login/platform', { ticket: 'tk-nurse' })).status, 404);
  assert.equal((await call('POST', '/api/login/dev', { name: 'x' })).status, 404);
});
