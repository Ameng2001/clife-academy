/* 自评与三方评、园所集体荣誉、练习营、园内教研组、研修项目期次、园所分享日、分享者上讲堂、斗课扩展形式、运营周报
 * （selfreview.js、honors.js、camps.js、studygroups.js、programs.js、sharedays.js、lectures.js、contests.js、weekly.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { termOf } from '../academy/selfreview.js';
import { weeklyOf, lastWeekOf } from '../academy/weekly.js';
import { orgBadgesOf } from '../academy/honors.js';
import { orgKeyOf } from '../academy/org.js';
import { FORMS } from '../academy/contests.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-batch-'));
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
  const login = async (name, role, org, district) => { const r = await call('POST', '/api/login/dev', { name, role, org, district }); return { auth: { Authorization: 'Bearer ' + r.json.token }, id: r.json.user.id }; };
  return { call, login };
}
const LONG = '这是一段足够长的文字，用来通过最少字数的检查。'.repeat(8);

test('termOf / lastWeekOf: autumn covers Sep–Jan, spring Feb–Aug; last week is Monday to Sunday', () => {
  assert.equal(termOf(new Date('2026-10-22').getTime()).key, '2026-autumn');
  assert.equal(termOf(new Date('2027-01-15').getTime()).key, '2026-autumn');
  assert.equal(termOf(new Date('2027-03-01').getTime()).key, '2027-spring');
  const w = lastWeekOf(new Date('2026-10-21T10:00:00').getTime());   // 周三
  assert.equal(new Date(w.from).getDay(), 1); assert.equal(new Date(w.to).getDay(), 0); assert.equal(w.key, '2026-10-12');
});

test('weeklyOf: counts passes, submissions, reviews, overdue, answers, questions, cases for one org in the week; no names', () => {
  const now = new Date('2026-10-19T10:00:00').getTime(), w = lastWeekOf(now), inW = w.from + 86400000;
  const users = [{ id: 'd', name: '园长', academy: { role: 'director', org: { name: '甲园' } } }, { id: 'a', name: '甲一', academy: { role: 'teacher', org: { name: '甲园' } } }, { id: 'x', name: '乙一', academy: { role: 'teacher', org: { name: '乙园' } } }];
  const db = { users,
    submissions: [{ uid: 'a', org: 'name:甲园', type: 'practice', status: 'pass', at: inW, review: { by: 'd', at: inW + 3600000 } }, { uid: 'a', org: 'name:甲园', type: 'practice', status: 'pending', at: w.from - 10 * 86400000 }, { uid: 'x', org: 'name:乙园', type: 'practice', status: 'pending', at: inW }],
    drillAnswers: [{ uid: 'a', at: inW }, { uid: 'x', at: inW }], questions: [{ org: 'name:甲园', status: 'open', at: inW, answers: [] }], cases: [{ org: 'name:甲园', status: 'approved', at: inW }] };
  const stateOf = uid => (uid === 'a' ? { progress: { 'obs-0': { passedAt: inW }, 'obs-1': { passedAt: now } } } : { progress: {} });
  const d = weeklyOf(new Set(['name:甲园']), { db, stateOf, isAdmin: () => false, now });
  assert.equal(d.members, 2); assert.equal(d.active, 1); assert.equal(d.passes, 1); assert.equal(d.submitted, 1); assert.equal(d.reviewed, 1); assert.equal(d.pending, 1); assert.equal(d.overdue, 1);
  assert.equal(d.drillAnswers, 1); assert.equal(d.questionsNew, 1); assert.equal(d.casesApproved, 1);
  assert.ok(d.text.includes('1 人过了关')); assert.equal(d.text.includes('甲一'), false);
});

test('orgBadgesOf: a path counts only with ≥ 3 people of that role, all finished; outside uses count toward 10', () => {
  const mk = (id, role) => ({ id, name: id, academy: { role, org: { name: '甲园' } } });
  const users = [mk('a', 'nurse'), mk('b', 'nurse'), mk('c', 'nurse'), mk('d', 'director'), { id: 'z', name: 'z', academy: { role: 'teacher', org: { name: '乙园' } } }];
  const full = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`nurse-${i}`, { passedAt: 1000 + i }]));
  const stateOf = uid => (['a', 'b', 'c'].includes(uid) ? { progress: full } : { progress: {} });
  const db = { users, cases: [{ id: 'c1', status: 'approved', org: 'name:甲园', by: 'a' }], caseUses: [{ caseId: 'c1', uid: 'z', at: 5 }, { caseId: 'c1', uid: 'b', at: 6 }] };
  const b = orgBadgesOf('name:甲园', { db, stateOf, isAdmin: () => false, orgKeyOf });
  const nurse = b.find(x => x.key === 'org-path-nurse'); assert.equal(nurse.on, true); assert.equal(nurse.of, 3);
  assert.equal(b.find(x => x.key === 'org-path-director'), undefined);   // 只有 1 人
  const uses = b.find(x => x.key === 'org-uses'); assert.equal(uses.progress, 1); assert.equal(uses.on, false);   // 本园自己用的不算
});

test('self review: one per term; mentor and director write one paragraph each; others cannot; admin sees counts not people', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'it', '本地运营');
  const dir = await login('甲园长', 'director', '甲园'), m = await login('甲骨干', 'teacher', '甲园'), n = await login('甲新', 'teacher', '甲园'), other = await login('乙园长', 'director', '乙园');
  await call('PUT', '/api/org/pairs', { mentor: m.id, mentee: n.id }, dir.auth);
  let r = await call('GET', '/api/me/selfreview', null, n.auth); assert.equal(r.status, 200); assert.equal(r.json.items.length, 7); assert.equal(r.json.mine, null);
  assert.equal((await call('POST', '/api/me/selfreview', { levels: { env: 1 }, focus: '观察记录' }, n.auth)).json.code, 'levels');
  const levels = Object.fromEntries(r.json.items.map(i => [i.key, 1]));
  r = await call('POST', '/api/me/selfreview', { levels, focus: '观察记录只写事实', reflection: '这学期跟了三个环节。' }, n.auth); assert.equal(r.status, 200); assert.equal(r.json.mine.focus, '观察记录只写事实');
  r = await call('POST', '/api/me/selfreview', { levels: { ...levels, obs: 2 }, focus: '改了', reflection: '' }, n.auth); assert.equal(r.json.mine.levels.obs, 2);   // 再交就是改
  assert.equal((await call('POST', '/api/selfreview/comment', { uid: n.id, text: '看了她的三份观察记录，事实与推断已经分开写了。' }, other.auth)).status, 403);
  r = await call('POST', '/api/selfreview/comment', { uid: n.id, text: '看了她的三份观察记录，事实与推断已经分开写了。' }, m.auth); assert.equal(r.status, 200); assert.equal(r.json.person.comments[0].role, 'mentor');
  r = await call('POST', '/api/selfreview/comment', { uid: n.id, text: '每周一题都答了，三次教研都在，反思写得具体，下学期可以带一个新老师。' }, dir.auth); assert.equal(r.json.person.comments.length, 2);
  r = await call('GET', '/api/me/selfreview', null, n.auth); assert.equal(r.json.comments.length, 2); assert.equal(r.json.comments.some(c => c.by), false);
  r = await call('GET', '/api/selfreview/others', null, dir.auth); assert.equal(r.json.as, 'director'); assert.equal(r.json.people.length, 2); assert.equal(r.json.done, 1);
  r = await call('GET', '/api/selfreview/others', null, m.auth); assert.equal(r.json.as, 'mentor'); assert.equal(r.json.people[0].uid, n.id); assert.ok(r.json.people[0].myComment);
  assert.equal((await call('GET', '/api/selfreview/others', null, n.auth)).status, 403);
  // 园所集体荣誉：本园的人都能看
  r = await call('GET', '/api/org/honors', null, n.auth); assert.equal(r.status, 200); assert.ok(r.json.badges.some(b => b.key === 'org-uses'));
  assert.equal((await call('GET', '/api/org/honors', null, admin.auth)).status, 200);
});

test('camps: join, post only up to today, leave erases everything, close records graduates and the badge appears', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'it', '本地运营');
  const dir = await login('甲园长', 'director', '甲园'), a = await login('甲一', 'teacher', '甲园'), b = await login('甲二', 'teacher', '甲园'), x = await login('乙一', 'teacher', '乙园');
  const days = ['挑一个幼儿看五分钟', '只写事实', '把推断另起一段'];
  assert.equal((await call('POST', '/api/camps', { title: '观察记录练习营', days: days.slice(0, 2), startAt: Date.now() - 86400000 }, dir.auth)).json.code, 'days');
  let r = await call('POST', '/api/camps', { title: '观察记录练习营', intro: '三天', days, startAt: Date.now() - 86400000 - 1000 }, dir.auth); assert.equal(r.status, 200); const id = r.json.camp.id; assert.equal(r.json.camp.scope, 'org'); assert.equal(r.json.camp.phase, 'running');
  assert.equal((await call('GET', '/api/camps', null, x.auth)).json.camps.length, 0);   // 别的园看不到
  r = await call('POST', '/api/camps/join', { id }, a.auth); assert.equal(r.json.camp.mine, true); assert.equal(r.json.camp.today, 1);
  await call('POST', '/api/camps/join', { id }, b.auth);
  assert.equal((await call('POST', '/api/camps/post', { id, day: 2, text: LONG }, a.auth)).json.code, 'early');
  r = await call('POST', '/api/camps/post', { id, day: 0, text: LONG }, a.auth); assert.equal(r.status, 200); assert.equal(r.json.camp.posts.length, 1);
  await call('POST', '/api/camps/post', { id, day: 1, text: LONG }, b.auth);
  r = await call('GET', '/api/camps', null, a.auth); assert.equal(r.json.camps[0].posts.length, 2);   // 营内互看
  r = await call('POST', '/api/camps/leave', { id }, b.auth); assert.equal(r.json.camp.mine, false); assert.equal(r.json.camp.posts, undefined);
  r = await call('GET', '/api/camps', null, a.auth); assert.equal(r.json.camps[0].posts.length, 1); assert.equal(r.json.camps[0].members, 1);   // 退营无痕
  assert.equal((await call('POST', '/api/camps/close', { id, summary: '短' }, dir.auth)).json.code, 'summary');
  r = await call('POST', '/api/camps/close', { id, summary: '三天里大家都把事实和推断分开了，下次练时长。' }, dir.auth); assert.equal(r.json.camp.phase, 'done'); assert.equal(r.json.camp.graduated, false);
  r = await call('GET', '/api/me/honors', null, a.auth); const badge = r.json.badges.find(x => x.key === 'camp-' + id); assert.ok(badge); assert.equal(badge.on, true); assert.equal(badge.kind, 'growth');
  r = await call('GET', '/api/camps', null, a.auth); assert.equal(r.json.camps[0].graduated, true);
  // 管理员办全平台的营
  r = await call('POST', '/api/camps', { title: '全平台家长沟通练习营', days, startAt: Date.now() + 86400000, scope: 'all' }, admin.auth); assert.equal(r.json.camp.scope, 'all');
  assert.equal((await call('GET', '/api/camps', null, x.auth)).json.camps.length, 1);
});

test('study tasks: reviewer posts, members reply ≥ 100 chars and only then see others; host sees who is missing; reflect evidence counts', async t => {
  const { call, login } = await startServer(t);
  await login('运营方', 'it', '本地运营');
  const dir = await login('甲园长', 'director', '甲园'), lead = await login('教研主任', 'teacher', '甲园'), a = await login('甲一', 'teacher', '甲园'), b = await login('甲二', 'teacher', '甲园');
  assert.equal((await call('POST', '/api/studytasks', { title: '看这节课', prompt: '写三点你会改的地方' }, lead.auth)).status, 403);
  await call('PUT', '/api/org/reviewer', { uid: lead.id, reviewer: true }, dir.auth);
  let r = await call('POST', '/api/studytasks', { title: '看这节课', prompt: '写三点你会改的地方，每点一个事实' }, lead.auth); assert.equal(r.status, 200); const id = r.json.task.id; assert.deepEqual(r.json.task.missing.sort(), ['教研主任', '甲一', '甲二'].sort());
  assert.equal((await call('POST', '/api/studytasks/reply', { id, text: '短' }, a.auth)).json.code, 'text');
  r = await call('GET', '/api/studytasks', null, a.auth); assert.equal(r.json.tasks[0].list, undefined);
  r = await call('POST', '/api/studytasks/reply', { id, text: LONG }, a.auth); assert.equal(r.status, 200); assert.equal(r.json.task.list.length, 1);
  await call('POST', '/api/studytasks/reply', { id, text: LONG }, b.auth);
  r = await call('GET', '/api/studytasks', null, a.auth); assert.equal(r.json.tasks[0].list.length, 2); assert.equal(r.json.tasks[0].missing, undefined);
  r = await call('GET', '/api/me/certificates', null, a.auth); assert.equal(r.status, 200);
  r = await call('GET', '/api/me/portfolio', null, a.auth); assert.equal(r.json.studyReplies.length, 1); assert.equal(r.json.progress.seven.have >= 1, true);
  r = await call('POST', '/api/studytasks/close', { id }, lead.auth); assert.equal(r.json.task.open, false);
  assert.equal((await call('POST', '/api/studytasks/reply', { id, text: LONG }, b.auth)).json.code, 'closed');
});

test('programs: admin builds a term, teachers apply, roster accepted → completed, hours flow into the certificate', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'it', '本地运营');
  const a = await login('甲一', 'teacher', '甲园'), b = await login('甲二', 'teacher', '甲园');
  const from = Date.now() + 7 * 86400000, to = from + 2 * 86400000;
  assert.equal((await call('POST', '/api/programs', { title: '寒假研修', from, to, hours: 12 }, a.auth)).status, 403);
  let r = await call('POST', '/api/programs', { title: '2027 寒假观察记录研修', kind: '寒暑假研修', term: '2026 秋', from, to, place: '市教师发展中心', hours: 12, capacity: 1 }, admin.auth); assert.equal(r.status, 200); const id = r.json.program.id;
  r = await call('POST', '/api/programs/apply', { id }, a.auth); assert.equal(r.json.program.mine.status, 'applied');
  r = await call('POST', '/api/programs/apply', { id }, b.auth); assert.equal(r.json.program.mine.status, 'applied');
  r = await call('GET', '/api/programs', null, a.auth); assert.equal(r.json.programs[0].roster, undefined); assert.equal(r.json.programs[0].applied, 2);
  r = await call('GET', '/api/programs', null, admin.auth); assert.equal(r.json.programs[0].roster.length, 2);
  assert.equal((await call('POST', '/api/programs/roster', { id, uid: a.id, status: 'completed' }, admin.auth)).json.code, 'status');
  r = await call('POST', '/api/programs/roster', { id, uid: a.id, status: 'accepted' }, admin.auth); assert.equal(r.json.program.accepted, 1);
  r = await call('GET', '/api/programs', null, b.auth); assert.equal(r.json.programs[0].canApply, false);   // 名额满了、已报名
  r = await call('POST', '/api/programs/roster', { id, uid: a.id, status: 'completed' }, admin.auth); assert.equal(r.json.program.roster.find(x => x.uid === a.id).status, 'completed');
  r = await call('GET', '/api/me/hours', null, a.auth); assert.equal(r.status, 200); const line = r.json.lines.find(l => l.kind === 'program'); assert.ok(line); assert.equal(line.minutes, 12 * r.json.rule.minutesPerHour);
  r = await call('GET', '/api/me/portfolio', null, a.auth); assert.equal(r.json.programs[0].status, 'completed');
  await call('POST', '/api/programs/close', { id }, admin.auth);
  assert.equal((await call('GET', '/api/programs', null, a.auth)).json.programs[0].phase, 'done');
});

test('share days: district admin hosts for a community; each director submits one page of own approved cases; no counting', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'it', '本地运营');
  const d = await login('区县小李', 'district', '', '柳北区');
  const a = await login('甲园长', 'director', '甲园', '柳北区'), a1 = await login('甲一', 'teacher', '甲园', '柳北区');
  const b = await login('乙园长', 'director', '乙园', '柳北区');
  const far = await login('丁园长', 'director', '丁园', '鱼峰区');
  let r = await call('POST', '/api/district/communities', { name: '柳北一组', orgs: ['name:甲园', 'name:乙园'], lead: 'name:甲园' }, d.auth); const cid = r.json.community?.id || r.json.communities?.[0]?.id; assert.ok(cid);
  r = await call('POST', '/api/cases', { title: '心情墙', domain: 'env', use: 'adapt', text: LONG }, a1.auth); const caseId = r.json.case.id;
  await call('POST', '/api/cases/decide', { id: caseId, action: 'consent' }, a.auth); await call('POST', '/api/cases/decide', { id: caseId, action: 'approve' }, admin.auth);
  assert.equal((await call('POST', '/api/sharedays', { communityId: cid, at: Date.now() + 86400000 }, a.auth)).status, 403);
  r = await call('POST', '/api/sharedays', { communityId: cid, at: Date.now() + 86400000, place: '甲园', theme: '本学期的区角' }, d.auth); assert.equal(r.status, 200); const id = r.json.shareday.id;
  assert.equal((await call('GET', '/api/sharedays', null, far.auth)).json.sharedays.length, 0);
  r = await call('GET', '/api/sharedays', null, a1.auth); assert.equal(r.json.sharedays.length, 1); assert.equal(r.json.sharedays[0].canPage, false);
  assert.equal((await call('POST', '/api/sharedays/page', { id, caseIds: [caseId], note: '' }, a1.auth)).status, 403);
  r = await call('POST', '/api/sharedays/page', { id, caseIds: [caseId, 'nope'], note: '这学期我们改了两个区角。' }, a.auth); assert.equal(r.status, 200); assert.equal(r.json.shareday.pages[0].cases.length, 1);
  r = await call('POST', '/api/sharedays/page', { id, caseIds: [caseId], note: '乙园这学期想借甲园那条心情墙的做法。' }, b.auth); assert.equal(r.json.shareday.pages[1].cases.length, 0);   // 不是本园的案例不收
  r = await call('GET', '/api/sharedays', null, b.auth); assert.equal(r.json.sharedays[0].pages.length, 2); assert.equal(JSON.stringify(r.json).includes('"votes"'), false);
  r = await call('POST', '/api/sharedays/close', { id }, d.auth); assert.ok(r.json.shareday.closedAt);
  assert.equal((await call('POST', '/api/sharedays/page', { id, caseIds: [], note: '晚了晚了晚了晚了晚了' }, a.auth)).json.code, 'closed');
});

test('sharer candidates and invitation: admin sees authors by uses, invite records the sharer on the lecture and grants the title once', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'it', '本地运营');
  const dir = await login('甲园长', 'director', '甲园'), a = await login('甲一', 'teacher', '甲园');
  const others = [await login('乙一', 'teacher', '乙园'), await login('乙二', 'teacher', '乙园'), await login('乙三', 'teacher', '乙园')];
  let r = await call('POST', '/api/cases', { title: '心情墙', domain: 'env', use: 'adapt', text: LONG }, a.auth); const caseId = r.json.case.id;
  await call('POST', '/api/cases/decide', { id: caseId, action: 'consent' }, dir.auth); await call('POST', '/api/cases/decide', { id: caseId, action: 'approve' }, admin.auth);
  assert.equal((await call('GET', '/api/lectures/sharers', null, dir.auth)).status, 403);
  r = await call('GET', '/api/lectures/sharers', null, admin.auth); assert.equal(r.json.candidates.length, 0);
  for (const o of others) await call('POST', '/api/cases/used', { id: caseId, note: '我也试了一下' }, o.auth);
  r = await call('GET', '/api/lectures/sharers', null, admin.auth); assert.equal(r.json.candidates.length, 1); assert.equal(r.json.candidates[0].uses, 3); assert.equal(r.json.candidates[0].sharer, false);
  r = await call('POST', '/api/lectures', { title: '十二月大讲堂', at: Date.now() + 86400000, minutes: 60 }, admin.auth); assert.equal(r.status, 200); const lid = r.json.lecture?.id || r.json.id; assert.ok(lid);
  r = await call('POST', '/api/lectures/invite', { id: lid, uid: a.id, caseId }, admin.auth); assert.equal(r.status, 200); assert.equal(r.json.lecture.sharers[0].caseTitle, '心情墙'); assert.equal(r.json.lecture.showcase.length, 1); assert.equal(r.json.lecture.honors[0].label, '年度分享者');
  await call('POST', '/api/lectures/invite', { id: lid, uid: a.id }, admin.auth);
  r = await call('GET', '/api/me/honors', null, a.auth); assert.equal(r.json.titles.filter(t => t.title === 'sharer').length, 1);
  r = await call('GET', '/api/lectures/sharers', null, admin.auth); assert.equal(r.json.candidates[0].sharer, true); assert.equal(r.json.candidates[0].invited[0], '十二月大讲堂');
});

test('contest forms: an 环创擂台 uses its own rubric and entry minimum; the close tag carries the form name', async t => {
  const { call, login } = await startServer(t);
  await login('运营方', 'it', '本地运营');
  const dir = await login('甲园长', 'director', '甲园'), a = await login('甲一', 'teacher', '甲园');
  assert.equal(Object.keys(FORMS).length, 4);
  let r = await call('GET', '/api/contests', null, dir.auth); assert.equal(r.json.forms.env.name, '环创擂台');
  r = await call('POST', '/api/contests', { title: '建构区', activity: '建构区的材料', goal: '幼儿自己取用', form: 'env', domain: 'env', dueAt: Date.now() + 1000 }, dir.auth); assert.equal(r.status, 200); const id = r.json.contest.id; assert.equal(r.json.contest.form, 'env'); assert.equal(r.json.contest.rubric[0], '空间与动线'); assert.equal(r.json.contest.entryLabel, '一个区角的前后对比与说明');
  r = await call('POST', '/api/contests/enter', { id, design: LONG }, a.auth); assert.equal(r.status, 200);
  await new Promise(r => setTimeout(r, 1200));
  await call('POST', '/api/contests/group', { id }, dir.auth);
  r = await call('GET', '/api/contests/one?id=' + id, null, dir.auth); const entry = r.json.contest.list[0];
  assert.equal((await call('POST', '/api/contests/rate', { entryId: entry.id, scores: [5, 5, 5, 5], comment: '好' }, dir.auth)).json.code, 'scores');
  await call('POST', '/api/contests', { id, title: '建构区', activity: '建构区的材料', goal: '幼儿自己取用', form: 'env', domain: 'env', reviewAt: Date.now() + 10 }, dir.auth);
  await new Promise(r => setTimeout(r, 50));
  await call('POST', '/api/contests/select', { id, entryIds: [entry.id] }, dir.auth);
  r = await call('POST', '/api/contests/close', { id, summary: '' }, dir.auth); assert.equal(r.status, 200);
  r = await call('GET', '/api/cases', null, a.auth); assert.ok(r.json.cases.some(c => (c.source?.tag || '').startsWith('环创擂台')));
});

test('weekly: director gets own org, admin gets all with org rows; teachers cannot', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'it', '本地运营');
  const dir = await login('甲园长', 'director', '甲园'), a = await login('甲一', 'teacher', '甲园');
  assert.equal((await call('GET', '/api/ops/weekly', null, a.auth)).status, 403);
  let r = await call('GET', '/api/ops/weekly', null, dir.auth); assert.equal(r.json.scope, 'org'); assert.equal(r.json.members, 2); assert.ok(r.json.text.includes('人在学'));
  r = await call('GET', '/api/ops/weekly', null, admin.auth); assert.equal(r.json.scope, 'all'); assert.equal(r.json.orgs.length, 1); assert.equal(r.json.orgs[0].name, '甲园');
});
