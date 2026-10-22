const S = require('../../utils/store.js');
const D = S.D;
Page({
  onShow() { this.reload(); },
  reload() {
    const ST = S.get();
    const paths = Object.keys(D.PATHS).map(p => {
      const tot = D.PATHS[p].length, d = ST.prog[p];
      return { p, name: D.PATHN[p], d, tot, fin: d >= tot, open: p === S.myPath(),
        levels: D.PATHS[p].map((l, i) => ({ i, t: S.title(p, i), scene: l.scene, dur: l.dur, s: S.status(p, i), kind: l.type === 'practice' ? '实践' : l.type === 'seminar' ? '研讨' : '' })), domain: D.PATH_META[p] ? (D.PATH_META[p].domain || (D.PATH_META[p].kind === 'stage' ? D.PATH_META[p].stage + '阶段' : '')) : '' };
    });
    this.setData({ paths });
  },
  toggle(e) { const p = e.currentTarget.dataset.p; this.setData({ paths: this.data.paths.map(x => Object.assign(x, { open: x.p === p ? !x.open : x.open })) }); },
  goLevel(e) { const { p, i } = e.currentTarget.dataset; wx.navigateTo({ url: `/pages/level/level?p=${p}&i=${i}` }); }
});
