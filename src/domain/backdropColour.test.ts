import { describe, expect, it } from 'vitest'
import { describeColour } from './backdropColour'
import { backdropChoices, backdropLine, buildViewPrompt, viewsFor } from './sheetSpecs'
import { defaultStyleBible } from './visualDevelopment'

describe('naming a backdrop colour', () => {
  it.each([
    ['#1e4a52', 'dark teal'],
    ['#808080', 'grey'],
    ['#202020', 'very dark charcoal grey'],
    ['#ffffff', 'white'],
    ['#000000', 'black'],
    ['#b03030', 'red'],
    ['#2a3f8f', 'blue'],
    ['#d9c27a', 'light yellow'],
  ])('%s is %s', (hex, word) => {
    expect(describeColour(hex)).toBe(word)
  })
  it('says nothing for a value that is not a colour', () => {
    expect(describeColour('teal')).toBe('')
    expect(describeColour('')).toBe('')
  })
})

describe('the "same as my front view" backdrop', () => {
  it('is offered next to the flat choices', () => {
    expect(backdropChoices.map((b) => b.value)).toEqual(['gray', 'white', 'match', 'front'])
  })
  it('asks for the front view\'s own colour and lighting, not a flat field, and carries the measured colour', () => {
    const line = backdropLine('front', true, '#1e4a52')
    expect(line).toMatch(/exactly the background of the attached reference image/)
    expect(line).toMatch(/dark teal, about #1e4a52/)
    expect(line).not.toMatch(/mid-grey|no gradient|no vignette/)
  })
  it('works without a measured colour, and falls back to flat grey when there is no front view to match', () => {
    expect(backdropLine('front', true)).not.toMatch(/about #/)
    expect(backdropLine('front', false, '#1e4a52')).toMatch(/mid-grey/)
  })
  it('reaches the prompt of a view', () => {
    const view = viewsFor('character', 'Turnaround', 'moderate')[1]
    const prompt = buildViewPrompt({ style: defaultStyleBible, asset: { id: 'C1', name: 'VENOMSPUR', type: 'character' }, variant: 'Canonical', sheetType: 'Turnaround', view, anchored: true, backdrop: 'front', backdropHex: '#1e4a52' })
    expect(prompt).toMatch(/dark teal, about #1e4a52/)
    expect(prompt).not.toMatch(/mid-grey field/)
  })
})
