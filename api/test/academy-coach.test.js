/* Coach 面向专业发展：规则草稿只用学习记录；plan 先接没走完的线、实践关那周只排一关；review 的变更只有 add-practice 与 pair；采用后首页有本周待学；园长看 pair 建议（academy/coach.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { evidenceOf, draftPlan, draftReview, draftDebrief, STALL_DAYS } from '../academy/coach.js';
import { LEVEL_TYPES, PATH_LEN } from '../academy/events-data.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-coach-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', FIRST_USER_ADMIN: '1', ASSISTANT_PROVIDER: '', ASSISTANT_API_KEY: '' } });
  const h = { log: '' }; child.stdout.on('data', d => h.log += d); child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) }; };
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { auth: { Authorization: 'Bearer ' + r.json.token }, id: r.json.user.id }; };
  return { call, login };
}

test('drafts: a stalled line is picked up first, a practice week holds one level, revise ×2 → add-practice, no mentor at 入职 → pair', () => {
  const now = Date.now(), D = 86400000;
  const db = { users: [{ id: 'a', name: '甲一', academy: { role: 'teacher', org: { name: '甲园' } } }], submissions: [{ uid: 'a', levelId: 'obs-0', status: 'revise', at: now - 5 * D, review: { comment: '事实与推断还混着' } }, { uid: 'a', levelId: 'obs-0', status: 'revise', at: now - 2 * D, review: { comment: '推断没有标依据' } }], drillAnswers: [], selfReviews: [], certificates: [] };
  const stateOf = () => ({ progress: { 'teacher-0': { passedAt: now - (STALL_DAYS + 3) * D }, 'teacher-1': { passedAt: now - (STALL_DAYS + 1) * D } } });
  const ev = evidenceOf('a', { db, stateOf, pairs: { mentorOf: () => null }, now });
  assert.equal(ev.stage, '入职'); assert.equal(ev.paths.find(p => p.path === 'teacher').stalled, true); assert.equal(ev.mentor, null);
  const plan = draftPlan(ev);
  assert.equal(plan.weeks[0].levelIds[0], 'teacher-2');
  assert.ok(plan.weeks.length <= 16); assert.ok(plan.weeks.every(w => w.levelIds.length <= 2));
  for (const w of plan.weeks) if (w.levelIds.some(id => LEVEL_TYPES[id] === 'practice')) assert.equal(w.levelIds.length, 1);
  assert.equal(JSON.stringify(plan).includes('幼儿姓名'), false);
  const rv = draftReview(ev);
  assert.equal(rv.nochange, false); assert.deepEqual(rv.changes.map(c => c.type), ['add-practice', 'pair']); assert.equal(rv.changes[0].levelId, 'obs-0'); assert.equal(rv.stalled[0].path, 'teacher');
  const db2 = { ...db, submissions: [] };
  const rv2 = draftReview(evidenceOf('a', { db: db2, stateOf: () => ({ progress: { 'teacher-0': { passedAt: now - D } } }), pairs: { mentorOf: () => 'm' }, now }));
  assert.equal(rv2.nochange, true); assert.equal(rv2.changes.length, 0);
  const dbf = draftDebrief(ev, 'obs-0', { db });
  assert.equal(dbf.type, 'practice'); assert.ok(dbf.summary.includes('退回')); assert.ok(dbf.next.includes('改'));
});

test('routes: plan → accept → home plan shows this week; review pair suggestion reaches the director; debrief needs a real level', async t => {
  const { call, login } = await startServer(t);
  await login('运营方', 'it', '本地运营');
  const dir = await login('甲园长', 'director', '甲园'), a = await login('甲一', 'teacher', '甲园');
  let r = await call('GET', '/api/me/coach', null, a.auth); assert.equal(r.status, 200); assert.equal(r.json.model, false); assert.equal(r.json.plan, null); assert.ok(r.json.evidence.includes('不读幼儿数据'));
  r = await call('POST', '/api/me/coach/plan', null, a.auth); assert.equal(r.status, 200); const planId = r.json.card.id; assert.equal(r.json.card.kind, 'plan'); assert.ok(r.json.card.weeks.length > 0); assert.ok(PATH_LEN[r.json.card.weeks[0].levelIds[0].split(/-(?=\d+$)/)[0]]);
  r = await call('POST', '/api/me/coach/accept', { id: planId, on: true }, a.auth); assert.equal(r.json.plan.week, 1); assert.ok(r.json.plan.levels.length);
  r = await call('GET', '/api/me/coach', null, a.auth); assert.equal(r.json.plan.cardId, planId); assert.equal(r.json.cards[0].accepted, true);
  r = await call('POST', '/api/me/coach/review', null, a.auth); const rvId = r.json.card.id; assert.equal(r.json.card.kind, 'review'); assert.ok(r.json.card.changes.some(c => c.type === 'pair'));   // 入职、没带教
  assert.equal((await call('GET', '/api/org/coach', null, dir.auth)).json.suggestions.length, 0);   // 没采用不进园长看板
  await call('POST', '/api/me/coach/accept', { id: rvId, on: true }, a.auth);
  r = await call('GET', '/api/org/coach', null, dir.auth); assert.equal(r.json.suggestions.length, 1); assert.equal(r.json.suggestions[0].uid, a.id);
  assert.equal((await call('GET', '/api/org/coach', null, a.auth)).status, 403);
  await call('PUT', '/api/org/pairs', { mentor: dir.id, mentee: a.id }, dir.auth);
  assert.equal((await call('GET', '/api/org/coach', null, dir.auth)).json.suggestions.length, 0);   // 配上了就不再提
  assert.equal((await call('POST', '/api/me/coach/debrief', { levelId: 'nope-1' }, a.auth)).status, 404);
  r = await call('POST', '/api/me/coach/debrief', { levelId: 'obs-0' }, a.auth); assert.equal(r.json.card.kind, 'debrief'); assert.equal(r.json.card.type, 'practice');
  r = await call('POST', '/api/me/coach/accept', { id: planId, on: false }, a.auth); assert.equal(r.json.plan, null);
});
