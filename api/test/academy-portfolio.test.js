/* 发展档案与学时证明：hoursOf 按规则计时、学年边界、出具编号与核验脱敏、规则快照、档案不含助手草稿（academy/portfolio.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { hoursOf, schoolYearOf, DEFAULT_RULE, sanitizeRule } from '../academy/portfolio.js';
import { LEVEL_INFO } from '../academy/events-data.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-pf-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', FIRST_USER_ADMIN: '1' } });
  const h = { log: '' }; child.stdout.on('data', d => h.log += d); child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, headers: r.headers, json: await r.json().catch(() => null) };
  };
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { h: { Authorization: 'Bearer ' + r.json.token }, id: r.json.user.id }; };
  return { call, login };
}

test('hoursOf: tool levels by duration, practice and seminar add extras, rounding down to the half hour, school year starts in September', () => {
  const t0 = new Date('2026-10-01T10:00:00').getTime();
  const progress = { 'nurse-0': { passedAt: t0 }, 'nurse-1': { passedAt: t0 + 1 }, 'obs-0': { passedAt: t0 + 2 }, 'obs-1': { passedAt: t0 + 3 }, 'care-0': { passedAt: new Date('2025-06-01').getTime() } };
  const rule = sanitizeRule(DEFAULT_RULE);
  const sy = schoolYearOf(t0); assert.equal(sy.label, '2026–2027 学年'); assert.equal(new Date(sy.from).getMonth(), 8);
  const h = hoursOf('u', { from: sy.from, to: sy.to, rule, db: { certificates: [] }, stateOf: () => ({ progress }) });
  const expectMin = LEVEL_INFO['nurse-0'].minutes + LEVEL_INFO['nurse-1'].minutes + LEVEL_INFO['obs-0'].minutes + 60 + LEVEL_INFO['obs-1'].minutes + 30;
  assert.equal(h.minutes, expectMin); assert.equal(h.lines.length, 3);
  assert.equal(h.hours, Math.floor(expectMin / 45 / 0.5) * 0.5);
  const h2 = hoursOf('u', { from: sy.from, to: sy.to, rule: { ...rule, minutesPerHour: 60, roundTo: 1 }, db: { certificates: [{ uid: 'u', kind: 'backbone', at: t0 }] }, stateOf: () => ({ progress }) });
  assert.ok(h2.lines.some(l => l.kind === 'backbone')); assert.equal(h2.hours, Math.floor((expectMin + 240) / 60));
});

test('portfolio and hours certificate over the API: export header, excluded list, issue once, verify masked, rule snapshot survives rule change', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营', 'it', '运营方');
  const a = await login('甲一', 'nurse', '甲园');
  const put = progress => call('PUT', '/api/data', { state: { _ts: Date.now(), role: 'nurse', progress, sessions: [], credits: {} }, stamped: true, baseRev: 0 }, a.h);
  const t0 = Date.now();
  await put({ 'nurse-0': { passedAt: t0, quiz: { right: 2, of: 2 } }, 'nurse-1': { passedAt: t0 + 1 } });
  await call('POST', '/api/questions', { levelId: 'nurse-1', text: '基础数据在哪里改？' }, a.h); // 助手草稿不进档案
  let r = await call('GET', '/api/me/portfolio', null, a.h);
  assert.equal(r.status, 200); assert.equal(r.json.summary.levels, 2); assert.equal(r.json.levels[0].quiz.of, 2); assert.equal(r.json.paths[0].path, 'nurse');
  assert.ok(r.json.excluded.length >= 3); assert.equal(JSON.stringify(r.json).includes('assistant'), false);
  r = await call('GET', '/api/me/portfolio?download=1', null, a.h);
  assert.match(r.headers.get('content-disposition'), /attachment/);
  r = (await call('GET', '/api/me/hours', null, a.h)).json;
  assert.equal(r.lines.length, 1); assert.equal(r.certs.length, 0); assert.equal(r.rule.minutesPerHour, 45);
  assert.equal((await call('POST', '/api/me/hours/issue', { from: t0 + 100000, to: t0 + 200000 }, a.h)).json.code, 'empty');
  r = await call('POST', '/api/me/hours/issue', {}, a.h);
  assert.equal(r.status, 200); const no = r.json.cert.no; assert.match(no, /^XS-\d{4}-00001$/);
  assert.equal((await call('POST', '/api/me/hours/issue', {}, a.h)).json.cert.no, no); // 同一区间不重复
  assert.equal((await call('PUT', '/api/hours/rule', { minutesPerHour: 60 }, a.h)).status, 403);
  assert.equal((await call('PUT', '/api/hours/rule', { minutesPerHour: 60, issuer: '柳州市教师发展中心' }, admin.h)).json.rule.minutesPerHour, 60);
  r = (await call('GET', '/api/me/hours', null, a.h)).json;
  assert.equal(r.rule.minutesPerHour, 60); assert.equal(r.certs[0].rule.minutesPerHour, 45); // 旧证明的快照不变
  r = (await call('GET', '/api/hours/verify?no=' + no.toLowerCase())).json;
  assert.equal(r.valid, true); assert.equal(r.name, '甲*'); assert.equal(r.issuer, DEFAULT_RULE.issuer);
  assert.equal((await call('GET', '/api/hours/verify?no=XS-0000-00000')).json.valid, false);
});
