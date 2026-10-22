const S = require('../../utils/store.js');
const D = S.D;
Page({
  goMall() { wx.navigateTo({ url: '/pages/mall/mall' }); },
  data: { quotaLogAll: false },
  onShow() { this.reload(); this.loadLecture(); this.loadDrill(); this.loadContest(); this.loadCheckup(); this.loadCommunity(); },
  // 我的园所在的跨园共同体（GET /api/me/community）；没登录不显示
  async loadCommunity() {
    if (!S.auth.signedIn()) { this.setData({ community: null }); return; }
    try { const r = await S.district.myCommunity(); const c = r.community; this.setData({ community: c ? { name: c.name, orgText: c.orgs.map(o => o.name + (o.key === c.lead ? '（组长园）' : '')).join('、'), cases: c.cases, drills: c.drills } : null }); } catch (e) { this.setData({ community: null }); }
  },
  reload() {
    const ST = S.get(), role = ST.role, p = S.myPath(), director = role === 'director', district = role === 'district';
    const tot = D.PATHS[p].length, d = ST.prog[p], cur = Math.min(d, tot - 1), l = D.PATHS[p][cur], fin = d >= tot;
    const st = S.lvState(p, cur), nq = S.qsOf(p, cur).length;
    const segs = [
      { k: '讲', on: st.seg !== 'jiang' || st.zuo || fin },
      { k: '看', on: ['zuo', 'ce'].includes(st.seg) || st.zuo || fin },
      { k: '做', on: st.zuo || fin },
      { k: '测', on: st.right.length >= nq || fin }
    ];
    const map = D.PATHS[p].map((x, i) => ({ i, t: x.featured ? '全日观察' : x.t, s: S.status(p, i) }));
    const probes = D.PROBES.slice(0, 5).map((x, i) => Object.assign({ i }, x));
    const recs = D.PROBES.map((x, i) => Object.assign({ i }, x)).filter(x => x.go && x.go[0] === p);
    const sum = { ok: 0, warn: 0, idle: 0 }; D.PROBES.forEach(x => sum[x.s]++);
    const lessons = []; Object.keys(D.PATHS).forEach(q => D.PATHS[q].forEach((x, i) => lessons.push({ p: q, i, t: x.featured ? '全日观察与疾病登记' : x.t, role: D.PATHN[q], scene: x.scene, dur: x.dur, s: S.status(q, i), goal: x.goal || '', ico: D.PATHN[q][0] })));
    const mine = lessons.filter(x => x.p === p).slice(0, 2), other = lessons.filter(x => x.p !== p).slice(0, 2);
    // 园长：登录了取本园真实汇总（GET /api/org/summary），没登录用演示数
    let staff = null, advice = this.data.advice || null;
    if (director && !S.auth.signedIn()) {
      staff = Object.entries(D.STAFF).map(([q, [n, name]]) => {
        const base = { director: [0, 2, 0], nurse: [0, 1, 0], teacher: [2, 12, 4], care: [3, 5, 1], it: [0, 1, 0] }[q];
        let [f, ing, no] = base; if (ST.prog[q] >= D.PATHS[q].length) { f = Math.min(n, f + 1); ing = Math.max(0, ing - 1); }
        return { q, name, n, f, ing, no, self: q === 'director' };
      });
      advice = '4 名班级教师、1 名保育员尚未开始。建议下周三午睡时段集中学习前两关，由种子教师陪练。（演示数据）';
    } else if (director) { staff = this.data.staff || []; this.loadOrg(); }
    if (S.auth.signedIn()) S.honors.points().then(x => this.setData({ points: x.points })).catch(() => this.setData({ points: null })); else if (this.data.points !== null) this.setData({ points: null });
    this.setData({ org: D.ORG, roleLabel: S.roleLabel(), director, district, p, pathName: D.PATHN[p], d, tot, fin,
      next: { i: cur, t: S.title(p, cur), dur: l.dur, goal: l.goal }, segs, map, probes, recs, sum, lessons: mine.concat(other),
      files: D.FILES.slice(0, 3), staff, advice });
  },
  // 园长：接收本园实践关新提交的订阅消息（一次性，收一条用一次，用完再点）
  async subscribeQueue() {
    const mine = await S.notify.ask(['queue']).catch(() => null);
    if (mine === null) { wx.showToast({ title: '这台服务器没配订阅消息', icon: 'none' }); return; }
    this.setData({ queueGrants: mine.queue || 0 });
    wx.showToast({ title: mine.queue ? '好了，下 ' + mine.queue + ' 条新提交会提醒你' : '没有开启', icon: 'none' });
  },
  async loadOrg() {
    try { const c = await S.notify.templates(); this.setData({ queueTmpl: !!c.templates.queue, queueGrants: c.mine ? c.mine.queue || 0 : 0 }); } catch (e) {}
    try {
      const r = await S.auth.orgSummary();
      const staff = r.roles.filter(x => x.members > 0).map(x => ({ q: x.role, name: x.name, n: x.members, f: x.finished, ing: x.started, no: x.members - x.finished - x.started, self: x.role === 'director', next: x.next }));
      const needs = r.roles.filter(x => x.next && x.finished < x.members).sort((a, b) => a.rate - b.rate);
      const advice = needs.length ? needs.map(x => x.name + ' ' + x.next.count + ' 人停在「' + x.next.title + '」').join('；') + '。建议午睡时段集中学这一关，由种子教师陪练。' : (r.members_total ? '各岗位都已完成。' : '还没有本园教师登录过大课堂。');
      this.setData({ staff, advice, orgWeek: r.passes7d, orgTotal: r.members_total });
      S.growth.weekly().then(w => this.setData({ wk: w.text })).catch(() => this.setData({ wk: '' }));
      S.auth.orgCohort().then(c => { const line = b => (b && b.enough ? `整体完成率 本园 ${b.rate.mine}% · 中位 ${b.rate.median}%，近 30 天在学 本园 ${b.active30.mine}% · 中位 ${b.active30.median}%` : null); this.setData({ cohort: c.city ? { city: line(c.city), cityN: c.city.others, district: c.district ? line(c.district) : null, dName: c.district ? c.district.name : '', dN: c.district ? c.district.others : 0 } : null }); }).catch(() => this.setData({ cohort: null }));
      this.loadQuota();
      S.auth.reviewStats().then(x => this.setData({ rs: { pending: x.pending, overdue: x.overdue, median: x.medianHours, qOpen: x.questions.open, qEsc: x.questions.escalated } })).catch(() => this.setData({ rs: null }));
    } catch (e) { this.setData({ advice: e.status === 403 ? '这页只给园长看，岗位由平台账号决定。' : '本园数据没取到，稍后再试。' }); }
  },
  // 园所额度池：池子剩多少、每位教师剩多少用了多少；点一个人分或收
  async loadQuota() {
    try {
      const q = await S.honors.orgQuota();
      const members = q.members.map(m => ({ id: m.id, name: m.name, role: D.PATHN[m.role] || m.role, left: m.left, used: m.used }));
      const used = q.log.filter(r => r.kind === 'spend').reduce((s, r) => s + r.n, 0);
      // 流水：充值 / 分给谁 / 收回 / 谁在哪个工具用了，最近 50 条，默认只露 6 条
      const line = r => r.kind === 'topup' ? '运营方充值 ' + r.n + (r.note ? '（' + r.note + '）' : '')
        : r.kind === 'alloc' ? '分给 ' + r.name + ' ' + r.n + (r.byName ? ' · ' + r.byName : '')
        : r.kind === 'recall' ? '收回 ' + r.name + ' 没用的 ' + r.n + (r.byName ? ' · ' + r.byName : '')
        : r.name + ' 在' + (r.tool || '工具') + '用了 ' + r.n + (r.note ? '（' + r.note + '）' : '');
      const log = q.log.map(r => ({ id: r.id, kind: r.kind, at: S.fmtDay(r.at), text: line(r), n: (r.kind === 'topup' || r.kind === 'recall' ? '+' : '−') + r.n }));
      this.setData({ quota: { pool: q.pool, topup: q.topup, allocated: q.allocated, used, members, empty: !q.topup, log, logShown: this.data.quotaLogAll ? log : log.slice(0, 6), logMore: log.length > 6 } });
    } catch (e) { this.setData({ quota: null }); }
  },
  toggleQuotaLog() { const all = !this.data.quotaLogAll, q = this.data.quota; this.setData({ quotaLogAll: all, quota: Object.assign({}, q, { logShown: all ? q.log : q.log.slice(0, 6) }) }); },
  quotaMember(e) {
    const m = this.data.quota.members.find(x => x.id === e.currentTarget.dataset.id); if (!m) return;
    const pool = this.data.quota.pool;
    const items = [];
    [10, 30, 100].forEach(n => { if (pool >= n) items.push({ t: '分 ' + n, run: () => this.allocQuota(m, n) }); });
    if (pool > 0) items.push({ t: '分指定数量…', run: () => this.allocCustom(m) });
    if (m.left > 0) items.push({ t: '收回没用的 ' + m.left, run: () => this.recallQuota(m) });
    if (!items.length) { wx.showToast({ title: pool ? '没有可操作的' : '池子是空的，额度由运营方按合同充值', icon: 'none' }); return; }
    wx.showActionSheet({ itemList: items.map(x => x.t), success: r => items[r.tapIndex] && items[r.tapIndex].run() });
  },
  allocCustom(m) {
    wx.showModal({ title: '分给 ' + m.name + ' 多少额度', content: '池子里还有 ' + this.data.quota.pool, editable: true, placeholderText: '1–' + Math.min(10000, this.data.quota.pool), success: r => { if (!r.confirm) return; const n = Math.floor(Number(r.content)); if (!(n >= 1)) { wx.showToast({ title: '填一个正整数', icon: 'none' }); return; } this.allocQuota(m, n); } });
  },
  async allocQuota(m, n) {
    try { await S.honors.allocQuota(m.id, n); wx.showToast({ title: '已分 ' + n + ' 给 ' + m.name, icon: 'none' }); this.loadQuota(); }
    catch (e) { wx.showToast({ title: e.code === 'pool' ? '池子不够，只剩 ' + (e.pool != null ? e.pool : this.data.quota.pool) : e.code === 'n' ? '一次 1–10000' : '没分成', icon: 'none' }); }
  },
  recallQuota(m) {
    wx.showModal({ title: '收回 ' + m.name + ' 没用的 ' + m.left + '？', content: '回到园所池子，可以再分给别人；已经用掉的不动。', confirmText: '收回', success: async r => {
      if (!r.confirm) return;
      try { await S.honors.recallQuota(m.id); wx.showToast({ title: '已收回', icon: 'none' }); this.loadQuota(); } catch (e) { wx.showToast({ title: '没收成', icon: 'none' }); }
    } });
  },
  goLevel(e) { const { p, i } = e.currentTarget.dataset; wx.navigateTo({ url: `/pages/level/level?p=${p}&i=${i}` }); },
  goProbe(e) {
    const pr = D.PROBES[+e.currentTarget.dataset.i];
    if (pr.go[0] === 'local') { wx.navigateTo({ url: '/pages/local/local' }); return; }
    const [p, i] = pr.go;
    if (D.ROLES[S.get().role].path !== p && S.get().role !== 'director') { S.setRole(Object.keys(D.ROLES).find(k => D.ROLES[k].path === p)); wx.showToast({ title: '该关卡推送给' + D.PATHN[p] + '，已切换身份', icon: 'none' }); }
    wx.navigateTo({ url: `/pages/level/level?p=${p}&i=${i}` });
  },
  viewAs(e) { const p = e.currentTarget.dataset.p; S.setRole(Object.keys(D.ROLES).find(k => D.ROLES[k].path === p)); wx.showToast({ title: '已切换为' + D.PATHN[p], icon: 'none' }); this.reload(); },
  // 首页体检：登录了取本园体检推给我这个岗位的关（GET /api/me/checkup）；没登录保留演示探针
  async loadCheckup() {
    if (!S.auth.signedIn()) { this.setData({ apiRecs: null }); return; }
    try { const r = await S.checkup.mine(); this.setData({ apiRecs: r.recommendations.map(x => Object.assign({}, x, { p: x.levelId.split(/-(?=\d+$)/)[0], i: +x.levelId.split(/-(?=\d+$)/)[1] })), apiSum: r.sum || null }); }
    catch (e) { this.setData({ apiRecs: null }); }
  },
  goRec(e) { const { p, i } = e.currentTarget.dataset; wx.navigateTo({ url: `/pages/level/level?p=${p}&i=${i}` }); },
  // 首页斗课卡：本园进行中的擂台
  async loadContest() {
    if (!S.auth.signedIn()) { this.setData({ contest: null }); return; }
    try { const r = await S.contests.list(); const c = r.current[0]; this.setData({ contest: c ? { id: c.id, t: c.title, n: c.entries, state: c.phase === 'open' ? (c.mine ? '已应战 · 改作品' : '自愿应战') : '看同事的设计、互评' } : null }); }
    catch (e) { this.setData({ contest: null }); }
  },
  // 首页每周一题：接 GET /api/drills 的本周题；没登录或连不上用演示题
  async loadDrill() {
    if (!S.auth.signedIn()) { this.setData({ drill: { t: D.DRILLS[0].t, n: D.DRILLS[0].n, state: '去作答' } }); return; }
    try { const r = await S.drills.list(); const x = r.current[0]; this.setData({ drill: x ? { t: x.title, n: x.answered, state: x.mine ? '已答，看同园老师怎么答' : '去作答' } : null }); }
    catch (e) { this.setData({ drill: { t: D.DRILLS[0].t, n: D.DRILLS[0].n, state: '去作答' } }); }
  },
  // 首页名师讲堂卡：接 GET /api/lectures 的下一场；连不上用演示场次
  async loadLecture() {
    try {
      const r = await S.lectures.list(); const x = r.upcoming[0];
      this.setData({ live: x ? { id: x.id, when: S.lectures.when(x.at, x.minutes), t: x.title, d: x.desc } : null, liveOn: !!(x && x.booked), liveDemo: false });
    } catch (e) { this.setData({ live: D.LIVES[0], liveOn: !!S.get().live[0], liveDemo: true }); }
  },
  async toggleLive() {
    if (this.data.liveDemo) { const ST = S.get(); ST.live[0] = !ST.live[0]; S.save(); wx.showToast({ title: ST.live[0] ? '已预约（演示）' : '已取消预约', icon: 'none' }); return this.loadLecture(); }
    if (!S.auth.signedIn()) { wx.showToast({ title: '登录后才能预约', icon: 'none' }); return; }
    try {
      const r = await S.lectures.book(this.data.live.id, !this.data.liveOn);
      if (r.lecture.booked) { const mine = await S.notify.ask(['lecture']).catch(() => null); wx.showToast({ title: mine && mine.lecture > 0 ? '已预约，开播前 30 分钟提醒' : '已预约', icon: 'none' }); }
      else wx.showToast({ title: '已取消预约', icon: 'none' });
      this.loadLecture();
    } catch (err) { wx.showToast({ title: '没成：' + err.message, icon: 'none' }); }
  },
  notice() { wx.showToast({ title: '已生成补训通知（原型演示）', icon: 'none' }); },
  go(e) { const u = e.currentTarget.dataset.u; (['home', 'paths', 'lessons', 'community', 'me'].some(t => u.includes('/' + t + '/')) ? wx.switchTab : wx.navigateTo)({ url: u }); },
  file(e) { wx.showToast({ title: '原型：「' + e.currentTarget.dataset.n + '」预览', icon: 'none' }); }
});
