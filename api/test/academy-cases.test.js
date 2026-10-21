/* 案例库：自荐 → 园长同意 → 审核入库；园长从已通过的作品推荐；退回改交；可见范围；附图（academy/cases.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const LONG = '事实：上午区角时间，A 把积木叠到第七块倒了，又叠了两次。推断：他在尝试调整底部承重，依据是第三次主动换了更大的积木垫底。';
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-cases-'));
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
  const upload = async (auth, bytes) => { const hash = crypto.createHash('sha256').update(bytes).digest('hex'); const r = await fetch(`${base}/api/media/${hash}`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'image/png' }, body: bytes }); assert.ok(r.ok); return hash; };
  const raw = (p, headers) => fetch(base + p, { headers });
  return { call, login, upload, raw };
}

test('cases: teacher self-nominates → director consents → curator approves; visibility at each step', async t => {
  const { call, login, upload, raw } = await startServer(t);
  const admin = await login('管理员', 'director', '运营方');   // 第一个用户是管理员
  const zhao = await login('赵', 'director', '甲园'), wang = await login('王', 'teacher', '甲园'), chen = await login('陈', 'care', '甲园'), li = await login('李', 'teacher', '乙园'), cur = await login('审核员', 'teacher', '运营方');
  assert.equal((await call('GET', '/api/cases')).status, 401);
  assert.equal((await call('POST', '/api/cases', { title: 'x', domain: 'obs', use: 'idea', text: '短' }, wang.auth)).json.code, 'text');
  assert.equal((await call('POST', '/api/cases', { title: 'x', domain: 'nope', use: 'idea', text: LONG }, wang.auth)).json.code, 'domain');
  const hash = await upload(wang.auth, PNG);
  const c = (await call('POST', '/api/cases', { title: '事实与推断分开写的一次尝试', domain: 'obs', age: '中班', use: 'adapt', text: LONG, files: [{ hash, name: 'a.png', type: 'image/png' }, { hash: '0'.repeat(64), name: 'ghost' }] }, wang.auth)).json.case;
  assert.equal(c.status, 'consent'); assert.equal(c.files.length, 1); assert.equal(c.byName, '王'); assert.equal(c.orgName, '甲园');
  assert.equal((await call('GET', '/api/cases', null, li.auth)).json.cases.length, 0, '未入库看不到');
  assert.equal((await call('GET', '/api/cases/mine', null, wang.auth)).json.cases[0].id, c.id);
  // 队列：本园园长看到待同意；别园园长看不到；教师 403
  assert.equal((await call('GET', '/api/cases/queue', null, chen.auth)).status, 403);
  const q1 = (await call('GET', '/api/cases/queue', null, zhao.auth)).json;
  assert.equal(q1.director, true); assert.equal(q1.curator, false); assert.deepEqual(q1.consent.map(x => x.id), [c.id]); assert.deepEqual(q1.pending, []);
  const qian = await login('钱', 'director', '乙园');
  assert.deepEqual((await call('GET', '/api/cases/queue', null, qian.auth)).json.consent, []);
  // 附图：本人、本园园长能读，别园不能
  assert.equal((await raw(`/api/cases/file?id=${c.id}&hash=${hash}`, wang.auth)).status, 200);
  assert.equal((await raw(`/api/cases/file?id=${c.id}&hash=${hash}`, zhao.auth)).status, 200);
  assert.equal((await raw(`/api/cases/file?id=${c.id}&hash=${hash}`, li.auth)).status, 404);
  // 同意：别园园长不行，本园园长行
  assert.equal((await call('POST', '/api/cases/decide', { id: c.id, action: 'consent' }, qian.auth)).json.code, 'org');
  assert.equal((await call('POST', '/api/cases/decide', { id: c.id, action: 'approve' }, zhao.auth)).json.code, 'curator', '园长不能入库');
  assert.equal((await call('POST', '/api/cases/decide', { id: c.id, action: 'consent' }, zhao.auth)).json.case.status, 'pending');
  assert.equal((await call('POST', '/api/cases/decide', { id: c.id, action: 'consent' }, zhao.auth)).json.code, 'state');
  // 审核人：管理员指定
  assert.equal((await call('PUT', '/api/cases/curator', { uid: cur.id, curator: true }, zhao.auth)).json.code, 'admin');
  assert.deepEqual((await call('PUT', '/api/cases/curator', { uid: cur.id, curator: true }, admin.auth)).json, { id: cur.id, curator: true });
  assert.equal((await call('GET', '/api/me', null, cur.auth)).json.user.academy.curator, true);
  const q2 = (await call('GET', '/api/cases/queue', null, cur.auth)).json;
  assert.equal(q2.curator, true); assert.deepEqual(q2.pending.map(x => x.id), [c.id]);
  // 退回要写原因；退回后本人改了再交回到待同意
  assert.equal((await call('POST', '/api/cases/decide', { id: c.id, action: 'reject' }, cur.auth)).json.code, 'note');
  assert.equal((await call('POST', '/api/cases/decide', { id: c.id, action: 'reject', note: '把推断的依据写清楚' }, cur.auth)).json.case.status, 'rejected');
  assert.equal((await call('GET', '/api/cases/mine', null, wang.auth)).json.cases[0].note, '把推断的依据写清楚');
  assert.equal((await call('POST', '/api/cases', { id: c.id, title: c.title, domain: 'obs', use: 'adapt', text: LONG + ' 依据是第三次换积木。' }, wang.auth)).json.case.status, 'consent');
  assert.equal((await call('POST', '/api/cases', { id: c.id, title: 'x', domain: 'obs', use: 'adapt', text: LONG }, chen.auth)).json.code, 'edit', '别人不能改');
  await call('POST', '/api/cases/decide', { id: c.id, action: 'consent' }, zhao.auth);
  const ap = (await call('POST', '/api/cases/decide', { id: c.id, action: 'approve' }, cur.auth)).json.case;
  assert.equal(ap.status, 'approved'); assert.equal(ap.curated.byName, '审核员'); assert.equal(ap.canEdit, false);
  // 入库后别园也看得到、能读附图、能搜
  const all = (await call('GET', '/api/cases', null, li.auth)).json;
  assert.equal(all.total, 1); assert.equal(all.cases[0].byName, '王'); assert.equal(all.cases[0].mine, false);
  assert.equal((await raw(`/api/cases/file?id=${c.id}&hash=${hash}`, li.auth)).status, 200);
  assert.equal((await call('GET', '/api/cases?q=' + encodeURIComponent('推断') + '&age=中班&use=adapt', null, li.auth)).json.cases.length, 1);
  assert.equal((await call('GET', '/api/cases?use=direct', null, li.auth)).json.cases.length, 0);
  assert.equal((await call('POST', '/api/cases', { id: c.id, title: 'x', domain: 'obs', use: 'adapt', text: LONG }, wang.auth)).json.code, 'edit', '入库后本人不能改');
  assert.equal((await call('POST', '/api/cases/delete', { id: c.id }, wang.auth)).json.code, 'edit');
  assert.equal((await call('POST', '/api/cases/delete', { id: c.id }, cur.auth)).json.ok, true);
});

test('cases: a director recommends a passed practice work of their own kindergarten; it skips consent and keeps the author', async t => {
  const { call, login } = await startServer(t);
  await login('管理员', 'director', '运营方');
  const zhao = await login('赵', 'director', '甲园'), wang = await login('王', 'teacher', '甲园'), qian = await login('钱', 'director', '乙园');
  const s = (await call('POST', '/api/submissions', { levelId: 'obs-0', text: LONG }, wang.auth)).json.submission;
  assert.equal((await call('POST', '/api/cases', { title: 'x', domain: 'obs', use: 'direct', text: LONG, submissionId: s.id }, zhao.auth)).json.code, 'not-passed');
  await call('POST', '/api/submissions/review', { id: s.id, verdict: 'pass', scores: [5, 5, 5, 5, 5] }, zhao.auth);
  assert.equal((await call('POST', '/api/cases', { title: 'x', domain: 'obs', use: 'direct', text: LONG, submissionId: s.id }, qian.auth)).json.code, 'org');
  const c = (await call('POST', '/api/cases', { title: '王老师的观察记录', domain: 'obs', use: 'direct', text: LONG, submissionId: s.id }, zhao.auth)).json.case;
  assert.equal(c.status, 'pending'); assert.equal(c.byName, '王'); assert.equal(c.consent.byName, '赵'); assert.deepEqual(c.source, { kind: 'submission', submissionId: s.id, levelId: 'obs-0' });
  assert.equal((await call('GET', '/api/cases/mine', null, wang.auth)).json.cases[0].id, c.id, '作者是教师本人');
  // 园长自己交的也要过审核
  const own = (await call('POST', '/api/cases', { title: '园长的做法', domain: 'comm', use: 'idea', text: LONG }, zhao.auth)).json.case;
  assert.equal(own.status, 'pending');
});
