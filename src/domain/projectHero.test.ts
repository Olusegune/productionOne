import { describe, expect, it } from 'vitest'
import { heroSummary } from './projectHero'
import type { GoldenPathInput } from './goldenPath'

const base: GoldenPathInput = { hasScript: true, assetCount: 8, styleLocked: false, outputsCount: 0, approvedCount: 0, jobsActive: 0, storyboards: false, shotCount: 0, ready: false }

describe('heroSummary', () => {
  it('asks for a script first', () => {
    const h = heroSummary({ ...base, hasScript: false, assetCount: 0 })
    expect(h.button).toBe('Add your script')
    expect(h.status).toMatch(/no script yet/i)
  })
  it('names the next step on the button and counts approvals in the status', () => {
    const h = heroSummary({ ...base, approvedCount: 3 })
    expect(h.button).toBe('Continue: Approve a visual style')
    expect(h.status).toBe('3 of 8 assets approved')
    expect(h.next?.workspace).toBe('Design')
  })
  it('mentions running requests', () => {
    expect(heroSummary({ ...base, styleLocked: true, jobsActive: 1 }).status).toBe('0 of 8 assets approved · 1 request running')
    expect(heroSummary({ ...base, styleLocked: true, jobsActive: 3 }).status).toContain('3 requests running')
  })
  it('reaches 100 percent and points at Deliver when everything is done', () => {
    const h = heroSummary({ ...base, styleLocked: true, outputsCount: 8, approvedCount: 8, ready: true })
    expect(h.percent).toBe(100)
    expect(h.next).toBeNull()
    expect(h.button).toBe('Open Deliver')
  })
  it('keeps the percent within 0 to 100 and grows with progress', () => {
    const a = heroSummary(base).percent, b = heroSummary({ ...base, styleLocked: true, outputsCount: 8 }).percent
    expect(a).toBeGreaterThanOrEqual(0)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThanOrEqual(100)
  })
})

describe('goldenPath for a project with no script', () => {
  it('says an empty project needs assets, not analyzed assets, and an image-only project is past Create and Analyze', async () => {
    const { goldenPath } = await import('./goldenPath')
    const empty = goldenPath({ ...base, hasScript: false, assetCount: 0 })
    expect(empty.steps.find((s) => s.id === 'create')!.detail).toMatch(/add your own images/)
    expect(empty.steps.find((s) => s.id === 'generate')!.detail).toMatch(/^Needs assets/)
    const images = goldenPath({ ...base, hasScript: false, assetCount: 1 })
    expect(images.steps.slice(0, 2).map((s) => s.state)).toEqual(['done', 'done'])
    expect(images.steps[1].detail).toBe('1 asset added')
    expect(images.next?.id).toBe('design')
  })
})
