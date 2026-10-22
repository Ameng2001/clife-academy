// 精品微课搜索（与网页端 lib/library.js 同一规则）：搜标题、目标、步骤、平台菜单路径、场景、按钮名；多个词用逗号分隔须同时命中；标题命中排前。
const D = require('./data.js');
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
const tokens = q => norm(q).split(/[,，;；/／|｜]+/).filter(Boolean);
const title = (p, i) => { const l = D.PATHS[p][i]; return l.featured ? '全日观察与疾病登记' : l.t; };
const stepsOf = (p, i) => { const l = D.PATHS[p][i]; return l.featured ? D.OBS.steps : l.steps; };

function search(q, { path = null, scene = null } = {}) {
  const ts = tokens(q), rows = [];
  Object.keys(D.PATHS).forEach(p => D.PATHS[p].forEach((l, i) => {
    if (path && p !== path) return;
    if (scene && l.scene !== scene) return;
    const t = title(p, i), steps = stepsOf(p, i), menu = (l.menu || []).concat(l.btn || '').join(' ');
    if (!ts.length) { rows.push({ p, i, t, score: 0, hit: '' }); return; }
    const hay = norm([t, l.goal, l.scene, menu, steps.join(' '), l.event, D.PATHN[p]].join(' '));
    if (!ts.every(x => hay.includes(x))) return;
    const nt = norm(t), ng = norm(l.goal), nm = norm(menu);
    const score = ts.reduce((a, x) => a + (nt.includes(x) ? 3 : ng.includes(x) ? 2 : nm.includes(x) ? 1.5 : 1), 0);
    let hit = '';
    if (!ts.some(x => nt.includes(x))) { for (const f of [l.goal].concat(steps, l.menu || [])) { const n = norm(f), x = ts.find(x => n.includes(x)); if (x) { const k = n.indexOf(x); hit = (k > 12 ? '…' : '') + String(f).slice(Math.max(0, k - 12), k + 40); break; } } }
    rows.push({ p, i, t, score, hit });
  }));
  if (ts.length) rows.sort((a, b) => b.score - a.score);
  return rows;
}
// 一日生活环节 → 场景（与网页端 lib/library.js 的 DAY_PARTS 同一张表）。不在表里的场景（账号、教研、园长工作台…）不属于一日生活，不显示。
const DAY_PARTS = [
  ['入园与晨检', ['出勤与请假', '晨午检', '健康检查', '安全']],
  ['进餐与午睡', ['膳食', '进餐', '午睡', '睡眠健康']],
  ['活动与游戏', ['活动设计', '活动现场', '区角', '自主游戏', '游戏分享', '数智体能', '课中互动', '墙面与主题']],
  ['过渡与一日常规', ['过渡环节', '一日常规', '观察记录', '日常反馈']],
  ['健康与特殊情况', ['疾病防控', '疾病管理', '健康档案', '体检', '冲突处理', '特殊需要']],
  ['离园与家园', ['家长会', '个别约谈', '家园活动']],
];
/** 按环节分组：[{ part, items }]，空环节不出。items 里每条要带 scene。 */
function byDayPart(items) { return DAY_PARTS.map(([part, scenes]) => ({ part, items: items.filter(x => scenes.includes(x.scene)) })).filter(g => g.items.length); }
module.exports = { search, DAY_PARTS, byDayPart };
