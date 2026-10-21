/* 实践关交证据、研讨关作答、点评队列与权限（academy/submissions.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { LEVEL_TYPES, RUBRICS } from '../academy/events-data.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// 1×1 PNG：PNG 签名 + IHDR 足够过 media.js 的魔数检查
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-sub-'));
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
  const upload = async (auth, bytes) => {
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const r = await fetch(`${base}/api/media/${hash}`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'image/png' }, body: bytes });
    assert.ok(r.status === 200 || r.status === 201, 'upload ' + r.status);
    return hash;
  };
  const raw = (p, headers) => fetch(base + p, { headers });
  return { call, login, upload, raw };
}

test('index: level types and rubrics are generated', () => {
  assert.equal(LEVEL_TYPES['nurse-0'], 'tool');
  assert.equal(LEVEL_TYPES['obs-0'], 'practice');
  assert.equal(LEVEL_TYPES['obs-1'], 'seminar');
  assert.ok(RUBRICS['obs-0'].length >= 3 && RUBRICS['obs-1'].length >= 3);
  assert.equal(RUBRICS['nurse-0'], undefined);
});

test('submit: practice waits for review, seminar passes at once, tool levels and empty bodies are refused', async t => {
  const { call, login } = await startServer(t);
  const wang = await login('王', 'teacher', '甲园');
  assert.equal((await call('POST', '/api/submissions', { levelId: 'nurse-0', text: 'x' }, wang)).status, 400);
  assert.equal((await call('POST', '/api/submissions', { levelId: 'obs-0' }, wang)).json.code, 'empty');
  assert.equal((await call('POST', '/api/submissions', { levelId: 'nope', text: 'x' }, wang)).json.code, 'level');
  assert.equal((await call('POST', '/api/submissions', { levelId: 'obs-0', text: 'x' })).status, 401);
  const p = await call('POST', '/api/submissions', { levelId: 'obs-0', text: '事实：A 叠到第七块倒了。推断：他在练手眼协调。', files: [{ hash: 'zz', name: 'bad' }] }, wang);
  assert.equal(p.status, 200); assert.equal(p.json.submission.status, 'pending'); assert.deepEqual(p.json.submission.files, []);
  assert.equal(p.json.submission.uid, undefined, 'own view carries no uid');
  const s = await call('POST', '/api/submissions', { levelId: 'obs-1', text: '今天他和 B 搭了十分钟积木。' }, wang);
  assert.equal(s.json.submission.status, 'pass');
  const mine = await call('GET', '/api/submissions?level=obs-0', null, wang);
  assert.equal(mine.json.submissions.length, 1); assert.equal(mine.json.title, '事实与推断'); assert.equal(mine.json.rubric.length, 5);
  assert.deepEqual((await call('GET', '/api/submissions', null, wang)).json.submissions.map(x => x.levelId).sort(), ['obs-0', 'obs-1']);
});

test('seminar: colleagues in the same kindergarten see each other only after answering', async t => {
  const { call, login } = await startServer(t);
  const wang = await login('王', 'teacher', '甲园'), chen = await login('陈', 'care', '甲园'), li = await login('李', 'teacher', '乙园');
  await call('POST', '/api/submissions', { levelId: 'obs-1', text: '王的回答' }, wang);
  await call('POST', '/api/submissions', { levelId: 'obs-1', text: '李的回答（别园）' }, li);
  // 陈还没交：看不到别人的
  assert.deepEqual((await call('GET', '/api/submissions?level=obs-1', null, chen)).json.others, []);
  await call('POST', '/api/submissions', { levelId: 'obs-1', text: '陈的回答' }, chen);
  const r = await call('GET', '/api/submissions?level=obs-1', null, chen);
  assert.deepEqual(r.json.others.map(o => o.name), ['王']);
  assert.equal(r.json.others[0].uid, undefined);
});

test('review: directors and reviewers of the same kindergarten; revise needs a comment; files readable by both sides only', async t => {
  const { call, login, upload, raw } = await startServer(t);
  const wang = await login('王', 'teacher', '甲园'), zhao = await login('赵', 'director', '甲园'), qian = await login('钱', 'director', '乙园'), chen = await login('陈', 'care', '甲园');
  const hash = await upload(wang, PNG);
  const sub = (await call('POST', '/api/submissions', { levelId: 'obs-0', text: '观察记录正文', files: [{ hash, name: 'a.png', type: 'image/png' }] }, wang)).json.submission;
  assert.equal(sub.files.length, 1);
  // 队列：园长看得到，别园园长看不到，教师 403
  assert.equal((await call('GET', '/api/review/queue', null, chen)).status, 403);
  assert.deepEqual((await call('GET', '/api/review/queue', null, qian)).json.pending, []);
  const q = (await call('GET', '/api/review/queue', null, zhao)).json;
  assert.equal(q.pending.length, 1); assert.equal(q.pending[0].name, '王'); assert.equal(q.pending[0].title, '事实与推断'); assert.equal(q.pending[0].rubric.length, 5);
  // 文件：本人与本园园长能读，别园园长不能，不存在的 404
  assert.equal((await raw(`/api/submissions/file?id=${sub.id}&hash=${hash}`, wang)).status, 200);
  assert.equal((await raw(`/api/submissions/file?id=${sub.id}&hash=${hash}`, zhao)).status, 200);
  assert.equal((await raw(`/api/submissions/file?id=${sub.id}&hash=${hash}`, qian)).status, 403);
  assert.equal((await raw(`/api/submissions/file?id=${sub.id}&hash=${hash}`, chen)).status, 403);
  assert.equal((await raw(`/api/submissions/file?id=${sub.id}&hash=${'0'.repeat(64)}`, zhao)).status, 404);
  // 点评
  assert.equal((await call('POST', '/api/submissions/review', { id: sub.id, verdict: 'pass' }, qian)).json.code, 'org');
  assert.equal((await call('POST', '/api/submissions/review', { id: sub.id, verdict: 'maybe' }, zhao)).json.code, 'verdict');
  assert.equal((await call('POST', '/api/submissions/review', { id: sub.id, verdict: 'revise' }, zhao)).json.code, 'comment');
  assert.equal((await call('POST', '/api/submissions/review', { id: 'nope', verdict: 'pass' }, zhao)).status, 404);
  const rv = await call('POST', '/api/submissions/review', { id: sub.id, verdict: 'revise', scores: [5, 4, 9, 'x', 3], comment: '推断没标依据' }, zhao);
  assert.equal(rv.json.submission.status, 'revise'); assert.deepEqual(rv.json.submission.scores, undefined);
  assert.deepEqual(rv.json.submission.review.scores, [5, 4, null, null, 3]); assert.equal(rv.json.submission.review.byName, '赵');
  const mine = (await call('GET', '/api/submissions?level=obs-0', null, wang)).json.submissions[0];
  assert.equal(mine.status, 'revise'); assert.equal(mine.review.comment, '推断没标依据');
  // 再交一次 → 新的待点评；队列里已点评的进 done
  const again = (await call('POST', '/api/submissions', { levelId: 'obs-0', text: '改好了' }, wang)).json.submission;
  const q2 = (await call('GET', '/api/review/queue', null, zhao)).json;
  assert.deepEqual(q2.pending.map(x => x.id), [again.id]); assert.deepEqual(q2.done.map(x => x.id), [sub.id]);
  await call('POST', '/api/submissions/review', { id: again.id, verdict: 'pass', scores: [5, 5, 5, 5, 5] }, zhao);
  assert.equal((await call('GET', '/api/submissions?level=obs-0', null, wang)).json.submissions[0].status, 'pass');
  // 园长不能点评自己的
  const own = (await call('POST', '/api/submissions', { levelId: 'obs-0', text: '园长自己的' }, zhao)).json.submission;
  assert.equal((await call('POST', '/api/submissions/review', { id: own.id, verdict: 'pass' }, zhao)).json.code, 'org');
  assert.equal((await call('GET', '/api/review/queue', null, zhao)).json.pending.length, 0);
});
