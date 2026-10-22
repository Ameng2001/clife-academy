// 资料库：服务端资源库（内置教育部文件 + 本园与公开的上传）；连不上服务端时回落到演示资料（D.FILES）。
const S = require('../../utils/store.js');
const D = S.D;
const { API_BASE } = require('../../utils/config.js');
const KINDS = [['', '全部'], ['policy', '文献与政策'], ['template', '模板与工具'], ['case', '专家案例'], ['work', '课程成果']];
const DOMAIN_NAME = {}; S.capability.DOMAINS.forEach(d => { DOMAIN_NAME[d.key] = d.name; });
Page({
  data: { kind: '', kinds: KINDS.map(k => ({ v: k[0], t: k[1] })), q: '', items: [], demo: false, role: '全部', roles: ['全部', '园长', '保健医', '班级教师', '保育员', '信息接口人'] },
  onLoad(o) { if (o && o.kind) this.setData({ kind: o.kind }); },
  onShow() { this.reload(); },
  async reload() {
    if (this.data.kind === 'case') return this.reloadCases();
    if (this.data.kind === 'work') return this.reloadWorks();
    try {
      const r = await S.resources.list({ q: this.data.q, kind: this.data.kind });
      const items = r.resources.map(x => ({ id: x.id, title: x.title, desc: x.desc || '', meta: [r.kinds[x.kind], x.domain ? DOMAIN_NAME[x.domain] : '', x.seed ? (x.source || '') + (x.year ? ' ' + x.year : '') : (x.byName || '')].filter(Boolean).join(' · '), url: x.url, file: x.file ? x.file.name : '', ext: x.seed ? '文' : x.file ? (x.file.type && x.file.type.indexOf('video') === 0 ? '视' : '图') : '链' }));
      this.setData({ items, demo: false, canAdd: !!r.canAdd });
    } catch (e) {
      this.setData({ demo: true, files: D.FILES.filter(f => this.data.role === '全部' || f[2] === this.data.role) });
    }
  },
  // 专家案例：要登录；每条带「可直接用 / 需改编 / 只看思路」
  async reloadCases() {
    if (!S.auth.signedIn()) { this.setData({ items: [], demo: false, caseHint: '专家案例实名共享，登录后可见。' }); return; }
    try {
      const r = await S.resources.cases({ q: this.data.q });
      const items = r.cases.map(x => ({ id: x.id, title: x.title, desc: x.text, meta: [DOMAIN_NAME[x.domain] || '', x.age || '', r.uses[x.use] || '', x.byName + (x.orgName ? ' · ' + x.orgName : '')].filter(Boolean).join(' · '), ext: '例', isCase: true, open: false }));
      this.setData({ items, demo: false, caseHint: items.length ? '' : '还没有入库的案例。' });
    } catch (e) { this.setData({ items: [], demo: false, caseHint: '没取到案例。' }); }
  },
  // 课程成果：要登录；点开看简介、改了什么、文件名；工坊地址可复制到浏览器打开
  async reloadWorks() {
    if (!S.auth.signedIn()) { this.setData({ items: [], demo: false, caseHint: '课程成果实名共享，登录后可见。' }); return; }
    try {
      const r = await S.resources.works({ q: this.data.q });
      const items = r.works.map(x => ({ id: x.id, title: x.title, isCase: true, open: false, ext: '课', link: x.source && x.source.url || '',
        meta: [x.pipelineName, x.age || '', x.weeks ? x.weeks + ' 周' : '', (x.domainNames || []).join('、'), x.byName + (x.orgName ? ' · ' + x.orgName : '')].filter(Boolean).join(' · '),
        desc: x.summary + '\n\n在起草稿上改了什么：\n' + x.changes.map(c => '· ' + c).join('\n') + (x.files.length ? '\n\n文件（网页端下载）：' + x.files.map(f => f.name).join('、') : '') }));
      this.setData({ items, demo: false, caseHint: items.length ? '' : '还没有入库的课程成果。在教研工坊做过、班里用过的课，去网页端「课程成果」分享。' });
    } catch (e) { this.setData({ items: [], demo: false, caseHint: '没取到课程成果。' }); }
  },
  copyLink(e) { const u = e.currentTarget.dataset.u; if (u) wx.setClipboardData({ data: u, success: () => wx.showToast({ title: '工坊地址已复制，到浏览器打开', icon: 'none' }) }); },
  toggle(e) { const i = +e.currentTarget.dataset.i; const items = this.data.items; if (!items[i] || !items[i].isCase) return; items[i].open = !items[i].open; this.setData({ items }); },
  setKind(e) { this.setData({ kind: e.currentTarget.dataset.v }); this.reload(); },
  qInput(e) { this.setData({ q: e.detail.value }); clearTimeout(this.qt); this.qt = setTimeout(() => this.reload(), 300); },
  open(e) {
    const it = this.data.items[+e.currentTarget.dataset.i];
    if (it.isCase) return this.toggle(e);
    if (it.url) { wx.setClipboardData({ data: it.url, success: () => wx.showToast({ title: '链接已复制，请在浏览器打开', icon: 'none' }) }); return; }
    if (it.file) { wx.previewImage({ urls: [API_BASE + '/api/resources/file?id=' + it.id], fail: () => wx.showToast({ title: '文件请在网页端打开', icon: 'none' }) }); }
  },
  setRole(e) { this.setData({ role: e.currentTarget.dataset.v }); this.reload(); },
  file(e) { wx.showToast({ title: '原型：「' + e.currentTarget.dataset.n + '」预览', icon: 'none' }); }
});
