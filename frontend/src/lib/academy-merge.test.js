import { describe, it, expect } from 'vitest'
import { mergeProgress, mergeSessions, creditsOf, mergeAcademy, academyExtras, mergeStates, localExtras, hasProgress } from './academy-merge.js'

describe('academy-merge', () => {
  it('progress is a union, and a level both sides passed keeps the earlier pass', () => {
    const a = { 'nurse-0': { passedAt: 100, credits: 1 }, 'nurse-1': { passedAt: 300, credits: 1, quiz: { right: 1, of: 1 } } }
    const b = { 'nurse-1': { passedAt: 200, credits: 1 }, 'director-0': { passedAt: 50, credits: 1 } }
    expect(mergeProgress(a, b)).toEqual({
      'nurse-0': { passedAt: 100, credits: 1 }, 'nurse-1': { passedAt: 200, credits: 1 }, 'director-0': { passedAt: 50, credits: 1 }
    })
    expect(mergeProgress(null, b)).toEqual(b)
    expect(mergeProgress({ 'x-0': { note: 'no passedAt' } }, {})).toEqual({})
  })
  it('sessions are append-only: union by id, legacy rows by level and end, ordered by end', () => {
    const a = [{ id: 's1', levelId: 'nurse-0', end: 10 }, { levelId: 'nurse-1', end: 30 }]
    const b = [{ id: 's1', levelId: 'nurse-0', end: 10, quiz: { right: 1, of: 1 } }, { id: 's2', levelId: 'nurse-0', end: 20 }, { levelId: 'nurse-1', end: 30 }]
    const m = mergeSessions(a, b)
    expect(m.map(s => s.id || s.end)).toEqual(['s1', 's2', 30])
    expect(m).toHaveLength(3)
  })
  it('credits are derived from progress per path', () => {
    expect(creditsOf({ 'nurse-0': { passedAt: 1 }, 'nurse-3': { passedAt: 1, credits: 2 }, 'it-0': { passedAt: 1 }, 'care-0': {} })).toEqual({ nurse: 3, it: 1 })
  })
  it('mergeAcademy writes the three fields and drops any draft', () => {
    const out = { lvDraft: { 'nurse-0': {} }, credits: { nurse: 9 } }
    mergeAcademy(out, { progress: { 'nurse-0': { passedAt: 1 } }, sessions: [{ id: 'a', end: 1 }] }, { progress: {}, sessions: [] })
    expect(out).toEqual({ credits: { nurse: 1 }, progress: { 'nurse-0': { passedAt: 1 } }, sessions: [{ id: 'a', end: 1 }] })
  })
  it('academyExtras counts the levels the device passed that the server lacks', () => {
    expect(academyExtras({ progress: { 'nurse-0': { passedAt: 1 }, 'nurse-1': { passedAt: 2 } } }, { progress: { 'nurse-0': { passedAt: 1 } } })).toBe(1)
    expect(academyExtras({ progress: {} }, null)).toBe(0)
  })
})

describe('mergeStates carries the academy rules', () => {
  const base = { _ts: 1, workouts: [], routines: [], unit: 'kg' }
  it('two devices that each passed a level keep both, whichever copy is newer', () => {
    const phone = { ...base, _ts: 5, progress: { 'nurse-0': { passedAt: 5 } }, sessions: [{ id: 'p', levelId: 'nurse-0', end: 5 }], credits: { nurse: 1 } }
    const pc = { ...base, _ts: 3, progress: { 'director-0': { passedAt: 3 } }, sessions: [{ id: 'c', levelId: 'director-0', end: 3 }], credits: { director: 1 } }
    for (const [a, b] of [[phone, pc], [pc, phone]]) {
      const m = mergeStates(a, b)
      expect(Object.keys(m.progress).sort()).toEqual(['director-0', 'nurse-0'])
      expect(m.sessions.map(s => s.id)).toEqual(['c', 'p'])
      expect(m.credits).toEqual({ director: 1, nurse: 1 })
    }
  })
  it('sign-in with prefer keeps the server profile and still adds the device’s passes', () => {
    const server = { ...base, _ts: 9, role: 'director', progress: { 'director-0': { passedAt: 9 } } }
    const device = { ...base, _ts: 2, role: 'nurse', progress: { 'nurse-0': { passedAt: 2 } } }
    const m = mergeStates(server, device, { prefer: 'a' })
    expect(m.role).toBe('director')
    expect(Object.keys(m.progress).sort()).toEqual(['director-0', 'nurse-0'])
  })
  it('a draft never survives a merge', () => {
    const m = mergeStates({ ...base, _ts: 2, lvDraft: { 'nurse-0': { seg: 'ce' } } }, { ...base, _ts: 1 })
    expect(m.lvDraft).toBeUndefined()
  })
  it('localExtras reports passed levels the server does not have', () => {
    const x = localExtras({ progress: { 'nurse-0': { passedAt: 1 } }, workouts: [] }, { progress: {}, workouts: [] })
    expect(x.levels).toBe(1)
    expect(localExtras({ workouts: [] }, { workouts: [] }).levels).toBeUndefined()
  })
})
