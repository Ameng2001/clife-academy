// 能力地图（与 clife-academy frontend/src/lib/capability.js 同一规则）：七个领域各一个状态，证据是工具关通过、作品通过点评、研讨作答。
// 给本人看「哪些领域有证据、哪些还空着」，不是分数。
const D = require('./data.js');
const DOMAINS = [
  { key: 'env', name: '环境创设与利用' }, { key: 'life', name: '一日生活组织与保育' }, { key: 'play', name: '游戏活动支持与引导' },
  { key: 'plan', name: '教育活动计划与实施' }, { key: 'obs', name: '观察、记录与评价' }, { key: 'comm', name: '沟通与合作' }, { key: 'reflect', name: '反思与发展' }
];
const BY_NAME = {}; DOMAINS.forEach(d => { BY_NAME[d.name] = d.key; });
const SKILL_DOMAIN = { health: 'life', food: 'life', sleep: 'life', sport: 'life', teach: 'plan', family: 'comm' };
const SCENE_DOMAIN = { '观察记录': 'obs' };
function domainOf(p, l) {
  const meta = D.PATH_META[p];
  if (meta && meta.domain && BY_NAME[meta.domain]) return BY_NAME[meta.domain];
  if (SCENE_DOMAIN[l.scene]) return SCENE_DOMAIN[l.scene];
  return SKILL_DOMAIN[D.SKMAP[l.scene]] || null;
}
function capabilityMap(progress, submissions) {
  const latest = {}; (submissions || []).forEach(s => { if (!latest[s.levelId] || s.at > latest[s.levelId].at) latest[s.levelId] = s; });
  const acc = {}; DOMAINS.forEach(d => { acc[d.key] = Object.assign({}, d, { tools: 0, works: 0, answers: 0, pending: 0, revise: 0, total: 0, cert: null }); });
  const tools = { done: 0, total: 0 };
  Object.keys(D.PATHS).forEach(p => {
    D.PATHS[p].forEach((l, i) => {
      const id = p + '-' + i, k = domainOf(p, l), passed = !!(progress[id] && progress[id].passedAt);
      if (!k) { tools.total++; if (passed) tools.done++; return; }
      const d = acc[k]; d.total++; const s = latest[id];
      if (l.type === 'practice') { if (s && s.status === 'pass') d.works++; else if (s && s.status === 'pending') d.pending++; else if (s && s.status === 'revise') d.revise++; }
      else if (l.type === 'seminar') { if (s) d.answers++; }
      else if (passed) d.tools++;
    });
    const meta = D.PATH_META[p];
    if (meta && meta.domain && BY_NAME[meta.domain]) { const n = D.PATHS[p].length; let done = 0; D.PATHS[p].forEach((l, i) => { if (progress[p + '-' + i] && progress[p + '-' + i].passedAt) done++; }); acc[BY_NAME[meta.domain]].cert = { path: p, done, total: n, ready: n > 0 && done === n }; }
  });
  const domains = DOMAINS.map(d => { const a = acc[d.key]; a.status = a.tools + a.works + a.answers > 0 ? 'evidenced' : a.pending + a.revise > 0 ? 'started' : 'empty'; a.text = evidenceText(a); return a; });
  return { domains, tools, evidenced: domains.filter(d => d.status === 'evidenced').length };
}
function evidenceText(d) {
  const parts = [];
  if (d.tools) parts.push('工具关通过 ' + d.tools); if (d.works) parts.push('作品通过点评 ' + d.works); if (d.answers) parts.push('研讨作答 ' + d.answers);
  if (d.pending) parts.push('待点评 ' + d.pending); if (d.revise) parts.push('需修改 ' + d.revise);
  return parts.length ? parts.join(' · ') : d.total ? '还没有证据' : '内容建设中';
}
module.exports = { DOMAINS, domainOf, capabilityMap, evidenceText };
