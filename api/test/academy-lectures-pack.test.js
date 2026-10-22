/* 讲堂包：规则草稿（packDraftOf）、改定（cleanPack）、路由权限与对外范围（academy/lectures.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { packDraftOf, cleanPack, paragraphsOf } from '../academy/lectures.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-pack-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', FIRST_USER_ADMIN: '1', ASSISTANT_API_KEY: '', ASSISTANT_BASE: '' } });
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

const SCRIPT = `一、为什么要做
家长最关心的是安全与健康。我们从两个保育场景起步，先把晨检与午睡做扎实。

二、怎么起步
先选一个班试一个月，园长每周看一次数据。不要一上来全园铺开。

三、常见的坑
把工具当考核，老师就会应付。把它当备忘，老师才会用。

四、下一步
两个场景跑顺了再加第三个。`;

test('pack draft: headings become preview points and clip titles; text is moved, not invented', () => {
  const paras = paragraphsOf(SCRIPT);
  assert.equal(paras.length, 4); assert.equal(paras[0].head, '为什么要做');
  const d = packDraftOf({ title: '数智化幼儿园的建设路径', speaker: '张教授' }, SCRIPT);
  assert.deepEqual(d.preview.points, ['为什么要做', '怎么起步', '常见的坑', '下一步']);
  assert.equal(d.clips.length, 4); assert.equal(d.clips[0].id, 'c1'); assert.equal(d.clips[1].title, '怎么起步'); assert.match(d.clips[1].desc, /^先选一个班/);
  assert.equal(d.poster.headline, '数智化幼儿园的建设路径'); assert.equal(d.poster.lines.at(-1), '张教授 主讲 · 名师讲堂');
  // 没小标题、没空行：按句子切，最多 5 条要点、切片不超过 5 组
  const long = Array.from({ length: 14 }, (_, i) => `第 ${i + 1} 句话讲一件事。`).join('');
  const e = packDraftOf({ title: 't' }, long);
  assert.equal(e.preview.points.length, 5); assert.ok(e.clips.length <= 5 && e.clips.length >= 3);
  // 改定收口：条数与长度
  const c = cleanPack({ preview: { points: ['a', '', 'b', 'c', 'd', 'e', 'f'] }, clips: [{ id: 'c1', title: 'x'.repeat(50), desc: 'y', start: '90' }, { title: '' }], poster: { headline: 'h', lines: ['l'] } });
  assert.equal(c.preview.points.length, 5); assert.equal(c.clips.length, 1); assert.equal(c.clips[0].title.length, 30); assert.equal(c.clips[0].start, 90);
  assert.equal(cleanPack(null), null);
});

test('pack routes: admin drafts and saves; preview is public before the lecture, clips and poster only after; clips feed the library', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const teacher = await login('王老师', 'nurse', '柳北区示例幼儿园');
  const soon = Date.now() + 3600000, past = Date.now() - 7200000;
  let r = await call('POST', '/api/lectures', { title: '数智化幼儿园的建设路径', speaker: '张教授', at: soon }, admin); const id = r.json.lecture.id;
  r = await call('POST', '/api/lectures', { title: '上月：保育两个场景', at: past, replayUrl: 'https://example.com/replay' }, admin); const pastId = r.json.lecture.id;
  assert.equal(r.json.lecture.pack, null);
  assert.equal((await call('POST', '/api/lectures/pack/draft', { id, script: SCRIPT }, teacher)).status, 403);
  assert.equal((await call('POST', '/api/lectures/pack/draft', { id, script: '太短' }, admin)).json.code, 'script');
  assert.equal((await call('POST', '/api/lectures/pack/draft', { id: 'nope', script: SCRIPT }, admin)).status, 404);
  r = await call('POST', '/api/lectures/pack/draft', { id, script: SCRIPT }, admin);
  assert.equal(r.status, 200); assert.equal(r.json.lecture.pack.model, false); assert.equal(r.json.lecture.pack.script, SCRIPT); assert.equal(r.json.lecture.pack.clips.length, 4);
  // 讲前：谁都看得到预习卡，看不到切片、海报、讲稿
  r = await call('GET', '/api/lectures'); const up = r.json.upcoming.find(l => l.id === id);
  assert.deepEqual(up.pack.preview.points, ['为什么要做', '怎么起步', '常见的坑', '下一步']); assert.deepEqual(up.pack.clips, []); assert.equal(up.pack.poster, null); assert.equal(up.pack.script, undefined);
  r = await call('GET', '/api/lectures', null, teacher); assert.equal(r.json.upcoming.find(l => l.id === id).pack.script, undefined);
  // 讲完的那场：切片与海报对外，进讲堂微课
  r = await call('POST', '/api/lectures/pack/draft', { id: pastId, script: SCRIPT }, admin); assert.equal(r.status, 200);
  r = await call('POST', '/api/lectures/pack', { id: pastId, pack: { preview: { points: ['两个场景起步'] }, clips: [{ id: 'c1', title: '为什么从保育起步', desc: '家长最关心的是安全与健康。', start: 120 }, { id: 'c2', title: '一个班试一个月', desc: '园长每周看一次数据。' }], poster: { headline: '保育两个场景', lines: ['先晨检午睡', '一个班一个月'] } } }, admin);
  assert.equal(r.status, 200); assert.equal(r.json.lecture.pack.clips.length, 2); assert.equal(r.json.lecture.pack.clips[0].start, 120); assert.equal(r.json.lecture.pack.script, SCRIPT);
  assert.equal((await call('POST', '/api/lectures/pack', { id: pastId, pack: { preview: { points: [] }, clips: [] } }, admin)).json.code, 'pack');
  assert.equal((await call('POST', '/api/lectures/pack', { id: pastId, pack: {} }, teacher)).status, 403);
  r = await call('GET', '/api/lectures'); const done = r.json.done.find(l => l.id === pastId);
  assert.equal(done.pack.clips.length, 2); assert.equal(done.pack.poster.headline, '保育两个场景'); assert.equal(done.pack.script, undefined);
  r = await call('GET', '/api/lectures/clips'); assert.equal(r.status, 200);
  assert.deepEqual(r.json.clips.map(c => c.id), [pastId + ':c1', pastId + ':c2']); assert.equal(r.json.clips[0].lecture, '上月：保育两个场景'); assert.equal(r.json.clips[0].replayUrl, 'https://example.com/replay'); assert.equal(r.json.clips[0].start, 120);
  // 删包
  r = await call('POST', '/api/lectures/pack', { id: pastId, pack: null }, admin); assert.equal(r.json.lecture.pack, null);
  assert.equal((await call('GET', '/api/lectures/clips')).json.clips.length, 0);
});
