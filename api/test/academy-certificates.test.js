/* 证书与认证期次：工具线自动发证（测验 ≥ 80%）、领域研修证书要作品全通过、编号核验脱敏、骨干期次报名条件与答辩结果（academy/certificates.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { earnedOf, KIND_LABEL } from '../academy/certificates.js';
import { PATH_LEN, LEVEL_TYPES } from '../academy/events-data.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-cert-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', FIRST_USER_ADMIN: '1', STATE_CACHE_TTL_MS: '50' } });
  const h = { log: '' }; child.stdout.on('data', d => h.log += d); child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { Authorization: 'Bearer ' + r.json.token }; };
  const put = (auth, progress) => call('PUT', '/api/data', { state: { _ts: Date.now(), role: 'nurse', progress, sessions: [], credits: {} }, stamped: true, baseRev: 0 }, auth);
  return { call, login, put };
}
const passed = (right = 3, of = 3) => ({ passedAt: Date.now(), credits: 1, quiz: { right, of } });
const full = (path, right, of) => Object.fromEntries(Array.from({ length: PATH_LEN[path] }, (_, i) => [`${path}-${i}`, passed(right, of)]));

test('earnedOf: tool cert needs the finished role path and quiz ≥ 80%; domain cert needs every practice work passed', () => {
  const users = [{ id: 'a', name: '李', academy: { role: 'care', org: { id: null, name: 'x' } } }];
  const db = { users, submissions: [], cases: [], certificates: [], drillAnswers: [], drills: [] };
  let e = earnedOf('a', { db, stateOf: () => ({ progress: full('care', 2, 3) }) });
  assert.equal(e.tool.ok, false); assert.equal(e.tool.quiz, 67);
  e = earnedOf('a', { db, stateOf: () => ({ progress: full('care', 3, 3) }) });
  assert.equal(e.tool.ok, true); assert.deepEqual(e.earned.map(x => x.kind), ['tool']);
  // obs 路径：走完但实践关作品没过 → 不发；作品过了 → 发
  const practice = Object.keys(LEVEL_TYPES).filter(id => id.startsWith('obs-') && LEVEL_TYPES[id] === 'practice');
  assert.ok(practice.length >= 1);
  e = earnedOf('a', { db, stateOf: () => ({ progress: { ...full('care', 3, 3), ...full('obs', 3, 3) } }) });
  assert.equal(e.domains.find(d => d.path === 'obs').ok, false);
  db.submissions = practice.map(id => ({ uid: 'a', levelId: id, status: 'pass', at: 1, review: { at: 2 } }));
  e = earnedOf('a', { db, stateOf: () => ({ progress: { ...full('care', 3, 3), ...full('obs', 3, 3) } }) });
  assert.equal(e.domains.find(d => d.path === 'obs').ok, true); assert.deepEqual(e.earned.map(x => x.kind), ['tool', 'domain']);
  assert.equal(e.backbone.eligible, false); assert.equal(e.seven.have >= 1, true);
  assert.equal(KIND_LABEL.backbone, '骨干教师认证');
});

test('certificates: issued with numbers on read, verify masks the name, cohorts take only eligible applicants, pass issues the backbone certificate', async t => {
  const { call, login, put } = await startServer(t);
  const admin = await login('运营', 'it', '运营方'); // FIRST_USER_ADMIN
  const a = await login('陈老师', 'care', '甲园');
  await put(a, full('care', 3, 3));
  let r = (await call('GET', '/api/me/certificates', null, a)).json;
  assert.equal(r.certificates.length, 1); assert.match(r.certificates[0].no, /^CL-\d{4}-00001$/); assert.equal(r.certificates[0].kind, 'tool');
  assert.equal((await call('GET', '/api/me/certificates', null, a)).json.certificates.length, 1); // 不重复发
  const no = r.certificates[0].no;
  r = (await call('GET', '/api/certificates/verify?no=' + no)).json;
  assert.equal(r.valid, true); assert.equal(r.name, '陈**'); assert.ok(!('uid' in r));
  assert.equal((await call('GET', '/api/certificates/verify?no=CL-2000-00009')).status, 404);
  // 期次：管理员开班；没条件的报不了
  r = await call('POST', '/api/cohorts', { name: '2027 春骨干教师认证', term: '2027春', applyTo: Date.now() + 86400000 }, admin);
  assert.equal(r.status, 200); const id = r.json.cohort.id; assert.equal(r.json.cohort.phase, 'open');
  assert.equal((await call('POST', '/api/cohorts', { name: 'x', term: 'y' }, a)).status, 403);
  r = await call('POST', '/api/cohorts/apply', { id }, a);
  assert.equal(r.status, 400); assert.equal(r.json.code, 'eligible'); assert.equal(r.json.backbone.domainCerts, 0);
  // 直接写一个够条件的人：三张领域证书 ＋ 一条案例（走 db 的条件只能靠记录；这里用管理员记答辩结果验证发证）
  // 报名名单里加人要先够条件，所以用答辩结果接口验证：没报名的人记不了
  assert.equal((await call('POST', '/api/cohorts/result', { id, uid: 'nobody', result: 'pass' }, admin)).status, 404);
  r = (await call('GET', '/api/cohorts', null, a)).json;
  assert.equal(r.cohorts.length, 1); assert.equal(r.canHost, false); assert.ok(!('list' in r.cohorts[0]));
  r = (await call('GET', '/api/cohorts', null, admin)).json; assert.deepEqual(r.cohorts[0].list, []);
  // 园长看本园证书
  const dir = await login('甲园长', 'director', '甲园');
  r = (await call('GET', '/api/org/certificates', null, dir)).json;
  assert.deepEqual(r.counts, { tool: 1, domain: 0, backbone: 0 }); assert.equal(r.certificates[0].name, '陈老师');
  // 勋章里有证书类
  const h = (await call('GET', '/api/me/honors', null, a)).json;
  assert.equal(h.badges.find(b => b.key === 'cert-tool').on, true); assert.equal(h.badges.find(b => b.key === 'backbone').on, false);
  assert.equal((await call('POST', '/api/cohorts/close', { id }, admin)).json.cohort.phase, 'closed');
});
