/* 订阅消息：额度、openid 绑定、提交 → 通知点评人、点评 → 通知教师、拒收清零（academy/notify.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 微信桩：code → openid、token、subscribe/send（记下每条；openid 'o-refuse' 答 43101；第一个 token 过期一次）
function wxStub() {
  const seen = { sends: [], tokens: 0 };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const out = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (u.pathname === '/sns/jscode2session') return out(200, { openid: 'o-' + u.searchParams.get('js_code'), session_key: 'k' });
    if (u.pathname === '/cgi-bin/token') { seen.tokens++; return out(200, { access_token: 'tok-' + seen.tokens, expires_in: 7200 }); }
    if (u.pathname === '/cgi-bin/message/subscribe/send') {
      let raw = ''; req.on('data', d => raw += d); req.on('end', () => {
        const body = JSON.parse(raw);
        if (u.searchParams.get('access_token') === 'tok-1') return out(200, { errcode: 42001, errmsg: 'access_token expired' });
        seen.sends.push({ token: u.searchParams.get('access_token'), ...body });
        out(200, body.touser.startsWith('o-refuse') ? { errcode: 43101, errmsg: 'user refused' } : { errcode: 0, errmsg: 'ok' });
      });
      return;
    }
    out(404, {});
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}`, seen })));
}

async function startServer(t, extraEnv = {}) {
  const stub = await wxStub();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-notify-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1',
      WX_APPID: 'wx-test', WX_SECRET: 's', WX_API_BASE: stub.base, WX_TMPL_REVIEW: 'T-REVIEW', WX_TMPL_QUEUE: 'T-QUEUE',
      WX_TMPL_QUEUE_DATA: '{"thing1":"title","name2":"who","time3":"at","thing4":"note"}', ...extraEnv } });
  const h = { log: '' }; child.stdout.on('data', d => h.log += d); child.stderr.on('data', d => h.log += d);
  const port = await boundPort(child, () => h.log);
  t.after(() => { child.kill(); stub.srv.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { Authorization: 'Bearer ' + r.json.token }; };
  const settle = async (n, ms = 2000) => { const t0 = Date.now(); while (stub.seen.sends.length < n && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 30)); };
  return { call, login, seen: stub.seen, settle, log: () => h.log };
}

test('templateData: values are cut to the field rules, times formatted, blanks filled', async () => {
  process.env.WX_TMPL_REVIEW = 'x';
  const { templateData } = await import('../academy/notify.js');
  const d = templateData('review', { title: '一'.repeat(30), verdict: '需修改', at: Date.UTC(2026, 10, 3, 1, 5), comment: '' });
  assert.equal([...d.thing1.value].length, 20); assert.ok(d.thing1.value.endsWith('…'));
  assert.equal(d.phrase2.value, '需修改'); assert.match(d.time3.value, /^2026年11月3日 \d\d:\d\d$/); assert.equal(d.thing4.value, '无');
});

test('subscribe: grants count up, reject clears, a platform account binds its openid with a code', async t => {
  const { call, login } = await startServer(t);
  assert.equal((await call('GET', '/api/notify')).json.mine, null);
  assert.deepEqual((await call('GET', '/api/notify')).json.templates, { review: 'T-REVIEW', queue: 'T-QUEUE' });
  const wang = await login('王', 'teacher', '甲园');
  assert.equal((await call('POST', '/api/notify/subscribe', { results: { review: 'accept' } })).status, 401);
  let r = await call('POST', '/api/notify/subscribe', { results: { review: 'accept', queue: 'reject' }, code: 'code-wang-0001' }, wang);
  assert.deepEqual(r.json, { mine: { review: 1, queue: 0 }, openid: true, bound: true });
  r = await call('POST', '/api/notify/subscribe', { results: { review: 'accept' } }, wang);
  assert.deepEqual(r.json.mine, { review: 2, queue: 0 }); assert.equal(r.json.bound, false);
  r = await call('POST', '/api/notify/subscribe', { results: { review: 'reject' } }, wang);
  assert.equal(r.json.mine.review, 0);
  assert.deepEqual((await call('GET', '/api/notify', null, wang)).json.mine, { review: 0, queue: 0 });
});

test('a practice submission notifies the reviewers who hold a grant; the review notifies the teacher; a refusal clears the grant', async t => {
  const { call, login, seen, settle } = await startServer(t);
  const wang = await login('王', 'teacher', '甲园'), zhao = await login('赵', 'director', '甲园'), qian = await login('钱', 'director', '乙园'), sun = await login('孙', 'director', '甲园');
  await call('POST', '/api/notify/subscribe', { results: { review: 'accept' }, code: 'code-wang-0001' }, wang);
  await call('POST', '/api/notify/subscribe', { results: { queue: 'accept' }, code: 'code-zhao-0001' }, zhao);
  await call('POST', '/api/notify/subscribe', { results: { queue: 'accept' }, code: 'code-qian-0001' }, qian);
  // 孙没有订阅：不发
  const sub = (await call('POST', '/api/submissions', { levelId: 'obs-0', text: '事实：A 叠到第七块倒了。' }, wang)).json.submission;
  await settle(1);
  assert.equal(seen.sends.length, 1, '只有本园、有额度的赵收到');
  assert.equal(seen.sends[0].touser, 'o-code-zhao-0001'); assert.equal(seen.sends[0].template_id, 'T-QUEUE'); assert.equal(seen.sends[0].page, 'pages/home/home');
  assert.equal(seen.sends[0].data.thing1.value, '事实与推断'); assert.equal(seen.sends[0].data.name2.value, '王'); assert.equal(seen.sends[0].data.thing4.value, '事实：A 叠到第七块倒了。');
  assert.equal(seen.sends[0].token, 'tok-2', '第一个 token 过期后换了一个再发');
  assert.deepEqual((await call('GET', '/api/notify', null, zhao)).json.mine, { review: 0, queue: 0 }, '额度用掉');
  // 研讨关不通知
  await call('POST', '/api/submissions', { levelId: 'obs-1', text: '今天他和 B 搭了十分钟积木，我先说这件事。' }, wang);
  await settle(2, 300); assert.equal(seen.sends.length, 1);
  // 点评 → 通知王
  await call('POST', '/api/submissions/review', { id: sub.id, verdict: 'revise', comment: '推断没标依据', scores: [5] }, zhao);
  await settle(2);
  assert.equal(seen.sends.length, 2);
  assert.equal(seen.sends[1].touser, 'o-code-wang-0001'); assert.equal(seen.sends[1].template_id, 'T-REVIEW'); assert.equal(seen.sends[1].page, 'pages/level/level?p=obs&i=0');
  assert.equal(seen.sends[1].data.phrase2.value, '需修改'); assert.equal(seen.sends[1].data.thing4.value, '推断没标依据');
  // 王额度用完：再评一次不发
  await call('POST', '/api/submissions/review', { id: sub.id, verdict: 'pass', scores: [5] }, zhao);
  await settle(3, 300); assert.equal(seen.sends.length, 2);
  // 拒收：微信答 43101，额度清零
  const li = await login('李', 'teacher', '甲园');
  await call('POST', '/api/notify/subscribe', { results: { review: 'accept' }, code: 'refuse-0001' }, li);   // openid o-refuse-0001
  await call('POST', '/api/notify/subscribe', { results: { review: 'accept' } }, li);
  assert.equal((await call('GET', '/api/notify', null, li)).json.mine.review, 2);
  await call('POST', '/api/notify/subscribe', { results: { queue: 'accept' } }, zhao);
  const s2 = (await call('POST', '/api/submissions', { levelId: 'obs-0', text: '李的记录' }, li)).json.submission;
  await settle(3);
  await call('POST', '/api/submissions/review', { id: s2.id, verdict: 'pass' }, zhao);
  await settle(4);
  assert.equal(seen.sends[3].touser, 'o-refuse-0001');
  assert.equal((await call('GET', '/api/notify', null, li)).json.mine.review, 0, '拒收后清零');
});

test('without templates the routes are absent and submissions still work', async t => {
  const { call, login } = await startServer(t, { WX_TMPL_REVIEW: '', WX_TMPL_QUEUE: '' });
  assert.equal((await call('GET', '/api/notify')).status, 404);
  const wang = await login('王', 'teacher', '甲园');
  assert.equal((await call('POST', '/api/submissions', { levelId: 'obs-0', text: 'x' }, wang)).status, 200);
});
