/* 资源库（docs/ROADMAP.md 第四节）：文献与政策、模板与工具。案例库另做（要审核）。
 *
 * db.resources: { id, kind, title, domain, desc, url | file:{hash,name,type,size}, scope:'public'|'org', org, by, byName, at, updatedAt }
 * 内置条目在 resources-seed.js（教育部文件原文），只读。
 * 谁能加：管理员、园长、academy.reviewer（种子教师 / 教研主任）；谁能改删：加的人本人、本园园长、管理员。
 * 可见：public 的谁都能看（含没登录，资源本身不是秘密）；org 的只给同园。
 * 文件走上游 media 存储（PUT /api/media/{hash}，存在上传者名下），只收图片与短视频；文档类资源贴链接（飞书、网盘）。 */
import crypto from 'node:crypto';
import { orgKeyOf } from './org.js';
import { SEED, KINDS } from './resources-seed.js';

const DOMAINS = ['env', 'life', 'play', 'plan', 'obs', 'comm', 'reflect'];
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const HASH = /^[0-9a-f]{64}$/;
const URL_OK = /^https?:\/\/\S+$/i;
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');

export const canAdd = (u, isAdmin) => !!u && (u.academy?.role === 'director' || u.academy?.reviewer === true || isAdmin(u));

export function resourceRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, MEDIA, sendMediaFile }) {
  db.resources = db.resources || [];
  const pub = (r, user) => ({
    id: r.id, kind: r.kind, title: r.title, domain: r.domain, desc: r.desc, url: r.url || null, file: r.file ? { name: r.file.name, type: r.file.type, size: r.file.size } : null,
    scope: r.scope, at: r.at, byName: r.byName || null, source: r.source || null, year: r.year || null, seed: r.id.startsWith('seed:'),
    mine: !!user && r.by === user.id, canEdit: !!user && !r.id.startsWith('seed:') && (r.by === user.id || isAdmin(user) || (user.academy?.role === 'director' && r.org && r.org === orgKeyOf(user)))
  });
  const visible = user => {
    const org = user ? orgKeyOf(user) : null;
    return [...SEED, ...db.resources.filter(r => r.scope === 'public' || (org && r.org === org))];
  };
  const findMine = id => db.resources.find(r => r.id === id);
  const mayEdit = (user, r) => r.by === user.id || isAdmin(user) || (user.academy?.role === 'director' && r.org && r.org === orgKeyOf(user));

  return {
  // ?q=&kind=&domain=  没登录也能看 public 的
  'GET /api/resources': async (req, res) => {
    const user = readSession(req);
    const sp = new URL(req.url, 'http://x').searchParams;
    const q = norm(sp.get('q')), kind = sp.get('kind') || '', domain = sp.get('domain') || '';
    let list = visible(user);
    if (kind && KINDS[kind]) list = list.filter(r => r.kind === kind);
    if (domain) list = list.filter(r => r.domain === domain);
    if (q) list = list.filter(r => norm([r.title, r.desc, r.source, ...(r.match || [])].join(' ')).includes(q));
    list.sort((a, b) => (a.id.startsWith('seed:') ? 0 : 1) - (b.id.startsWith('seed:') ? 0 : 1) || (b.at || 0) - (a.at || 0));
    json(res, 200, { resources: list.map(r => pub(r, user)), kinds: KINDS, canAdd: canAdd(user, isAdmin) });
  },
  // 加或改：{ id?, kind, title, domain?, desc?, url? | file?{hash,name,type,size}, scope }
  'POST /api/resources': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let r = id ? findMine(id) : null;
    if (id && !r) return json(res, 404, { error: 'no such resource' });
    if (r ? !mayEdit(user, r) : !canAdd(user, isAdmin)) return json(res, 403, { error: 'not allowed', code: 'editor' });
    const title = str(body.title, 120);
    if (!title) return json(res, 400, { error: 'title required', code: 'title' });
    const kind = KINDS[body.kind] ? body.kind : 'other';
    const domain = DOMAINS.includes(body.domain) ? body.domain : null;
    const url = str(body.url, 1000);
    if (url && !URL_OK.test(url)) return json(res, 400, { error: 'url must start with http(s)://', code: 'url' });
    let file = null;
    if (body.file && HASH.test(String(body.file.hash || ''))) {
      // 文件要在上传者名下已存在（r 的上传者或当前用户）
      const owner = r?.file?.hash === body.file.hash ? r.by : user.id;
      if (!MEDIA.file(owner, body.file.hash)) return json(res, 400, { error: 'upload the file first', code: 'file' });
      file = { hash: body.file.hash, name: str(body.file.name, 120), type: str(body.file.type, 60), size: Number(body.file.size) || 0, owner };
    }
    if (!url && !file) return json(res, 400, { error: 'a link or a file is required', code: 'empty' });
    const scope = body.scope === 'public' && (isAdmin(user) || user.academy?.role === 'director') ? 'public' : (body.scope === 'public' ? 'org' : (body.scope === 'org' ? 'org' : 'org'));
    const now = Date.now();
    if (r) { Object.assign(r, { kind, title, domain, desc: str(body.desc, 1000), url: url || null, file, scope, updatedAt: now }); }
    else {
      const org = orgKeyOf(user);
      if (!org && scope === 'org') return json(res, 400, { error: 'your account has no kindergarten; share publicly instead', code: 'org' });
      r = { id: crypto.randomBytes(9).toString('base64url'), kind, title, domain, desc: str(body.desc, 1000), url: url || null, file, scope, org, by: user.id, byName: user.name, at: now, updatedAt: now };
      db.resources.push(r);
    }
    saveDb();
    audit(req, id ? 'resource.edit' : 'resource.new', { user, msg: r.id });
    json(res, 200, { resource: pub(r, user) });
  },
  'POST /api/resources/delete': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const r = findMine(str(body.id, 40));
    if (!r) return json(res, 404, { error: 'no such resource' });
    if (!mayEdit(user, r)) return json(res, 403, { error: 'not allowed', code: 'editor' });
    db.resources = db.resources.filter(x => x.id !== r.id); saveDb();
    audit(req, 'resource.delete', { user, msg: r.id });
    json(res, 200, { ok: true });
  },
  // 资源文件：能看到这条资源的人都能读
  'GET /api/resources/file': async (req, res) => {
    const user = readSession(req);
    const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
    const r = visible(user).find(x => x.id === id);
    if (!r || !r.file) return json(res, 404, { error: 'not found' });
    const f = MEDIA.file(r.file.owner, r.file.hash);
    if (!f) return json(res, 404, { error: 'media-missing' });
    await sendMediaFile(res, f, r.file.hash);
  }
  };
}
