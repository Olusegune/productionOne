import { describe, expect, it } from 'vitest'
import { parseStory } from './story'
import { explainStory } from './explain'

const script = `INT. KITCHEN - DAY

MARA stands at the stove. DEV watches from the door.

MARA
Dinner is ready.

DEV
I know.

MARA
Then sit.

EXT. YARD

A stranger waits.
`
describe('explainStory', () => {
  const ex = explainStory(parseStory(script))
  it('explains the detected format', () => { expect(ex.findings[0].reason.length).toBeGreaterThan(0); expect(ex.format).toMatch(/screenplay/i) })
  it('marks repeat speakers as high confidence', () => { expect(ex.findings.find((f) => f.subject === 'MARA')?.confidence).toBe('high') })
  it('flags scenes with a missing time of day and sorts low-confidence first', () => {
    const scene = ex.findings.find((f) => f.kind === 'scene')
    expect(scene?.reason).toMatch(/time of day/)
    expect(ex.needsReview).toBeGreaterThan(0)
    expect(ex.findings[0].confidence).not.toBe('high')
  })
})
