const S = require('../../utils/store.js');
const D = S.D;
const SEGN = { jiang: '讲', kan: '看', zuo: '做', ce: '测' };
Page({
  data: { chap: 0, scene: 0 },
  onLoad(q) { this.p = q.p; this.i = +q.i; if (q.seg === 'jiang' || q.seg === 'kan') { const st = S.lvState(this.p, this.i); st.seg = q.seg; S.save(); } this.reload(); this.loadQuestions(); },
  onShow() { if (this.p) { this.reload(); this.watchEvents(); this.loadSub(); } },
  // 实践关 / 研讨关：进页取一次本人提交；实践关待点评时停在「做」每 15 秒问一次
  loadSub() {
    const l = D.PATHS[this.p][this.i];
    if (!S.isSub(l) || !S.auth.signedIn()) return;
    const tick = () => S.submissions.load(this.p + '-' + this.i).then(() => { const passed = S.tryPass(this.p, this.i); this.reload(); if (passed) wx.showToast({ title: '第 ' + (this.i + 1) + ' 关通过，积分已记', icon: 'none' }); if (S.zuoDone(this.p, this.i)) { clearInterval(this.subTm); this.subTm = null; } });
    tick();
    clearInterval(this.subTm); this.subTm = setInterval(() => { if (this.data.seg === 'zuo' && S.status(this.p, this.i) === 'current') tick(); }, 15000);
  },
  subInput(e) { this.subText = e.detail.value; },
  async submitSub() {
    const l = D.PATHS[this.p][this.i], t = (this.subText || '').trim();
    if (!S.auth.signedIn()) { wx.showToast({ title: '登录后提交', icon: 'none' }); return; }
    if (!t) { wx.showToast({ title: l.type === 'practice' ? '写一段记录再交' : '先写下你的回答', icon: 'none' }); return; }
    if (l.type === 'seminar' && t.length < 20) { wx.showToast({ title: '再写具体一点，至少 20 字', icon: 'none' }); return; }
    try {
      await S.submissions.submit(this.p + '-' + this.i, t, []);
      this.subText = ''; this.setData({ subVal: '', subEditing: false });
      wx.showToast({ title: l.type === 'practice' ? '已提交，等点评' : '已提交', icon: 'none' });
      // 实践关：问一次要不要在点评有结果时收一条订阅消息（一次性，每次提交问一次）
      if (l.type === 'practice') S.notify.ask(['review']).catch(() => {});
      const passed = S.tryPass(this.p, this.i); this.reload();
      if (passed) wx.showToast({ title: '第 ' + (this.i + 1) + ' 关通过，积分已记', icon: 'none' });
    } catch (e) { wx.showToast({ title: '提交失败：' + (e.message || ''), icon: 'none' }); }
  },
  editSub() { const d = S.submissions.get(this.p + '-' + this.i), m = S.submissions.latest(d && d.submissions); this.subText = m ? m.text : ''; this.setData({ subEditing: true, subVal: this.subText }); },
  onHide() { clearInterval(this.evTm); this.evTm = null; clearInterval(this.subTm); this.subTm = null; },
  onUnload() { clearInterval(this.evTm); this.evTm = null; clearInterval(this.subTm); this.subTm = null; },
  // 登录后等平台回传：进页问一次，停在「做」时每 10 秒问一次
  watchEvents() {
    clearInterval(this.evTm); this.evTm = null;
    const l = D.PATHS[this.p][this.i];
    if (!S.auth.signedIn() || !String(l.event || '').trim() || S.zuoDone(this.p, this.i) || S.status(this.p, this.i) !== 'current') return;
    const tick = () => S.events.load().then(() => { if (S.zuoDone(this.p, this.i)) { clearInterval(this.evTm); this.evTm = null; const passed = S.tryPass(this.p, this.i); this.reload(); if (passed) wx.showToast({ title: '第 ' + (this.i + 1) + ' 关通过，积分已记', icon: 'none' }); } });
    tick();
    this.evTm = setInterval(() => { if (this.data.seg === 'zuo') tick(); }, 10000);
  },
  reload() {
    const p = this.p, i = this.i, l = D.PATHS[p][i], st = S.lvState(p, i), s = S.status(p, i), tot = D.PATHS[p].length;
    const qs = S.qsOf(p, i), nq = qs.length, locked = s === 'locked', done = s === 'done';
    const scenes = S.scenesOf(p, i), chapters = S.chaptersOf(p, i), steps = S.stepsOf(p, i);
    const sub = S.isSub(l), subData = sub ? S.submissions.get(p + '-' + i) : null, mine = sub ? S.submissions.latest(subData && subData.submissions) : null;
    const okN = done ? nq : st.right.length, zuo = sub ? S.zuoDone(p, i) : (S.zuoDone(p, i) && !!String(l.event || '').trim() ? true : st.zuo);
    const tabs = [
      { k: 'jiang', t: '白板微课', sub: scenes.length + ' 幕', done: st.seg !== 'jiang' || st.zuo || done },
      { k: 'kan', t: '操作录屏', sub: steps.length + ' 步', done: ['zuo', 'ce'].includes(st.seg) || st.zuo || done },
      { k: 'zuo', t: sub ? (l.type === 'practice' ? '实践任务' : '情景研讨') : '平台实操', sub: done || zuo ? '已通过' : locked ? '解锁后开放' : sub ? (mine ? S.submissions.STATUS[mine.status] : '待提交') : '等待回传', done: done || zuo, lock: locked },
      { k: 'ce', t: '即时测验', sub: okN + '/' + nq, done: done || okN >= nq, lock: locked }
    ];
    const quiz = qs.map((q, qi) => ({ t: q.t, jump: q.jump, picked: done ? q.o.findIndex(o => o[1]) : (this.picked || {})[qi], o: q.o.map((o, oi) => ({ l: 'ABCD'[oi], t: o[0], ok: !!o[1], why: o[2] })) }));
    wx.setNavigationBarTitle({ title: '第 ' + (i + 1) + ' 关' });
    this.setData({ p, i, tot, pathName: D.PATHN[p], title: S.title(p, i), goal: l.goal.replace(/^能/, ''), dur: l.dur, status: s, locked, done, nextProg: S.get().prog[p] + 1,
      seg: st.seg, tabs, scenes, chapters, steps, event: l.event, menu: l.menu, btn: l.btn, nq, okN, quiz,
      zuo: zuo || done, zuoAt: st.zuoAt, signedIn: S.auth.signedIn(),
      subType: sub ? l.type : '', subNote: sub ? (l.type === 'practice' ? l.evidence.note : l.prompt) : '', rubric: l.rubric || [],
      mine: mine ? Object.assign({}, mine, { statusText: S.submissions.STATUS[mine.status], atText: S.fmtDay(mine.at), reviewAt: mine.review ? S.fmtDay(mine.review.at) : '' }) : null,
      others: subData && subData.others ? subData.others.map(o => Object.assign({}, o, { atText: S.fmtDay(o.at) })) : [],
      canSubmit: sub && s === 'current' && S.auth.signedIn() && (!mine || mine.status === 'revise' || !!this.data.subEditing), passedAt: S.passedAt(p, i), hasNext: i + 1 < tot, nextTitle: i + 1 < tot ? S.title(p, i + 1) : '',
      featured: !!l.featured, points: l.featured ? D.OBS.points : steps, asked: S.get().asked.filter(a => a.k === p + '-' + i).map(a => ({ id: '', q: a.q, status: '待回复', ans: [] })),
      files: D.FILES.filter(f => f[2] === D.PATHN[p]).slice(0, 2), roleLabel: D.PATHN[S.get().role],
      sub: scenes[this.data.scene] ? scenes[this.data.scene].subs[0] : '' });
  },
  setSeg(e) { const k = e.currentTarget.dataset.k; if (this.data.locked && (k === 'zuo' || k === 'ce')) { wx.showToast({ title: '解锁后开放', icon: 'none' }); return; } const st = S.lvState(this.p, this.i); st.seg = k; S.save(); this.reload(); },
  pickScene(e) { const k = +e.currentTarget.dataset.k; this.setData({ scene: k, sub: this.data.scenes[k].subs[0] }); },
  pickChap(e) { this.setData({ chap: +e.currentTarget.dataset.k }); },
  // 模拟回传：登录了就真发一条到服务端（DEV_LOGIN=1 才收），没登录或服务端不收就只记本机
  async simulate() {
    const l = D.PATHS[this.p][this.i];
    if (S.auth.signedIn()) {
      try { await S.events.demo(l.event); }
      catch (e) { if (e.status === 403) { wx.showToast({ title: '服务端没开演示回传', icon: 'none' }); return; } }
    }
    const st = S.lvState(this.p, this.i); if (!S.events.has(l.event)) st.zuo = true; st.zuoAt = S.fmtTime();
    const passed = S.tryPass(this.p, this.i); S.save(); this.reload();
    if (passed) wx.showToast({ title: '第 ' + (this.i + 1) + ' 关通过，积分已记', icon: 'none' });
  },
  openPlatform() { wx.setClipboardData({ data: 'https://campus.lzpreschool.cn/ulogin', success: () => wx.showToast({ title: '平台地址已复制，请在浏览器打开', icon: 'none' }) }); },
  pick(e) {
    const { q, o } = e.currentTarget.dataset, qi = +q, oi = +o, quiz = this.data.quiz, st = S.lvState(this.p, this.i);
    if (this.data.done) return;
    this.picked = this.picked || {}; this.picked[qi] = oi;
    const ok = quiz[qi].o[oi].ok;
    st.right = st.right.filter(x => x !== qi); if (ok) st.right.push(qi);
    const passed = S.tryPass(this.p, this.i); S.save(); this.reload();
    if (passed) wx.showToast({ title: '第 ' + (this.i + 1) + ' 关通过，积分已记', icon: 'none' });
  },
  jump(e) { const k = e.currentTarget.dataset.k; const st = S.lvState(this.p, this.i); st.seg = k; S.save(); this.reload(); },
  goNext() { wx.redirectTo({ url: `/pages/level/level?p=${this.p}&i=${this.i + 1}` }); },
  goCurrent() { wx.redirectTo({ url: `/pages/level/level?p=${this.p}&i=${S.get().prog[this.p]}` }); },
  goMe() { wx.switchTab({ url: '/pages/me/me' }); },
  // 登录了取本关的真实问答（GET /api/questions?level=）：我的提问带助手整理与回答；本园已答的作为参考
  async loadQuestions() {
    if (!S.auth.signedIn()) return;
    try {
      const r = await S.questions.ofLevel(this.p + '-' + this.i);
      const row = q => ({ id: q.id, q: q.text, status: { open: q.answers.length ? '有回答，去采纳' : (q.assistant && q.assistant.draft ? '助手有草稿，等种子教师确认' : '等种子教师回答') , answered: '已采纳', closed: '已解决' }[q.status], mine: q.mine, who: q.mine ? '我的提问' : q.name + ' 问过',
        note: q.assistant ? (q.assistant.summary ? '助手概括：' + q.assistant.summary : q.assistant.note) : '', ans: q.answers.map(a => ({ id: a.id, by: a.byName + ' · ' + a.roleLabel + (a.fromAssistant ? '（据助手草稿）' : ''), text: a.text, accepted: a.accepted })) });
      this.setData({ asked: r.mine.map(row).concat(r.faq.map(row)), apiQa: true });
    } catch (e) { /* 保留本地 */ }
  },
  async acceptAnswer(e) { const { id, a } = e.currentTarget.dataset; try { await S.questions.accept(id, a); wx.showToast({ title: '已采纳', icon: 'none' }); this.loadQuestions(); } catch (err) { wx.showToast({ title: '没成', icon: 'none' }); } },
  async closeQ(e) { try { await S.questions.close(e.currentTarget.dataset.id); wx.showToast({ title: '已标已解决', icon: 'none' }); this.loadQuestions(); } catch (err) { wx.showToast({ title: '没成', icon: 'none' }); } },
  // 标点评「有帮助」（只有提交人能标，计点评人的贡献勋章）
  async markHelpful() { const m = this.data.mine; if (!m || !m.review) return; try { await S.submissions.helpful(this.p + '-' + this.i, m.id, !m.review.helpful); this.reload(); } catch (e) { wx.showToast({ title: '没标成', icon: 'none' }); } },
  askInput(e) { this.ask = e.detail.value; },
  async submitAsk() {
    const v = (this.ask || '').trim(); if (!v) return;
    if (S.auth.signedIn()) {
      try { const r = await S.questions.ask(this.p + '-' + this.i, v); this.ask = ''; this.setData({ askVal: '' }); wx.showToast({ title: r.question.assistant && r.question.assistant.draft ? '助手起了草稿，等种子教师确认' : '已提交，等种子教师回答', icon: 'none' }); this.loadQuestions(); return; }
      catch (e) { wx.showToast({ title: e.code === 'limit' ? '开放中的提问已有五条' : '没提交成', icon: 'none' }); return; }
    }
    S.get().asked.push({ k: this.p + '-' + this.i, q: v }); S.save(); this.ask = ''; this.setData({ askVal: '' }); wx.showToast({ title: '已提交，值守时段内回复', icon: 'none' }); this.reload(); },
  file(e) { wx.showToast({ title: '原型：「' + e.currentTarget.dataset.n + '」预览', icon: 'none' }); }
});
