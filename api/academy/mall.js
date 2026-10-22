/* 教学物料商城（docs/POINTS-DESIGN.md 第三节第 2 条，夜 61）：本地运营方上架教学物料，教师用积分换，运营方发货到园。
 *
 * 上什么：教具包、绘本、区角材料、耗材、名师讲堂线下场次名额、培训名额。不上购物卡、现金等价物、与教学无关的礼品。
 * 谁上：管理员（本地运营方）或区县管理员。范围 all 全平台 / district 本区县 / community 本共同体。收货 org 寄到园 / pickup 现场领。
 * 怎么换：教师选物、确认收货园所（默认本园，不填个人地址）、扣积分、生成订单。发货前教师可取消；运营方可取消并退回积分、标发货、标签收。
 * 不做：购物车、拼单、秒杀、「已兑 N 件」、热门榜。库存只给运营方看数，教师只看「还有 / 换完了」。
 *
 * db.mallItems:  { id, title, desc, points, stock(null 不限), scope:'all'|'district'|'community', district?, communityId?, deliver:'org'|'pickup', pickupNote,
 *                  off, by, byName, at, updatedAt }
 * db.mallOrders: { id, uid, name, org, orgName, itemId, title, points, deliver, note, status:'placed'|'shipped'|'done'|'cancelled',
 *                  at, shippedAt, doneAt, cancelledAt, cancelNote, byName(处理人) }
 * 积分：ledger.points.spend / refund（points.js 挂上去的），流水 tool 'mall'，ref 'order:<id>'。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { districtKeyOf, districtOrgsOf, isDistrictAdmin } from './district.js';

export const SCOPES = Object.freeze({ all: '全平台', district: '本区县', community: '本共同体' });
export const DELIVER = Object.freeze({ org: '寄到园', pickup: '现场领' });
export const ORDER_STATUS = Object.freeze({ placed: '待发货', shipped: '已发货', done: '已签收', cancelled: '已取消' });
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const newId = () => crypto.randomBytes(9).toString('base64url');

export function mallRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, communities = null, ledger = null }) {
  db.mallItems = db.mallItems || []; db.mallOrders = db.mallOrders || [];
  const now = () => Date.now();
  const canManage = u => !!u && (isAdmin(u) || isDistrictAdmin(u));
  const userDistrict = u => districtKeyOf(u) || (() => { const ok = orgKeyOf(u); if (!ok) return null; for (const m of db.orgDistricts || []) if (m.org === ok) return m.district; return null; })();
  const myCommunity = u => (communities ? communities.ofOrg(orgKeyOf(u)) : null);
  const sees = (u, it) => it.scope === 'all' || (it.scope === 'district' && !!it.district && (userDistrict(u) === it.district || isAdmin(u)))
    || (it.scope === 'community' && !!it.communityId && (myCommunity(u)?.id === it.communityId || isAdmin(u) || (isDistrictAdmin(u) && (communities?.byId(it.communityId)?.orgs || []).some(o => districtOrgsOf(db, districtKeyOf(u)).some(x => x.key === o.key)))));
  const manages = (u, it) => isAdmin(u) || (isDistrictAdmin(u) && it.by === u.id) || (isDistrictAdmin(u) && it.scope === 'district' && it.district === districtKeyOf(u));
  const redeemed = it => db.mallOrders.filter(o => o.itemId === it.id && o.status !== 'cancelled').length;
  const left = it => (it.stock == null ? null : Math.max(0, it.stock - redeemed(it)));
  const pubItem = (it, u) => ({
    id: it.id, title: it.title, desc: it.desc, points: it.points, scope: it.scope, scopeName: SCOPES[it.scope], communityName: it.communityId ? (communities?.byId(it.communityId)?.name || null) : null,
    deliver: it.deliver, deliverName: DELIVER[it.deliver], pickupNote: it.pickupNote || '', off: !!it.off, byName: it.byName, at: it.at,
    available: !it.off && (left(it) == null || left(it) > 0),
    ...(manages(u, it) ? { stock: it.stock, left: left(it), redeemed: redeemed(it), canEdit: true } : {})
  });
  const pubOrder = (o, u) => ({
    id: o.id, title: o.title, points: o.points, deliver: o.deliver, deliverName: DELIVER[o.deliver], note: o.note, status: o.status, statusName: ORDER_STATUS[o.status],
    at: o.at, shippedAt: o.shippedAt || null, doneAt: o.doneAt || null, cancelledAt: o.cancelledAt || null, cancelNote: o.cancelNote || '', byName: o.byName || null,
    mine: o.uid === u.id, ...(canManage(u) ? { name: o.name, orgName: o.orgName, uid: o.uid } : {})
  });
  const bank = () => ledger?.points || null;

  return {
  // 商城：我能看到的商品（下架的只有运营方看）、我的订单、运营方还看全部订单
  'GET /api/mall': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const items = db.mallItems.filter(it => sees(user, it) && (!it.off || manages(user, it))).sort((a, b) => b.updatedAt - a.updatedAt).map(it => pubItem(it, user));
    const mine = db.mallOrders.filter(o => o.uid === user.id).sort((a, b) => b.at - a.at).map(o => pubOrder(o, user));
    const all = canManage(user) ? db.mallOrders.filter(o => isAdmin(user) || db.mallItems.some(it => it.id === o.itemId && manages(user, it))).sort((a, b) => b.at - a.at).map(o => pubOrder(o, user)) : undefined;
    json(res, 200, { items, orders: mine, ...(all ? { all } : {}), points: bank() ? bank().balance(user.id) : null, manage: canManage(user), orgName: user.academy?.org?.name || null,
      scopes: SCOPES, deliver: DELIVER, statuses: ORDER_STATUS, canScopes: isAdmin(user) ? Object.keys(SCOPES) : ['district', 'community'] });
  },
  // 上架 / 改 / 下架：{ id?, title, desc, points, stock?, scope, communityId?, deliver, pickupNote?, off? }
  'POST /api/mall/items': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!canManage(user)) return json(res, 403, { error: 'operators only', code: 'manage' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let it = id ? db.mallItems.find(x => x.id === id) : null;
    if (id && !it) return json(res, 404, { error: 'no such item' });
    if (it && !manages(user, it)) return json(res, 403, { error: 'not yours', code: 'manage' });
    const title = str(body.title, 60), desc = str(body.desc, 600);
    if (title.length < 2) return json(res, 400, { error: 'title ≥ 2 chars', code: 'title' });
    const points = Math.floor(Number(body.points));
    if (!(points >= 1 && points <= 100000)) return json(res, 400, { error: 'points must be an integer 1–100000', code: 'points' });
    const stock = body.stock === null || body.stock === '' || body.stock === undefined ? (it && body.stock === undefined ? it.stock : null) : Math.floor(Number(body.stock));
    if (stock != null && !(stock >= 0 && stock <= 100000)) return json(res, 400, { error: 'stock must be an integer ≥ 0, or empty for unlimited', code: 'stock' });
    const scope = SCOPES[body.scope] ? body.scope : (it ? it.scope : null);
    if (!scope) return json(res, 400, { error: 'scope must be all / district / community', code: 'scope' });
    if (scope === 'all' && !isAdmin(user)) return json(res, 403, { error: 'platform-wide items are for admins', code: 'scope' });
    const where = {};
    if (scope === 'district') { const dk = isAdmin(user) ? (str(body.district, 80) || it?.district || districtKeyOf(user)) : districtKeyOf(user); if (!dk) return json(res, 400, { error: 'pick a district', code: 'district' }); where.district = dk; }
    if (scope === 'community') { const cid = str(body.communityId, 40) || it?.communityId; const cm = communities?.byId(cid); if (!cm) return json(res, 400, { error: 'pick a community', code: 'community' }); if (!isAdmin(user) && !cm.orgs.some(o => districtOrgsOf(db, districtKeyOf(user)).some(x => x.key === o.key))) return json(res, 403, { error: 'not your community', code: 'community' }); where.communityId = cm.id; }
    const deliver = DELIVER[body.deliver] ? body.deliver : (it ? it.deliver : 'org');
    const pickupNote = str(body.pickupNote, 200);
    if (!it) { it = { id: newId(), by: user.id, byName: user.name, at: now() }; db.mallItems.push(it); }
    Object.assign(it, { title, desc, points, stock, scope, district: where.district || null, communityId: where.communityId || null, deliver, pickupNote, off: body.off === true, updatedAt: now() });
    saveDb();
    audit(req, 'mall.item', { user, msg: `${it.id} ${title} ${points}` });
    json(res, 200, { item: pubItem(it, user) });
  },
  // 换：{ id, note? }。扣积分、生成订单；余额不够答 409，换完了答 409
  'POST /api/mall/redeem': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!bank()) return json(res, 503, { error: 'points not wired', code: 'points' });
    const body = await readBody(req);
    const it = db.mallItems.find(x => x.id === str(body.id, 40));
    if (!it || !sees(user, it) || it.off) return json(res, 404, { error: 'no such item' });
    if (left(it) != null && left(it) <= 0) return json(res, 409, { error: 'sold out', code: 'stock' });
    if (it.deliver === 'org' && !orgKeyOf(user)) return json(res, 400, { error: 'your account has no kindergarten to ship to', code: 'org' });
    const bal = bank().balance(user.id);
    if (bal < it.points) return json(res, 409, { error: 'insufficient points', code: 'insufficient', points: bal, need: it.points });
    const o = { id: newId(), uid: user.id, name: user.name, org: orgKeyOf(user), orgName: user.academy?.org?.name || null, itemId: it.id, title: it.title, points: it.points, deliver: it.deliver, note: str(body.note, 200), status: 'placed', at: now() };
    if (!bank().spend(user.id, it.points, 'order:' + o.id, `换「${it.title.slice(0, 24)}」`)) return json(res, 409, { error: 'insufficient points', code: 'insufficient', points: bank().balance(user.id), need: it.points });
    db.mallOrders.push(o);
    saveDb();
    audit(req, 'mall.redeem', { user, msg: `${o.id} ${it.title} -${it.points}` });
    json(res, 200, { order: pubOrder(o, user), points: bank().balance(user.id) });
  },
  // 订单：{ id, action: cancel | ship | done, note? }。教师只能取消自己待发货的；运营方可发货、签收、取消（没签收的）；取消退回积分
  'POST /api/mall/orders': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const o = db.mallOrders.find(x => x.id === str(body.id, 40));
    if (!o) return json(res, 404, { error: 'no such order' });
    const it = db.mallItems.find(x => x.id === o.itemId);
    const mgr = canManage(user) && (isAdmin(user) || (it && manages(user, it)));
    const action = body.action;
    if (action === 'cancel') {
      if (o.status === 'done' || o.status === 'cancelled') return json(res, 400, { error: 'not cancellable', code: 'state' });
      if (!mgr && !(o.uid === user.id && o.status === 'placed')) return json(res, 403, { error: 'only before shipping, only your own', code: 'state' });
      o.status = 'cancelled'; o.cancelledAt = now(); o.cancelNote = str(body.note, 200); o.byName = user.name;
      if (bank()) bank().refund(o.uid, o.points, 'order:' + o.id, `取消「${o.title.slice(0, 24)}」退回`);
    } else if (action === 'ship' || action === 'done') {
      if (!mgr) return json(res, 403, { error: 'operators only', code: 'manage' });
      if (action === 'ship') { if (o.status !== 'placed') return json(res, 400, { error: 'not waiting for shipping', code: 'state' }); o.status = 'shipped'; o.shippedAt = now(); }
      else { if (o.status !== 'shipped' && o.status !== 'placed') return json(res, 400, { error: 'not deliverable', code: 'state' }); o.status = 'done'; o.doneAt = now(); }
      o.byName = user.name;
    } else return json(res, 400, { error: 'action must be cancel, ship or done', code: 'action' });
    saveDb();
    audit(req, 'mall.order', { user, msg: `${o.id} ${action}` });
    json(res, 200, { order: pubOrder(o, user) });
  }
  };
}
