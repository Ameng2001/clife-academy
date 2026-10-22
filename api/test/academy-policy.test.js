/* 口径库：一份规则，各模块的 SYSTEM 提示从它拼；GET /api/policy 不登录也给。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, ruleOf, systemRules, VERSION } from '../academy/policy.js';
import { SYSTEM as COACH } from '../academy/coach.js';
import { PACK_SYSTEM } from '../academy/lectures.js';
import { SYSTEM as FORMS } from '../academy/forms.js';

test('policy: ids unique, every rule has text/why/where, systemRules numbers only prompted rules', () => {
  assert.equal(new Set(RULES.map(r => r.id)).size, RULES.length);
  for (const r of RULES) { assert.ok(r.title && r.text && r.why && r.where.length, r.id); }
  assert.equal(ruleOf('nope'), null);
  const all = systemRules(); assert.match(all, /^规矩：\n1\. /); assert.ok(!all.includes('工具额度'), 'rules without a prompt stay out');
  const some = systemRules(['plain', 'nope', 'child-data']); assert.equal(some.split('\n').length, 3); assert.match(some, /1\. 句子短/);
  assert.match(VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test('policy: Coach, lecture pack and light-form prompts carry the shared lines', () => {
  const child = ruleOf('child-data').prompt;
  for (const s of [COACH, PACK_SYSTEM, FORMS]) { assert.ok(s.includes('规矩：'), 'has block'); assert.ok(s.includes(child), 'child-data line'); }
  assert.ok(COACH.includes(ruleOf('no-ranking').prompt)); assert.ok(PACK_SYSTEM.includes(ruleOf('ai-drafts').prompt)); assert.ok(FORMS.includes(ruleOf('real-name').prompt));
});
