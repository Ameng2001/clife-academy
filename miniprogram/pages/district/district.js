// 区县看板：园所数、在学人数、各领域覆盖率中位数（≥ 3 园才显示）、认证人数、共同体活动、体检汇总；园所只给名单，不排名。
const S = require('../../utils/store.js');
const DEMO = { district: { name: '柳北区（演示）' }, orgCount: 5, members_total: 86, finished: 9, certified: 4, passes7d: 37, medians: true, rateMedian: 42,
  domains: [['环境创设与利用', 20], ['一日生活组织与保育', 65], ['游戏活动支持与引导', 30], ['教育活动计划与实施', 48], ['观察、记录与评价', 55], ['沟通与合作', 40], ['反思与发展', 12]].map(([name, median]) => ({ name, median })),
  activity: { contests: { total: 2, open: 1, done: 1 }, drillAnswers: 63, cases: 11, lectureBookings: 48 }, checkup: { pushed: 3, warn: 1 },
  orgs: ['柳北区示例幼儿园', '雀儿山幼儿园', '胜利幼儿园', '雅儒幼儿园', '长塘幼儿园'].map(name => ({ name })) };
const DEMO_COMM = [{ id: 'demo-1', name: '柳北一组', orgText: '柳北区示例幼儿园（组长园）、雀儿山幼儿园、胜利幼儿园' }, { id: 'demo-2', name: '柳北二组', orgText: '雅儒幼儿园、长塘幼儿园' }];
Page({
  data: { demo: true, d: DEMO, name: '', comm: DEMO_COMM },
  onShow() { this.reload(); },
  async reload() {
    if (S.auth.signedIn() && S.get().role === 'district') {
      try {
        const d = await S.district.summary(); this.setData({ demo: false, d, noDistrict: !d.district });
        try { const r = await S.district.communities(); this.setData({ comm: r.communities.map(c => ({ id: c.id, name: c.name, orgText: c.orgs.map(o => o.name + (o.key === c.lead ? '（组长园）' : '')).join('、') })) }); } catch (e) { this.setData({ comm: [] }); }
        return;
      } catch (e) { /* 回落演示 */ }
    }
    this.setData({ demo: true, d: DEMO, comm: DEMO_COMM });
  },
  onName(e) { this.setData({ name: e.detail.value }); },
  async attach() {
    const n = (this.data.name || '').trim(); if (!n) return;
    if (this.data.demo) { wx.showToast({ title: '演示数据，登录后可挂接', icon: 'none' }); return; }
    try { const r = await S.district.attach(n); wx.showToast({ title: r.added ? '已挂进本区' : '已在本区或没挂成', icon: 'none' }); this.setData({ name: '' }); this.reload(); }
    catch (e) { wx.showToast({ title: '没挂成', icon: 'none' }); }
  },
  goPath() { wx.switchTab({ url: '/pages/paths/paths' }); }
});
