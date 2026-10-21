/* 跨园共同体：区县管理员建组、一园一组、组内共享案例库与联合研讨题、组外看不到（academy/communities.js）。 */
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-comm-'));
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
  const login = async (name, role, org, district) => { const r = await call('POST', '/api/login/dev', { name, role, org, district }); return { Authorization: 'Bearer ' + r.json.token }; };
  return { call, login };
}

test('communities: build from district orgs, one org per group, shared drills and cases inside the group only', async t => {
  const { call, login } = await startServer(t);
  const d = await login('区县小李', 'district', '', '柳北区');
  const a = await login('甲园长', 'director', '甲园', '柳北区'), a2 = await login('甲一', 'nurse', '甲园', '柳北区');
  const b = await login('乙园长', 'director', '乙园', '柳北区');
  const c = await login('丙园长', 'director', '丙园', '柳北区');
  const far = await login('外区园长', 'director', '丁园', '鱼峰区');
  assert.equal((await call('GET', '/api/district/communities', null, a)).status, 403);
  let r = (await call('GET', '/api/district/communities', null, d)).json;
  assert.deepEqual(r.free.map(o => o.name), ['丙园', '甲园', '乙园']); assert.equal(r.communities.length, 0);
  // 只有一园不够；外区的园不行
  assert.equal((await call('POST', '/api/district/communities', { name: '一组', orgs: ['name:甲园'] }, d)).json.code, 'count');
  assert.equal((await call('POST', '/api/district/communities', { name: '一组', orgs: ['name:甲园', 'name:丁园'] }, d)).json.code, 'outside');
  r = await call('POST', '/api/district/communities', { name: '柳北一组', orgs: ['name:甲园', 'name:乙园'], lead: 'name:甲园' }, d);
  assert.equal(r.status, 200); const id = r.json.community.id; assert.equal(r.json.community.leadName, '甲园');
  assert.equal((await call('POST', '/api/district/communities', { name: '二组', orgs: ['name:乙园', 'name:丙园'] }, d)).status, 409); // 乙园已在一组
  r = (await call('GET', '/api/district/communities', null, d)).json;
  assert.deepEqual(r.free.map(o => o.name), ['丙园']);
  // 成员看自己的组
  assert.equal((await call('GET', '/api/me/community', null, a2)).json.community.name, '柳北一组');
  assert.equal((await call('GET', '/api/me/community', null, c)).json.community, null);
  // 区县管理员出联合研讨题：要指定本区的组
  assert.equal((await call('POST', '/api/drills', { title: '这是一道联合研讨题，怎么答' }, d)).json.code, 'community');
  r = await call('POST', '/api/drills', { title: '这是一道联合研讨题，怎么答', communityId: id }, d);
  assert.equal(r.status, 200); assert.equal(r.json.drill.scope, 'community'); assert.equal(r.json.drill.communityName, '柳北一组');
  const drillId = r.json.drill.id;
  assert.equal((await call('GET', '/api/drills', null, d)).json.postScope, 'community');
  // 组内两园看得到，丙园与外区看不到
  assert.equal((await call('GET', '/api/drills', null, b)).json.current.length, 1);
  assert.equal((await call('GET', '/api/drills', null, c)).json.current.length, 0);
  assert.equal((await call('GET', '/api/drills', null, far)).json.current.length, 0);
  // 甲一答了，乙园长答了：甲一看得到乙园长的（跨园）；区县管理员不用答也看得到；乙园长不能点评甲一的（点评按园）
  await call('POST', '/api/drills/answer', { id: drillId, text: '我会先把事实说清楚，再给家长留一个继续谈的入口。' }, a2);
  await call('POST', '/api/drills/answer', { id: drillId, text: '我先回答问题，不回避；哭的事实与之后的事实都说。' }, b);
  r = (await call('GET', '/api/drills/answers?id=' + drillId, null, a2)).json;
  assert.equal(r.locked, false); assert.deepEqual(r.answers.filter(x => !x.mine).map(x => x.orgName), ['乙园']);
  assert.equal(r.drill.answered, 2);
  r = (await call('GET', '/api/drills/answers?id=' + drillId, null, d)).json; assert.equal(r.answers.length, 2);
  const aAns = r.answers.find(x => x.orgName === '甲园');
  assert.equal((await call('POST', '/api/drills/review', { answerId: aAns.id, comment: '很好' }, b)).status, 403);
  assert.equal((await call('POST', '/api/drills/review', { answerId: aAns.id, comment: '事实在前，好。' }, a)).status, 200);
  // 共同体案例：乙园长交一条自己的案例并由管理员…这里只验过滤参数不报错且带 community 字段
  r = (await call('GET', '/api/cases?community=1', null, a2)).json;
  assert.equal(r.community.name, '柳北一组'); assert.deepEqual(r.cases, []);
  assert.equal((await call('GET', '/api/cases?community=1', null, c)).json.community, null);
  // 改组：换名、加丙园
  r = await call('POST', '/api/district/communities', { id, name: '柳北一组（扩）', orgs: ['name:甲园', 'name:乙园', 'name:丙园'] }, d);
  assert.equal(r.json.community.orgs.length, 3); assert.equal(r.json.community.lead, null);
  assert.equal((await call('GET', '/api/drills', null, c)).json.current.length, 1);
  // 解散：题一起删
  r = await call('POST', '/api/district/communities/delete', { id }, d);
  assert.equal(r.json.drillsRemoved, 1);
  assert.equal((await call('GET', '/api/drills', null, b)).json.current.length, 0);
  assert.equal((await call('GET', '/api/me/community', null, a2)).json.community, null);
});
