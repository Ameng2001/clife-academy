// 界面态：弹层栈与 toast。上游 useUI.js 的组间休息计时、震动提示都不要了。
import { create } from 'zustand'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
let toastTm = null
const TOAST_MS = 2200
const TOAST_ACTION_MS = 5000
let toastLeft = 0
let toastT0 = 0
let toastPaused = false
let toastSeq = 0
const runToast = set => {
  toastPaused = false
  toastT0 = Date.now()
  clearTimeout(toastTm)
  toastTm = setTimeout(() => set({ toastMsg: '', toastAction: null }), toastLeft)
}

export const useUI = create((set, get) => ({
  sheets: [],          // { id, render:(close)=>JSX, kind:'sheet'|'center', locked }
  toastMsg: '',
  toastAction: null,   // { label, run, id }

  openSheet(render, { kind = 'sheet', locked = false } = {}) {
    const id = uid()
    set(s => ({ sheets: [...s.sheets, { id, render, kind, locked }] }))
    const close = () => get().closeSheet(id)
    return { id, close, lock: v => set(s => ({ sheets: s.sheets.map(x => x.id === id ? { ...x, locked: v } : x) })) }
  },
  closeSheet(id) { set(s => ({ sheets: s.sheets.filter(x => x.id !== id) })) },
  closeAll() { set({ sheets: [] }) },

  // 2.2 秒的一句话；带动作（{ action, onAction }）时留 5 秒，按住不走（pauseToast）。新的替换旧的。
  toast(msg, { action, onAction, ms } = {}) {
    const withAction = !!(action && typeof onAction === 'function')
    clearTimeout(toastTm)
    toastLeft = ms || (withAction ? TOAST_ACTION_MS : TOAST_MS)
    toastSeq += 1
    set({ toastMsg: msg, toastAction: withAction ? { label: action, run: onAction, id: toastSeq } : null })
    runToast(set)
  },
  runToastAction() {
    const act = get().toastAction
    if (!act) return
    clearTimeout(toastTm)
    set({ toastMsg: '', toastAction: null })
    act.run()
  },
  pauseToast() {
    if (!get().toastAction || toastPaused) return
    toastPaused = true
    clearTimeout(toastTm)
    toastLeft = Math.max(400, toastLeft - (Date.now() - toastT0))
  },
  resumeToast() {
    if (!toastPaused) return
    toastPaused = false
    if (get().toastMsg) runToast(set)
  },
}))
