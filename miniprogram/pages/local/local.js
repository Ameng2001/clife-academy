const S = require('../../utils/store.js');
Page({
  onShow() { this.reload(); },
  reload() { const ST = S.get(); this.setData({ tickets: ST.tickets.concat([{ id: 'GD-1129', t: '批量调整出勤操作咨询', s: '已关闭' }]), open: ST.tickets.filter(t => t.s === '处理中').length }); },
  copy() { wx.setClipboardData({ data: '400-636-6396', success: () => wx.showToast({ title: '已复制 400-636-6396', icon: 'none' }) }); },
  dev(e) { this.devv = e.detail.value; },
  txt(e) { this.txtv = e.detail.value; },
  submit() {
    const d = (this.devv || '').trim(), x = (this.txtv || '').trim();
    if (!d) { wx.showToast({ title: '请填写设备与位置', icon: 'none' }); return; }
    const ST = S.get(); ST.tickets.unshift({ id: 'GD-' + (1300 + ST.tickets.length), t: d + (x ? '：' + x : ''), s: '处理中' }); S.save();
    this.devv = ''; this.txtv = ''; this.setData({ devv: '', txtv: '' });
    wx.showToast({ title: '报修已提交，24 小时内协调处理', icon: 'none' }); this.reload();
  }
});
