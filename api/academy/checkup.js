/* 探针体检卡（docs/ROADMAP.md 第八节「园长：园所体检卡（工具线 12 探针）」；迁移方案 checkup）。
 *
 * 12 项探针是园级运行指标，只看园所对平台的使用情况：不出现任何幼儿数据，不做园所排名，不作教师考核依据。
 * 11 项由平台每周回传（契约 docs/PLATFORM-EVENTS.md 第 7 节），「学习」一项由大课堂自己算（各岗位路径是否都开学）。
 * 每周一出卡：状态 ok / warn / idle 由这里的阈值定，文字也由这里生成，平台只给数。
 * 同一项连续两周需关注 → 向对应岗位推送关卡（首页提示，不发订阅消息、不催）。
 * 新上线园所前两周只开账号覆盖、基础数据、设备在线三项。
 *
 * db.checkups: { org, week('YYYY-MM-DD' 周一), probes:{ key: number }, at, by:'platform'|uid }  一园一周一条，后到的覆盖。
 * db.checkupOrgs: { org, firstAt }  首次回传时间，用来判「新上线」。 */
import crypto from 'node:crypto';
import { orgKeyOf, summarize } from './org.js';
import { LEVELS, ROLE_PATH, PATH_NAMES } from './events-data.js';

const KEY = process.env.PLATFORM_EVENTS_KEY || '';
const WEEK = 7 * 24 * 3600000;
const pct = v => Math.round(v * 100) + '%';
const findLevel = kw => Object.keys(LEVELS).find(id => LEVELS[id].includes(kw)) || null;
/** 探针定义：key、名字、平台给什么数、阈值、文字、推送哪一关。导出给文档与测试。 */
export const PROBES = Object.freeze([
  { key: 'disease', name: '疾病管理', input: '未填写康复结论的疾病记录条数', status: v => (v > 0 ? 'warn' : 'ok'), text: v => (v > 0 ? `${v} 条疾病记录未填写康复结论` : '疾病记录都有康复结论'), go: findLevel('疾病到复课') },
  { key: 'tickets', name: '工单', input: '本周同一主题的咨询次数（取最多的一个主题）', status: v => (v >= 3 ? 'warn' : 'ok'), text: v => (v >= 3 ? `本周同一问题咨询 ${v} 次` : '本周没有重复咨询'), go: findLevel('出勤调整') },
  { key: 'devices', name: '设备在线', input: '连续离线 ≥ 2 天的设备台数', status: v => (v > 0 ? 'warn' : 'ok'), text: v => (v > 0 ? `${v} 台设备连续离线 2 天以上` : '设备都在线'), go: findLevel('设备在线检查'), local: true },
  { key: 'fitness', name: '体能', input: '本学期完成国体测评的班级比例', status: v => (v <= 0 ? 'idle' : v < 1 ? 'warn' : 'ok'), text: v => (v <= 0 ? '本学期尚未完成国体测评' : v < 1 ? `国体测评完成 ${pct(v)} 的班级` : '本学期国体测评已完成'), go: findLevel('国体测评') },
  { key: 'morning', name: '晨午检', input: '本周有晨午检记录的在园日比例', status: v => (v <= 0 ? 'idle' : v < 1 ? 'warn' : 'ok'), text: v => (v >= 1 ? '本周在园日全部有记录' : v <= 0 ? '本周没有晨午检记录' : `本周 ${pct(v)} 的在园日有记录`), go: findLevel('晨检') },
  { key: 'meals', name: '膳食', input: '下周带量食谱是否已发布（1/0）', status: v => (v >= 1 ? 'ok' : 'warn'), text: v => (v >= 1 ? '下周带量食谱已发布' : '下周带量食谱还没发布'), go: findLevel('带量食谱') },
  { key: 'accounts', name: '账号覆盖', input: '已开通 / 应开通岗位账号的比例', status: v => (v <= 0 ? 'idle' : v < 1 ? 'warn' : 'ok'), text: v => (v >= 1 ? '岗位账号全部开通' : v <= 0 ? '岗位账号还没开通' : `岗位账号开通 ${pct(v)}`), go: findLevel('三端登录'), early: true },
  { key: 'basics', name: '基础数据', input: '健康档案字段完整度（比例）', status: v => (v <= 0 ? 'idle' : v < 0.9 ? 'warn' : 'ok'), text: v => (v <= 0 ? '基础数据还没录入' : `健康档案字段完整度 ${pct(v)}`), go: findLevel('班级与幼儿信息'), early: true },
  { key: 'attendance', name: '出勤与请假', input: '出勤当日确认率', status: v => (v <= 0 ? 'idle' : v < 0.95 ? 'warn' : 'ok'), text: v => (v <= 0 ? '出勤还没开始确认' : `出勤当日确认率 ${pct(v)}`), go: findLevel('请假登记') },
  { key: 'sleep', name: '睡眠', input: '本周睡眠垫有数据回传的在园日比例', status: v => (v <= 0 ? 'idle' : v < 1 ? 'warn' : 'ok'), text: v => (v >= 1 ? '睡眠垫本周每天都有数据回传' : v <= 0 ? '睡眠垫本周没有数据' : `睡眠垫本周 ${pct(v)} 的在园日有数据`), go: findLevel('睡眠数据') },
  { key: 'research', name: '教研', input: '本月课案篇数', status: v => (v <= 0 ? 'idle' : v < 5 ? 'warn' : 'ok'), text: v => (v <= 0 ? '本月还没有课案' : `本月课案 ${v} 篇`), go: findLevel('教研工坊 · 共创') },
  { key: 'learning', name: '学习', input: '（大课堂自己算）各岗位路径是否都开学', status: v => (v <= 0 ? 'idle' : v < 1 ? 'warn' : 'ok'), text: v => (v >= 1 ? '各岗位路径均已开学' : v <= 0 ? '还没有人开始学' : `${pct(v)} 的岗位已开学`), go: null, computed: true }
]);
export const PROBE_KEYS = PROBES.filter(p => !p.computed).map(p => p.key);
const EARLY_DAYS = 14;
/** 这一周的周一（本地时间）'YYYY-MM-DD'。 */
export function weekOf(ts = Date.now()) { const d = new Date(ts); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const weekTs = w => new Date(w + 'T00:00:00').getTime();
const platformKeyOk = req => { if (!KEY) return false; const h = req.headers.authorization || ''; if (!h.startsWith('Bearer ')) return false; const g = Buffer.from(h.slice(7).trim()), w = Buffer.from(KEY); return g.length === w.length && crypto.timingSafeEqual(g, w); };

/** 纯函数：一园近几周的回传 + 学习指标 → 体检卡。导出便于测试。 */
export function buildCard(rows, { learning, firstAt, now = Date.now(), weeks = 4 } = {}) {
  const thisWeek = weekOf(now);
  const keys = []; for (let i = weeks - 1; i >= 0; i--) keys.push(weekOf(weekTs(thisWeek) - i * WEEK));
  const byWeek = Object.fromEntries(rows.map(r => [r.week, r]));
  const limited = !!firstAt && now - firstAt < EARLY_DAYS * 86400000;
  const probes = PROBES.filter(p => !limited || p.early).map(p => {
    const series = keys.map(w => { if (p.computed) return w === thisWeek ? (learning == null ? 'idle' : p.status(learning)) : (byWeek[w]?.probes?.learning != null ? p.status(byWeek[w].probes.learning) : 'idle'); const v = byWeek[w]?.probes?.[p.key]; return v == null ? 'idle' : p.status(Number(v)); });
    const cur = p.computed ? learning : byWeek[thisWeek]?.probes?.[p.key] ?? byWeek[keys[keys.length - 2]]?.probes?.[p.key];
    const has = cur != null;
    const status = has ? p.status(Number(cur)) : 'idle';
    const consecutive = status === 'warn' && series[series.length - 2] === 'warn';
    return { key: p.key, name: p.name, status, text: has ? p.text(Number(cur)) : '还没回传', value: has ? Number(cur) : null, weeks: series, consecutive,
      go: p.local ? { local: true } : (p.go ? { levelId: p.go, title: LEVELS[p.go], role: Object.keys(ROLE_PATH).find(r => ROLE_PATH[r] === p.go.split(/-(?=\d+$)/)[0]) || null } : null),
      act: p.local ? '去报修' : (p.go ? `推荐${PATH_NAMES[p.go.split(/-(?=\d+$)/)[0]] || ''}第 ${Number(p.go.split(/-(?=\d+$)/)[1]) + 1} 关` : null) };
  });
  const sum = { ok: 0, warn: 0, idle: 0 }; probes.forEach(p => sum[p.status]++);
  const latest = rows.slice().sort((a, b) => b.at - a.at)[0] || null;
  const recommendations = probes.filter(p => p.consecutive && p.go?.levelId).map(p => ({ role: p.go.role, levelId: p.go.levelId, title: p.go.title, probe: p.name, why: `「${p.name}」连续两周需关注：${p.text}` }));
  return { week: thisWeek, weeks: keys, generatedAt: latest?.at || null, limited, firstAt: firstAt || null, sum, probes, recommendations, total: PROBES.length };
}

export function checkupRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, readStateCached }) {
  db.checkups = db.checkups || []; db.checkupOrgs = db.checkupOrgs || [];
  const orgKeyFrom = o => (o && typeof o === 'object' ? (o.id ? 'id:' + String(o.id).trim() : o.name ? 'name:' + String(o.name).trim() : null) : null);
  const learningOf = org => { const members = db.users.filter(u => !u.disabled && orgKeyOf(u) === org); if (!members.length) return null; const s = summarize(members, uid => readStateCached(uid)); const groups = s.roles.filter(r => r.members > 0); if (!groups.length) return 0; return groups.filter(r => r.started + r.finished > 0).length / groups.length; };
  const cardOf = org => buildCard(db.checkups.filter(r => r.org === org), { learning: learningOf(org), firstAt: db.checkupOrgs.find(o => o.org === org)?.firstAt || null });

  return {
  // 平台（PLATFORM_EVENTS_KEY）或管理员回传：{ org:{id?|name}, week?, probes:{ key: number, ... } }；批量 { cards:[ … ] }（≤ 50）
  'POST /api/checkup': async (req, res) => {
    const user = platformKeyOk(req) ? null : readSession(req);
    if (!platformKeyOk(req) && !(user && isAdmin(user))) return json(res, 403, { error: 'platform key or admin', code: 'auth' });
    const body = await readBody(req);
    const cards = Array.isArray(body.cards) ? body.cards : [body];
    if (!cards.length || cards.length > 50) return json(res, 400, { error: 'batch must be 1–50', code: 'batch' });
    const rejected = []; let accepted = 0;
    cards.forEach((c, i) => {
      const org = orgKeyFrom(c.org);
      if (!org) return rejected.push({ i, code: 'no-org' });
      const week = /^\d{4}-\d{2}-\d{2}$/.test(c.week || '') ? weekOf(weekTs(c.week)) : weekOf();
      const probes = {}; let n = 0;
      for (const k of PROBE_KEYS) { const v = c.probes?.[k]; if (v == null) continue; const num = Number(v); if (!Number.isFinite(num) || num < 0) return rejected.push({ i, code: 'bad-value', key: k }); probes[k] = num; n++; }
      if (!n) return rejected.push({ i, code: 'no-probes' });
      const unknown = Object.keys(c.probes || {}).filter(k => !PROBE_KEYS.includes(k));
      let row = db.checkups.find(r => r.org === org && r.week === week);
      if (row) { Object.assign(row.probes, probes); row.at = Date.now(); row.by = user ? user.id : 'platform'; }
      else { db.checkups.push({ org, week, probes, at: Date.now(), by: user ? user.id : 'platform' }); }
      if (!db.checkupOrgs.some(o => o.org === org)) db.checkupOrgs.push({ org, firstAt: Date.now() });
      // 一园只留 26 周
      const mine = db.checkups.filter(r => r.org === org).sort((a, b) => a.week.localeCompare(b.week));
      if (mine.length > 26) { const drop = new Set(mine.slice(0, mine.length - 26)); db.checkups = db.checkups.filter(r => !drop.has(r)); }
      accepted++;
      if (unknown.length) rejected.push({ i, code: 'unknown-probe', keys: unknown, accepted: true });
    });
    saveDb();
    audit(req, 'checkup.push', { user: user || undefined, msg: `${accepted}/${cards.length}` });
    json(res, 200, { accepted, rejected });
  },
  // 园长或管理员看本园体检卡（管理员可 ?org=id:xxx）
  'GET /api/org/checkup': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (user.academy?.role !== 'director' && !isAdmin(user)) return json(res, 403, { error: 'directors only', code: 'director' });
    const q = new URL(req.url, 'http://x').searchParams.get('org');
    const org = (isAdmin(user) && q) || orgKeyOf(user);
    if (!org) return json(res, 200, { org: null, card: null, pushed: !!KEY });
    json(res, 200, { org, orgName: user.academy?.org?.name || null, card: cardOf(org), pushed: !!KEY });
  },
  // 本园体检推给我这个岗位的关卡（任何成员）
  'GET /api/me/checkup': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const org = orgKeyOf(user);
    if (!org) return json(res, 200, { recommendations: [], week: weekOf() });
    const card = cardOf(org);
    const role = user.academy?.role || 'teacher';
    json(res, 200, { week: card.week, recommendations: card.recommendations.filter(r => r.role === role || role === 'director'), sum: card.sum, limited: card.limited });
  },
  // 探针定义（给平台接口人与前端）
  'GET /api/checkup/probes': async (req, res) => {
    json(res, 200, { probes: PROBES.map(p => ({ key: p.key, name: p.name, input: p.input, computed: !!p.computed, early: !!p.early, go: p.go ? { levelId: p.go, title: LEVELS[p.go] } : null, local: !!p.local })), earlyDays: EARLY_DAYS });
  }
  };
}
