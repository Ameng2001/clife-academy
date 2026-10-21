/* 斗课园内赛：出题、应战、截止后可见、互评与分数保密、编组、对照、入选、收官入库（academy/contests.js）。 */
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-con-'));
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
  const login = async (name, role, org) => { const r = await call('POST', '/api/login/dev', { name, role, org }); return { Authorization: 'Bearer ' + r.json.token }; };
  return { call, login };
}
const ORG = '柳北区示例幼儿园';
const DESIGN = '活动名：影子从哪来。环节一：户外找影子，孩子用粉笔描下同伴的影子（10 分钟）。环节二：回到室内，用手电筒和积木做影子，换光源位置看影子怎么变（15 分钟）。环节三：画出「我发现的影子秘密」。材料：粉笔、手电筒 6 支、积木、记录纸。';

test('contest: host sets the theme, teachers enter, designs hide until the deadline, scores stay private, closing files everything into the library', async t => {
  const { call, login } = await startServer(t);
  const dir = await login('赵园长', 'director', ORG), t1 = await login('王老师', 'teacher', ORG), t2 = await login('李美丽', 'teacher', ORG), t3 = await login('周老师', 'teacher', ORG), far = await login('外园', 'teacher', '鱼峰区示例幼儿园');
  assert.equal((await call('POST', '/api/contests', { title: 'x', activity: 'y', goal: 'z' }, t1)).status, 403);
  let r = await call('POST', '/api/contests', { month: '2026-12', title: '中班科学：影子从哪来', age: '中班', activity: '影子从哪来', goal: '感知光与影子的关系，能用语言描述影子的变化', guide: '科学探究 目标 2：能对事物或现象进行观察比较', domain: 'plan', dueAt: Date.now() + 3600000 }, dir);
  assert.equal(r.status, 200); const id = r.json.contest.id; assert.equal(r.json.contest.phase, 'open'); assert.equal(r.json.contest.canHost, true);
  assert.equal((await call('GET', '/api/contests', null, far)).json.current.length, 0);
  // 应战：≥100 字；别人应战期看不到设计
  assert.equal((await call('POST', '/api/contests/enter', { id, design: '太短' }, t1)).status, 400);
  r = await call('POST', '/api/contests/enter', { id, design: DESIGN, note: '第一次试，孩子对手电筒更感兴趣。' }, t1); assert.equal(r.json.contest.mine.design, DESIGN); assert.equal(r.json.contest.entries, 1);
  await call('POST', '/api/contests/enter', { id, design: DESIGN + ' 李版：加一个比影子长短的环节。' }, t2);
  await call('POST', '/api/contests/enter', { id, design: DESIGN + ' 周版：改成下午户外。' }, t3);
  r = await call('GET', '/api/contests/one?id=' + id, null, t2); assert.equal(r.json.contest.list, undefined); assert.equal(r.json.contest.mine.design.includes('李版'), true);
  r = await call('GET', '/api/contests/one?id=' + id, null, dir); assert.equal(r.json.contest.list.length, 3); // 主持人看得到
  assert.equal((await call('POST', '/api/contests/group', { id }, dir)).status, 400); // 没截止不能编组
  // 截止：把 dueAt 改到过去
  await call('POST', '/api/contests', { id, month: '2026-12', title: '中班科学：影子从哪来', age: '中班', activity: '影子从哪来', goal: '感知光与影子的关系', domain: 'plan', dueAt: Date.now() - 1000 }, dir);
  r = await call('GET', '/api/contests/one?id=' + id, null, t2); assert.equal(r.json.contest.phase, 'review'); assert.equal(r.json.contest.list.length, 3); assert.ok(r.json.contest.list.every(e => e.design));
  assert.equal((await call('POST', '/api/contests/enter', { id, design: DESIGN }, t3)).status, 400);
  // 互评：五项 1–5 + 一句话；不评自己；分数只有作者看自己的
  const e1 = r.json.contest.list.find(e => e.name === '王老师').id, e2 = r.json.contest.list.find(e => e.name === '李美丽').id;
  assert.equal((await call('POST', '/api/contests/rate', { entryId: e2, scores: [5, 4, 4, 5, 3], comment: '好' }, t2)).status, 403);
  assert.equal((await call('POST', '/api/contests/rate', { entryId: e1, scores: [5, 4], comment: '好' }, t2)).status, 400);
  r = await call('POST', '/api/contests/rate', { entryId: e1, scores: [5, 4, 4, 5, 3], comment: '手电筒环节设计得具体，反思可以再写细。' }, t2); assert.equal(r.status, 200); assert.equal(r.json.entry.ratingsCount, 1); assert.equal(r.json.entry.ratings, undefined);
  await call('POST', '/api/contests/rate', { entryId: e1, scores: [4, 4, 5, 4, 4], comment: '材料准备充分。' }, t3);
  await call('POST', '/api/contests/rate', { entryId: e2, scores: [3, 3, 4, 3, 3], comment: '比长短的环节时间不够。' }, t1);
  r = await call('GET', '/api/contests/one?id=' + id, null, t1); const m = r.json.contest.mine; assert.equal(m.ratings.length, 2); assert.equal(m.ratings[0].byName, '李美丽'); assert.equal(m.avg, undefined);
  assert.equal(r.json.contest.list.find(e => e.id === e2).ratings, undefined); assert.equal(r.json.contest.list.find(e => e.id === e2).avg, undefined);
  r = await call('GET', '/api/contests/one?id=' + id, null, dir); assert.equal(r.json.contest.list.find(e => e.id === e1).avg, 4.2);
  // 编组、对照、入选、收官
  r = await call('POST', '/api/contests/group', { id }, dir); assert.equal(r.json.contest.groups.length, 1); assert.equal(r.json.contest.groups[0].entryIds.length, 3);
  assert.equal((await call('POST', '/api/contests/review', { id, group: 1, text: '短' }, dir)).status, 400);
  r = await call('POST', '/api/contests/review', { id, group: 1, text: '三份设计的差别在光源：王老师用手电筒让孩子自己控制，李老师加了比较，周老师放到下午利用自然光。换到小班，建议都从户外描影子开始，室内环节减半。' }, dir); assert.ok(r.json.contest.groups[0].review.text.includes('光源'));
  r = await call('POST', '/api/contests/select', { id, entryIds: [e1] }, dir); assert.equal(r.json.contest.selectedCount, 1);
  r = await call('POST', '/api/contests/close', { id, summary: '首期三人参赛，入选一份。' }, dir); assert.equal(r.json.contest.phase, 'done'); assert.ok(r.json.contest.list.every(e => e.caseId));
  assert.equal((await call('POST', '/api/contests/close', { id }, dir)).status, 400);
  r = await call('GET', '/api/cases', null, t2); assert.equal(r.json.total, 3);
  const sel = r.json.cases.find(c => c.source.selected); assert.equal(sel.byName, '王老师'); assert.equal(sel.source.tag, '同课异构 · 2026-12 · 中班'); assert.equal(sel.use, 'adapt'); assert.ok(sel.text.includes('同课异构对照'));
  assert.equal(r.json.cases.filter(c => c.source.tag === '参赛作品').length, 2);
  r = await call('GET', '/api/me/honors', null, t3); assert.equal(r.json.creditsTotal, 2);
  r = await call('GET', '/api/contests', null, t1); assert.equal(r.json.past.length, 1); assert.equal(r.json.current.length, 0);
});
