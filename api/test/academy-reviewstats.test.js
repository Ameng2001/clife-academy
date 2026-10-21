/* 点评时效看板：待点评与超期按两个工作日、近 30 天中位时长、点评队伍人数、园长只看本园、管理员各园一行、不列点评人个人数（academy/reviewstats.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statsOf, median } from '../academy/reviewstats.js';

const mkUser = (id, org, role, extra = {}) => ({ id, name: id, academy: { role, org: { id: org, name: org }, ...extra } });
test('statsOf: pending/overdue by working days, median turnaround, reviewers counted not listed', () => {
  const now = new Date('2026-10-22T10:00:00').getTime(), H = 3600000, D = 86400000;
  const users = [mkUser('d', '甲园', 'director'), mkUser('r', '甲园', 'teacher', { reviewer: true }), mkUser('t1', '甲园', 'teacher'), mkUser('t2', '甲园', 'nurse'), mkUser('x', '乙园', 'teacher')];
  const submissions = [
    { id: 's1', uid: 't1', org: 'id:甲园', type: 'practice', status: 'pending', at: now - 2 * H, levelId: 'obs-0' },           // 刚交
    { id: 's2', uid: 't2', org: 'id:甲园', type: 'practice', status: 'pending', at: now - 5 * D, levelId: 'obs-0' },           // 超期
    { id: 's3', uid: 't1', org: 'id:甲园', type: 'practice', status: 'pass', at: now - 3 * D, levelId: 'obs-0', review: { by: 'r', at: now - 3 * D + 4 * H } },
    { id: 's4', uid: 't2', org: 'id:甲园', type: 'practice', status: 'revise', at: now - 10 * D, levelId: 'obs-0', review: { by: 'd', at: now - 10 * D + 20 * H } },
    { id: 's5', uid: 'x', org: 'id:乙园', type: 'practice', status: 'pending', at: now - 9 * D, levelId: 'obs-0' },
    { id: 's6', uid: 't1', org: 'id:甲园', type: 'seminar', status: 'pass', at: now - D, levelId: 'obs-1' }
  ];
  const questions = [{ org: 'id:甲园', status: 'open', at: now - 3 * D, escalatedAt: now, answers: [] }, { org: 'id:甲园', status: 'answered', at: now - 2 * D, answers: [{ at: now - 2 * D + 6 * H }] }];
  const db = { users, submissions, questions };
  const s = statsOf(new Set(['id:甲园']), { db, isAdmin: () => false, now });
  assert.equal(s.pending, 2); assert.equal(s.overdue, 1); assert.equal(s.done30, 2); assert.equal(s.medianHours, 12); assert.equal(s.within2d, 100);
  assert.equal(s.reviewers, 2); assert.equal(s.active30, 2); assert.equal(s.members, 4);
  assert.equal(s.questions.open, 1); assert.equal(s.questions.escalated, 1); assert.equal(s.questions.medianHours, 6);
  assert.equal(s.queue.length, 2); assert.equal(s.queue[0].id, 's2'); assert.equal(s.queue[0].overdue, true);
  assert.equal(JSON.stringify(s).includes('"by"'), false); // 不带点评人
  const all = statsOf(null, { db, isAdmin: () => false, now });
  assert.equal(all.pending, 3); assert.equal(all.overdue, 2);
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 2, 3]), 2.5); assert.equal(median([]), null);
});
