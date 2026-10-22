const S = require('../../utils/store.js');
const D = S.D;
const ROLE_NAME = { director: '园长', nurse: '保健医', teacher: '班级教师', care: '保育员', it: '信息接口人' };
Page({
  data: { drills: [], demo: false, hint: '' },
  onShow() { this.reload(); },
  // 接 GET /api/drills；没登录或连不上回落演示题（作答只记在手机上）
  async reload() {
    if (!S.auth.signedIn()) { this.demoLoad('登录后作答，答了能看同园老师怎么答。下面是演示题。'); return; }
    try {
      const r = await S.drills.list();
      const rows = r.current.concat(r.past.slice(0, 5)).map(x => ({ id: x.id, t: x.title, ctx: x.context, role: x.role ? ROLE_NAME[x.role] || x.role : '全部岗位', n: x.answered, past: x.phase === 'closed', mine: x.mine ? x.mine.text : '', mineId: x.mine ? x.mine.id : '', review: x.mine && x.mine.review ? x.mine.review : null, featured: x.featured, others: [], open: !!x.mine && !this.data.demo && (this.data.drills.find(y => y.id === x.id) || {}).open }));
      this.setData({ drills: rows, demo: false, hint: rows.length ? '' : '本周还没出题，出了会在这里和首页出现。' });
      rows.forEach((x, i) => { if (x.mine) this.loadOthers(i); });
    } catch (e) { this.demoLoad('没连上服务器，下面是演示题。'); }
  },
  async markHelpful(e) { const d = this.data.drills[e.currentTarget.dataset.i]; if (!d || !d.mineId || !d.review) return; try { await S.drills.helpful(d.mineId, !d.review.helpful); this.reload(); } catch (err) { wx.showToast({ title: '没标成', icon: 'none' }); } },
  demoLoad(hint) { const ST = S.get(); this.setData({ drills: D.DRILLS.map((x, i) => ({ id: 'demo-' + i, t: x.t, role: x.role, n: x.n + (ST.drill[i] ? 1 : 0), mine: ST.drill[i] || '', best: x.best, others: x.others.map(o => ({ name: o[0], text: o[1] })), demo: true })), demo: true, hint }); },
  async loadOthers(i) {
    const d = this.data.drills[i]; if (!d || d.demo) return;
    try { const r = await S.drills.answers(d.id); this.setData({ ['drills[' + i + '].others']: r.answers.filter(a => !a.mine).map(a => ({ name: a.name, text: a.text, review: a.review, featured: a.review && a.review.featured })) }); } catch (e) {}
  },
  input(e) { this.draft = this.draft || {}; this.draft[+e.currentTarget.dataset.i] = e.detail.value; },
  edit(e) { const i = +e.currentTarget.dataset.i; this.draft = this.draft || {}; this.draft[i] = this.data.drills[i].mine; this.setData({ ['drills[' + i + '].editing']: true }); },
  cancel(e) { this.setData({ ['drills[' + +e.currentTarget.dataset.i + '].editing']: false }); },
  async submit(e) {
    const i = +e.currentTarget.dataset.i, v = ((this.draft || {})[i] || '').trim(), d = this.data.drills[i];
    if (d.demo) { if (!v) { wx.showToast({ title: '先写下你的做法再提交', icon: 'none' }); return; } S.get().drill[i] = v; S.save(); wx.showToast({ title: '已提交（演示）', icon: 'none' }); return this.reload(); }
    if (v.length < 20) { wx.showToast({ title: '再写具体一点，至少 20 字', icon: 'none' }); return; }
    try { await S.drills.answer(d.id, v); wx.showToast({ title: '已提交，看看同园老师怎么答', icon: 'none' }); this.reload(); }
    catch (err) { wx.showToast({ title: '没交成：' + err.message, icon: 'none' }); }
  }
});
