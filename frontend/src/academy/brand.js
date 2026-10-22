// 平台名称：从 /api/config 的 brand 取（运营方在运营后台改），没拿到前用默认。
import { useStore } from '../store/useStore.js'

export const FALLBACK = { name: 'C-Life 学前大课堂', short: '学前大课堂', region: '', tagline: '按岗位走关，在平台上做一次就算一次。', credit: '' }

export function useBrand() {
  const c = useStore(s => s.config)
  return { ...FALLBACK, ...(c?.brand || {}) }
}

// 标签页标题跟着全称走；订阅 store 而不是在组件里 effect，登录前、加载中也对。
export const brandNow = () => ({ ...FALLBACK, ...(useStore.getState().config?.brand || {}) })
if (typeof document !== 'undefined') {
  const apply = () => { const n = brandNow().name; if (document.title !== n) document.title = n }
  apply(); useStore.subscribe(apply)
}
