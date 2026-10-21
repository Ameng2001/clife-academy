/* 发展档案随人迁移（ROADMAP 第五节「发展档案」随人走、第十一节 E 期）。
 * 三件事：
 *   1. 迁移包：GET /api/me/portfolio/package 把本人档案打成一个带签名的 JSON（签名是本实例的 HMAC，发包时在 db.transfers 记一条 { id, uid, hash }）。
 *   2. 核验：GET /api/portfolio/verify?id=&hash= 公开，答这枚包是不是本实例发的、给谁的（姓名脱敏）。换城市时新实例拿它来核。
 *   3. 迁入：POST /api/me/portfolio/import 把别的实例（或本实例旧账号）发的包挂到当前账号名下，记进 db.imports；能联网核验就核，核不上记「未核验」。
 * 迁入的档案只是档案：在发展档案里单列一节「迁入的经历」，不并进进度、不发勋章、不算本实例的学时证明（那是按本实例学习记录出的）。
 * 同实例换园不用包：登录时 auth/routes.js 记 academy.history，档案「经历」一节直接读。
 *
 * db.transfers: { id, uid, hash, issuedAt }
 * db.imports:   { id, uid, issuer:{ url, name }, issuedAt, hash, person:{ name, orgName, role, districtName }, summary, paths, certificates, titles, badges, history, levels, verified:true|false|null, at } */
import crypto from 'node:crypto';

export const FORMAT = 'clife-academy-transfer/1';
export const MAX_BYTES = 2 * 1024 * 1024;
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
/** 签名与哈希都对「除 sig 外的字段、键按字母序」的 JSON 算，两边才对得上。 */
export const canonical = obj => JSON.stringify(sortKeys(obj));
function sortKeys(v) { if (Array.isArray(v)) return v.map(sortKeys); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])); return v; }
const mask = name => (name && name.length > 1 ? name[0] + '*'.repeat(name.length - 1) : name || '');

/** 包 → 存进 db.imports 的精简条目（不存全文，够档案里列出来就行）。导出便于测试。 */
export function trimPackage(pkg) {
  const pf = pkg.portfolio || {};
  return {
    person: { name: str(pkg.person?.name, 40), orgName: str(pkg.person?.orgName, 60) || null, role: str(pkg.person?.role, 20) || null, districtName: str(pkg.person?.districtName, 40) || null },
    summary: Object.fromEntries(Object.entries(pf.summary || {}).filter(([, v]) => Number.isFinite(v)).slice(0, 20).map(([k, v]) => [str(k, 30), v])),
    paths: (pf.paths || []).filter(x => x.done > 0).slice(0, 30).map(x => ({ name: str(x.name, 30), done: +x.done || 0, total: +x.total || 0, finishedAt: x.finishedAt || null })),
    certificates: (pf.certificates || []).slice(0, 30).map(c => ({ no: str(c.no, 30), label: str(c.label, 40), at: c.at || null })),
    titles: (pf.titles || []).slice(0, 30).map(t => ({ label: str(t.label, 30), at: t.at || null })),
    badges: (pf.badges || []).slice(0, 60).map(b => ({ name: str(b.name, 30), at: b.at || null })),
    cases: (pf.cases || []).filter(c => c.status === 'approved').slice(0, 60).map(c => ({ title: str(c.title, 60), at: c.at || null })),
    history: (pf.history || []).slice(0, 20).map(h => ({ orgName: str(h.orgName, 60), role: str(h.role, 20), from: h.from || null, to: h.to || null })),
    levels: (pf.levels || []).slice(0, 200).map(l => ({ id: str(l.id, 30), title: str(l.title, 60), at: l.passedAt || l.at || null }))
  };
}

