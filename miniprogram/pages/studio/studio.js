// 名师工作室与市级展示：工作室名单、方向、成员与产出；市级展示的上台作品与名师点评。没有分数与名次。
const S = require('../../utils/store.js');
const DEMO_STUDIOS = [
  { id: 'demo-1', name: '张老师工作室', meta: '张老师 主持 · 游戏活动支持与引导 · 2026 秋 · 成员 6 · 产出 4 条', intro: '产出园本游戏案例，每学期一次共读与一次入园观摩。', cases: ['影子游戏的三次推进', '沙水区的水渠', '建构区的“桥”从哪来', '娃娃家的角色轮换'] },
  { id: 'demo-2', name: '李老师工作室', meta: '李老师 主持 · 观察、记录与评价 · 2026 秋 · 成员 5 · 产出 2 条', intro: '事实与推断分开写；每月一段公共录像共写。', cases: ['一段 3 分钟录像的五份记录', '接园一分钟怎么说'] }
];
const DEMO_SHOWS = [{ id: 'demo-s1', title: '2026 柳州学前教育市级展示', meta: '张老师工作室 主持 · 2026-12-18 · 市教师发展中心 · 游戏中的学习 · 上台 6 件 · 年度分享者 周老师', entries: [
  { title: '影子游戏的三次推进', who: '周老师 · 柳北区示例幼儿园 · 柳北一组 · 共同体赛 · 2026-11 · 中班', comment: '三次推进都从幼儿的问题出发，材料的变化跟着问题走；换一个班，先看他们问的是什么。' },
  { title: '沙水区的水渠', who: '陈老师 · 雀儿山幼儿园 · 柳北一组 · 共同体赛 · 2026-11 · 大班', comment: '教师退后的时机把握得好；可以把那张“失败的坝”也留在案例里。' }
] }];
Page({
  data: { demo: true, studios: DEMO_STUDIOS, shows: DEMO_SHOWS, eligible: false },
  onShow() { this.reload(); },
  async reload() {
    if (S.auth.signedIn()) {
      try {
        const r = await S.studios.studios();
        const studios = r.studios.map(s => ({ id: s.id, name: s.name, meta: `${s.hostName} 主持${s.focus ? ' · ' + s.focus : ''}${s.term ? ' · ' + s.term : ''} · 成员 ${s.members.length} · 产出 ${s.cases.length} 条${s.mine ? ' · ' + ({ host: '我主持', member: '我是成员', applicant: '已申请' })[s.mine] : ''}`, intro: s.intro, cases: s.cases.map(c => c.title), canApply: s.canApply }));
        let shows = [];
        try { const w = await S.studios.showcases(); shows = w.showcases.map(x => ({ id: x.id, title: x.title, meta: `${x.studioName} 主持 · ${new Date(x.at).toLocaleDateString('zh-CN')}${x.place ? ' · ' + x.place : ''}${x.theme ? ' · ' + x.theme : ''} · 上台 ${x.entryCount} 件${x.sharers.length ? ' · 年度分享者 ' + x.sharers.map(y => y.name).join('、') : ''}${x.closedAt ? ' · 已收官' : ''}`, entries: x.entries.map(c => ({ title: c.title, who: [c.byName, c.orgName, c.communityName, c.tag].filter(Boolean).join(' · '), comment: c.comment ? c.comment.text : '' })) })); } catch (e) { /* 没有展示 */ }
        this.setData({ demo: false, studios, shows, eligible: r.eligible }); return;
      } catch (e) { /* 回落演示 */ }
    }
    this.setData({ demo: true, studios: DEMO_STUDIOS, shows: DEMO_SHOWS });
  },
  async apply(e) {
    if (this.data.demo) { wx.showToast({ title: '演示数据，登录后可申请', icon: 'none' }); return; }
    try { await S.studios.apply(e.currentTarget.dataset.id); wx.showToast({ title: '已申请，等主持人通过', icon: 'none' }); this.reload(); }
    catch (err) { wx.showToast({ title: err.code === 'eligible' ? '要有骨干教师认证' : '没申请成', icon: 'none' }); }
  },
  goLibrary() { wx.navigateTo({ url: '/pages/library/library' }); }
});
