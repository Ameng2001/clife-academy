// 大课堂的弹层：确认框，和登录时「这台设备上的进度要不要记到账号里」的那一问。
// 上游 sheets.jsx 里三千多行健身弹层已删，只留这两样。
import { useUI } from '../store/useUI.js'
import { Button } from '../components/ui.jsx'

function ConfirmDialog({ title, message, confirmText, cancelText, danger, onConfirm, onCancel, close }) {
  return <div style={{ textAlign: 'center', padding: '4px 0' }}>
    {title && <h3 style={{ marginBottom: 8 }}>{title}</h3>}
    <div className="muted" style={{ marginBottom: 18, lineHeight: 1.5 }}>{message}</div>
    <button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={() => { close(); onConfirm && onConfirm() }}>{confirmText || '确定'}</button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={() => { close(); onCancel && onCancel() }}>{cancelText || '取消'}</Button>
  </div>
}

export function confirmSheet(opts) {
  useUI.getState().openSheet(close => <ConfirmDialog {...opts} close={close} />, { kind: 'center', ...(opts.locked ? { locked: true } : {}) })
}

// 登录时 store.adoptProfile 的提问（useStore.js runAdopt → localExtras）：这台设备没登录时通过的
// 关卡（extras.levels，lib/academy-merge.js academyExtras）要不要并进账号。resolve(true) 为并入。
export function askAddDeviceData(extras = {}) {
  const levels = Number(extras.levels) || 0
  return new Promise(resolve => confirmSheet({
    title: levels ? '把这台设备上通过的关卡记到账号里？' : '把这台设备上的记录记到账号里？',
    message: levels ? `这台设备在没登录时通过了 ${levels} 关。记到账号里，或者保持账号在服务器上的样子。`
      : '这台设备在没登录时留下了一些记录。记到账号里，或者保持账号在服务器上的样子。',
    confirmText: '记到账号里', cancelText: '保持账号原样',
    onConfirm: () => resolve(true), onCancel: () => resolve(false), locked: true
  }))
}
