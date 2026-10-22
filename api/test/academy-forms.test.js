/* 轻形态：规则草稿（formDraftOf）、收口（cleanForm）、路由权限（academy/forms.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { formDraftOf, cleanForm, KINDS, GUIDE } from '../academy/forms.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-forms-'));
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
const TEXT = '之前午睡前孩子们总是吵，老师要喊好几遍。我们发现问题出在从户外回来直接上床。后来我们在入睡前加了十分钟安静角，先听一段故事。现在大部分孩子十分钟内能躺下。家长在家也可以睡前讲一个短故事。效果是起床后情绪也好了。';
const CASE = { title: '午睡前的安静角', domain: 'life', byName: '王老师', orgName: '示例园', text: TEXT };

test('form drafts: three kinds from one case, sentences moved not invented; guide clauses follow the domain', () => {
  const p = formDraftOf(CASE, 'parents');
  assert.equal(p.slides.length, 5); assert.equal(p.slides[0].h, '为什么做这件事'); assert.match(p.slides[0].lines[0], /^之前午睡前/); assert.match(p.footer, /王老师/);
  const t = formDraftOf(CASE, 'transition');
  assert.match(t.before[0], /^之前/); assert.ok(t.after.some(x => /现在|后来/.test(x))); assert.match(t.why, /发现/);
  const m = formDraftOf(CASE, 'memo');
  assert.equal(m.cards.length, 3); assert.equal(m.cards[0].clause, GUIDE.life[0].clause); assert.match(m.cards[0].apply, /我们/);
  assert.equal(formDraftOf(CASE, 'nope'), null);
  // 收口：结构照 base，只取文字
  const c = cleanForm('parents', { title: 'x', slides: [{ h: '改了', lines: ['a', 'b'] }, { h: 'y', lines: ['只一条'] }] }, p);
  assert.equal(c.slides.length, 5); assert.deepEqual(c.slides[0].lines, ['a', 'b']); assert.equal(c.slides[0].h, '为什么做这件事'); assert.deepEqual(c.slides[1].lines, p.slides[1].lines);
  assert.equal(cleanForm('transition', { before: [], after: [] }), null);
  assert.equal(cleanForm('memo', { cards: [{ clause: 'k', gist: 'g' }] }).cards.length, 1);
  assert.deepEqual(Object.keys(KINDS), ['parents', 'transition', 'memo']);
});

test('form routes: author or curator drafts on approved cases only, anyone signed-in reads, edits are clamped', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'director', '本地运营');
  const author = await login('王老师', 'teacher', '示例园');
  const other = await login('李老师', 'teacher', '另一园');
  // 作者交、园长同意、审核人入库（管理员直接可审）
  let r = await call('POST', '/api/cases', { title: CASE.title, domain: 'life', use: 'adapt', text: TEXT }, author); assert.equal(r.status, 200); const id = r.json.case.id;
  r = await call('POST', '/api/cases/forms/draft', { caseId: id, kind: 'parents' }, author); assert.equal(r.status, 404); // 还没入库
  const director = await login('示例园长', 'director', '示例园');
  assert.equal((await call('POST', '/api/cases/decide', { id, action: 'consent' }, director)).status, 200);
  assert.equal((await call('POST', '/api/cases/decide', { id, action: 'approve' }, admin)).status, 200);
  assert.equal((await call('POST', '/api/cases/forms/draft', { caseId: id, kind: 'parents' }, other)).json.code, 'who');
  assert.equal((await call('POST', '/api/cases/forms/draft', { caseId: id, kind: 'x' }, author)).json.code, 'kind');
  r = await call('POST', '/api/cases/forms/draft', { caseId: id, kind: 'parents' }, author); assert.equal(r.status, 200); const fid = r.json.form.id; assert.equal(r.json.form.model, false); assert.equal(r.json.form.content.slides.length, 5);
  r = await call('POST', '/api/cases/forms/draft', { caseId: id, kind: 'memo' }, admin); assert.equal(r.status, 200);
  // 同种再生成是覆盖，不加条
  r = await call('POST', '/api/cases/forms/draft', { caseId: id, kind: 'parents' }, author); assert.equal(r.json.form.id, fid);
  r = await call('GET', '/api/cases/forms?caseId=' + id, null, other); assert.equal(r.status, 200); assert.equal(r.json.forms.length, 2); assert.equal(r.json.canMake, false); assert.equal(r.json.forms[0].canEdit, false);
  assert.equal((await call('GET', '/api/cases/forms?caseId=' + id)).status, 401);
  // 改定
  assert.equal((await call('POST', '/api/cases/forms', { id: fid, content: { slides: [] } }, author)).json.code, 'content');
  assert.equal((await call('POST', '/api/cases/forms', { id: fid, content: { slides: [{ h: 'a', lines: ['b'] }] } }, other)).json.code, 'who');
  r = await call('POST', '/api/cases/forms', { id: fid, content: { title: '安静角', slides: [{ h: '为什么', lines: ['x'.repeat(200)] }], footer: '自己写的' } }, author);
  assert.equal(r.status, 200); assert.equal(r.json.form.content.slides.length, 1); assert.equal(r.json.form.content.slides[0].lines[0].length, 120); assert.equal(r.json.form.content.footer, '自己写的');
  r = await call('GET', '/api/cases/forms/all?kind=memo', null, other); assert.equal(r.json.forms.length, 1); assert.equal(r.json.forms[0].case.title, CASE.title);
  r = await call('POST', '/api/cases/forms', { id: fid, remove: true }, admin); assert.equal(r.json.ok, true);
  assert.equal((await call('GET', '/api/cases/forms?caseId=' + id, null, author)).json.forms.length, 1);
});
