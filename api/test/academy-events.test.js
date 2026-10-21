/* POST /api/events：平台密钥回传、幂等、闭合清单、演示自回传、GET 列表。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 平台桩：只做 ticket 核验，给事件测试造一个平台账号
function startStub() {
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const t = JSON.parse(body || '{}').ticket;
      res.writeHead(t === 'tk-1' ? 200 : 401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(t === 'tk-1' ? { uid: 'p-100', name: '李保健', org: { id: 'o-1', name: '测试园' }, role: 'nurse' } : {}));
    });
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}

async function startServer(t, stubBase, extraEnv = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-events-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1',
      PLATFORM_AUTH_URL: stubBase + '/verify', PLATFORM_EVENTS_KEY: 'k-events', ...extraEnv }
  });
  const h = { log: '' };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  return { call };
}
const PK = { Authorization: 'Bearer k-events' };

test('platform key: accepted, idempotent by id and by (event, ref), unknown events and unknown uids are refused', async t => {
  const stub = await startStub(); t.after(() => stub.srv.close());
  const { call } = await startServer(t, stub.base);
  const login = await call('POST', '/api/login/platform', { ticket: 'tk-1' });
  assert.equal(login.status, 200);
  const auth = { Authorization: 'Bearer ' + login.json.token };

  const a = await call('POST', '/api/events', { uid: 'p-100', event: '完成 1 次批量调整', at: '2026-11-03T08:30:00+08:00', ref: 'adj-77', id: 'ev-1' }, PK);
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.deepEqual(a.json, { accepted: 1, duplicates: 0, rejected: [] });
  const again = await call('POST', '/api/events', { uid: 'p-100', event: '完成 1 次批量调整', ref: 'adj-77', id: 'ev-1' }, PK);
  assert.deepEqual(again.json, { accepted: 0, duplicates: 1, rejected: [] });
  const sameRef = await call('POST', '/api/events', { uid: 'p-100', event: '完成 1 次批量调整', ref: 'adj-77' }, PK);
  assert.deepEqual(sameRef.json, { accepted: 0, duplicates: 1, rejected: [] });
  const noRef = await call('POST', '/api/events', { uid: 'p-100', event: '完成 1 次批量调整' }, PK);
  assert.equal(noRef.json.accepted, 1, 'without id or ref every call counts');

  const unknown = await call('POST', '/api/events', { uid: 'p-100', event: '做了件别的事' }, PK);
  assert.equal(unknown.status, 400); assert.equal(unknown.json.code, 'unknown-event');
  const nobody = await call('POST', '/api/events', { uid: 'p-999', event: '完成 1 次批量调整' }, PK);
  assert.equal(nobody.status, 404); assert.equal(nobody.json.code, 'no-user');
  const badKey = await call('POST', '/api/events', { uid: 'p-100', event: '完成 1 次批量调整' }, { Authorization: 'Bearer wrong' });
  assert.equal(badKey.status, 401);

  const batch = await call('POST', '/api/events', { events: [
    { uid: 'p-100', event: '语音录入 1 条晨检异常', ref: 'mc-1' }, { uid: 'p-100', event: '不存在' }, { uid: 'p-404', event: '语音录入 1 条晨检异常' }
  ] }, PK);
  assert.equal(batch.status, 200);
  assert.deepEqual(batch.json, { accepted: 1, duplicates: 0, rejected: [{ i: 1, code: 'unknown-event' }, { i: 2, code: 'no-user' }] });

  const list = await call('GET', '/api/events', null, auth);
  assert.equal(list.status, 200);
  assert.deepEqual(list.json.events.map(e => e.event), ['完成 1 次批量调整', '完成 1 次批量调整', '语音录入 1 条晨检异常']);
  assert.equal(list.json.events[0].at, Date.parse('2026-11-03T08:30:00+08:00'));
  assert.deepEqual(list.json.events[0].levels, ['nurse-2']);
  assert.equal(list.json.events[0].src, 'platform');
  const since = await call('GET', '/api/events?since=' + list.json.events[1].received, null, auth);
  assert.deepEqual(since.json.events.map(e => e.event), ['语音录入 1 条晨检异常']);
  assert.equal((await call('GET', '/api/events')).status, 401);
});

test('demo: a signed-in user posts to themselves only while DEV_LOGIN is on; config says which sources exist', async t => {
  const stub = await startStub(); t.after(() => stub.srv.close());
  const { call } = await startServer(t, stub.base);
  const cfg = await call('GET', '/api/config');
  assert.deepEqual(cfg.json.events, { platform: true, demo: true });
  const login = await call('POST', '/api/login/dev', { name: '王老师', role: 'teacher', org: '测试园' });
  const auth = { Authorization: 'Bearer ' + login.json.token };
  const r = await call('POST', '/api/events', { event: '完成 1 次本班出勤确认' }, auth);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.accepted, 1);
  assert.equal(r.json.events[0].src, 'demo');
  assert.deepEqual(r.json.events[0].levels, ['teacher-1']);
  const bad = await call('POST', '/api/events', { event: '随便' }, auth);
  assert.equal(bad.status, 400); assert.equal(bad.json.code, 'unknown-event');
  assert.equal((await call('POST', '/api/events', { event: '完成 1 次本班出勤确认' })).status, 401);
});

test('without DEV_LOGIN a session cannot post events and config omits demo', async t => {
  const stub = await startStub(); t.after(() => stub.srv.close());
  const { call } = await startServer(t, stub.base, { DEV_LOGIN: '' });
  const cfg = await call('GET', '/api/config');
  assert.deepEqual(cfg.json.events, { platform: true });
  const login = await call('POST', '/api/login/platform', { ticket: 'tk-1' });
  const r = await call('POST', '/api/events', { event: '完成 1 次批量调整' }, { Authorization: 'Bearer ' + login.json.token });
  assert.equal(r.status, 403); assert.equal(r.json.code, 'platform-only');
});
