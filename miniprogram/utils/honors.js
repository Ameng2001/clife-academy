// 荣誉与积分：GET /api/me/honors（勋章、称号、关卡以外的事件记录），GET /api/me/points（积分余额与流水）。
// 积分是平台唯一的资产：学、分享、互动都记，花在教研工坊等工具的额度与教学物料上；不是货币、不可转赠、不排行、不公开。钱包页与工坊统一。
const api = require('./api.js');
async function honors() { return api.request('/api/me/honors'); }
async function points() { return api.request('/api/me/points'); }
// 教学物料商城（本人这一侧）：GET /api/mall、POST /api/mall/redeem、POST /api/mall/orders cancel
async function mall() { return api.request('/api/mall'); }
async function redeem(id, note) { return api.request('/api/mall/redeem', { method: 'POST', body: { id, note: note || '' } }); }
async function cancelOrder(id) { return api.request('/api/mall/orders', { method: 'POST', body: { id, action: 'cancel' } }); }
// 园所额度池（园长这一侧）：GET /api/org/quota 本园池子、每人剩余与用掉的；POST /api/org/quota/alloc { uid, n } 分给本园教师；POST /api/org/quota/recall { uid, n? } 收回没用的（n 不给就全收）
// 额度由运营方按合同充给园所（管理员在网页后台），园长只管分与收；额度只能用在教研工坊等工具上，不进商城、不进个人余额
async function orgQuota() { return api.request('/api/org/quota'); }
async function allocQuota(uid, n) { return api.request('/api/org/quota/alloc', { method: 'POST', body: { uid, n } }); }
async function recallQuota(uid, n) { return api.request('/api/org/quota/recall', { method: 'POST', body: n ? { uid, n } : { uid } }); }
module.exports = { honors, points, mall, redeem, cancelOrder, orgQuota, allocQuota, recallQuota };
