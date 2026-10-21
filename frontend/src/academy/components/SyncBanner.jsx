// 顶部同步状态条：读 store.sync.status，用中文说清「改动还在这台设备上」。
// 替换上游 components/SyncBanner.jsx＋ServerSync.jsx（那两者带着 passkey、配对、健身弹层）。
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import Icon from '../../components/Icon.jsx'

export const PENDING_GRACE_MS = 5000
const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

export function useOnline() {
  const [online, setOnline] = useState(isOnline)
  useEffect(() => {
    const on = () => setOnline(isOnline())
    window.addEventListener('online', on); window.addEventListener('offline', on)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [])
  return online
}

// sync 的一种状态，用话说出来：tone 定颜色，line 给设置页与「立即同步」的提示，
// banner 是常驻条上的那句（null 表示没什么可说），action 是条上给的动作。
export function connectionView(sync, { online = isOnline() } = {}) {
  if (!sync) return null
  const err = sync.lastError || {}
  const status = !online && (sync.status === 'ok' || sync.status === 'pending') ? 'offline' : sync.status
  switch (status) {
    case 'ok': return { tone: 'ok', icon: 'cloud', line: '已同步', banner: null, action: null }
    case 'pending': return { tone: 'wait', icon: 'reset', line: '等待同步', banner: '还没同步。点一下重试。', action: 'retry', label: null }
    case 'held': return { tone: 'wait', icon: 'reset', line: '等你回答这台设备上的进度怎么处理', banner: '回答完这台设备上的进度要不要记到账号里，才会继续同步。点一下回答。', action: 'retry', label: null }
    case 'offline':
      return online
        ? { tone: 'off', icon: 'cloudSlash', action: 'retry', line: err.code === 'timeout' ? '服务器没有及时应答' : '连不上服务器', banner: sync.pending ? '连不上服务器。改动已存在这台设备上，服务器恢复后会同步。' : '连不上服务器。显示的是上次同步的内容。' }
        : { tone: 'off', icon: 'cloudSlash', action: 'retry', line: '离线，连不上服务器', banner: sync.pending ? '离线。改动已存在这台设备上，联网后会同步。' : '离线。显示的是上次同步的内容。' }
    case 'error':
      return { tone: 'bad', icon: 'warning', action: 'retry', line: `服务器出错（HTTP ${err.status}）`, banner: `服务器返回了错误（HTTP ${err.status}）。改动还在这台设备上。` }
    case 'auth':
      return { tone: 'bad', icon: 'lock', action: 'signin', line: '登录已过期', banner: '登录已过期，服务器不再接受这个浏览器。改动还在这台设备上。' }
    default:
      return { tone: 'quiet', icon: 'lock', action: 'signin', line: '访客模式：进度只在这个浏览器里', banner: '访客模式：进度只在这个浏览器里。' }
  }
}
export const actionLabel = view => (view.label !== undefined ? view.label : ({ retry: '重试', signin: '登录' })[view.action] || null)

export async function syncNowWithToast() {
  const sync = await useStore.getState().syncNow()
  const view = connectionView(sync)
  if (view) useUI.getState().toast(view.line)
  return sync
}

function useConnection() {
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  const guest = useStore(s => s.isGuest())
  const online = useOnline()
  const [waited, setWaited] = useState(false)
  const status = sync?.status
  useEffect(() => {
    setWaited(false)
    if (status !== 'pending') return
    const tm = setTimeout(() => setWaited(true), PENDING_GRACE_MS)
    return () => clearTimeout(tm)
  }, [status])
  const view = connectionView(sync, { online })
  const show = !!view?.banner && (!!user || guest || status === 'auth') && (status !== 'pending' || waited)
  return { view, show, user, status }
}

export const showsConnection = S => S?.connStatus !== false
export const showsLocalLine = S => S?.connLocal !== false

// signIn：点「登录」时做什么（AcademyApp 指到大课堂登录页）。
export default function SyncBanner({ signIn }) {
  const on = useStore(s => showsConnection(s.S))
  const local = useStore(s => showsLocalLine(s.S))
  const update = useStore(s => s.update)
  const conn = useConnection()
  const { view, user, status } = conn
  const quiet = view?.tone === 'quiet'
  const show = conn.show && on && (!quiet || local)
  const row = useRef(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    const el = row.current
    if (!show || !el) { root.style.removeProperty('--conn'); return }
    const fit = () => root.style.setProperty('--conn', el.offsetHeight + 'px')
    fit()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null
    ro?.observe(el)
    return () => { ro?.disconnect(); root.style.removeProperty('--conn') }
  }, [show])

  if (!show) return null
  const act = { retry: () => { syncNowWithToast() }, signin: () => signIn && signIn({ user, status }) }[view.action]
  const label = actionLabel(view)
  const inner = <><Icon name={view.icon} /><span className="conn-t">{view.banner}</span>{act && label && <span className="conn-a">{label}</span>}</>
  return <div className={'conn-bar ' + view.tone}>
    <div className="conn-row" ref={row} role="status" aria-live="polite">
      {act ? <button className="conn" onClick={act}>{inner}</button> : <div className="conn">{inner}</div>}
      {quiet && <button type="button" className="conn-x" aria-label="关闭" onClick={() => update(s => { s.connLocal = false })}><Icon name="xmark" /></button>}
    </div>
  </div>
}
