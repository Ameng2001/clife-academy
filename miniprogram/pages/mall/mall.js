// 教学物料商城：本地运营方上架的教具、绘本、耗材、名额，用积分换，寄到园。上架、发货在网页端；这里是本人这一侧：看、换、取消。
const S = require('../../utils/store.js');
Page({
  data: { items: [], orders: [], points: null, orgName: '', busy: false, signedIn: false },
  onShow() { this.reload(); },
  async reload() {
    const signedIn = S.auth.signedIn();
    if (!signedIn) { this.setData({ signedIn, items: [], orders: [], points: null }); return; }
    try {
      const d = await S.honors.mall();
      this.setData({ signedIn, points: d.points, orgName: d.orgName || '',
        items: d.items.map(it => Object.assign({}, it, { enough: (d.points || 0) >= it.points, meta: it.scopeName + (it.communityName ? ' · ' + it.communityName : '') + ' · ' + it.deliverName + (it.available ? '' : ' · 换完了') })),
        orders: d.orders.map(o => Object.assign({}, o, { at: S.fmtDay(o.at) })) });
    } catch (e) { this.setData({ signedIn, items: [], orders: [] }); wx.showToast({ title: '没取到商城', icon: 'none' }); }
  },
  redeem(e) {
    const it = this.data.items.find(x => x.id === e.currentTarget.dataset.id); if (!it || this.data.busy) return;
    const where = it.deliver === 'org' ? '寄到 ' + (this.data.orgName || '本园') : '现场领' + (it.pickupNote ? '：' + it.pickupNote : '');
    wx.showModal({ title: '用 ' + it.points + ' 积分换「' + it.title + '」？', content: where + '。发货前可以取消，积分退回。', confirmText: '换', success: async r => {
      if (!r.confirm) return;
      this.setData({ busy: true });
      try { const x = await S.honors.redeem(it.id); wx.showToast({ title: '已换，还有 ' + x.points + ' 积分', icon: 'none' }); }
      catch (err) { wx.showToast({ title: err.code === 'insufficient' ? '积分不够' : err.code === 'stock' ? '换完了' : '没换成', icon: 'none' }); }
      this.setData({ busy: false }); this.reload();
    } });
  },
  cancel(e) {
    const o = this.data.orders.find(x => x.id === e.currentTarget.dataset.id); if (!o || this.data.busy) return;
    wx.showModal({ title: '取消「' + o.title + '」？', content: '积分退回。', success: async r => {
      if (!r.confirm) return;
      this.setData({ busy: true });
      try { await S.honors.cancelOrder(o.id); wx.showToast({ title: '已取消，积分退回', icon: 'none' }); } catch (err) { wx.showToast({ title: '没成', icon: 'none' }); }
      this.setData({ busy: false }); this.reload();
    } });
  },
  goMe() { wx.switchTab({ url: '/pages/me/me' }); }
});
