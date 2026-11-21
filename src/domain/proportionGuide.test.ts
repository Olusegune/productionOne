import { describe, expect, it } from 'vitest'
import { GUIDE_WIDTH, guideLine, guideName, guideSvg } from './proportionGuide'
import { createProfile, setControl, setLinked } from './proportions'
import { buildViewPrompt, sheetTypesFor, viewsFor } from './sheetSpecs'
import { defaultStyleBible } from './visualDevelopment'

describe('the proportion guide', () => {
  it('is the same image for the same proportions and a different one when they change', () => {
    const a = createProfile('a')
    expect(guideSvg(a)).toBe(guideSvg(createProfile('b')))
    const longer = setLinked(a, 'legLength', 4.8)
    expect(guideSvg(longer)).not.toBe(guideSvg(a))
    expect(guideName(longer)).not.toBe(guideName(a))
    expect(guideName(a)).toMatch(/^guide_pp1-[0-9a-f]{8}\.png$/)
  })
  it('is a plain grey figure on white with a numbered ruler, in a known width', () => {
    const svg = guideSvg(createProfile('a'))
    expect(svg).toContain(`width="${GUIDE_WIDTH}"`)
    expect(svg).toContain('fill="#ffffff"')
    expect((svg.match(/<text /g) ?? []).length).toBeGreaterThanOrEqual(7)
    expect(svg).not.toMatch(/<image|href=/)
  })
  it('shows the hand size and the leg length in the drawing', () => {
    const base = guideSvg(createProfile('a'))
    expect(guideSvg(setControl(createProfile('a'), 'handSize', 1.3))).not.toBe(base)
    expect(guideSvg(setControl(createProfile('a'), 'legLength', 5))).not.toBe(base)
  })
})

describe('the guide in the prompt', () => {
  const asset = { id: 'C1', name: 'DOMINIC', type: 'character' as const }
  const view = viewsFor('character', sheetTypesFor('character')[0])[0]
  const base = { style: defaultStyleBible, asset, variant: 'Canonical', sheetType: sheetTypesFor('character')[0], view, backdrop: 'gray' as const }
  it('says to take only the proportions from it, and only when proportions are set and the guide is attached', () => {
    const words = 'Body and face proportions (target, keep the same in every view): long legs.'
    expect(buildViewPrompt({ ...base, proportions: words, guide: true })).toContain(guideLine)
    expect(buildViewPrompt({ ...base, proportions: words })).not.toContain(guideLine)
    expect(buildViewPrompt({ ...base, guide: true })).not.toContain(guideLine)
    expect(guideLine).toMatch(/not a picture of the character/)
  })
  it('never appears for a prop', () => {
    const prop = { id: 'P1', name: 'LAMP', type: 'prop' as const }
    const pv = viewsFor('prop', sheetTypesFor('prop')[0])[0]
    expect(buildViewPrompt({ ...base, asset: prop, sheetType: sheetTypesFor('prop')[0], view: pv, proportions: 'x', guide: true })).not.toContain(guideLine)
  })
})
