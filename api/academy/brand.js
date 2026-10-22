// 平台名称可配（db.brand）：全称、短名、地区、一句话、技术支持署名。产品线名「幼师学坊」（与教研工坊对应）；
// 本地运营方可加地方前缀（柳州：龙城幼师学坊）或改成自己的名字，网页、小程序、证书、答疑提示词都从这里取。
// 环境变量 BRAND_NAME / BRAND_SHORT / BRAND_REGION / BRAND_TAGLINE / BRAND_CREDIT 给初始默认；运营后台改过的以 db 为准。
const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const env = (k, d) => (process.env[k] ?? '').trim() || d;

export const DEFAULT_BRAND = Object.freeze({
  name: env('BRAND_NAME', '幼师学坊'),          // 全称：登录页、证书、设置「关于」
  short: env('BRAND_SHORT', '幼师学坊'),               // 短名：顶部导航、首页标题、小程序标题
  region: env('BRAND_REGION', ''),                        // 地区：如「柳州市」，小程序顶栏与证书副题
  tagline: env('BRAND_TAGLINE', '按岗位走关，在平台上做一次就算一次。'),
  credit: env('BRAND_CREDIT', ''),                        // 技术支持署名：如「技术支持：C-Life」，证书页脚；空则不显示
});
export const LIMITS = { name: 40, short: 12, region: 20, tagline: 80, credit: 40 };

export function sanitizeBrand(b) {
  const out = {};
  for (const k of Object.keys(LIMITS)) out[k] = str(b?.[k], LIMITS[k]);
  if (!out.name) out.name = DEFAULT_BRAND.name;
  if (!out.short) out.short = out.name.replace(/^C-Life\s*/i, '').slice(0, LIMITS.short) || DEFAULT_BRAND.short;
  if (!out.tagline) out.tagline = DEFAULT_BRAND.tagline;
  return out;
}
export const brandOf = db => sanitizeBrand({ ...DEFAULT_BRAND, ...(db.brand || {}) });

export function brandRoutes({ json, readBody, db, saveDb, readSession, audit, isAdmin }) {
  return {
    'GET /api/brand': async (req, res) => {
      const user = readSession(req);
      json(res, 200, { brand: brandOf(db), defaults: DEFAULT_BRAND, limits: LIMITS, canEdit: !!(user && isAdmin(user)) });
    },
    // 改名（管理员）：{ name, short, region, tagline, credit }；传 reset:true 回到默认
    'PUT /api/brand': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      if (!isAdmin(user)) return json(res, 403, { error: 'admins only', code: 'admin' });
      const body = await readBody(req);
      if (body.reset) delete db.brand; else db.brand = sanitizeBrand({ ...brandOf(db), ...body });
      saveDb();
      audit(req, 'brand.set', { user, msg: brandOf(db).name });
      json(res, 200, { brand: brandOf(db) });
    },
  };
}
