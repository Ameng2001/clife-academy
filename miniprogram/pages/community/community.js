// 教研共同体（tab 页）：幼师学坊的 UGC 一面，和网页端 /community 同一形态——顶部 tab、一张「本期」大卡、「动动手」入口、带封面的作品卡网格。
// 收专家案例、课程成果、合集。封面不用图（案例图要带登录态取，小程序 image 带不了 Bearer），按类型底色加标签。
// 红线：不显示人数、不点赞、不排行；没有「关注」，换成本园 / 本共同体。分享动作在网页端。
const S = require('../../utils/store.js');
const TABS = [['new', '最新'], ['org', '本园'], ['community', '本共同体'], ['collections', '合集']];
const TYPE_NAME = { case: '专家案例', work: '课程成果', collection: '合集' };
const FIVE_TO_SEVEN = { lang: 'plan', social: 'comm', health: 'life', art: 'env', sci: 'play' };
const DOMAIN_NAME = {}; S.capability.DOMAINS.forEach(d => { DOMAIN_NAME[d.key] = d.name; });
const at = x => (x.curated && x.curated.at) || x.at || x.updatedAt || 0;
Page({
  data: { signedIn: false, all: [], cols: [], tab: 'new', tabs: TABS.map(t => ({ k: t[0], t: t[1] })), domain: '', domains: S.capability.DOMAINS.map(d => ({ k: d.key, t: d.name })), community: null, orgName: '', featured: null, cards: [], hint: '', q: '' },
  onLoad(o) { if (o && o.tab) this.setData({ tab: o.tab }); },
  onShow() { this.reload(); },
  async reload() {
    const signedIn = S.auth.signedIn();
    this.setData({ signedIn });
    if (!signedIn) { this.setData({ all: [], cols: [], community: null, featured: null, cards: [], hint: '专家案例与课程成果实名共享，登录后可见。' }); return; }
    const me = S.auth.current(), orgName = me && me.academy && me.academy.org ? me.academy.org.name : '';
    const [cm, c, w, col, lec] = await Promise.all([
      S.district.myCommunity().catch(() => ({ community: null })), S.resources.cases({}).catch(() => ({ cases: [], uses: {} })), S.resources.works({}).catch(() => ({ works: [] })),
      S.resources.collections().catch(() => ({ collections: [] })), S.lectures.list().catch(() => ({ upcoming: [], done: [] }))]);
    const community = cm.community ? { name: cm.community.name, orgs: cm.community.orgs.map(o => o.name) } : null;
    const all = c.cases.map(x => ({ type: 'case', id: 'c' + x.id, kind: 'case', title: x.title, by: x.byName, org: x.orgName || '', at: at(x), label: (DOMAIN_NAME[x.domain] || '') + (x.age ? ' · ' + x.age : ''), sub: c.uses[x.use] || '', domains: [x.domain], text: x.text, showcase: !!x.showcase }))
      .concat(w.works.map(x => ({ type: 'work', id: 'w' + x.id, kind: 'work', title: x.title, by: x.byName, org: x.orgName || '', at: at(x), label: x.pipelineName + (x.age ? ' · ' + x.age : '') + (x.weeks ? ' · ' + x.weeks + ' 周' : ''), sub: (x.domainNames || []).join('、'), domains: (x.domains || []).map(d => FIVE_TO_SEVEN[d]).filter(Boolean), text: x.summary })))
      .sort((a, b) => b.at - a.at).map(x => Object.assign(x, { typeName: TYPE_NAME[x.type], when: S.fmtDay(x.at) }));
    const cols = col.collections.map(x => ({ type: 'collection', typeName: '合集', id: 'k' + x.id, title: x.title, by: x.byName, org: x.where || '', at: x.updatedAt, when: S.fmtDay(x.updatedAt), label: x.scopeName + ' · ' + x.total + ' 条', sub: x.desc || '', domains: [], text: x.desc || '' }));
    const sc = all.find(x => x.showcase), lx = lec.upcoming[0] || lec.done[0];
    const featured = sc ? { kind: 'case', label: '市级展示 · ' + sc.label, over: '市级展示 · 名师点评过的案例', title: sc.title, text: sc.text, foot: sc.by + (sc.org ? ' · ' + sc.org : ''), go: '看 →' }
      : lx ? { kind: 'lecture', id: lx.id, label: '名师讲堂 · ' + (lx.phase === 'done' ? '可回看' : S.fmtDay(lx.at)), over: '名师讲堂 · 每月一场 · 一场留给课程成果', title: lx.title, text: lx.desc || '', foot: lx.speaker || '', go: lx.phase === 'done' ? '回看 →' : '预约 →' } : null;
    this.setData({ all, cols, community, orgName, featured });
    this.apply();
  },
  apply() {
    const d = this.data, kw = (d.q || '').trim().toLowerCase();
    let list = d.tab === 'collections' ? d.cols : d.all;
    if (d.tab === 'org') list = list.filter(x => d.orgName && x.org === d.orgName);
    if (d.tab === 'community') list = list.filter(x => d.community && d.community.orgs.indexOf(x.org) >= 0);
    if (d.domain && d.tab !== 'collections') list = list.filter(x => x.domains.indexOf(d.domain) >= 0);
    if (kw) list = list.filter(x => [x.title, x.by, x.org, x.label, x.sub, x.text].join(' ').toLowerCase().indexOf(kw) >= 0);
    this.setData({ cards: list, hint: list.length ? '' : d.tab === 'collections' ? '还没有合集。' : d.tab === 'org' ? '本园还没有入库的作品。' : '还没有匹配的作品。园里做过的事、工坊里做过的课，去网页端分享。' });
  },
  setTab(e) { this.setData({ tab: e.currentTarget.dataset.k }); this.apply(); },
  setDomain(e) { const k = e.currentTarget.dataset.k; this.setData({ domain: k === this.data.domain ? '' : k }); this.apply(); },
  qInput(e) { this.setData({ q: e.detail.value }); this.apply(); },
  open(e) {
    const x = this.data.cards[+e.currentTarget.dataset.i];
    if (x.type === 'collection') { wx.showToast({ title: '合集里的内容在网页端看', icon: 'none' }); return; }
    wx.navigateTo({ url: '/pages/library/library?kind=' + x.type });
  },
  openFeatured() { const f = this.data.featured; if (!f) return; wx.navigateTo({ url: f.kind === 'lecture' ? '/pages/live/live' : '/pages/library/library?kind=case' }); },
  goKind(e) { wx.navigateTo({ url: '/pages/library/library?kind=' + e.currentTarget.dataset.k }); },
  goStudio() { wx.navigateTo({ url: '/pages/studio/studio' }); },
  goCollections() { this.setData({ tab: 'collections' }); this.apply(); },
  login() { wx.switchTab({ url: '/pages/me/me' }); }
});
