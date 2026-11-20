import { describe, expect, it } from 'vitest'
import { goldenPath, type GoldenPathInput } from './goldenPath'

const base: GoldenPathInput = { hasScript: false, assetCount: 0, styleLocked: false, outputsCount: 0, approvedCount: 0, jobsActive: 0, storyboards: false, shotCount: 0, ready: false }

describe('golden path', () => {
  it('starts at Create for an empty project', () => {
    const { next, progress, steps } = goldenPath(base)
    expect(next?.id).toBe('create')
    expect(progress).toBe(0)
    expect(steps.map((s) => s.id)).toEqual(['create', 'analyze', 'design', 'generate', 'review', 'deliver'])
  })
  it('never forces Direct unless storyboards are enabled', () => {
    expect(goldenPath(base).steps.some((s) => s.id === 'direct')).toBe(false)
    expect(goldenPath({ ...base, storyboards: true }).steps.some((s) => s.id === 'direct')).toBe(true)
  })
  it('advances from real data and reports honest detail', () => {
    const { next, steps } = goldenPath({ ...base, hasScript: true, assetCount: 6, styleLocked: true, outputsCount: 2 })
    expect(next?.id).toBe('generate')
    expect(steps.find((s) => s.id === 'generate')?.detail).toBe('2 of 6 references saved')
    expect(steps.find((s) => s.id === 'design')?.state).toBe('done')
  })
  it('reports queue activity and completes when ready', () => {
    expect(goldenPath({ ...base, hasScript: true, assetCount: 2, styleLocked: true, jobsActive: 1 }).next?.action).toBe('Watch the queue')
    const done = goldenPath({ ...base, hasScript: true, assetCount: 2, styleLocked: true, outputsCount: 2, approvedCount: 2, ready: true })
    expect(done.next).toBeNull()
    expect(done.progress).toBe(100)
  })
  it('does not call an empty project ready to deliver', () => {
    const empty = goldenPath({ ...base, ready: true })
    expect(empty.steps.find((x) => x.id === 'deliver')?.state).not.toBe('done')
    expect(empty.progress).toBeLessThan(100)
  })
  it('treats a project started from your own images as already created and analyzed', () => {
    const { steps, next } = goldenPath({ ...base, assetCount: 1, outputsCount: 1, approvedCount: 1 })
    expect(steps.find((s) => s.id === 'create')).toMatchObject({ state: 'done', detail: 'Started from your own images' })
    expect(steps.find((s) => s.id === 'analyze')?.detail).toBe('1 asset added')
    expect(next?.id).toBe('design')
  })
  describe('optional extras', () => {
    it('are absent until started, so existing projects look exactly as before', () => {
      expect(goldenPath(base).extras).toEqual([])
      expect(goldenPath({ ...base, shape: { characters: 4, withProfile: 0 } }).extras).toEqual([])
    })
    it('report where optional shape work stands without becoming the next step or changing progress', () => {
      const input = { ...base, hasScript: true, assetCount: 4, styleLocked: true, shape: { characters: 4, withProfile: 2 } }
      const withExtra = goldenPath(input)
      const without = goldenPath({ ...input, shape: undefined })
      expect(withExtra.extras).toHaveLength(1)
      expect(withExtra.extras[0]).toMatchObject({ id: 'shape', state: 'upcoming' })
      expect(withExtra.extras[0].detail).toMatch(/2 of 4 characters have target proportions/)
      expect(withExtra.next).toEqual(without.next)
      expect(withExtra.progress).toBe(without.progress)
      expect(withExtra.steps).toEqual(without.steps)
    })
    it('shows done when every character has a profile', () => {
      expect(goldenPath({ ...base, shape: { characters: 2, withProfile: 2 } }).extras[0].state).toBe('done')
    })
  })
})