export function transferRoutes({ json, readBody, db, saveDb, readSession, audit, portfolioOf, ORIGIN, RP_NAME, SECRET, fetchImpl = globalThis.fetch }) {
  db.transfers = db.transfers || []; db.imports = db.imports || [];
  const now = () => Date.now();
  const sign = body => crypto.createHmac('sha256', SECRET).update(canonical(body)).digest('base64url');
  const pub = i => ({ id: i.id, issuer: i.issuer, issuedAt: i.issuedAt, person: i.person, summary: i.summary, paths: i.paths, certificates: i.certificates, titles: i.titles, badges: i.badges, cases: i.cases, history: i.history, levels: i.levels.length, verified: i.verified, at: i.at });

  /** 本实例发的包：id 在册、hash 对得上、签名对得上。 */
  const verifyLocal = (id, hash, pkg) => {
    const t = db.transfers.find(x => x.id === id);
    if (!t || t.hash !== hash) return false;
    if (pkg) { const { sig, ...body } = pkg; try { if (!crypto.timingSafeEqual(Buffer.from(sign(body)), Buffer.from(String(sig || '')))) return false; } catch { return false; } }
    return true;
  };

  return {
  // 迁移包：带签名的整份档案，文件下载。
  'GET /api/me/portfolio/package': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const portfolio = portfolioOf(user);
    const body = { format: FORMAT, id: crypto.randomBytes(9).toString('base64url'), issuer: { url: ORIGIN, name: RP_NAME }, issuedAt: now(),
      person: portfolio.person, portfolio: { ...portfolio, imports: undefined } };
    const pkg = { ...body, sig: sign(body) };
    db.transfers.push({ id: body.id, uid: user.id, hash: sha256(canonical(body)), issuedAt: body.issuedAt }); saveDb();
    audit(req, 'portfolio.package', { user, msg: body.id });
    json(res, 200, pkg, { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`迁移包-${user.name}-${new Date().toISOString().slice(0, 10)}.json`)}` });
  },
  // 核验（公开）：{ valid, name(脱敏), issuedAt, issuer }
  'GET /api/portfolio/verify': async (req, res) => {
    const sp = new URL(req.url, 'http://x').searchParams;
    const id = str(sp.get('id'), 40), hash = str(sp.get('hash'), 64);
    const t = db.transfers.find(x => x.id === id);
    if (!t || !verifyLocal(id, hash)) return json(res, 404, { valid: false });
    const u = db.users.find(x => x.id === t.uid);
    json(res, 200, { valid: true, id, name: mask(u?.name), issuedAt: t.issuedAt, issuer: { url: ORIGIN, name: RP_NAME } });
  },
  // 迁入：{ package }
  'POST /api/me/portfolio/import': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const pkg = body.package;
    if (!pkg || typeof pkg !== 'object' || pkg.format !== FORMAT) return json(res, 400, { error: 'not a transfer package', code: 'format' });
    if (!str(pkg.id, 40) || !pkg.issuer?.url || !Number.isFinite(+pkg.issuedAt) || !pkg.person?.name || !pkg.portfolio) return json(res, 400, { error: 'package incomplete', code: 'shape' });
    const { sig, ...rest } = pkg;
    const text = canonical(rest);
    if (text.length > MAX_BYTES) return json(res, 413, { error: 'package too large', code: 'size' });
    const hash = sha256(text), issuerUrl = String(pkg.issuer.url).replace(/\/+$/, '');
    if (db.imports.some(i => i.uid === user.id && i.issuer.url === issuerUrl && i.id === pkg.id)) return json(res, 409, { error: 'already imported', code: 'dup' });
    let verified = null;
    if (issuerUrl === ORIGIN.replace(/\/+$/, '')) verified = verifyLocal(pkg.id, hash, pkg);
    else if (/^https?:\/\//.test(issuerUrl)) {
      try { const r = await fetchImpl(`${issuerUrl}/api/portfolio/verify?id=${encodeURIComponent(pkg.id)}&hash=${hash}`, { signal: AbortSignal.timeout(5000) }); verified = r.status === 200 ? !!(await r.json())?.valid : r.status === 404 ? false : null; }
      catch { verified = null; }
    }
    const item = { id: str(pkg.id, 40), uid: user.id, issuer: { url: issuerUrl, name: str(pkg.issuer.name, 40) || issuerUrl }, issuedAt: +pkg.issuedAt, hash, ...trimPackage(pkg), verified, at: now() };
    db.imports.push(item); saveDb(); audit(req, 'portfolio.import', { user, msg: `${item.issuer.name} ${verified === true ? 'verified' : verified === false ? 'INVALID' : 'unverified'}` });
    json(res, 200, { item: pub(item) });
  },
  'GET /api/me/portfolio/imports': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { imports: db.imports.filter(i => i.uid === user.id).sort((a, b) => b.at - a.at).map(pub), history: user.academy?.history || [] });
  },
  'POST /api/me/portfolio/imports/remove': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const i = db.imports.findIndex(x => x.uid === user.id && x.id === str(body.id, 40));
    if (i < 0) return json(res, 404, { error: 'no such import' });
    db.imports.splice(i, 1); saveDb(); audit(req, 'portfolio.import.remove', { user, msg: body.id });
    json(res, 200, { ok: true });
  }
  };
}
