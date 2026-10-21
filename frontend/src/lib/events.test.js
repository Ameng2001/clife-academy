import { describe, it, expect } from 'vitest'
import { eventsForLevel, levelDone, eventRefs } from './events.js'

const lv = { needsEvent: true, event: '完成 1 次批量调整' }
const evs = [
  { id: 'a', event: '完成 1 次批量调整', src: 'platform' },
  { id: 'b', event: '语音录入 1 条晨检异常', src: 'platform' },
  { id: 'c', event: '完成 1 次批量调整', src: 'demo' }
]

describe('events ↔ level', () => {
  it('matches by exact event name', () => {
    expect(eventsForLevel(evs, lv).map(e => e.id)).toEqual(['a', 'c'])
    expect(levelDone(evs, lv)).toBe(true)
    expect(levelDone(evs, { needsEvent: true, event: '没有的事' })).toBe(false)
  })
  it('a level without a practice step needs nothing', () => {
    expect(eventsForLevel(evs, { needsEvent: false, event: '' })).toEqual([])
    expect(levelDone([], lv)).toBe(false)
  })
  it('refs tell platform events from demo ones', () => {
    expect(eventRefs(evs, lv)).toEqual(['ev:a', 'demo:c'])
  })
})
