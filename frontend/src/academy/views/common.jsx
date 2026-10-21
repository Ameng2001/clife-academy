import { useStore } from '../../store/useStore.js'
import { ROLES, pathOfRole } from '../../lib/lessons.js'

export const useS = () => useStore(s => s.S)
export const update = (mut, push = true) => useStore.getState().update(mut, push)
export const myPath = S => pathOfRole(S.role) || 'nurse'
export const fmtDay = ts => { const d = new Date(ts); return `${d.getMonth() + 1} 月 ${d.getDate()} 日` }

/** 岗位切换：演示期每个人都能切；正式版由平台账号决定，这个控件只剩园长能用。 */
export function RoleSelect({ S }) {
  return <select className="ac-sel" value={S.role} onChange={e => update(s => { s.role = e.target.value })}>
    {Object.keys(ROLES).map(k => <option key={k} value={k}>{ROLES[k].label}</option>)}
  </select>
}
