/* 答疑：提问带关卡、助手整理（无模型时只整理）、本园种子教师答、采纳、已解决、两个工作日转讲师、相似问题（academy/questions.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { similarity, workdaysLater, questionRoutes } from '../academy/questions.js';
import { parseJson } from '../academy/assistant.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-q-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', FIRST_USER_ADMIN: '1', ASSISTANT_API_KEY: '', ASSISTANT_BASE_URL: '' } });
  const h = { log: '' }; child.stdout.on('data', d => h.log += d); child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { h: { Authorization: 'Bearer ' + r.json.token }, id: r.json.user.id }; };
  return { call, login };
}

test('helpers: bigram similarity, two working days skip the weekend, JSON parsing tolerates fences', () => {
  assert.ok(similarity('晨检记录在哪里填', '晨检记录填在哪里') > 0.5);
  assert.ok(similarity('晨检记录在哪里填', '带量食谱怎么导出') < 0.2);
  const fri = new Date('2026-10-23T10:00:00').getTime(); // 周五
  assert.equal(new Date(workdaysLater(fri)).getDay(), 2); // 周二
  assert.deepEqual(parseJson('好的：```json\n{"a":1}\n```'), { a: 1 }); assert.equal(parseJson('nothing'), null);
});

test('questions: ask with level, assistant organizes without a model, seed teacher answers, asker accepts, escalation after two workdays', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营', 'it', '运营方');
  const a = await login('甲一', 'nurse', '甲园'), dir = await login('甲园长', 'director', '甲园'), seed = await login('甲种子', 'teacher', '甲园');
  const b = await login('乙一', 'nurse', '乙园');
  await call('PUT', '/api/org/reviewer', { uid: seed.id, reviewer: true }, dir.h);
  assert.equal((await call('POST', '/api/questions', { levelId: 'nope-1', text: '这关怎么过' }, a.h)).json.code, 'level');
  let r = await call('POST', '/api/questions', { levelId: 'nurse-7', text: '康复结论在哪一步填？家长说孩子好了但没有医院证明' }, a.h);
  assert.equal(r.status, 200); const q = r.json.question;
  assert.equal(q.status, 'open'); assert.equal(q.levelTitle, '疾病到复课'); assert.equal(r.json.assistantConfigured, false);
  assert.equal(q.assistant.draft, null); assert.ok(q.assistant.sources.some(s => s.kind === 'level')); assert.match(q.assistant.note, /没有接模型/);
  // 本园种子教师的队列里有；外园没有；提问人自己不能答
  assert.equal((await call('GET', '/api/questions', null, seed.h)).json.queue.length, 1);
  assert.equal((await call('GET', '/api/questions', null, b.h)).json.queue.length, 0);
  assert.equal((await call('GET', '/api/questions', null, b.h)).json.canAnswer, false);
  assert.equal((await call('POST', '/api/questions/answer', { id: q.id, text: '自己答自己' }, a.h)).status, 403);
  assert.equal((await call('POST', '/api/questions/answer', { id: q.id, text: '外园来答' }, b.h)).status, 403);
  assert.equal((await call('POST', '/api/questions/confirm', { id: q.id }, seed.h)).json.code, 'draft'); // 没草稿
  r = await call('POST', '/api/questions/answer', { id: q.id, text: '在「疾病登记」里填复课日期，没有医院证明就选「家长口述」，保健医复核后生效。' }, seed.h);
  assert.equal(r.status, 200); assert.equal(r.json.question.answers[0].roleLabel, '种子教师');
  const ansId = r.json.question.answers[0].id;
  r = await call('POST', '/api/questions/accept', { id: q.id, answerId: ansId }, a.h);
  assert.equal(r.json.question.status, 'answered'); assert.equal(r.json.question.answers[0].accepted, true);
  // 本园同事在本关看到已答的；相似问题也能找到
  const a2 = await login('甲二', 'nurse', '甲园');
  assert.equal((await call('GET', '/api/questions?level=nurse-7', null, a2.h)).json.faq.length, 1);
  assert.equal((await call('GET', '/api/questions?level=nurse-7', null, b.h)).json.faq.length, 0);
  r = (await call('GET', '/api/questions/similar?levelId=nurse-7&q=' + encodeURIComponent('康复结论填在哪'), null, a2.h)).json;
  assert.ok(r.sources.some(s => s.kind === 'question'));
  r = await call('POST', '/api/questions', { levelId: 'nurse-7', text: '康复结论填在哪？' }, a2.h);
  assert.ok(r.json.question.assistant.sources.some(s => s.kind === 'question'));
  // 勋章
  const h = (await call('GET', '/api/me/honors', null, seed.h)).json;
  assert.equal(h.badges.find(b => b.key === 'answers-10').progress, 1);
  // 管理员（本地讲师）看全部开放的
  assert.equal((await call('GET', '/api/questions', null, admin.h)).json.queue.length, 1);
  // 已解决
  assert.equal((await call('POST', '/api/questions/close', { id: r.json.question.id, note: '看了相似问题就懂了' }, a2.h)).json.question.status, 'closed');
});

test('escalateDue: an open question with no answer flips to escalated after two working days, answered ones do not', () => {
  const db = { users: [], questions: [{ id: 'x', status: 'open', at: new Date('2026-10-19T09:00:00').getTime(), answers: [], escalatedAt: null }, { id: 'y', status: 'open', at: new Date('2026-10-19T09:00:00').getTime(), answers: [{}], escalatedAt: null }] };
  const { escalateDue } = questionRoutes({ json() {}, readBody() {}, db, saveDb() {}, readSession() {}, audit() {}, isAdmin: () => false });
  assert.equal(escalateDue(new Date('2026-10-20T09:00:00').getTime()), 0);
  assert.equal(escalateDue(new Date('2026-10-21T10:00:00').getTime()), 1);
  assert.ok(db.questions[0].escalatedAt); assert.equal(db.questions[1].escalatedAt, null);
});
