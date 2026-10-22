/* 桥到学前教师发展平台 api 的 HTTP 客户端：只发 GET，带只读接口令牌（在网页「设置 → 只读接口令牌」新建）。
   ACADEMY_URL   服务地址，如 https://academy.example.com 或本地 http://127.0.0.1:3000
   ACADEMY_TOKEN 令牌，cla_ 开头 */
let _fetch = globalThis.fetch
export const _setFetchForTests = f => { _fetch = f || globalThis.fetch }

export function config() {
  const url = (process.env.ACADEMY_URL || '').replace(/\/+$/, '')
  const token = (process.env.ACADEMY_TOKEN || '').trim()
  return { url, token }
}

export function checkConfig() {
  const { url, token } = config()
  if (!url) throw Object.assign(new Error('没设 ACADEMY_URL（平台的地址，如 https://academy.example.com）'), { code: 'CONFIG' })
  if (!token) throw Object.assign(new Error('没设 ACADEMY_TOKEN（网页「设置 → 只读接口令牌」里新建）'), { code: 'CONFIG' })
  if (!token.startsWith('cla_')) throw Object.assign(new Error('ACADEMY_TOKEN 不像只读令牌（应以 cla_ 开头）'), { code: 'CONFIG' })
  return { url, token }
}

export async function get(path, params = {}) {
  const { url, token } = checkConfig()
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  const full = url + path + (sp.size ? '?' + sp.toString() : '')
  let r
  try { r = await _fetch(full, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) }) }
  catch (e) { throw Object.assign(new Error(`连不上 ${url}：${e.message}`), { code: 'NETWORK' }) }
  let data = null
  try { data = await r.json() } catch { /* 非 JSON */ }
  if (r.status === 401) throw Object.assign(new Error('令牌无效或已撤（401）；到网页「设置 → 只读接口令牌」重新建一枚'), { code: 'UNAUTHORIZED' })
  if (r.status === 403) throw Object.assign(new Error(`这个账号看不了这项（403${data?.code ? '，' + data.code : ''}）`), { code: 'FORBIDDEN' })
  if (!r.ok) throw Object.assign(new Error(`${path} 答 ${r.status}${data?.error ? '：' + data.error : ''}`), { code: 'HTTP_' + r.status })
  return data
}
