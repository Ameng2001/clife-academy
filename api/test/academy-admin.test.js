/* 运营后台汇总与公告（admin.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { overviewOf } from '../academy/admin.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-admin-'));
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

test('overviewOf: six groups of counts; disabled users, closed items and expired notices drop out; no names', () => {
  const now = new Date('2026-10-22T10:00:00').getTime(), D = 86400000;
  const db = {
    users: [{ id: 'a', name: '管理员', academy: { role: 'director', org: { name: '甲园' } } }, { id: 'b', name: '甲一', academy: { role: 'teacher', org: { name: '甲园' }, reviewer: true } }, { id: 'c', name: '停', disabled: true, academy: { role: 'teacher', org: { name: '乙园' } } }],
    communities: [{ id: 'k' }], pairs: [{ endedAt: null }, { endedAt: 1 }], invites: [{ code: 'x' }, { code: 'y', usedBy: 'b' }],
    programs: [{ from: now + D, to: now + 2 * D, applicants: [{ status: 'applied' }, { status: 'accepted' }] }, { from: now - 9 * D, to: now - 8 * D, closedAt: now - D, applicants: [{ status: 'applied' }] }],
    cohorts: [{}], camps: [{ closedAt: 1 }], lectures: [{ at: now + D }, { at: now - D }], showcases: [], sharedays: [{}],
    resources: [{}, {}], cases: [{ status: 'pending' }, { status: 'approved' }, { status: 'approved' }], caseUses: [{}], studios: [],
    drills: [{ scope: 'all', closeAt: now + D }, { scope: 'name:甲园', closeAt: now + D }, { scope: 'all', closeAt: now - D }],
    contests: [{ dueAt: now + D }, { dueAt: now - D }, { dueAt: now - 9 * D, closedAt: now - D }],
    submissions: [{ uid: 'b', org: 'name:甲园', type: 'practice', status: 'pending', at: now - 5 * D }], questions: [{ status: 'open', escalatedAt: now, answers: [] }, { status: 'open', answers: [] }, { status: 'answered', answers: [] }],
    notices: [{ until: null }, { until: now - 1 }]
  };
  const o = overviewOf({ db, isAdmin: u => u.id === 'a', auditRows: [{ ts: now - 3600000, ok: true }, { ts: now - 3600000, ok: false }, { ts: now - 3 * D, ok: true }], now });
  assert.deepEqual(o.people, { users: 2, disabled: 1, admins: 1, directors: 1, reviewers: 1, curators: 0, district: 0, orgs: 1, communities: 1, pairs: 1, invitesUnused: 1 });
  assert.deepEqual(o.programs, { open: 1, applied: 1, cohortsOpen: 1, campsOpen: 0, lecturesUpcoming: 1, showcasesOpen: 0, sharedaysOpen: 1 });
  assert.deepEqual(o.content, { resources: 2, casesPending: 1, casesApproved: 2, caseUses: 1, studios: 0 });
  assert.equal(o.review.drillsOpen, 1); assert.equal(o.review.contestsOpen, 1); assert.equal(o.review.contestsReview, 1);
  assert.equal(o.review.pending, 1); assert.equal(o.review.overdue, 1); assert.equal(o.review.questionsOpen, 2); assert.equal(o.review.questionsEscalated, 1);
  assert.deepEqual(o.notices, { active: 1, total: 2 }); assert.deepEqual(o.audit, { day: 2, dayFail: 1, total: 3 });
  assert.equal(JSON.stringify(o).includes('甲一'), false);
});

test('notices: admin posts, edits, removes; everyone signed in sees active ones only; teachers cannot post or see the overview', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('管理员', 'director', '甲园');      // FIRST_USER_ADMIN
  const tch = await login('甲一', 'teacher', '甲园');
  assert.equal((await call('GET', '/api/admin/overview', null, tch.auth)).status, 403);
  assert.equal((await call('POST', '/api/admin/notices', { title: '停电', text: '周五下午平台维护' }, tch.auth)).status, 403);
  assert.equal((await call('POST', '/api/admin/notices', { title: '停', text: '周五下午平台维护' }, admin.auth)).status, 400);
  const a = await call('POST', '/api/admin/notices', { title: '停电', text: '周五下午平台维护两小时' }, admin.auth);
  assert.equal(a.status, 200); assert.equal(a.json.notice.byName, '管理员');
  const old = await call('POST', '/api/admin/notices', { title: '过期', text: '这条已经过期了', until: Date.now() - 1000 }, admin.auth);
  assert.equal(old.status, 200);
  let seen = await call('GET', '/api/notices', null, tch.auth);
  assert.deepEqual(seen.json.notices.map(n => n.title), ['停电']);
  const e = await call('POST', '/api/admin/notices', { id: a.json.notice.id, title: '停电', text: '改到周六上午', until: Date.now() + 86400000 }, admin.auth);
  assert.equal(e.json.notice.text, '改到周六上午');
  const ov = await call('GET', '/api/admin/overview', null, admin.auth);
  assert.equal(ov.status, 200); assert.equal(ov.json.overview.notices.active, 1); assert.equal(ov.json.overview.notices.total, 2); assert.equal(ov.json.notices.length, 2);
  assert.equal(ov.json.overview.people.users, 2); assert.equal(ov.json.overview.people.admins, 1); assert.ok(ov.json.overview.audit.total >= 1);
  assert.equal((await call('POST', '/api/admin/notices', { id: a.json.notice.id, remove: true }, admin.auth)).status, 200);
  seen = await call('GET', '/api/notices', null, tch.auth);
  assert.equal(seen.json.notices.length, 0);
});
