/* 改编来源链：改自已入库案例、链与被改编列表、入库时给原案例记「用过，有效」（academy/cases.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-adapt-'));
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
const TEXT = '之前午睡前孩子们总是吵，老师要喊好几遍。后来我们在入睡前加了十分钟安静角，先听一段故事。现在大部分孩子十分钟内能躺下，起床后情绪也好了。';

test('adaptation chain: source must be approved, both names stay, approval records a use on the original, chain walks up', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const a = await login('王老师', 'director', '甲园'); // 园长交的直接待审核
  const b = await login('李老师', 'director', '乙园');
  const c = await login('周老师', 'director', '丙园');
  let r = await call('POST', '/api/cases', { title: '午睡前的安静角', domain: 'life', use: 'adapt', text: TEXT }, a); const A = r.json.case.id;
  // 还没入库的不能当来源
  assert.equal((await call('POST', '/api/cases', { title: '改', domain: 'life', use: 'adapt', text: TEXT, adaptedFrom: A }, b)).json.code, 'adapt');
  assert.equal((await call('POST', '/api/cases/decide', { id: A, action: 'approve' }, admin)).status, 200);
  r = await call('POST', '/api/cases', { title: '乙园的安静角：换成放音乐', domain: 'life', use: 'direct', text: TEXT, adaptedFrom: A, adaptNote: '故事换成音乐' }, b);
  assert.equal(r.status, 200); const B = r.json.case.id; assert.equal(r.json.case.adaptedFrom.title, '午睡前的安静角'); assert.equal(r.json.case.adaptedFrom.byName, '王老师'); assert.equal(r.json.case.adaptedFrom.note, '故事换成音乐');
  // 入库前原案例没有被改编记录、没有用过记录
  r = await call('GET', '/api/cases', null, a); let orig = r.json.cases.find(x => x.id === A); assert.deepEqual(orig.adaptations, []); assert.equal(orig.used, 0);
  assert.equal((await call('POST', '/api/cases/decide', { id: B, action: 'approve' }, admin)).status, 200);
  r = await call('GET', '/api/cases', null, a); orig = r.json.cases.find(x => x.id === A);
  assert.equal(orig.adaptations.length, 1); assert.equal(orig.adaptations[0].byName, '李老师'); assert.equal(orig.used, 1); assert.match(orig.uses[0].note, /改编为/);
  // 再审一次不会重复记（approve 已入库会 400），再改编一级：链往上两级
  r = await call('POST', '/api/cases', { title: '丙园：安静角加手指游戏', domain: 'life', use: 'direct', text: TEXT, adaptedFrom: B }, c); const C = r.json.case.id;
  assert.equal((await call('POST', '/api/cases/decide', { id: C, action: 'approve' }, admin)).status, 200);
  r = await call('GET', '/api/cases', null, c); const third = r.json.cases.find(x => x.id === C);
  assert.deepEqual(third.chain.map(x => x.byName), ['李老师', '王老师']);
  orig = r.json.cases.find(x => x.id === A); assert.equal(orig.adaptations.length, 1); // 只列直接改自这条的
  // 自己改自己的：不记用过
  r = await call('POST', '/api/cases', { title: '王老师自己再改', domain: 'life', use: 'direct', text: TEXT, adaptedFrom: A }, a); const D = r.json.case.id;
  assert.equal((await call('POST', '/api/cases/decide', { id: D, action: 'approve' }, admin)).status, 200);
  r = await call('GET', '/api/cases', null, a); orig = r.json.cases.find(x => x.id === A); assert.equal(orig.used, 1); assert.equal(orig.adaptations.length, 2);
  // 去掉来源
  r = await call('POST', '/api/cases', { title: '草稿', domain: 'life', use: 'idea', text: TEXT, adaptedFrom: A }, b); const E = r.json.case.id;
  r = await call('POST', '/api/cases', { id: E, title: '草稿', domain: 'life', use: 'idea', text: TEXT, adaptedFrom: null }, b); assert.equal(r.json.case.adaptedFrom, null);
});
