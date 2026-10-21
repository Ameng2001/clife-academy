/* 名师工作室与市级展示：管理员建室定主持人、申请要骨干认证、主持人加成员即授称号、收录产出；展示上台、名师点评、年度分享者、收官打标（academy/studios.js）。 */
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-studio-'));
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

test('studios: admin creates with a host, apply needs backbone cert, host adds a member (title granted), collects member cases as output', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营', 'it', '运营方');
  const expert = await login('专家讲师', 'director', '市教师发展中心'), a = await login('甲一', 'teacher', '甲园'), b = await login('乙一', 'teacher', '乙园');
  assert.equal((await call('POST', '/api/studios', { name: '张老师工作室', hostUid: expert.id }, a.h)).status, 403);
  let r = await call('POST', '/api/studios', { name: '张老师工作室', focus: '游戏活动支持与引导', term: '2026 秋', hostUid: expert.id, intro: '产出园本游戏案例' }, admin.h);
  assert.equal(r.status, 200); const st = r.json.studio; assert.equal(st.hostName, '专家讲师');
  r = (await call('GET', '/api/studios', null, a.h)).json;
  assert.equal(r.studios.length, 1); assert.equal(r.studios[0].canApply, false); assert.equal(r.eligible, false); assert.equal(r.studios[0].applicants, undefined);
  assert.equal((await call('POST', '/api/studios/apply', { id: st.id, note: '想来' }, a.h)).json.code, 'eligible');
  assert.equal((await call('POST', '/api/studios/members', { id: st.id, uid: a.id, action: 'add' }, b.h)).status, 403);
  r = await call('POST', '/api/studios/members', { id: st.id, uid: a.id, action: 'add', reason: '共同体赛入选两次' }, expert.h);
  assert.equal(r.status, 200); assert.equal(r.json.studio.members.length, 1); assert.equal(r.json.studio.mine, 'host');
  const honors = (await call('GET', '/api/me/honors', null, a.h)).json;
  assert.equal(honors.titles[0].label, '名师工作室成员');
  assert.equal((await call('GET', '/api/studios', null, a.h)).json.studios[0].mine, 'member');
  // 成员的入库案例可收为产出
  r = await call('POST', '/api/cases', { title: '影子游戏的三次推进', domain: 'play', age: '中班', use: 'adapt', text: '一'.repeat(60) }, a.h);
  const caseId = r.json.case.id;
  assert.equal((await call('POST', '/api/cases/decide', { id: caseId, action: 'approve' }, admin.h)).status, 200);
  r = (await call('GET', '/api/studios', null, expert.h)).json.studios[0];
  assert.equal(r.memberCases.length, 1);
  r = await call('POST', '/api/studios/cases', { id: st.id, caseIds: [caseId, 'nope'] }, expert.h);
  assert.equal(r.json.studio.cases.length, 1);
  // 移出成员撤称号
  await call('POST', '/api/studios/members', { id: st.id, uid: a.id, action: 'remove' }, expert.h);
  assert.equal((await call('GET', '/api/me/honors', null, a.h)).json.titles.length, 0);
});

test('showcases: host builds from the pool, comments works, grants 年度分享者 only to authors on stage, closing tags the cases', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营', 'it', '运营方');
  const expert = await login('专家讲师', 'director', '市教师发展中心'), a = await login('甲一', 'teacher', '甲园'), b = await login('乙一', 'teacher', '乙园');
  const st = (await call('POST', '/api/studios', { name: '张老师工作室', hostUid: expert.id }, admin.h)).json.studio;
  await call('POST', '/api/studios/members', { id: st.id, uid: a.id, action: 'add' }, expert.h);
  const mk = async (who, title) => { const r = await call('POST', '/api/cases', { title, domain: 'play', age: '中班', use: 'adapt', text: '一'.repeat(60) }, who.h); await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, admin.h); return r.json.case.id; };
  const c1 = await mk(a, '影子游戏'), c2 = await mk(b, '沙水区的水渠');
  await call('POST', '/api/studios/cases', { id: st.id, caseIds: [c1] }, expert.h);
  assert.equal((await call('POST', '/api/showcases', { studioId: st.id, title: '2026 柳州学前教育市级展示' }, a.h)).status, 403);
  let r = await call('POST', '/api/showcases', { studioId: st.id, year: '2026', title: '2026 柳州学前教育市级展示', theme: '游戏中的学习', place: '市教师发展中心' }, expert.h);
  assert.equal(r.status, 200); const sc = r.json.showcase;
  assert.equal(sc.pool.length, 1); assert.equal(sc.pool[0].from, '工作室产出'); // c2 不在候选池（不是共同体赛入选，也不是产出）
  r = await call('POST', '/api/showcases/entries', { id: sc.id, caseIds: [c1, c2] }, expert.h);
  assert.equal(r.json.showcase.entries.length, 2); assert.equal(r.json.showcase.pool.length, 0);
  assert.equal((await call('POST', '/api/showcases/comment', { id: sc.id, caseId: c1, text: '短' }, expert.h)).json.code, 'empty');
  r = await call('POST', '/api/showcases/comment', { id: sc.id, caseId: c1, text: '三次推进都从幼儿的问题出发，材料的变化跟着问题走。' }, expert.h);
  assert.equal(r.json.showcase.entries[0].comment.byName, '专家讲师');
  assert.equal((await call('POST', '/api/showcases/sharer', { id: sc.id, uid: admin.id, reason: '不在台上' }, expert.h)).json.code, 'author');
  r = await call('POST', '/api/showcases/sharer', { id: sc.id, uid: b.id, reason: '沙水区案例被三所园用过' }, expert.h);
  assert.equal(r.json.showcase.sharers.length, 1);
  assert.equal((await call('GET', '/api/me/honors', null, b.h)).json.titles[0].label, '年度分享者');
  // 全平台可看，看不到候选池
  r = (await call('GET', '/api/showcases', null, b.h)).json;
  assert.equal(r.showcases.length, 1); assert.equal(r.showcases[0].pool, undefined); assert.equal(r.showcases[0].entries[1].mine, true); assert.equal(r.canHost, false);
  r = await call('POST', '/api/showcases/close', { id: sc.id, summary: '两件作品，一个主题' }, expert.h);
  assert.ok(r.json.showcase.closedAt);
  r = (await call('GET', '/api/cases?showcase=1', null, b.h)).json;
  assert.equal(r.cases.length, 2); assert.equal(r.cases[0].showcase.year, '2026'); assert.equal(r.showcased, 2);
});
