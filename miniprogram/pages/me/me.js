const S = require('../../utils/store.js');
const D = S.D;
const SOURCE = { wechat: '微信', platform: '平台账号', dev: '开发桩' };
Page({
  async applyCohort(e) { try { await S.certs.apply(e.currentTarget.dataset.id); wx.showToast({ title: '已报名', icon: 'none' }); this.loadHonors(); } catch (err) { wx.showToast({ title: err.code === 'eligible' ? '条件还不够' : '没报成', icon: 'none' }); } },
  data: { busy: false },
  goCheckup() { wx.navigateTo({ url: '/pages/checkup/checkup' }); },
  goGrowth() { wx.navigateTo({ url: '/pages/growth/growth' }); },
  goMall() { wx.navigateTo({ url: '/pages/mall/mall' }); },
  onShow() {
    this.reload();
    if (S.auth.signedIn()) { S.submissions.loadAll().then(() => this.reload()); this.loadHonors(); S.auth.pair().then(p => this.setData({ mentor: p.mentor ? p.mentor.name : '', mentees: (p.mentees || []).map(m => m.name).join('、') })).catch(() => {}); }
    else this.setData({ mentor: '', mentees: '', honors: null, points: null });
  },
  // 荣誉与积分：勋章按记录算、称号人授；积分是平台唯一的资产（钱包页与工坊统一，这里只给余额）
  async loadHonors() {
    try {
      const [h, p] = await Promise.all([S.honors.honors(), S.honors.points()]);
      S.portfolio.hours().then(h => this.setData({ hours: { label: h.schoolYear.label, minutes: h.minutes, hours: h.hours, per: h.rule.minutesPerHour, certs: h.certs.map(c => ({ id: c.id, no: c.no, hours: c.hours, when: S.fmtDay(c.from) + ' 至 ' + S.fmtDay(c.to) })) } })).catch(() => this.setData({ hours: null }));
      S.certs.mine().then(c => this.setData({ certs: { list: c.certificates.map(x => ({ id: x.id, label: x.label, no: x.no, at: S.fmtDay(x.at) })), rows: [].concat(c.tool ? [{ k: 'tool', name: c.kinds.tool + ' · ' + c.tool.name, ok: c.tool.ok, txt: '已过 ' + c.tool.done + '/' + c.tool.total + ' 关' + (c.tool.quiz != null ? ' · 正确率 ' + c.tool.quiz + '%' : '') }] : [], c.domains.map(x => ({ k: x.path, name: c.kinds.domain + ' · ' + x.name, ok: x.ok, txt: '已过 ' + x.done + '/' + x.total + ' 关 · 作品 ' + x.works + '/' + x.worksTotal })), [{ k: 'backbone', name: c.kinds.backbone, ok: c.backbone.ok, txt: '领域证书 ' + c.backbone.domainCerts + '/3 · 案例 ' + c.backbone.cases + '/1 · 线下答辩' + (c.backbone.eligible && !c.backbone.ok ? ' · 条件已达到' : '') }]), cohorts: c.cohorts.map(x => ({ id: x.id, name: x.name, phase: x.phase, mine: x.mine, canApply: x.phase === 'open' && !x.mine && c.backbone.eligible && !c.backbone.ok, when: '报名到 ' + S.fmtDay(x.applyTo) + (x.defenseAt ? ' · 答辩 ' + S.fmtDay(x.defenseAt) : '') })) } })).catch(() => this.setData({ certs: null }));
      const on = h.badges.filter(b => b.on).map(b => ({ key: b.key, name: b.name, at: S.fmtDay(b.at) }));
      this.setData({ honors: { titles: h.titles.map(t => ({ id: t.id, label: t.label, by: t.byName, at: S.fmtDay(t.at), reason: t.reason })), on, off: h.badges.filter(b => !b.on).map(b => ({ key: b.key, name: b.name, txt: b.of ? b.progress + '/' + b.of : '未获得' })), extra: h.creditsTotal }, points: Object.assign({}, p, { toolNames: Object.keys(p.tools).map(k => p.tools[k]).join('、'),
        // 最近几笔（钱包页与工坊统一，这里只给最近 6 笔）：从园所额度扣的标出来，正进负出
        recent: (p.history || []).slice(0, 6).map(x => ({ at: S.fmtDay(x.at), text: (x.tool ? x.tool + ' · ' : '') + (x.sub === 'quota' ? '园所额度 · ' : '') + x.note, n: (x.n > 0 ? '+' : '') + x.n, pos: x.n > 0, quota: x.sub === 'quota' })),
        more: (p.history || []).length > 6 }) });
    } catch (e) { this.setData({ honors: null, points: null, certs: null, hours: null }); }
  },
  reload() {
    const ST = S.get(), p = S.myPath(), tot = D.PATHS[p].length, d = ST.prog[p], fin = d >= tot;
    const badges = Object.keys(D.PATHS).map(q => ({ q, name: D.PATHN[q], ico: D.PATHN[q][0], on: ST.prog[q] >= D.PATHS[q].length, txt: ST.prog[q] >= D.PATHS[q].length ? '已获得' : ST.prog[q] + '/' + D.PATHS[q].length }));
    const recs = D.PATHS[p].slice(0, Math.min(d, tot)).map((l, i) => ({ i, t: S.title(p, i), at: S.passedAt(p, i) || '—' })).reverse();
    const u = ST.user, a = (u && u.academy) || {};
    const cap = S.capability.capabilityMap(S.sync.get().progress || {}, S.submissions.getAll());
    const domains = cap.domains.map(d => Object.assign({}, d, { pill: d.status === 'evidenced' ? 'ok' : d.status === 'started' ? 'warn' : 'idle', label: d.status === 'evidenced' ? '有证据' : d.status === 'started' ? '在做' : '还空着',
      sub: d.text + (d.cert ? ' · 领域路径 ' + d.cert.done + '/' + d.cert.total + (d.cert.ready ? ' · 领域研修证书可申领' : '') : '') }));
    this.setData({ domains, evidenced: cap.evidenced, toolsDone: cap.tools.done, toolsTotal: cap.tools.total, org: (a.org && a.org.name) || D.ORG, roleLabel: S.roleLabel(), credits: ST.credits[p], d, tot, fin, badges, recs,
      signedIn: ST.signedIn, userName: u ? u.name : '', roleName: D.PATHN[ST.role], source: SOURCE[a.source] || '', orgName: a.org ? a.org.name : '' });
  },
  async login() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await S.auth.login();
      await S.sync.onLogin(n => new Promise(resolve => wx.showModal({
        title: '把这台手机上通过的关卡记到账号里？',
        content: '这台手机在没登录时通过了 ' + n + ' 关。记到账号里，或者保持账号在服务器上的样子。',
        confirmText: '记到账号里', cancelText: '保持原样',
        success: r => resolve(!!r.confirm), fail: () => resolve(false)
      })));
      wx.showToast({ title: '欢迎，' + (S.auth.current() || {}).name, icon: 'none' });
    } catch (e) {
      wx.showToast({ title: e.status === 404 ? '服务端没开微信登录' : e.code === 'network' ? '连不上服务器' : '登录失败：' + (e.message || ''), icon: 'none' });
    }
    this.setData({ busy: false });
    this.reload();
  },
  logout() {
    wx.showModal({ title: '退出登录？', content: '进度已在账号里，换台设备登录照样有。', success: async r => {
      if (!r.confirm) return;
      await S.sync.push();
      await S.auth.logout();
      S.sync.onLogout();
      wx.showToast({ title: '已退出', icon: 'none' });
      this.reload();
    } });
  }
});
