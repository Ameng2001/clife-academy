/* 园长大讲堂（docs/ROADMAP.md 第四节）：每月一场，政策解读、园所建设路径、课程领导力。
 * 直播在第三方（腾讯会议、视频号等），平台只做三件事：预约、回放列表、讲义。
 *
 * db.lectures: { id, title, desc, who, speaker, at(开播时间戳), minutes, liveUrl, replayUrl, slides:{url}|{file:{hash,name,type,size,owner}}|null,
 *                notes, by, byName, createdAt, updatedAt, bookings:[uid], reminded:[uid] }
 * 谁能排场：管理员（本地运营方）。谁能看：所有人（没登录也能看安排与回放，预约要登录）。
 * 预约提醒：开播前 30 分钟给预约且订阅过「lecture」模板的人发一条订阅消息（notify.js，WX_TMPL_LECTURE）；没配模板就只是记名。
 * 不催：只在本人预约的那一场开播前发，不发「今天有课」。 */
import crypto from 'node:crypto';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const HASH = /^[0-9a-f]{64}$/;
const URL_OK = /^https?:\/\/\S+$/i;
export const REMIND_BEFORE_MS = 30 * 60 * 1000;

export function lectureRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin, MEDIA, sendMediaFile, notifier = null }) {
  db.lectures = db.lectures || [];
  const now = () => Date.now();
  const endOf = l => l.at + (l.minutes || 60) * 60000;
  const phase = l => (now() < l.at ? 'upcoming' : now() < endOf(l) ? 'live' : 'done');
  const pub = (l, user) => ({
    id: l.id, title: l.title, desc: l.desc, who: l.who, speaker: l.speaker, at: l.at, minutes: l.minutes, phase: phase(l),
    liveUrl: l.liveUrl || null, replayUrl: l.replayUrl || null, slides: l.slides ? (l.slides.url ? { url: l.slides.url } : { file: { name: l.slides.file.name, type: l.slides.file.type, size: l.slides.file.size } }) : null,
    notes: l.notes || '', booked: !!user && l.bookings.includes(user.id), bookings: l.bookings.length,
    ...(user && isAdmin(user) ? { bookedBy: l.bookings.map(id => db.users.find(u => u.id === id)?.name || id) } : {})
  });
  const find = id => db.lectures.find(l => l.id === id);

  // 开播前 30 分钟提醒预约的人。每分钟跑一次；给过的人记在 reminded 里，重启也不重发。
  async function tick() {
    if (!notifier) return 0;
    const t = now(); let n = 0;
    for (const l of db.lectures) {
      if (l.at - t > REMIND_BEFORE_MS || l.at < t) continue;
      let changed = false;
      for (const uid of l.bookings) {
        if (l.reminded.includes(uid)) continue;
        l.reminded.push(uid); changed = true; n++;
        notifier.send(uid, 'lecture', { title: l.title, at: l.at, who: l.speaker || '园长大讲堂', url: l.liveUrl || '' }, 'pages/live/live');
      }
      if (changed) saveDb();
    }
    return n;
  }

  return {
  routes: {
  // 全部场次，按时间：upcoming（含正在直播）与 done（回放）。没登录也能看。
  'GET /api/lectures': async (req, res) => {
    const user = readSession(req);
    const list = db.lectures.map(l => pub(l, user));
    const upcoming = list.filter(l => l.phase !== 'done').sort((a, b) => a.at - b.at);
    const done = list.filter(l => l.phase === 'done').sort((a, b) => b.at - a.at);
    json(res, 200, { upcoming, done, canEdit: !!user && isAdmin(user), remindBefore: REMIND_BEFORE_MS / 60000 });
  },
  // 排一场或改：{ id?, title, desc?, who?, speaker?, at, minutes?, liveUrl?, replayUrl?, slides?:{url}|{file:{hash,name,type,size}}|null, notes? }
  'POST /api/lectures': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const id = str(body.id, 40);
    let l = id ? find(id) : null;
    if (id && !l) return json(res, 404, { error: 'no such lecture' });
    const title = str(body.title, 120);
    if (!title) return json(res, 400, { error: 'title required', code: 'title' });
    const at = Number(body.at);
    if (!Number.isFinite(at) || at < 946684800000) return json(res, 400, { error: 'at must be a timestamp (ms)', code: 'at' });
    const minutes = Math.min(600, Math.max(10, Number(body.minutes) || 60));
    const liveUrl = str(body.liveUrl, 1000), replayUrl = str(body.replayUrl, 1000);
    if ((liveUrl && !URL_OK.test(liveUrl)) || (replayUrl && !URL_OK.test(replayUrl))) return json(res, 400, { error: 'url must start with http(s)://', code: 'url' });
    let slides = body.slides === undefined ? (l ? l.slides : null) : null;
    if (body.slides && body.slides.url) {
      const u = str(body.slides.url, 1000);
      if (!URL_OK.test(u)) return json(res, 400, { error: 'slides url must start with http(s)://', code: 'url' });
      slides = { url: u };
    } else if (body.slides && body.slides.file && HASH.test(String(body.slides.file.hash || ''))) {
      const f = body.slides.file, owner = l?.slides?.file?.hash === f.hash ? l.slides.file.owner : user.id;
      if (!MEDIA.file(owner, f.hash)) return json(res, 400, { error: 'upload the file first', code: 'file' });
      slides = { file: { hash: f.hash, name: str(f.name, 120), type: str(f.type, 60), size: Number(f.size) || 0, owner } };
    }
    const fields = { title, desc: str(body.desc, 2000), who: str(body.who, 60), speaker: str(body.speaker, 60), at, minutes, liveUrl: liveUrl || null, replayUrl: replayUrl || null, slides, notes: str(body.notes, 4000), updatedAt: now() };
    if (l) {
      // 改了开播时间就重新提醒
      if (l.at !== at) l.reminded = [];
      Object.assign(l, fields);
    } else {
      l = { id: crypto.randomBytes(9).toString('base64url'), ...fields, by: user.id, byName: user.name, createdAt: now(), bookings: [], reminded: [] };
      db.lectures.push(l);
    }
    saveDb();
    audit(req, id ? 'lecture.edit' : 'lecture.new', { user, msg: l.id });
    json(res, 200, { lecture: pub(l, user) });
  },
  'POST /api/lectures/delete': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
    const body = await readBody(req);
    const l = find(str(body.id, 40));
    if (!l) return json(res, 404, { error: 'no such lecture' });
    db.lectures = db.lectures.filter(x => x.id !== l.id); saveDb();
    audit(req, 'lecture.delete', { user, msg: l.id });
    json(res, 200, { ok: true });
  },
  // 预约 / 取消：{ id, on }。只能预约还没结束的场次。
  'POST /api/lectures/book': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const l = find(str(body.id, 40));
    if (!l) return json(res, 404, { error: 'no such lecture' });
    if (phase(l) === 'done') return json(res, 400, { error: 'this lecture is over; watch the replay', code: 'over' });
    const on = body.on !== false;
    l.bookings = l.bookings.filter(x => x !== user.id); l.reminded = l.reminded.filter(x => x !== user.id);
    if (on) l.bookings.push(user.id);
    saveDb();
    audit(req, on ? 'lecture.book' : 'lecture.unbook', { user, msg: l.id });
    json(res, 200, { lecture: pub(l, user), remind: on && !!notifier && notifier.remaining(user.id).lecture > 0 });
  },
  // 讲义文件：谁都能读
  'GET /api/lectures/file': async (req, res) => {
    const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
    const l = find(id);
    if (!l || !l.slides?.file) return json(res, 404, { error: 'not found' });
    const f = MEDIA.file(l.slides.file.owner, l.slides.file.hash);
    if (!f) return json(res, 404, { error: 'media-missing' });
    await sendMediaFile(res, f, l.slides.file.hash);
  }
  },
  tick
  };
}
