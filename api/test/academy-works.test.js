/* 课程成果：交（含投稿令牌）→ 园长同意 → 审核入库 +3 学分；changes 为空不收；用过有效只给分享者看；筛选（academy/works.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUMMARY = '小班 3 周主题式课程，从体测发现下肢力量薄弱出发，每周 5 个学习活动加户外活动，教案由教研工坊起草，班里用了两周后把户外跳箱改成了跨跳垫。';
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-works-'));
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
const WORK = { title: '运动：下肢力量锻炼', pipeline: 'theme', age: '小班', weeks: 3, domains: ['health', 'lang'], summary: SUMMARY, changes: ['户外跳箱改成跨跳垫，小班跳不上去'], files: [{ name: '主题网络图.docx', url: 'https://jiaoyan.clife.cn/f/1.docx' }, { name: '坏链接', url: 'http://x' }], source: { courseId: '1522', url: 'https://jiaoyan.clife.cn/teaching-workshop/x?id=1522' } };

test('submit → consent → approve: +3 credits, listed with filters, uses visible only to the sharer', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('管理员', 'director', '园A');
  const teacher = await login('王老师', 'teacher', '园B');
  const director = await login('李园长', 'director', '园B');
  const other = await login('赵老师', 'teacher', '园C');
  const bad = await call('POST', '/api/works', { ...WORK, changes: [] }, teacher.auth);
  assert.equal(bad.status, 400); assert.equal(bad.json.code, 'changes');
  const r = await call('POST', '/api/works', WORK, teacher.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const w = r.json.work;
  assert.equal(w.status, 'consent'); assert.equal(w.source.kind, 'workshop'); assert.equal(w.files.length, 1); assert.deepEqual(w.domainNames, ['健康', '语言']);
  assert.equal((await call('GET', '/api/works', null, other.auth)).json.total, 0);
  assert.equal((await call('POST', '/api/works/decide', { id: w.id, action: 'consent' }, other.auth)).status, 403);
  const q = await call('GET', '/api/works/queue', null, director.auth);
  assert.equal(q.json.consent.length, 1);
  assert.equal((await call('POST', '/api/works/decide', { id: w.id, action: 'consent' }, director.auth)).json.work.status, 'pending');
  assert.equal((await call('POST', '/api/works/decide', { id: w.id, action: 'approve' }, admin.auth)).json.work.status, 'approved');
  const me = await call('GET', '/api/me/credits', null, teacher.auth);
  if (me.status === 200) assert.ok(JSON.stringify(me.json).includes('课程成果入库'));
  const list = await call('GET', '/api/works?pipeline=theme&domain=health&q=跨跳', null, other.auth);
  assert.equal(list.json.total, 1); assert.equal(list.json.works[0].byName, '王老师'); assert.equal('uses' in list.json.works[0], false);
  assert.equal((await call('GET', '/api/works?pipeline=pbl', null, other.auth)).json.total, 0);
  assert.equal((await call('POST', '/api/works/used', { id: w.id, note: '改成了中班' }, other.auth)).status, 200);
  assert.equal((await call('POST', '/api/works/used', { id: w.id }, teacher.auth)).json.code, 'own');
  const mine = await call('GET', '/api/works/mine', null, teacher.auth);
  assert.deepEqual(mine.json.works[0].uses.map(u => u.name), ['赵老师']);
  assert.equal((await call('POST', '/api/works/delete', { id: w.id }, teacher.auth)).status, 403);
});

test('a submit token can post a work and nothing else; it is tagged with the token label', async t => {
  const { call, login } = await startServer(t);
  const teacher = await login('王老师', 'teacher', '园B');
  const tk = await call('POST', '/api/me/tokens', { label: '教研工坊', scope: 'submit' }, teacher.auth);
  assert.equal(tk.status, 200, JSON.stringify(tk.json));
  const auth = { Authorization: 'Bearer ' + tk.json.token };
  const r = await call('POST', '/api/works', WORK, auth);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.work.source.kind, 'token'); assert.equal(r.json.work.source.via, '教研工坊'); assert.equal(r.json.work.byName, '王老师');
  assert.equal((await call('POST', '/api/works/used', { id: r.json.work.id }, auth)).status, 403);
});

test('message / allowAdapt / filesScope: message ≤ 80 chars, files hidden outside the scope, summary and changes still public', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('管理员', 'director', '园A');
  const teacher = await login('王老师', 'teacher', '园B');
  const mate = await login('刘老师', 'teacher', '园B');
  const other = await login('赵老师', 'teacher', '园C');
  const r = await call('POST', '/api/works', { ...WORK, message: '第二周换成本班儿歌以后，幼儿自己会唱着做了。'.repeat(5), allowAdapt: false, filesScope: 'org' }, teacher.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const w = r.json.work;
  assert.equal(w.message.length, 80); assert.equal(w.allowAdapt, false); assert.equal(w.filesScope, 'org'); assert.equal(w.filesScopeName, '本园');
  assert.equal(w.files.length, 1); assert.equal(w.filesHidden, false);
  assert.equal((await call('POST', '/api/works/decide', { id: w.id, action: 'approve' }, admin.auth)).json.work.status, 'approved');
  const seenByMate = (await call('GET', '/api/works', null, mate.auth)).json.works[0];
  assert.equal(seenByMate.files.length, 1); assert.equal(seenByMate.filesHidden, false);
  const seenByOther = (await call('GET', '/api/works', null, other.auth)).json.works[0];
  assert.equal(seenByOther.files.length, 0); assert.equal(seenByOther.filesHidden, true);
  assert.equal(seenByOther.summary, SUMMARY); assert.deepEqual(seenByOther.changes, WORK.changes); assert.equal(seenByOther.allowAdapt, false);
  const plain = await call('POST', '/api/works', { ...WORK, title: '第二门' }, teacher.auth);
  assert.equal(plain.json.work.message, null); assert.equal(plain.json.work.allowAdapt, true); assert.equal(plain.json.work.filesScope, 'all');
  assert.equal((await call('POST', '/api/works', { ...WORK, title: '第二门', id: plain.json.work.id, filesScope: 'nowhere' }, teacher.auth)).json.work.filesScope, 'all');
});

test('draft: a token lands a draft without changes (and any changes it sends are dropped); only the owner sees it; the owner completes it and submits; the token cannot push it through', async t => {
  const { call, login } = await startServer(t);
  await login('运营方', 'director', '本地运营'); // 第一个账号是管理员
  const teacher = await login('王老师', 'teacher', '园B'), zhao = await login('赵园长', 'director', '园B');
  const tk = await call('POST', '/api/me/tokens', { label: 'Claude', scope: 'submit' }, teacher.auth);
  const auth = { Authorization: 'Bearer ' + tk.json.token };
  let r = await call('POST', '/api/works/draft', { title: '运动：下肢力量', pipeline: 'theme', summary: '短的', domains: ['health'], changes: ['Agent 编的'] }, auth);
  assert.equal(r.status, 200, JSON.stringify(r.json)); const id = r.json.work.id;
  assert.equal(r.json.work.status, 'draft'); assert.deepEqual(r.json.work.changes, [], 'token changes are dropped'); assert.equal(r.json.work.source.via, 'Claude'); assert.equal(r.json.url, `/works?tab=mine&id=${id}`); assert.ok(r.json.work.expiresAt > Date.now());
  assert.equal((await call('POST', '/api/works/draft', { title: 'x' }, auth)).status, 400, 'pipeline required');
  // 只本人可见：公开列表没有、园长队列没有、「我交的」有
  assert.ok(!(await call('GET', '/api/works', null, zhao.auth)).json.works.some(w => w.id === id));
  assert.equal((await call('GET', '/api/works/queue', null, zhao.auth)).json.consent.length, 0);
  r = await call('GET', '/api/works/mine', null, teacher.auth); assert.equal(r.json.works[0].id, id); assert.equal(r.json.works[0].status, 'draft');
  // 令牌不能把草稿推进流程；教师补齐后交，变 consent
  assert.equal((await call('POST', '/api/works', { ...WORK, id }, auth)).status, 403);
  assert.equal((await call('POST', '/api/works', { ...WORK, id, changes: [] }, teacher.auth)).status, 400, 'still needs changes');
  r = await call('POST', '/api/works', { ...WORK, id, changes: ['跳箱改成跨跳垫'] }, teacher.auth); assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.work.status, 'consent');
  assert.equal((await call('GET', '/api/works/queue', null, zhao.auth)).json.consent.length, 1);
  assert.equal((await call('POST', '/api/works/draft', { id, title: 'x', pipeline: 'theme' }, teacher.auth)).status, 403, 'no longer a draft');
});
