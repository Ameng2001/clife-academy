// 斗课——同课异构擂台，园内赛与共同体赛（共同体赛由区县管理员在网页端出题、跨园编组，作品带园名）。主持人（园长、点评人）出题；教师自愿应战交活动设计＋≤3 分钟片段；截止后组内互评（量表五项＋一句话，实名）；
const S = require('../../utils/store.js');
const PHASE = { open: '应战中', review: '互评与点评', done: '已收官' };
Page({
  data: { items: [], hint: '', cur: null, design: '', note: '', editing: false },
  onLoad(q) { this.wantId = q && q.id; },
  onShow() { this.reload(); },
  async reload() {
    if (!S.auth.signedIn()) { this.setData({ items: [], cur: null, hint: '登录后参加。园内可见，自愿参加，评作品不评人。' }); return; }
    try {
      const r = await S.contests.list();
      const items = r.current.concat(r.past).map(c => Object.assign({}, c, { phaseText: PHASE[c.phase], dueText: S.fmtDay(c.dueAt) }));
      this.setData({ items, hint: items.length ? '' : '本园还没办过斗课。园长或教研主任在网页端出题后，这里能应战。' });
      const id = this.wantId || (items[0] && items[0].id); if (id) this.open(id);
    } catch (e) { this.setData({ items: [], cur: null, hint: '没连上服务器。' }); }
  },
  async open(id) {
    if (typeof id !== 'string') id = id.currentTarget.dataset.id;
    try {
      const r = await S.contests.one(id); const c = r.contest;
      const groups = c.groups.length ? c.groups : (c.list ? [{ n: 0, entryIds: c.list.map(e => e.id), review: null }] : []);
      const list = (c.list || []).map(e => Object.assign({}, e, { open: false, scores: e.myRating ? e.myRating.scores.slice() : [0, 0, 0, 0, 0], comment: e.myRating ? e.myRating.comment : '', ratingRows: (e.ratings || []).map(x => ({ byName: x.byName, line: c.rubric.map((k, j) => k + ' ' + x.scores[j]).join(' · '), comment: x.comment })) }));
      this.setData({ cur: Object.assign({}, c, { phaseText: PHASE[c.phase], dueText: S.fmtDay(c.dueAt), groups: groups.map(g => Object.assign({}, g, { entries: g.entryIds.map(x => list.find(e => e.id === x)).filter(Boolean) })) }), design: c.mine ? c.mine.design : '', note: c.mine ? c.mine.note || '' : '', editing: false });
    } catch (e) { wx.showToast({ title: '没取到：' + e.message, icon: 'none' }); }
  },
  back() { this.setData({ cur: null }); },
  input(e) { this.setData({ [e.currentTarget.dataset.k]: e.detail.value }); },
  edit() { this.setData({ editing: true }); },
  async enter() {
    const d = (this.data.design || '').trim();
    if (d.length < 100) { wx.showToast({ title: '活动设计至少 100 字', icon: 'none' }); return; }
    try { await S.contests.enter(this.data.cur.id, d, (this.data.note || '').trim()); wx.showToast({ title: this.data.cur.mine ? '已改' : '已应战，片段到网页端传', icon: 'none' }); this.open(this.data.cur.id); }
    catch (e) { wx.showToast({ title: '没交成：' + e.message, icon: 'none' }); }
  },
  toggle(e) { const { g, i } = e.currentTarget.dataset; const k = `cur.groups[${g}].entries[${i}].open`; this.setData({ [k]: !this.data.cur.groups[g].entries[i].open }); },
  star(e) { const { g, i, j, n } = e.currentTarget.dataset; this.setData({ [`cur.groups[${g}].entries[${i}].scores[${j}]`]: +n }); },
  comment(e) { const { g, i } = e.currentTarget.dataset; this.setData({ [`cur.groups[${g}].entries[${i}].comment`]: e.detail.value }); },
  async rate(e) {
    const { g, i } = e.currentTarget.dataset, en = this.data.cur.groups[g].entries[i];
    if (en.scores.some(s => !s)) { wx.showToast({ title: '五项都打分', icon: 'none' }); return; }
    if (!(en.comment || '').trim()) { wx.showToast({ title: '写一句对作品的话', icon: 'none' }); return; }
    try { await S.contests.rate(en.id, en.scores, en.comment.trim()); wx.showToast({ title: '已评，只有作者和主持人看得到', icon: 'none' }); this.open(this.data.cur.id); }
    catch (err) { wx.showToast({ title: '没成：' + err.message, icon: 'none' }); }
  }
});
