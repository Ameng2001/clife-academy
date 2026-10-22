const S = require('../../utils/store.js');
const D = S.D;
Page({
  data: { lives: [], replays: [], demo: false, remindOn: false },
  onShow() { this.reload(); },
  // 接 GET /api/lectures；连不上回落演示场次（本地预约只记在手机上）。讲堂包：讲前 pack.preview.points 是预习卡，讲完 pack.clips 是微课切片、pack.poster 是海报
  async reload() {
    try {
      const r = await S.lectures.list();
      const lives = r.upcoming.map(x => ({ id: x.id, when: S.lectures.when(x.at, x.minutes) + (x.phase === 'live' ? ' · 正在直播' : ''), t: x.title, d: x.desc, who: (x.speaker ? x.speaker + ' 主讲 · ' : '') + (x.who || '园长'), on: x.booked, n: x.bookings, liveUrl: x.liveUrl, slides: x.slides && x.slides.url, live: x.phase === 'live', points: (x.pack && x.pack.preview && x.pack.preview.points) || [] }));
      const replays = r.done.map(x => ({ id: x.id, t: x.title, when: S.lectures.when(x.at, x.minutes), who: x.who, url: x.replayUrl, slides: x.slides && x.slides.url, notes: x.notes, clips: (x.pack && x.pack.clips) || [], poster: (x.pack && x.pack.poster) || null }));
      this.setData({ lives, replays, demo: false });
    } catch (e) {
      const ST = S.get();
      this.setData({ lives: D.LIVES.map((x, i) => Object.assign({ id: 'demo-' + i, on: !!ST.live[i], demo: true }, x)), replays: D.REPLAYS.map(r => ({ id: r[0], t: r[0], when: r[1], who: r[2] })), demo: true });
    }
  },
  async toggle(e) {
    const i = +e.currentTarget.dataset.i, l = this.data.lives[i];
    if (this.data.demo) { const ST = S.get(); ST.live[i] = !ST.live[i]; S.save(); wx.showToast({ title: ST.live[i] ? '已预约（演示）' : '已取消预约', icon: 'none' }); return this.reload(); }
    if (!S.auth.signedIn()) { wx.showToast({ title: '登录后才能预约', icon: 'none' }); return; }
    try {
      const r = await S.lectures.book(l.id, !l.on);
      if (r.lecture.booked) {
        // 预约时顺手问一次订阅：开播前 30 分钟一条，只发这一场
        const mine = await S.notify.ask(['lecture']).catch(() => null);
        wx.showToast({ title: mine && mine.lecture > 0 ? '已预约，开播前 30 分钟提醒' : '已预约', icon: 'none' });
      } else wx.showToast({ title: '已取消预约', icon: 'none' });
      this.reload();
    } catch (err) { wx.showToast({ title: err.code === 'over' ? '这场已结束，看回放' : '没成：' + err.message, icon: 'none' }); }
  },
  copy(e) {
    const u = e.currentTarget.dataset.u;
    if (!u) { wx.showToast({ title: this.data.demo ? '原型：回放播放器' : '回放整理中', icon: 'none' }); return; }
    wx.setClipboardData({ data: u, success: () => wx.showToast({ title: '链接已复制，到浏览器或腾讯会议打开', icon: 'none', duration: 2500 }) });
  }
});
