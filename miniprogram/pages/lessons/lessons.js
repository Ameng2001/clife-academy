const S = require('../../utils/store.js');
const D = S.D;
const LIB = require('../../utils/library.js');
const api = require('../../utils/api.js');
Page({
  // view：all 全部 / recent 本周常查（本园最近 7 天回传过的实操事件对应的场景排前面，GET /api/org/recent-events，只有事件名没有人）/ day 一日生活（按环节分组）
  data: { role: '全部', scene: '全部', view: 'all', views: [['all', '全部'], ['recent', '本周常查'], ['day', '一日生活']], roles: ['全部', '园长', '保健医', '班级教师', '保育员', '信息接口人'], scenes: [], groups: [], recentHint: '' },
  onShow() { this.reload(); },
  // 本周常查：拿本园最近事件 → 关卡 id（p-i）→ 场景顺序；没登录或连不上就按全部
  loadRecent() {
    if (this.recent) return Promise.resolve(this.recent);
    if (!S.auth.signedIn()) { this.recent = { scenes: [], hint: '登录后按本园最近做过的事排。' }; return Promise.resolve(this.recent); }
    return api.request('/api/org/recent-events?days=7').then(r => {
      const scenes = [];
      (r.events || []).forEach(e => (e.levels || []).forEach(id => { const k = id.lastIndexOf('-'); const p = id.slice(0, k), i = +id.slice(k + 1); const l = D.PATHS[p] && D.PATHS[p][i]; if (l && !scenes.includes(l.scene)) scenes.push(l.scene); }));
      this.recent = { scenes, hint: !scenes.length ? '这周还没有回传，先看全部。' : r.scope === 'org' ? '本园最近 7 天在平台上做过的事，对应的微课排在前面；只有事情，没有人。' : '账号没挂园所，先按本人最近做过的事排。' };
      return this.recent;
    }).catch(() => { this.recent = { scenes: [], hint: '没取到本园最近的事，先看全部。' }; return this.recent; });
  },
  reload() {
    const scenes = ['全部']; Object.values(D.PATHS).flat().forEach(l => { if (!scenes.includes(l.scene)) scenes.push(l.scene); });
    const path = this.data.role === '全部' ? null : Object.keys(D.PATHN).find(k => D.PATHN[k] === this.data.role);
    const view = this.data.q ? 'all' : this.data.view;
    const items = LIB.search(this.data.q || '', { path, scene: this.data.scene === '全部' || view === 'day' ? null : this.data.scene }).map(r => {
      const l = D.PATHS[r.p][r.i];
      return { p: r.p, i: r.i, t: r.t, hit: r.hit, role: D.PATHN[r.p], scene: l.scene, dur: l.dur, s: S.status(r.p, r.i), goal: l.goal || '', ico: D.PATHN[r.p][0] };
    });
    if (view === 'day') { this.setData({ scenes, items: [], groups: LIB.byDayPart(items), recentHint: '' }); return; }
    if (view === 'recent') {
      this.loadRecent().then(rc => { const order = rc.scenes; const sorted = order.length ? order.map(sc => items.filter(x => x.scene === sc)).flat() : items; this.setData({ scenes, items: sorted, groups: [], recentHint: rc.hint }); });
      return;
    }
    this.setData({ scenes, items, groups: [], recentHint: '' });
  },
  onSearch(e) { this.setData({ q: e.detail.value }); clearTimeout(this.qTm); this.qTm = setTimeout(() => this.reload(), 250); },
  clearSearch() { this.setData({ q: '' }); this.reload(); },
  setRole(e) { this.setData({ role: e.currentTarget.dataset.v }); this.reload(); },
  setScene(e) { this.setData({ scene: e.currentTarget.dataset.v }); this.reload(); },
  setView(e) { this.setData({ view: e.currentTarget.dataset.v }); this.reload(); },
  // 查阅：直接落到「讲」；做与测仍在路径里按顺序
  goLevel(e) { const { p, i } = e.currentTarget.dataset; wx.navigateTo({ url: `/pages/level/level?p=${p}&i=${i}&seg=jiang` }); }
});
