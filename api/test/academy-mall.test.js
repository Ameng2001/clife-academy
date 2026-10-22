/* 教学物料商城：运营方上架（范围、库存、收货方式）→ 教师用积分换 → 取消退回 → 发货、签收；库存数只给运营方；不显示已兑件数（academy/mall.js）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXT = '小班入园第二周，我们把早晨签到改成「找自己的照片贴到心情墙」。孩子进门先找照片，再选一个表情贴纸。两周后大部分孩子愿意自己走进教室，家长在门口停留的时间也短了。';
async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-mall-'));
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

test('mall: operators list items by scope; teachers redeem with points, see no counts; cancel refunds; ship and sign; stock runs out', async t => {
  const { call, login } = await startServer(t);
  const admin = await login('运营方', 'it', '本地运营');
  const d = await login('区县小李', 'district', '', '柳北区');
  const wang = await login('王老师', 'teacher', '甲园', '柳北区'), far = await login('丁老师', 'teacher', '丁园', '鱼峰区');
  const pts = async who => (await call('GET', '/api/me/points', null, who.auth)).json.points;
  // 王入库两条案例 → 40 分
  for (const title of ['心情墙', '签到墙']) { const r = await call('POST', '/api/cases', { title, domain: 'env', use: 'adapt', text: TEXT }, wang.auth); await call('POST', '/api/cases/decide', { id: r.json.case.id, action: 'approve' }, admin.auth); }
  assert.equal(await pts(wang), 40);
  // 教师不能上架；区县管理员不能上全平台的；管理员上一件全平台、区县上一件本区县（库存 1）
  assert.equal((await call('POST', '/api/mall/items', { title: '绘本《好饿的毛毛虫》', points: 30, scope: 'all' }, wang.auth)).status, 403);
  assert.equal((await call('POST', '/api/mall/items', { title: '绘本', points: 30, scope: 'all' }, d.auth)).json.code, 'scope');
  assert.equal((await call('POST', '/api/mall/items', { title: '绘本', points: 0, scope: 'all' }, admin.auth)).json.code, 'points');
  let r = await call('POST', '/api/mall/items', { title: '绘本《好饿的毛毛虫》', desc: '硬壳精装，寄到园', points: 30, scope: 'all', deliver: 'org' }, admin.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json)); const book = r.json.item; assert.equal(book.stock, null); assert.equal(book.left, null);
  r = await call('POST', '/api/mall/items', { title: '名师讲堂线下名额', desc: '12 月场', points: 15, stock: 1, scope: 'district', deliver: 'pickup', pickupNote: '当天到场签到领' }, d.auth);
  assert.equal(r.status, 200, JSON.stringify(r.json)); const seat = r.json.item; assert.equal(seat.left, 1);
  // 王看得到两件（本区县的也在），没有库存数与已兑数；丁（别的区）只看到全平台的
  r = await call('GET', '/api/mall', null, wang.auth);
  assert.equal(r.json.items.length, 2); assert.equal(r.json.points, 40); assert.equal(r.json.manage, false);
  for (const it of r.json.items) { assert.equal('stock' in it, false); assert.equal('redeemed' in it, false); assert.equal(it.available, true); }
  assert.equal((await call('GET', '/api/mall', null, far.auth)).json.items.length, 1);
  // 换名额：扣 15；再换绘本 30 不够答 409；取消名额退回 15 后再换绘本成功
  r = await call('POST', '/api/mall/redeem', { id: seat.id, note: '' }, wang.auth); assert.equal(r.status, 200, JSON.stringify(r.json)); const o1 = r.json.order; assert.equal(r.json.points, 25); assert.equal(o1.status, 'placed');
  r = await call('POST', '/api/mall/redeem', { id: book.id }, wang.auth); assert.equal(r.status, 409); assert.equal(r.json.code, 'insufficient');
  assert.equal((await call('POST', '/api/mall/redeem', { id: seat.id }, far.auth)).status, 404, 'out of scope');
  assert.equal((await call('GET', '/api/mall', null, wang.auth)).json.items.find(i => i.id === seat.id).available, false, 'sold out shows as unavailable');
  assert.equal((await call('POST', '/api/mall/orders', { id: o1.id, action: 'ship' }, wang.auth)).status, 403);
  r = await call('POST', '/api/mall/orders', { id: o1.id, action: 'cancel' }, wang.auth); assert.equal(r.status, 200); assert.equal(r.json.order.status, 'cancelled');
  assert.equal(await pts(wang), 40);
  assert.equal((await call('POST', '/api/mall/orders', { id: o1.id, action: 'cancel' }, wang.auth)).json.code, 'state', 'no double refund');
  r = await call('POST', '/api/mall/redeem', { id: book.id, note: '请寄到中班' }, wang.auth); assert.equal(r.status, 200); const o2 = r.json.order; assert.equal(r.json.points, 10);
  // 运营方：看全部订单带姓名与园；发货后教师不能取消；签收
  r = await call('GET', '/api/mall', null, admin.auth); assert.equal(r.json.manage, true); assert.equal(r.json.all.length, 2); assert.equal(r.json.all.find(o => o.id === o2.id).orgName, '甲园');
  assert.equal(r.json.items.find(i => i.id === seat.id).redeemed, 0, 'cancelled orders free the stock');
  r = await call('POST', '/api/mall/orders', { id: o2.id, action: 'ship' }, admin.auth); assert.equal(r.json.order.status, 'shipped');
  assert.equal((await call('POST', '/api/mall/orders', { id: o2.id, action: 'cancel' }, wang.auth)).status, 403);
  r = await call('POST', '/api/mall/orders', { id: o2.id, action: 'done' }, admin.auth); assert.equal(r.json.order.status, 'done');
  assert.equal((await call('POST', '/api/mall/orders', { id: o2.id, action: 'cancel' }, admin.auth)).json.code, 'state');
  r = await call('GET', '/api/me/points', null, wang.auth); assert.equal(r.json.points, 10); assert.equal(r.json.history[0].tool, '教学物料商城');
  // 下架后教师看不到；区县管理员改不了管理员的
  assert.equal((await call('POST', '/api/mall/items', { id: book.id, title: book.title, points: 30, off: true }, d.auth)).status, 403);
  await call('POST', '/api/mall/items', { id: book.id, title: book.title, points: 30, off: true }, admin.auth);
  assert.equal((await call('GET', '/api/mall', null, wang.auth)).json.items.some(i => i.id === book.id), false);
  assert.equal((await call('POST', '/api/mall/redeem', { id: book.id }, wang.auth)).status, 404);
});
