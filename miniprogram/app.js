// 学前教师发展平台 小程序（平台名称由服务端 /api/config 的 brand 给，见 utils/brand.js）
// 启动：有 token 就问一次 /api/me（顺手换新 token），再拉账号进度；回前台查修订号。页面各自在 onShow 里 reload。
const S = require('./utils/store.js');
const BRAND = require('./utils/brand.js');
App({
  globalData: { org: S.D.ORG, roles: S.D.ROLES },
  onLaunch(options) { BRAND.refresh().then(() => this.refreshPage()); this.restore(options); },
  onShow(options) {
    const ticket = S.auth.ticketFrom(options);
    if (ticket && ticket !== this.lastTicket) { this.lastTicket = ticket; this.fromPlatform(ticket); return; }
    S.sync.check(false).then(() => this.refreshPage());
  },
  async restore(options) {
    const ticket = S.auth.ticketFrom(options);
    if (ticket) { this.lastTicket = ticket; return this.fromPlatform(ticket); }
    try { const u = await S.auth.me(); if (u) await S.sync.pull(); }
    catch (e) { /* 离线：本地存的身份与进度照用 */ }
    this.refreshPage();
  },
  // 平台带着票据拉起：换会话、接管本机进度（演示进度丢掉，真通过的关问一句）
  async fromPlatform(ticket) {
    try {
      const u = await S.auth.loginPlatform(ticket);
      await S.sync.onLogin(n => new Promise(resolve => wx.showModal({
        title: '把这台手机上通过的关卡记到账号里？', content: '这台手机在没登录时通过了 ' + n + ' 关。',
        confirmText: '记到账号里', cancelText: '保持原样', success: r => resolve(!!r.confirm), fail: () => resolve(false)
      })));
      wx.showToast({ title: '欢迎，' + u.name, icon: 'none' });
    } catch (e) {
      wx.showToast({ title: e.status === 401 ? '平台票据无效，请从平台重新进入' : e.status === 404 ? '服务端没开平台登录' : '平台登录失败', icon: 'none' });
    }
    this.refreshPage();
  },
  // 当前页重画（同步落地后）
  refreshPage() { const pages = getCurrentPages(), cur = pages[pages.length - 1]; if (cur && cur.reload) cur.reload(); },
  roleLabel() { return S.roleLabel(); }
});
