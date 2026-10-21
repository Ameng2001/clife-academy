import { describe, it, expect } from 'vitest'
import { createDrafts, DRAFT_KEY } from './level-draft.js'

const memStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m } }

describe('level-draft', () => {
  it('starts fresh, mutates a copy, persists, clears', () => {
    const st = memStorage(), d = createDrafts(st)
    expect(d.get('nurse-0')).toBeNull()
    d.set('nurse-0', x => { x.seg = 'ce'; x.answers = { 0: 1 } })
    expect(d.get('nurse-0')).toEqual({ seg: 'ce', zuoDone: false, events: [], answers: { 0: 1 } })
    expect(JSON.parse(st.getItem(DRAFT_KEY))['nurse-0'].seg).toBe('ce')
    const again = createDrafts(st)
    expect(again.has('nurse-0')).toBe(true)
    again.clear('nurse-0')
    expect(again.get('nurse-0')).toBeNull()
    expect(createDrafts(st).has('nurse-0')).toBe(false)
  })
  it('survives a storage that throws', () => {
    const d = createDrafts({ getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    d.set('a', x => { x.zuoDone = true })
    expect(d.get('a').zuoDone).toBe(true)
  })
  it('notifies subscribers', () => {
    const d = createDrafts(memStorage()); let n = 0
    const off = d.subscribe(() => n++)
    d.set('a', () => {}); d.clear('a'); off(); d.set('a', () => {})
    expect(n).toBe(2)
  })
})
