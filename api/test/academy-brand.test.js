import test from 'node:test';
import assert from 'node:assert/strict';
import { brandOf, sanitizeBrand, brandRoutes, DEFAULT_BRAND } from '../academy/brand.js';

const mk = () => {
  const db = {};
  const out = {};
  const json = (res, code, body) => { out.code = code; out.body = body; };
  const routes = brandRoutes({ json, readBody: async req => req.body, db, saveDb: () => {}, readSession: req => req.user, audit: () => {}, isAdmin: u => !!u?.admin });
  return { db, out, routes };
};

test('默认名与短名', () => {
  const b = brandOf({});
  assert.equal(b.name, DEFAULT_BRAND.name);
  assert.equal(b.short, DEFAULT_BRAND.short);
  const c = sanitizeBrand({ name: '龙城幼师学堂' });
  assert.equal(c.short, '龙城幼师学堂');
  assert.equal(sanitizeBrand({ name: 'C-Life 示例' }).short, '示例');
});

test('管理员改名，其他人只读', async () => {
  const { db, out, routes } = mk();
  await routes['PUT /api/brand']({ user: { id: 'u', admin: false }, body: { name: '龙城幼师学堂' } }, {});
  assert.equal(out.code, 403);
  await routes['PUT /api/brand']({ user: { id: 'a', admin: true }, body: { name: '  龙城幼师学堂 ', short: '幼师学堂', region: '柳州市', credit: '技术支持：C-Life', tagline: '' } }, {});
  assert.equal(out.code, 200);
  assert.deepEqual([db.brand.name, db.brand.short, db.brand.region, db.brand.tagline], ['龙城幼师学堂', '幼师学堂', '柳州市', DEFAULT_BRAND.tagline]);
  await routes['GET /api/brand']({ user: null }, {});
  assert.equal(out.body.brand.name, '龙城幼师学堂');
  assert.equal(out.body.canEdit, false);
  await routes['PUT /api/brand']({ user: { id: 'a', admin: true }, body: { reset: true } }, {});
  assert.equal(db.brand, undefined);
  assert.equal(brandOf(db).name, DEFAULT_BRAND.name);
});

test('长度截断', () => {
  const b = sanitizeBrand({ name: 'x'.repeat(100), short: 'y'.repeat(30) });
  assert.equal(b.name.length, 40);
  assert.equal(b.short.length, 12);
});
