// 没有微信开发者工具：用 Node 顶替 wx 跑页面逻辑（真 api 在 :3000），再把 wxml 渲成 html 看效果。
// 用法：node mp-render.mjs <miniprogram目录> <页名> <输出html> [token json]
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const [MP, PAGE, OUT, LOGIN, TAPS, QUERY] = process.argv.slice(2); // TAPS：渲染前先点几下，JSON [[方法名, dataset], …]；QUERY：onLoad 的参数，JSON
const storage = new Map();
if (LOGIN) { const { user, token } = JSON.parse(LOGIN); storage.set('clife-academy-token', token); storage.set('clife-academy-user', user); }
const calls = [];
globalThis.wx = {
  getStorageSync: k => storage.has(k) ? storage.get(k) : '', setStorageSync: (k, v) => storage.set(k, JSON.parse(JSON.stringify(v))), removeStorageSync: k => storage.delete(k),
  showToast: o => calls.push(['toast', o.title]), showActionSheet: o => calls.push(['actionSheet', o.itemList]), showModal: o => calls.push(['modal', o.title, o.content]), navigateTo: o => calls.push(['navigateTo', o.url]), switchTab: o => calls.push(['switchTab', o.url]), setNavigationBarTitle() {}, login() {}, requestSubscribeMessage() {},
  request: ({ url, method, data, header, success, fail }) => fetch(url, { method, headers: header, body: data == null ? undefined : JSON.stringify(data) }).then(async r => success({ statusCode: r.status, data: await r.json().catch(() => null) })).catch(fail)
};
let pageDef = null; globalThis.Page = d => { pageDef = d; };
globalThis.getApp = () => ({ globalData: {} });
const require = createRequire(path.join(MP, 'pages', PAGE, 'x.js'));
require(path.join(MP, 'pages', PAGE, PAGE + '.js'));
const inst = Object.assign({}, pageDef, { data: Object.assign({}, pageDef.data || {}), setData(o) { for (const [k, v] of Object.entries(o)) { const ks = k.split('.'); let t = this.data; for (const p of ks.slice(0, -1)) t = t[p] = t[p] || {}; t[ks[ks.length - 1]] = v; } } });
if (inst.onLoad) await inst.onLoad(JSON.parse(QUERY || '{}')); if (inst.onShow) await inst.onShow();
await new Promise(r => setTimeout(r, 1500));
for (const [m, ds] of JSON.parse(TAPS || '[]')) { await inst[m]({ currentTarget: { dataset: ds || {} } }); }
// ---- 极简 wxml 渲染 ----
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const evalIn = (expr, scope) => { expr = expr.replace(/\u0001/g, '<').replace(/\u0002/g, '>'); try { return new Function('__s', 'with(__s){return (' + expr + ')}')(scope); } catch (e) { return '⟨' + expr + '⟩'; } };
const interp = (s, scope) => s.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => { const v = evalIn(e.trim(), scope); return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); });
const pure = (s, scope) => { const m = /^\s*\{\{([\s\S]*)\}\}\s*$/.exec(s); return m ? evalIn(m[1].trim(), scope) : s; };
function parse(src) { // → 节点树；{{ }} 里的 < > 先换成占位，免得被当标签
  src = src.replace(/\{\{[\s\S]*?\}\}/g, m => m.replace(/</g, '\u0001').replace(/>/g, '\u0002'));
  const root = { children: [] }, stack = [root]; const re = /<!--[\s\S]*?-->|<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[\w:.-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g; let m;
  while ((m = re.exec(src))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) { stack.pop(); continue; }
    if (m[2]) { const attrs = {}; m[3].replace(/([\w:.-]+)(?:="([^"]*)")?/g, (_, k, v) => { attrs[k] = v == null ? '' : v; }); const n = { tag: m[2], attrs, children: [] }; stack[stack.length - 1].children.push(n); if (!m[4] && !['image', 'input', 'img'].includes(m[2])) stack.push(n); continue; }
    if (m[5] && m[5].trim()) stack[stack.length - 1].children.push({ text: m[5] });
  }
  return root.children;
}
const TAG = { view: 'div', text: 'span', block: null, 'scroll-view': 'div', image: 'img', picker: 'div', button: 'button', input: 'input', topbar: 'div', navigator: 'a' };
function render(nodes, scope) {
  let out = '', skipElse = false;
  for (const n of nodes) {
    if (n.text) { out += esc(interp(n.text, scope)); continue; }
    const a = n.attrs;
    if ('wx:if' in a) { const ok = !!pure(a['wx:if'], scope); skipElse = ok; if (!ok) continue; }
    else if ('wx:elif' in a) { if (skipElse) continue; const ok = !!pure(a['wx:elif'], scope); skipElse = ok; if (!ok) continue; }
    else if ('wx:else' in a) { if (skipElse) continue; skipElse = true; }
    if ('wx:for' in a) { const list = pure(a['wx:for'], scope) || [], it = a['wx:for-item'] || 'item', ix = a['wx:for-index'] || 'index'; const arr = Array.isArray(list) ? list : Object.values(list); const a2 = { ...a }; delete a2['wx:for']; delete a2['wx:if']; delete a2['wx:elif']; delete a2['wx:else']; arr.forEach((v, i) => { out += render([{ ...n, attrs: a2 }], { ...scope, [it]: v, [ix]: i }); }); continue; }
    if (n.tag === 'topbar') { out += `<div class="top"><div class="brand"><div class="logo"></div><div><span class="name">幼师学坊</span><span class="sub">柳州 · 示例</span></div></div><div class="who">园长 ▾</div></div><div class="band"><span>${scope.__signedIn ? '已登录 · 进度随账号同步' : '未登录 · 园所、人员与数据均为示例'}</span><span class="reset">${scope.__signedIn ? '清本机草稿' : '重置演示进度'}</span></div>`; continue; }
    const tag = n.tag in TAG ? TAG[n.tag] : n.tag; const inner = render(n.children, scope);
    if (tag === null) { out += inner; continue; }
    const cls = a.class ? ' class="' + esc(interp(a.class, scope)) + '"' : '', sty = a.style ? ' style="' + esc(interp(a.style, scope)) + '"' : '';
    const extra = n.tag === 'scroll-view' ? ' data-scroll' : n.tag === 'image' ? ' src=""' : n.tag === 'input' ? ' placeholder="' + esc(a.placeholder || '') + '"' : '';
    out += tag === 'img' || tag === 'input' ? `<${tag}${cls}${sty}${extra}>` : `<${tag}${cls}${sty}${extra}>${inner}</${tag}>`;
  }
  return out;
}
const rpx = css => css.replace(/(-?[\d.]+)rpx/g, (_, n) => (n / 2) + 'px').replace(/^page\s*\{/m, 'body{margin:0;').replace(/\bpage\b(?=\s*\{)/g, 'body');
const wxss = [path.join(MP, 'app.wxss'), path.join(MP, 'pages', PAGE, PAGE + '.wxss'), path.join(MP, 'components/topbar/topbar.wxss')].filter(fs.existsSync).map(f => rpx(fs.readFileSync(f, 'utf8'))).join('\n');
const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8')); const tabs = appJson.tabBar.list;
const pageJson = JSON.parse(fs.readFileSync(path.join(MP, 'pages', PAGE, PAGE + '.json'), 'utf8'));
const scope = { ...inst.data, __signedIn: !!storage.get('clife-academy-token') };
const body = render(parse(fs.readFileSync(path.join(MP, 'pages', PAGE, PAGE + '.wxml'), 'utf8')), scope);
const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=375"><title>${pageJson.navigationBarTitleText || PAGE}</title><style>
${wxss}
body{width:375px;min-height:812px;box-sizing:border-box;padding-bottom:70px;position:relative}
.navbar{height:44px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:17px;background:#fff;border-bottom:1px solid #eee}
.tabbar{position:fixed;left:0;bottom:0;width:375px;height:56px;background:#fff;border-top:1px solid #ddd;display:flex}
.tabbar div{flex:1;display:flex;align-items:center;justify-content:center;font-size:12px;color:${appJson.tabBar.color}}
.tabbar div.on{color:${appJson.tabBar.selectedColor};font-weight:700}
.logo{width:28px;height:28px;border-radius:8px;background:#1f6b5c;margin-right:8px}
[data-scroll]{overflow-x:auto}
button{border:0;font-family:inherit}
</style></head><body><div class="navbar">${pageJson.navigationBarTitleText || ''}</div>${body}<div class="tabbar">${tabs.map(t => `<div class="${t.pagePath.endsWith('/' + PAGE) ? 'on' : ''}">${t.text}</div>`).join('')}</div></body></html>`;
// 行内 style 里的 rpx 也换成 px，不然浏览器当无效值丢掉（海报、流水行的间距都靠它）
fs.writeFileSync(OUT, html.replace(/style="([^"]*)"/g, (_, v) => `style="${rpx(v)}"`));
console.log('data keys:', Object.keys(inst.data).join(','), '\ncalls:', JSON.stringify(calls));
if (inst.onUnload) inst.onUnload(); process.exit(0); // 页面里的轮询计时器不让它挂住进程
