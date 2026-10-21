import { describe, it, expect } from 'vitest'
import {
  PATH_KEYS, levelId, parseLevelId, levelsOf, levelOf, cursorOf, statusOf, pathSummary, levelCount, pathOfRole
} from './lessons.js'

describe('lessons: the course library', () => {
  it('has the five role paths with the counts the plan states, plus the domain paths', () => {
    expect(PATH_KEYS.slice(0, 5)).toEqual(['nurse', 'teacher', 'care', 'it', 'director'])
    expect(PATH_KEYS.slice(0, 5).reduce((n, p) => n + levelCount(p), 0)).toBe(42)
    expect(PATH_KEYS).toContain('obs')
    expect(levelOf('obs-0').type).toBe('practice'); expect(levelOf('obs-0').needsSubmission).toBe(true); expect(levelOf('obs-0').needsEvent).toBe(false)
    expect(levelOf('obs-1').type).toBe('seminar')
    expect(levelCount('comm')).toBe(6); expect(levelCount('plan')).toBe(8); expect(levelCount('env')).toBe(6); expect(levelOf('plan-0').type).toBe('tool'); expect(levelOf('plan-0').needsEvent).toBe(false); expect(levelOf('plan-7').evidence.kinds).toContain('video'); expect(levelOf('env-4').evidence.min).toBe(2); expect(levelCount('play')).toBe(6); expect(levelCount('care')).toBe(8); expect(levelCount('nurse')).toBe(16); expect(levelOf('care-5').type).toBe('practice'); expect(levelOf('nurse-12').scene).toBe('过渡环节'); expect(levelCount('onboard')).toBe(6); expect(levelCount('backbone')).toBe(6); expect(levelOf('onboard-2').type).toBe('practice'); expect(levelOf('backbone-5').type).toBe('practice'); expect(levelCount('reflect')).toBe(6); expect(levelOf('play-5').type).toBe('practice'); expect(levelOf('reflect-2').type).toBe('practice'); expect(levelOf('comm-1').type).toBe('practice'); expect(levelOf('comm-3').type).toBe('seminar'); expect(levelOf('comm-3').rubric.length).toBe(4)
    expect(levelOf('nurse-0').type).toBe('tool')
    expect(levelCount('director')).toBe(6)
  })
  it('round-trips level ids and refuses ones outside the path', () => {
    expect(parseLevelId(levelId('nurse', 5))).toEqual({ path: 'nurse', i: 5 })
    expect(parseLevelId('nurse-99')).toBeNull()
    expect(parseLevelId('gym-1')).toBeNull()
    expect(parseLevelId('')).toBeNull()
  })
  it('every level has a title, a scene, a skill block, and quiz options with exactly one right answer', () => {
    for (const p of PATH_KEYS) for (const l of levelsOf(p)) {
      const lv = levelOf(l.id)
      expect(lv.title, l.id).toBeTruthy()
      expect(lv.skill, `${l.id} scene ${lv.scene}`).toBeTruthy()
      for (const q of lv.qs) expect(q.o.filter(o => o[1] === 1).length, `${l.id} ${q.t}`).toBe(1)
    }
  })
  it('swaps the featured observation level for its OBS content', () => {
    const lv = levelOf('nurse-5')
    expect(lv.title).toBe('全日观察与疾病登记')
    expect(lv.steps.length).toBeGreaterThan(0)
    expect(lv.qs.length).toBeGreaterThan(0)
    expect(lv.needsEvent).toBe(true)
  })
  it('derives the cursor and statuses from the progress table alone', () => {
    const prog = { 'nurse-0': { passedAt: 1 }, 'nurse-1': { passedAt: 1 }, 'nurse-3': { passedAt: 1 } }
    expect(cursorOf(prog, 'nurse')).toBe(2)       // nurse-3 ahead of the gap does not move the cursor
    expect(statusOf(prog, 'nurse-1')).toBe('done')
    expect(statusOf(prog, 'nurse-2')).toBe('current')
    expect(statusOf(prog, 'nurse-4')).toBe('locked')
    expect(statusOf(prog, 'nurse-3')).toBe('done')
    expect(pathSummary(prog, 'nurse')).toMatchObject({ total: 16, done: 2, finished: false })
    expect(pathSummary({}, 'it').finished).toBe(false)
  })
  it('maps a role to its path', () => {
    expect(pathOfRole('director')).toBe('director')
    expect(pathOfRole('nobody')).toBeNull()
  })
})
