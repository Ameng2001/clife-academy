import { describe, it, expect } from 'vitest'
import { allLessons, allScenes, searchLessons, snippet } from './library.js'

describe('微课库搜索', () => {
  it('lists every level across paths and the scenes in order', () => {
    const all = allLessons()
    expect(all.length).toBe(36)
    expect(all[0].id).toBe('nurse-0')
    expect(allScenes()[0]).toBe('账号')
  })
  it('empty query returns everything, filters narrow it', () => {
    expect(searchLessons('').length).toBe(36)
    expect(searchLessons('', { path: 'care' }).length).toBe(4)
    expect(searchLessons('', { scene: '出勤与请假' }).every(r => r.lesson.scene === '出勤与请假')).toBe(true)
  })
  it('finds a level by the platform menu or a step, not only the title', () => {
    const r = searchLessons('批量管理')
    expect(r.map(x => x.lesson.id)).toContain('nurse-2')
    expect(['menu', 'steps', 'title', 'goal']).toContain(r[0].where)
    expect(searchLessons('不存在的词xyz').length).toBe(0)
  })
  it('title hits rank first and multi-word queries must all match', () => {
    const r = searchLessons('出勤')
    expect(r[0].lesson.title.includes('出勤')).toBe(true)
    const both = searchLessons('出勤，批量')
    expect(both.every(x => /出勤/.test(JSON.stringify(x.lesson)) && /批量/.test(JSON.stringify(x.lesson)))).toBe(true)
  })
  it('snippet shows the matching text', () => {
    const l = searchLessons('批量管理')[0].lesson
    expect(snippet(l, '批量管理')).toContain('批量管理')
    expect(snippet(l, '')).toBe(l.goal)
  })
})
