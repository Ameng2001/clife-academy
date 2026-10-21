import { describe, it, expect } from 'vitest'
import { capabilityMap, domainOf, evidenceText, DOMAINS } from './capability.js'
import { levelOf, levelsOf, PATH_KEYS } from './lessons.js'

const passed = { passedAt: 1 }
describe('能力地图', () => {
  it('maps tool levels into domains by content and leaves platform-only levels out', () => {
    expect(domainOf(levelOf('nurse-0'))).toBe(null)                      // 三端登录：账号
    expect(domainOf(levelsOf('nurse').find(l => l.scene === '晨午检') && levelOf(levelsOf('nurse').find(l => l.scene === '晨午检').id))).toBe('life')
    expect(domainOf(levelOf('obs-0'))).toBe('obs'); expect(domainOf(levelOf('comm-3'))).toBe('comm')
    const teacherObs = levelsOf('teacher').find(l => l.scene === '观察记录')
    expect(domainOf(levelOf(teacherObs.id))).toBe('obs')
    const all = PATH_KEYS.flatMap(p => levelsOf(p)).map(l => domainOf(levelOf(l.id)))
    expect(all.filter(Boolean).length + all.filter(x => !x).length).toBe(48)
    expect(new Set(all.filter(Boolean)).size).toBeGreaterThanOrEqual(4)
  })
  it('empty progress is seven empty domains; env, play, reflect have no content yet', () => {
    const m = capabilityMap({}, [])
    expect(m.domains.length).toBe(7); expect(m.evidenced).toBe(0)
    expect(m.domains.every(d => d.status === 'empty')).toBe(true)
    expect(m.domains.find(d => d.key === 'env').total).toBe(0)
    expect(evidenceText(m.domains.find(d => d.key === 'env'))).toBe('内容建设中')
    expect(evidenceText(m.domains.find(d => d.key === 'comm'))).toBe('还没有证据')
    expect(m.domains.find(d => d.key === 'comm').cert).toEqual({ path: 'comm', name: '沟通与合作', done: 0, total: 6, ready: false })
  })
  it('counts the three kinds of evidence, uses the latest submission per level, and marks the domain certificate', () => {
    const subs = [
      { levelId: 'obs-0', status: 'revise', at: 1 }, { levelId: 'obs-0', status: 'pass', at: 2 },
      { levelId: 'obs-1', status: 'pass', at: 3 },
      { levelId: 'comm-1', status: 'pending', at: 4 }
    ]
    const m = capabilityMap({ 'obs-0': passed, 'obs-1': passed, 'nurse-2': passed }, subs)
    const obs = m.domains.find(d => d.key === 'obs'), comm = m.domains.find(d => d.key === 'comm')
    expect(obs.works).toBe(1); expect(obs.answers).toBe(1); expect(obs.revise).toBe(0); expect(obs.status).toBe('evidenced')
    expect(obs.cert.ready).toBe(true)
    expect(comm.pending).toBe(1); expect(comm.status).toBe('started'); expect(comm.cert.ready).toBe(false)
    expect(evidenceText(obs)).toBe('作品通过点评 1 · 研讨作答 1')
    expect(m.domains.find(d => d.key === 'life').tools).toBe(1)
    expect(m.evidenced).toBe(2)
    expect(m.tools.total).toBeGreaterThan(0)
  })
  it('DOMAINS follow the professional standard order', () => {
    expect(DOMAINS.map(d => d.key)).toEqual(['env', 'life', 'play', 'plan', 'obs', 'comm', 'reflect'])
  })
})
