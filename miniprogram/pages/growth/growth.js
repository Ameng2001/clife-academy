// 专业发展：Coach、自评、教研任务、练习营、研修项目、分享日。本人这一侧；没登录回落演示数据。
const S = require('../../utils/store.js');
const KIND = { plan: '学期计划', review: '周回顾', debrief: '单关复盘' };
const CHANGE = { 'add-practice': '再做一次实践任务', pair: '建议配带教' };
const STATUS = { applied: '已报名', accepted: '已录取', declined: '未录取', completed: '已完成' };
const DEMO = {
  cards: [{ id: 'd1', kind: 'review', kindName: '周回顾', at: '10 月 20 日', summary: '「观察与评价」走到第 1 关后停了 16 天；「事实与推断」改了 2 次还没过。', changes: [{ label: '再做一次实践任务', why: '先把上一次点评里的那一条单独练一次' }], accepted: null }],
  tasks: [{ id: 'd1', title: '看这节中班科学课', meta: '教研主任 发 · 10 月 24 日前交 · 3 人交了', prompt: '写三点你会改的地方，每点一个事实。', open: true, mine: '', others: [] }],
  camps: [{ id: 'd1', title: '21 天观察记录练习营', meta: '本园 · 进行中 · 第 5 天 · 8 人', mine: false, canJoin: true, phase: 'running', today: 4, task: '挑一个幼儿看五分钟，只写事实', posts: [] }],
  programs: [{ id: 'd1', title: '2027 寒假观察记录研修', meta: '寒暑假研修 · 1 月 26 日 至 1 月 28 日 · 市教师发展中心 · 12 学时 · 名额 40', canApply: true, status: '' }],
  sharedays: [{ id: 'd1', title: '本学期的区角', meta: '柳北一组 · 12 月 12 日 · 甲园 · 3 园 · 交了 2 页', pages: [{ orgName: '柳北区示例幼儿园', note: '这学期我们改了两个区角。', cases: '心情墙、建构区的“桥”' }] }]
};
Page({
  data: { demo: true, busy: false, levels: {}, focus: '', reflection: '', replies: {}, campText: {}, cards: [], tasks: [], camps: [], programs: [], sharedays: [], minReply: 100 },
  onShow() { this.reload(); },
  goLevel(e) { const id = e.currentTarget.dataset.id, m = id.match(/^(.*)-(\d+)$/); if (m) wx.navigateTo({ url: `/pages/level/level?p=${m[1]}&i=${m[2]}` }); },
  async reload() {
    if (!S.auth.signedIn()) { this.setData(Object.assign({ demo: true, coach: null, sr: null }, DEMO)); return; }
    const G = S.growth;
    const card = c => ({ id: c.id, kind: c.kind, kindName: KIND[c.kind], at: S.fmtDay(c.at), summary: c.summary, accepted: c.accepted, changes: (c.changes || []).map(x => ({ label: CHANGE[x.type] || x.type, why: x.why })) });
    const [coach, sr, tasks, camps, programs, sharedays] = await Promise.all([
      G.coach().catch(() => null), G.selfReview().catch(() => null), G.studyTasks().catch(() => ({ tasks: [], minReply: 100 })), G.camps().catch(() => ({ camps: [] })), G.programs().catch(() => ({ programs: [] })), G.sharedays().catch(() => ({ sharedays: [] }))
    ]);
    this.setData({ demo: false,
      coach: coach ? { stage: coach.stage, model: coach.model, plan: coach.plan } : null, cards: coach ? coach.cards.slice(0, 5).map(card) : [],
      sr: sr ? { term: sr.term, items: sr.items, scale: sr.scale, mine: sr.mine, comments: sr.comments.map(c => ({ who: (c.role === 'mentor' ? '带教教师 ' : '园长 ') + c.byName, text: c.text, at: S.fmtDay(c.at) })) } : null,
      levels: sr && sr.mine ? sr.mine.levels : this.data.levels, focus: sr && sr.mine ? sr.mine.focus : this.data.focus, reflection: sr && sr.mine ? sr.mine.reflection : this.data.reflection,
      minReply: tasks.minReply || 100,
      tasks: tasks.tasks.map(t => ({ id: t.id, title: t.title, prompt: t.prompt, open: t.open, meta: `${t.byName} 发 · ${t.open ? S.fmtDay(t.dueAt) + ' 前交' : '已收'} · ${t.replies} 人交了`, mine: t.mine ? t.mine.text : '', others: (t.list || []).filter(r => !r.mine).map(r => ({ name: r.name, text: r.text })) })),
      camps: camps.camps.map(c => ({ id: c.id, title: c.title, mine: c.mine, phase: c.phase, today: c.today, task: c.days[c.today], canJoin: c.phase === 'upcoming' || c.phase === 'running', summary: c.summary, meta: `${c.scope === 'all' ? '全平台' : c.orgName || '本园'} · ${({ upcoming: '报名中', running: '进行中', ended: '已结束', done: '已结营' })[c.phase]} · ${c.days.length} 天 · ${c.members} 人${c.graduated ? ' · 我已结营' : ''}`, posts: (c.posts || []).filter(p => p.day === c.today).map(p => ({ id: p.id, day: p.day, name: p.name, text: p.text })) })),
      programs: programs.programs.map(p => ({ id: p.id, title: p.title, canApply: p.canApply, status: p.mine ? STATUS[p.mine.status] : '', meta: `${p.kind} · ${S.fmtDay(p.from)}${p.to !== p.from ? ' 至 ' + S.fmtDay(p.to) : ''}${p.place ? ' · ' + p.place : ''} · ${p.hours} 学时${p.capacity ? ' · 名额 ' + p.capacity : ''}` })),
      sharedays: sharedays.sharedays.map(s => ({ id: s.id, title: s.theme || '园所分享日', meta: `${s.communityName} · ${S.fmtDay(s.at)}${s.place ? ' · ' + s.place : ''} · ${s.orgs} 园 · 交了 ${s.pages.length} 页`, pages: s.pages.map(p => ({ orgName: p.orgName, note: p.note, cases: p.cases.map(c => c.title).join('、') })) }))
    });
  },
  async act(fn, ok) { if (this.data.busy) return; this.setData({ busy: true }); try { await fn(); if (ok) wx.showToast({ title: ok, icon: 'none' }); await this.reload(); } catch (e) { wx.showToast({ title: '没成' + (e.message ? '：' + e.message : ''), icon: 'none' }); } this.setData({ busy: false }); },
  coachPlan() { this.act(() => S.growth.coachPlan()); },
  coachReview() { this.act(() => S.growth.coachReview()); },
  coachAccept(e) { this.act(() => S.growth.coachAccept(e.currentTarget.dataset.id, true), '已采用'); },
  pick(e) { const { key, n } = e.currentTarget.dataset; this.setData({ ['levels.' + key]: Number(n) }); },
  onFocus(e) { this.setData({ focus: e.detail.value }); },
  onReflection(e) { this.setData({ reflection: e.detail.value }); },
  saveSelfReview() { const sr = this.data.sr; if (!sr) return; if (sr.items.some(i => this.data.levels[i.key] == null)) return wx.showToast({ title: '七个领域每个选一档', icon: 'none' }); this.act(() => S.growth.saveSelfReview(this.data.levels, this.data.focus, this.data.reflection), '已交'); },
  onReply(e) { this.setData({ ['replies.' + e.currentTarget.dataset.id]: e.detail.value }); },
  reply(e) { const id = e.currentTarget.dataset.id; this.act(() => S.growth.studyReply(id, this.data.replies[id] || ''), '已交'); },
  campJoin(e) { this.act(() => S.growth.campJoin(e.currentTarget.dataset.id), '已报名'); },
  campLeave(e) { const id = e.currentTarget.dataset.id; wx.showModal({ title: '退营？', content: '你的帖子一起删，不留记录。', success: r => { if (r.confirm) this.act(() => S.growth.campLeave(id), '已退营'); } }); },
  onCampText(e) { this.setData({ ['campText.' + e.currentTarget.dataset.id]: e.detail.value }); },
  campPost(e) { const { id, day } = e.currentTarget.dataset; this.act(() => S.growth.campPost(id, Number(day), this.data.campText[id] || ''), '已发'); },
  programApply(e) { this.act(() => S.growth.programApply(e.currentTarget.dataset.id), '已报名'); }
});
