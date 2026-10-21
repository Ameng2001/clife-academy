// 证据照片上传：客户端算 sha256，PUT /api/media/{hash} 原始字节（上游 media 存储，存在本人名下）。
// 服务端只认魔数与大小；类型以文件自报为准。返回 { hash, name, type, size }。
const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '')

export async function sha256Hex(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function uploadMedia(file) {
  const buf = await file.arrayBuffer()
  const hash = await sha256Hex(buf)
  const r = await fetch(`${BASE}/api/media/${hash}`, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: buf })
  if (!r.ok) {
    const body = await r.json().catch(() => null)
    const e = new Error(body?.error || ('HTTP ' + r.status)); e.status = r.status; e.code = body?.code; throw e
  }
  return { hash, name: file.name || '', type: file.type || '', size: buf.byteLength }
}
