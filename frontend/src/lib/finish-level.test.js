import { describe, it, expect } from 'vitest'
import { finishLevel, canPass } from './finish-level.js'
import { levelOf, statusOf } from './lessons.js'

const T = Date.parse('2026-11-03T09:00:00Z')

describe('finish-level: settling one level', () => {
  it('passes the current level when the event came and the quiz is right, and advances the cursor', () => {
    const r = finishLevel({}, 'nurse-0', { zuoDone: true, right: 1, of: 1, events: ['login.ok'] }, { now: T })
    expect(r.passed).toBe(true)
    expect(r.S.progress['nurse-0']).toMatchObject({ passedAt: T, credits: 1 })
    expect(r.S.credits.nurse).toBe(1)
    expect(r.S.sessions).toHaveLength(1)
    expect(statusOf(r.S.progress, 'nurse-1')).toBe('current')
  })
  it('refuses a locked level but still logs that it was studied', () => {
    const r = finishLevel({}, 'nurse-3', { zuoDone: true, right: 1, of: 1 }, { now: T })
    expect(r.passed).toBe(false); expect(r.why).toBe('locked')
    expect(r.S.progress).toBeUndefined(); expect(r.S.sessions).toHaveLength(1)
  })
  it('does not pay twice for the same level', () => {
    const a = finishLevel({}, 'nurse-0', { zuoDone: true, right: 1, of: 1 }, { now: T })
    const b = finishLevel(a.S, 'nurse-0', { zuoDone: true, right: 1, of: 1 }, { now: T + 1 })
    expect(b.passed).toBe(false); expect(b.why).toBe('already'); expect(b.S.credits.nurse).toBe(1)
  })
  it('needs the platform event on a level that asks for one, and not on one that does not', () => {
    const withEvent = levelOf('nurse-0'), without = { ...withEvent, needsEvent: false }
    expect(canPass(withEvent, { zuoDone: false, right: 1, of: 1 })).toEqual({ ok: false, why: 'zuo' })
    expect(canPass(without, { zuoDone: false, right: 1, of: 1 }).ok).toBe(true)
  })
  it('applies the pass rate: all right by default, 80 % when gated', () => {
    const lv = levelOf('nurse-0')
    expect(canPass(lv, { zuoDone: true, right: 4, of: 5 })).toEqual({ ok: false, why: 'quiz' })
    expect(canPass(lv, { zuoDone: true, right: 4, of: 5, passRate: 0.8 }).ok).toBe(true)
  })
  it('never mutates its input', () => {
    const S = { progress: {}, sessions: [], credits: {} }
    const snap = JSON.stringify(S)
    finishLevel(S, 'nurse-0', { zuoDone: true, right: 1, of: 1 }, { now: T })
    expect(JSON.stringify(S)).toBe(snap)
  })
})
