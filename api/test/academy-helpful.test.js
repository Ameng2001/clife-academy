/* 「点评被标有帮助」：提交人与作答人标点评有帮助（可取消、只能标自己的、要先有点评）；点评勋章要 20 次且 ≥ 5 次有帮助（submissions.js、drills.js、honors.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { badgesOf, HELPFUL_MIN } from '../academy/honors.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-helpful-'));
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
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { h: { Authorization: 'Bearer ' + r.json.token }, id: r.json.user.id }; };
  return { call, login };
}

test('badge: 20 reviews alone is not enough; needs HELPFUL_MIN marks too', () => {
  const mk = (n, helpful) => Array.from({ length: n }, (_, i) => ({ uid: 'x', levelId: 'obs-0', review: { by: 'r', at: 1000 + i, helpful: i < helpful ? 2000 + i : null } }));
  const stateOf = () => ({ progress: {} });
  let b = badgesOf('r', { db: { users: [], submissions: mk(20, 0), drillAnswers: [], cases: [], titles: [] }, stateOf, pairs: null }).find(x => x.key === 'reviews-20');
  assert.equal(b.on, false); assert.equal(b.progress, 20); assert.equal(b.of, 20 + HELPFUL_MIN);
  b = badgesOf('r', { db: { users: [], submissions: mk(20, HELPFUL_MIN), drillAnswers: [], cases: [], titles: [] }, stateOf, pairs: null }).find(x => x.key === 'reviews-20');
  assert.equal(b.on, true); assert.equal(b.at, 2000 + HELPFUL_MIN - 1);
});

test('helpful over the API: only the author, only after a review, toggles off, works for drill answers too', async t => {
  const { call, login } = await startServer(t);
  await login('运营', 'it', '运营方');
  const dir = await login('甲园长', 'director', '甲园'), a = await login('甲一', 'teacher', '甲园'), b = await login('甲二', 'teacher', '甲园');
  let r = await call('POST', '/api/submissions', { levelId: 'obs-0', text: '事实一段。'.repeat(20), files: [] }, a.h);
  const sid = r.json.submission.id;
  assert.equal((await call('POST', '/api/submissions/helpful', { id: sid }, a.h)).json.code, 'review'); // 还没点评
  await call('POST', '/api/submissions/review', { id: sid, verdict: 'pass', scores: [5, 4], comment: '事实写得清楚' }, dir.h);
  assert.equal((await call('POST', '/api/submissions/helpful', { id: sid }, b.h)).status, 404); // 不是作者
  r = await call('POST', '/api/submissions/helpful', { id: sid }, a.h);
  assert.equal(r.status, 200); assert.ok(r.json.submission.review.helpful);
  const at = r.json.submission.review.helpful;
  assert.equal((await call('POST', '/api/submissions/helpful', { id: sid }, a.h)).json.submission.review.helpful, at); // 再标不变
  assert.equal((await call('POST', '/api/submissions/helpful', { id: sid, on: false }, a.h)).json.submission.review.helpful, null);
  await call('POST', '/api/submissions/helpful', { id: sid }, a.h);
  // 研讨作答
  r = await call('POST', '/api/drills', { title: '本园的题：晨检时家长说孩子昨晚发烧但今早退了，你怎么办？' }, dir.h);
  assert.equal(r.status, 200);
  const did = r.json.drill.id;
  r = await call('POST', '/api/drills/answer', { id: did, text: '我的回答。'.repeat(10) }, a.h);
  assert.equal(r.status, 200); const aid = r.json.drill.mine.id;
  await call('POST', '/api/drills/review', { answerId: aid, comment: '有一条具体事实', featured: false }, dir.h);
  r = await call('POST', '/api/drills/helpful', { answerId: aid }, a.h);
  assert.equal(r.status, 200); assert.ok(r.json.answer.review.helpful);
  const badge = (await call('GET', '/api/me/honors', null, dir.h)).json.badges.find(x => x.key === 'reviews-20');
  assert.equal(badge.progress, 2 + 2); assert.equal(badge.on, false);
});
