// 顶部：身份切换 + 原型提示条 + 重置。各页引用。
const S = require('../../utils/store.js');
const BRAND = require('../../utils/brand.js');
Component({
  properties: {},
  data: { roles: [], idx: 0, labels: [], brand: BRAND.get() },
  lifetimes: { attached() { this.refresh(); } },
  pageLifetimes: { show() { this.refresh(); } },
  methods: {
    refresh() {
      const keys = Object.keys(S.D.ROLES), role = S.get().role;
      this.setData({ roles: keys, labels: keys.map(k => S.roleLabel(k)), idx: keys.indexOf(role), signedIn: S.get().signedIn, brand: BRAND.get() });
    },
    onRole(e) {
      const k = this.data.roles[+e.detail.value];
      S.setRole(k); this.refresh();
      wx.showToast({ title: '已切换为' + S.roleLabel(k), icon: 'none' });
      this.triggerEvent('change', { role: k });
      const pages = getCurrentPages(), cur = pages[pages.length - 1];
      if (cur.route === 'pages/level/level') wx.switchTab({ url: '/pages/home/home' });
      else if (cur.reload) cur.reload();
    },
    onReset() {
      const demo = S.reset(); wx.showToast({ title: demo ? '演示进度已重置' : '已清本机草稿，账号进度不动', icon: 'none' });
      const pages = getCurrentPages(), cur = pages[pages.length - 1];
      if (cur.reload) cur.reload();
    }
  }
});
