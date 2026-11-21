import { describe, expect, it } from 'vitest'
import { proportionStatus } from './proportionStatus'
import { createProfile, setLinked } from './proportions'

describe('the proportions line on the Sheets tab', () => {
  it('says plainly when none are set', () => {
    expect(proportionStatus(undefined, 0)).toMatchObject({ kind: 'none' })
    expect(proportionStatus(undefined, 0).text).toMatch(/pictures are made without them/)
  })
  it('says which are applied and how tall', () => {
    const s = proportionStatus(setLinked(createProfile('a', 'elongated'), 'legLength', 4.8), 0)
    expect(s.kind).toBe('applied')
    expect(s.text).toMatch(/Elongated, \d\.\d+ head units tall/)
  })
  it('warns when approved pictures were made with earlier proportions, and says what to do', () => {
    const s = proportionStatus(createProfile('a'), 3)
    expect(s.kind).toBe('stale')
    expect(s.text).toMatch(/3 approved pictures were made with earlier proportions/)
    expect(s.text).toMatch(/Apply and make a new front view/)
    expect(proportionStatus(createProfile('a'), 1).text).toMatch(/1 approved picture was made/)
  })
})
