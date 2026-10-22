/* 课程成果：交（含投稿令牌）→ 园长同意 → 审核入库 +3 学分；changes 为空不收；用过有效只给分享者看；筛选（academy/works.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUMMARY = '小班 3 周主题式课程，从体测发现下肢力量薄弱出发，每周 5 个学习活动加户外活动，教案由教研工坊起草，班里用了两周后把户外跳箱改成了跨跳垫。';
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-works-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', DEV_LOGIN: '1', FIRST_USER_ADMIN: '1', TOOLS_API_KEY: 'tools-secret' } });
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
const WORK = { title: '运动：下肢力量锻炼', pipeline: 'theme', age: '小班', weeks: 3, domains: ['health', 'lang'], summary: SUMMARY, changes: ['户外跳箱改成跨跳垫，小班跳不上去'], files: [{ name: '主题网络图.docx', url: 'https://jiaoyan.clife.cn/f/1.docx' }, { name: '坏链接', url: 'http://x' }], source: { courseId: '1522', url: 'https://jiaoyan.clife.cn/teaching-workshop/x?id=1522' } };

test('submit → consent → approve: +3 credits, listed with filters, uses visible only to the sharer', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('管理员', 'director', '园A');
  const teacher = await login('王老师', 'teacher', '园B');
  const director = await login('李园长', 'director', '园B');
  const other = await login('赵老师', 'teacher', '园C');
  const bad = await call('POST', '/api/works', { ...WORK, changes: [] }, teacher.auth);
  assert.equal(bad.status, 400); assert.equal(bad.json.code, 'changes');
  const r = await call('POST', '/api/works', WORK, teacher.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const w = r.json.work;
  assert.equal(w.status, 'consent'); assert.equal(w.source.kind, 'workshop'); assert.equal(w.files.length, 1); assert.deepEqual(w.domainNames, ['健康', '语言']);
  assert.equal((await call('GET', '/api/works', null, other.auth)).json.total, 0);
  assert.equal((await call('POST', '/api/works/decide', { id: w.id, action: 'consent' }, other.auth)).status, 403);
  const q = await call('GET', '/api/works/queue', null, director.auth);
  assert.equal(q.json.consent.length, 1);
  assert.equal((await call('POST', '/api/works/decide', { id: w.id, action: 'consent' }, director.auth)).json.work.status, 'pending');
  assert.equal((await call('POST', '/api/works/decide', { id: w.id, action: 'approve' }, admin.auth)).json.work.status, 'approved');
  const me = await call('GET', '/api/me/credits', null, teacher.auth);
  if (me.status === 200) assert.ok(JSON.stringify(me.json).includes('课程成果入库'));
  const list = await call('GET', '/api/works?pipeline=theme&domain=health&q=跨跳', null, other.auth);
  assert.equal(list.json.total, 1); assert.equal(list.json.works[0].byName, '王老师'); assert.equal('uses' in list.json.works[0], false);
  assert.equal((await call('GET', '/api/works?pipeline=pbl', null, other.auth)).json.total, 0);
  assert.equal((await call('POST', '/api/works/used', { id: w.id, note: '改成了中班' }, other.auth)).status, 200);
  assert.equal((await call('POST', '/api/works/used', { id: w.id }, teacher.auth)).json.code, 'own');
  const mine = await call('GET', '/api/works/mine', null, teacher.auth);
  assert.deepEqual(mine.json.works[0].uses.map(u => u.name), ['赵老师']);
  assert.equal((await call('POST', '/api/works/delete', { id: w.id }, teacher.auth)).status, 403);
});

test('a submit token can post a work and nothing else; it is tagged with the token label', async t => {
  const { call, login } = await startServer(t);
  const teacher = await login('王老师', 'teacher', '园B');
  const tk = await call('POST', '/api/me/tokens', { label: '教研工坊', scope: 'submit' }, teacher.auth);
  assert.equal(tk.status, 200, JSON.stringify(tk.json));
  const auth = { Authorization: 'Bearer ' + tk.json.token };
  const r = await call('POST', '/api/works', WORK, auth);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.work.source.kind, 'token'); assert.equal(r.json.work.source.via, '教研工坊'); assert.equal(r.json.work.byName, '王老师');
  assert.equal((await call('POST', '/api/works/used', { id: r.json.work.id }, auth)).status, 403);
});

test('message / allowAdapt / filesScope: message ≤ 80 chars, files hidden outside the scope, summary and changes still public', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('管理员', 'director', '园A');
  {
    // 四栏表词表与上限；提交应答带 url 与 next；署名一句单独改（入库后也能），草稿不行，别人的不行
    const zhou = await login('周老师', 'teacher', '园Z'), qian = await login('钱老师', 'teacher', '园Z');
    const tok = await call('POST', '/api/me/tokens', { label: '教研工坊', scope: 'submit' }, zhou.auth); const tk = { Authorization: 'Bearer ' + tok.json.token };
    let o = await call('GET', '/api/works/options', null, tk); assert.equal(o.status, 200); assert.equal(o.json.limits.summaryMin, 50); assert.deepEqual(Object.keys(o.json.pipelines), ['theme', 'pbl', 'activity']); assert.equal(o.json.changesHints.length, 3);
    assert.equal((await call('GET', '/api/works/options')).status, 401);
    let r = await call('POST', '/api/works', WORK, tk); assert.equal(r.status, 200); assert.equal(r.json.url, '/works?tab=mine&id=' + r.json.work.id); assert.ok(r.json.next.includes('园长')); const wid = r.json.work.id;
    r = await call('POST', '/api/works/message', { id: wid, message: '中班也能用，跳绳换矮一点的' }, tk); assert.equal(r.status, 200); assert.equal(r.json.work.message, '中班也能用，跳绳换矮一点的');
    assert.equal((await call('POST', '/api/works/message', { id: wid, message: 'x' }, qian.auth)).json.code, 'edit');
    assert.equal((await call('POST', '/api/works/message', { id: wid }, tk)).json.code, 'message');
    assert.equal((await call('POST', '/api/works/message', { id: 'nope', message: 'x' }, tk)).json.code, 'work');
    const d = await call('POST', '/api/works/draft', { title: '草', pipeline: 'theme' }, tk); assert.equal((await call('POST', '/api/works/message', { id: d.json.work.id, message: 'x' }, tk)).json.code, 'draft');
    await call('POST', '/api/works/decide', { id: wid, action: 'consent' }, (await login('赵园长Z', 'director', '园Z')).auth); await call('POST', '/api/works/decide', { id: wid, action: 'approve' }, admin.auth);
    r = await call('POST', '/api/works/message', { id: wid, message: '' }, tk); assert.equal(r.status, 200); assert.equal(r.json.work.message, null, 'cleared after approval is fine');
    assert.equal((await call('POST', '/api/works', { ...WORK, id: wid }, tk)).json.code, 'edit', 'but the body itself is locked');
  }
  const teacher = await login('王老师', 'teacher', '园B');
  const mate = await login('刘老师', 'teacher', '园B');
  const other = await login('赵老师', 'teacher', '园C');
  const r = await call('POST', '/api/works', { ...WORK, message: '第二周换成本班儿歌以后，幼儿自己会唱着做了。'.repeat(5), allowAdapt: false, filesScope: 'org' }, teacher.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const w = r.json.work;
  assert.equal(w.message.length, 80); assert.equal(w.allowAdapt, false); assert.equal(w.filesScope, 'org'); assert.equal(w.filesScopeName, '本园');
  assert.equal(w.files.length, 1); assert.equal(w.filesHidden, false);
  assert.equal((await call('POST', '/api/works/decide', { id: w.id, action: 'approve' }, admin.auth)).json.work.status, 'approved');
  const seenByMate = (await call('GET', '/api/works', null, mate.auth)).json.works[0];
  assert.equal(seenByMate.files.length, 1); assert.equal(seenByMate.filesHidden, false);
  const seenByOther = (await call('GET', '/api/works', null, other.auth)).json.works[0];
  assert.equal(seenByOther.files.length, 0); assert.equal(seenByOther.filesHidden, true);
  assert.equal(seenByOther.summary, SUMMARY); assert.deepEqual(seenByOther.changes, WORK.changes); assert.equal(seenByOther.allowAdapt, false);
  const plain = await call('POST', '/api/works', { ...WORK, title: '第二门' }, teacher.auth);
  assert.equal(plain.json.work.message, null); assert.equal(plain.json.work.allowAdapt, true); assert.equal(plain.json.work.filesScope, 'all');
  assert.equal((await call('POST', '/api/works', { ...WORK, title: '第二门', id: plain.json.work.id, filesScope: 'nowhere' }, teacher.auth)).json.work.filesScope, 'all');
});

test('draft: a token lands a draft without changes (and any changes it sends are dropped); only the owner sees it; the owner completes it and submits; the token cannot push it through', async t => {
  const { call, login } = await startServer(t);
  await login('运营方', 'director', '本地运营'); // 第一个账号是管理员
  const teacher = await login('王老师', 'teacher', '园B'), zhao = await login('赵园长', 'director', '园B');
  const tk = await call('POST', '/api/me/tokens', { label: 'Claude', scope: 'submit' }, teacher.auth);
  const auth = { Authorization: 'Bearer ' + tk.json.token };
  let r = await call('POST', '/api/works/draft', { title: '运动：下肢力量', pipeline: 'theme', summary: '短的', domains: ['health'], changes: ['Agent 编的'] }, auth);
  assert.equal(r.status, 200, JSON.stringify(r.json)); const id = r.json.work.id;
  assert.equal(r.json.work.status, 'draft'); assert.deepEqual(r.json.work.changes, [], 'token changes are dropped'); assert.equal(r.json.work.source.via, 'Claude'); assert.equal(r.json.url, `/works?tab=mine&id=${id}`); assert.ok(r.json.work.expiresAt > Date.now());
  assert.equal((await call('POST', '/api/works/draft', { title: 'x' }, auth)).status, 400, 'pipeline required');
  // 只本人可见：公开列表没有、园长队列没有、「我交的」有
  assert.ok(!(await call('GET', '/api/works', null, zhao.auth)).json.works.some(w => w.id === id));
  assert.equal((await call('GET', '/api/works/queue', null, zhao.auth)).json.consent.length, 0);
  r = await call('GET', '/api/works/mine', null, teacher.auth); assert.equal(r.json.works[0].id, id); assert.equal(r.json.works[0].status, 'draft');
  // 令牌不能把草稿推进流程；教师补齐后交，变 consent
  assert.equal((await call('POST', '/api/works', { ...WORK, id }, auth)).status, 403);
  assert.equal((await call('POST', '/api/works', { ...WORK, id, changes: [] }, teacher.auth)).status, 400, 'still needs changes');
  r = await call('POST', '/api/works', { ...WORK, id, changes: ['跳箱改成跨跳垫'] }, teacher.auth); assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.work.status, 'consent');
  assert.equal((await call('GET', '/api/works/queue', null, zhao.auth)).json.consent.length, 1);
  assert.equal((await call('POST', '/api/works/draft', { id, title: 'x', pipeline: 'theme' }, teacher.auth)).status, 403, 'no longer a draft');
});

test('adapt chain: adapt only from an approved work that allows it; the adaptation is signed by both, the original gets a use and its author adapted points', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('管理员', 'director', '园A');
  const wang = await login('王老师', 'teacher', '园B'), li = await login('李老师', 'teacher', '园C');
  const approve = async id => { await call('POST', '/api/works/decide', { id, action: 'approve' }, admin.auth); };
  let r = await call('POST', '/api/works', WORK, wang.auth); const a = r.json.work.id;
  assert.equal((await call('POST', '/api/works', { ...WORK, title: '改编：下肢', adaptedFrom: a }, li.auth)).status, 400, 'not in the library yet');
  await approve(a);
  r = await call('POST', '/api/works', { ...WORK, title: '只看', allowAdapt: false }, wang.auth); const locked = r.json.work.id; await approve(locked);
  assert.equal((await call('POST', '/api/works', { ...WORK, title: 'x', adaptedFrom: locked }, li.auth)).json.code, 'adapt', 'sharer did not allow');
  r = await call('GET', '/api/works', null, li.auth);
  assert.equal(r.json.works.find(w => w.id === a).canAdapt, true); assert.equal(r.json.works.find(w => w.id === locked).canAdapt, false);
  assert.equal((await call('GET', '/api/works', null, wang.auth)).json.works.find(w => w.id === a).canAdapt, false, 'not your own');
  const wangBefore = (await call('GET', '/api/me/points', null, wang.auth)).json.points;
  r = await call('POST', '/api/works', { ...WORK, title: '改编：下肢力量（中班）', age: '中班', changes: ['跨跳垫换成跳绳，中班跳得动'], adaptedFrom: a }, li.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json)); const b = r.json.work.id;
  assert.equal(r.json.work.adaptedFrom.id, a); assert.equal(r.json.work.adaptedFrom.byName, '王老师');
  assert.equal((await call('GET', '/api/works', null, li.auth)).json.works.find(w => w.id === a).adaptations.length, 0, 'not until approved');
  // 工坊改编半价（WORKSHOP-TODO 第 14 条）：报价与扣减都按入库成果 5 折；没入库的、不许改编的答 400 adapt
  const key = { Authorization: 'Bearer tools-secret' };
  let qt = await call('GET', `/api/points/quote?pipeline=theme&weeks=3&adaptedFrom=${a}&uid=${li.id}`, null, key);
  assert.equal(qt.status, 200); assert.equal(qt.json.full, 90); assert.equal(qt.json.n, 45); assert.equal(qt.json.adapted.title, WORK.title); assert.ok(qt.json.note.startsWith('改编自《' + WORK.title + '》 5 折')); assert.equal(qt.json.enough, false);
  assert.equal((await call('GET', `/api/points/quote?pipeline=theme&weeks=3`, null, key)).json.n, 90);
  assert.equal((await call('GET', `/api/points/quote?pipeline=pbl&weeks=4&adaptedFrom=${locked}`, null, key)).json.code, 'adapt');
  assert.equal((await call('GET', `/api/points/quote?pipeline=nope`, null, key)).json.code, 'pipeline');
  let sp = await call('POST', '/api/points/spend', { uid: li.id, tool: 'workshop', pipeline: 'activity', ref: 'course:9:draft', adaptedFrom: a }, key);
  assert.equal(sp.status, 409);
  sp = await call('POST', '/api/points/spend', { uid: wang.id, tool: 'workshop', n: 10, ref: 'course:8:draft', adaptedFrom: a, note: '联调' }, key);
  assert.equal(sp.status, 200); assert.equal(sp.json.n, 5); assert.equal(sp.json.full, 10); assert.equal(sp.json.note, '改编自《' + WORK.title + '》 5 折 · 联调');
  assert.equal((await call('POST', '/api/points/spend', { uid: wang.id, tool: 'workshop', n: 10, ref: 'course:7:draft', adaptedFrom: 'nope' }, key)).json.code, 'adapt');
  const wh = (await call('GET', '/api/points/of?uid=' + wang.id, null, key)).json.history.find(h => h.kind === 'spend');
  assert.equal(wh.n, -5); assert.ok(wh.note.startsWith('改编自《')); assert.equal(wh.adaptedFrom.id, a); assert.equal(wh.adaptedFrom.title, WORK.title); assert.ok(wh.adaptedFrom.url.endsWith('/#/works?id=' + a));
  // 工坊开 ?from=1522&work=<a> 时核对来源（第 9、10 条）：对得上、能改编、不是本人；from 错了 course-mismatch；锁了的 not-allowed；没登录过学坊的 uid 404
  assert.equal((await call('GET', `/api/tools/work?id=${a}`)).status, 403);
  let tw = await call('GET', `/api/tools/work?id=${a}&from=1522&uid=${li.id}`, null, key);
  assert.equal(tw.status, 200); assert.equal(tw.json.canAdapt, true); assert.equal(tw.json.match, true); assert.equal(tw.json.own, false); assert.equal(tw.json.source.courseId, '1522');
  assert.equal(tw.json.label, '改编自《' + WORK.title + '》· 王老师（园B）'); assert.equal(tw.json.share.adaptedFrom, a); assert.equal(tw.json.files, undefined, 'no files: the workshop has the course');
  assert.equal((await call('GET', `/api/tools/work?id=${a}&from=1522&uid=${wang.id}`, null, key)).json.own, true);
  tw = await call('GET', `/api/tools/work?id=${a}&from=9999`, null, key); assert.equal(tw.json.canAdapt, false); assert.equal(tw.json.why, 'course-mismatch'); assert.equal(tw.json.match, false);
  tw = await call('GET', `/api/tools/work?id=${locked}`, null, key); assert.equal(tw.json.canAdapt, false); assert.equal(tw.json.why, 'not-allowed');
  assert.equal((await call('GET', `/api/tools/work?id=nope`, null, key)).json.code, 'work');
  assert.equal((await call('GET', `/api/tools/work?id=${a}&uid=nobody`, null, key)).json.code, 'uid');
  await call('POST', '/api/works/decide', { id: b, action: 'consent' }, (await login('赵园长', 'director', '园C')).auth);
  await approve(b);
  r = await call('GET', '/api/works', null, wang.auth); const orig = r.json.works.find(w => w.id === a), adap = r.json.works.find(w => w.id === b);
  assert.equal(orig.adaptations.length, 1); assert.equal(orig.adaptations[0].byName, '李老师'); assert.deepEqual(orig.adaptations[0].changes, ['跨跳垫换成跳绳，中班跳得动']);
  assert.equal(orig.uses.length, 1); assert.ok(orig.uses[0].note.includes('改编为'));
  assert.equal(adap.chain.length, 1); assert.equal(adap.chain[0].id, a);
  assert.equal(orig.source.courseId, '1522', 'workshop course id is exposed so the client can build the ?from= jump');
  r = await call('GET', '/api/me/points', null, wang.auth);
  assert.ok(r.json.history.some(h => h.sub === 'adapted'), 'original author got adapted points'); assert.ok(r.json.points > wangBefore);
  // 自己改自己的：没有 use、没有 adapted
  r = await call('POST', '/api/works', { ...WORK, title: '自己再改一版', adaptedFrom: a }, wang.auth); const c = r.json.work.id; await approve(c);
  assert.equal((await call('GET', '/api/works', null, wang.auth)).json.works.find(w => w.id === a).uses.length, 1);
});
