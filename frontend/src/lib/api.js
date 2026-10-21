// 同源 JSON 请求：带超时，非 2xx 抛 { status, data }（409 的 data 里带服务端整份状态）。
// 上游 api.js 的手机配对、Cloudflare Access、passkey 都不要了。
const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '')
const TIMEOUT_GET_MS = 20000
const TIMEOUT_MS = 60000

const failure = (message, code, status) => Object.assign(new Error(message), { code, status })

export async function api(path, opts) {
  const { timeout, ...init } = opts || {}
  const headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers)
  const ms = timeout != null ? timeout : (init.method || 'GET').toUpperCase() === 'GET' ? TIMEOUT_GET_MS : TIMEOUT_MS
  const ctl = typeof AbortController === 'function' ? new AbortController() : null
  let timer = null
  const expired = new Promise((_, reject) => {
    if (ms > 0) timer = setTimeout(() => { if (ctl) ctl.abort(); reject(failure('服务器没有及时应答', 'timeout')) }, ms)
  })
  const answer = exchange(BASE + path, Object.assign({}, init, { headers }, ctl ? { signal: ctl.signal } : {}))
  answer.catch(() => {})
  try { return await Promise.race([answer, expired]) }
  finally { clearTimeout(timer) }
}

// 每条路由都答 JSON（api/server.js json()）。2xx 却不是 JSON 的，是别人的页面（代理的登录页之类），按错误处理。
async function exchange(url, init) {
  const r = await fetch(url, init)
  let data
  let parsed = true
  try { data = await r.json() } catch { parsed = false }
  const body = parsed && data && typeof data === 'object' ? data : null
  if (!r.ok) { const e = new Error((body && body.error) || ('HTTP ' + r.status)); e.status = r.status; e.data = body || {}; throw e }
  if (!body) throw failure('服务器返回的不是大课堂数据', 'bad-response', r.status)
  return body
}
