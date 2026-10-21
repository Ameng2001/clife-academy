/* 园长大讲堂：排场（管理员）、预约、阶段、讲义、提醒 tick（academy/lectures.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { lectureRoutes, REMIND_BEFORE_MS } from '../academy/lectures.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-lec-'));
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
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { Authorization: 'Bearer ' + r.json.token }; };
  return { call, login };
}

test('lectures: admin schedules, anyone sees, signed-in book, over ones become replays', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营'); // 第一个登录的是管理员
  const teacher = await login('王老师', 'nurse', '柳北区示例幼儿园');
  const soon = Date.now() + 3600000, past = Date.now() - 7200000;
  assert.equal((await call('POST', '/api/lectures', { title: 'x', at: soon }, teacher)).status, 403);
  assert.equal((await call('POST', '/api/lectures', { title: '', at: soon }, admin)).status, 400);
  assert.equal((await call('POST', '/api/lectures', { title: 'x', at: soon, liveUrl: 'meeting.tencent.com/x' }, admin)).status, 400);
  let r = await call('POST', '/api/lectures', { title: '数智化幼儿园的建设路径', desc: '从两个保育场景起步', who: '园长、保健医', speaker: '特邀专家', at: soon, minutes: 60, liveUrl: 'https://meeting.tencent.com/x', slides: { url: 'https://example.com/a.pdf' } }, admin);
  assert.equal(r.status, 200); const id = r.json.lecture.id; assert.equal(r.json.lecture.phase, 'upcoming'); assert.equal(r.json.lecture.slides.url, 'https://example.com/a.pdf');
  r = await call('POST', '/api/lectures', { title: '上月回放', at: past, minutes: 60, replayUrl: 'https://example.com/replay' }, admin);
  const pastId = r.json.lecture.id; assert.equal(r.json.lecture.phase, 'done');
  // 没登录也能看
  r = await call('GET', '/api/lectures'); assert.equal(r.status, 200);
  assert.deepEqual(r.json.upcoming.map(l => l.id), [id]); assert.deepEqual(r.json.done.map(l => l.id), [pastId]); assert.equal(r.json.canEdit, false); assert.equal(r.json.upcoming[0].booked, false);
  // 预约要登录；结束的不能预约
  assert.equal((await call('POST', '/api/lectures/book', { id })).status, 401);
  assert.equal((await call('POST', '/api/lectures/book', { id: pastId }, teacher)).status, 400);
  r = await call('POST', '/api/lectures/book', { id }, teacher); assert.equal(r.status, 200); assert.equal(r.json.lecture.booked, true); assert.equal(r.json.lecture.bookings, 1); assert.equal(r.json.remind, false);
  r = await call('GET', '/api/lectures', null, admin); assert.deepEqual(r.json.upcoming[0].bookedBy, ['王老师']); assert.equal(r.json.canEdit, true);
  r = await call('GET', '/api/lectures', null, teacher); assert.equal(r.json.upcoming[0].bookedBy, undefined); assert.equal(r.json.upcoming[0].booked, true);
  r = await call('POST', '/api/lectures/book', { id, on: false }, teacher); assert.equal(r.json.lecture.booked, false); assert.equal(r.json.lecture.bookings, 0);
  // 删
  assert.equal((await call('POST', '/api/lectures/delete', { id: pastId }, teacher)).status, 403);
  assert.equal((await call('POST', '/api/lectures/delete', { id: pastId }, admin)).status, 200);
  assert.equal((await call('GET', '/api/lectures')).json.done.length, 0);
});

test('lectures: the reminder tick sends once per booker inside the 30-minute window, and again if the time moves', async () => {
  const sent = [];
  const db = { lectures: [], users: [{ id: 'u1', name: '王老师' }] };
  const notifier = { send: (uid, kind, fields) => { sent.push([uid, kind, fields.title]); return Promise.resolve({ sent: true }); }, remaining: () => ({ lecture: 1 }) };
  const L = lectureRoutes({ json: () => {}, readBody: async () => ({}), db, saveDb: () => {}, readSession: () => null, audit: () => {}, isAdmin: () => true, MEDIA: {}, sendMediaFile: async () => {}, notifier });
  const at = Date.now() + REMIND_BEFORE_MS - 60000;
  db.lectures.push({ id: 'a', title: '快开播', at, minutes: 60, bookings: ['u1', 'u2'], reminded: [] }, { id: 'b', title: '还早', at: Date.now() + REMIND_BEFORE_MS * 3, minutes: 60, bookings: ['u1'], reminded: [] });
  assert.equal(await L.tick(), 2);
  assert.deepEqual(sent, [['u1', 'lecture', '快开播'], ['u2', 'lecture', '快开播']]);
  assert.equal(await L.tick(), 0);
  db.lectures[0].at = Date.now() - 1000; assert.equal(await L.tick(), 0); // 已开播的不再发
});
