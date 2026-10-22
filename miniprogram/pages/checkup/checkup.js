const S = require('../../utils/store.js');
const D = S.D;
const SN = { ok: '正常', warn: '需关注', idle: '未开始' };
Page({
  data: { demo: true, probes: [], sum: { ok: 0, warn: 0, idle: 0 }, when: '', note: '' },
  onShow() { this.reload(); },
  // 园长登录了取真实体检卡（GET /api/org/checkup）；没登录或不是园长用演示数
  async reload() {
    const ST = S.get();
    if (S.auth.signedIn() && ST.role === 'director') {
      try {
        const r = await S.checkup.org();
        if (r.card) {
          const c = r.card;
          const probes = c.probes.map((p, i) => ({ i, k: p.name, s: p.status, sn: SN[p.status], d: p.text, w: p.weeks, go: p.go, act: p.act, levelId: p.go && p.go.levelId, local: p.go && p.go.local }));
          this.setData({ demo: false, org: r.orgName || D.ORG, sum: c.sum, probes, recs: c.recommendations, when: S.fmtDay(new Date(c.week + 'T00:00').getTime()) + ' 这周' + (c.generatedAt ? ' · 平台 ' + S.fmtDay(c.generatedAt) + ' 回传' : r.pushed ? ' · 平台还没回传' : ' · 还没接平台'), note: c.limited ? '新上线园所前两周只看账号覆盖、基础数据、设备在线三项。' : '' });
          return;
        }
      } catch (e) { /* 回落演示 */ }
    }
    const sum = { ok: 0, warn: 0, idle: 0 }; D.PROBES.forEach(x => sum[x.s]++);
    this.setData({ demo: true, org: D.ORG, sum, probes: D.PROBES.map((x, i) => Object.assign({ i, sn: SN[x.s] }, x)), recs: [], when: '演示数据', note: '' });
  },
  goProbe(e) {
    const pr = this.data.probes[+e.currentTarget.dataset.i];
    if (this.data.demo) {
      if (pr.go[0] === 'local') { wx.navigateTo({ url: '/pages/local/local' }); return; }
      const [p, i] = pr.go; wx.navigateTo({ url: `/pages/level/level?p=${p}&i=${i}` }); return;
    }
    if (pr.local) { wx.navigateTo({ url: '/pages/local/local' }); return; }
    if (!pr.levelId) return;
    const m = pr.levelId.match(/^(.*)-(\d+)$/); wx.navigateTo({ url: `/pages/level/level?p=${m[1]}&i=${m[2]}` });
  },
  goRec(e) { const id = e.currentTarget.dataset.id, m = id.match(/^(.*)-(\d+)$/); wx.navigateTo({ url: `/pages/level/level?p=${m[1]}&i=${m[2]}` }); }
});
