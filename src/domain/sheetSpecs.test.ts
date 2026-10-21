import { describe, expect, it } from 'vitest'
import { buildViewPrompt, outputName, viewsFor } from './sheetSpecs'
import { defaultStyleBible } from './visualDevelopment'

const amina = { id: 'CHAR-001', name: 'Amina', type: 'character' as const }

describe('sheet specs', () => {
  it('turnaround is five separate full-body views', () => {
    const views = viewsFor('character', 'Turnaround')
    expect(views.map((v) => v.key)).toEqual(['front', 'three-quarter-front', 'side', 'three-quarter-rear', 'rear'])
    expect(views.every((v) => v.fullBody)).toBe(true)
  })
  it('expressions are eight large close-ups whose wording changes with intensity', () => {
    const subtle = viewsFor('character', 'Expressions', 'subtle')
    const loud = viewsFor('character', 'Expressions', 'exaggerated')
    expect(subtle).toHaveLength(8)
    expect(new Set(subtle.map((v) => v.key)).size).toBe(8)
    expect(subtle[1].instruction).not.toBe(loud[1].instruction)
    expect(subtle.every((v) => !v.fullBody && v.aspect === '1:1')).toBe(true)
  })
  it('covers props and sets, and returns nothing for an unplanned combination', () => {
    expect(viewsFor('prop', 'Multi-view')).toHaveLength(4)
    expect(viewsFor('set', 'Layout')[0].label).toBe('Floor plan')
    expect(viewsFor('prop', 'Turnaround')).toEqual([])
  })
  it('writes prompts that demand identity, neutral light, no text and no cropping', () => {
    const view = viewsFor('character', 'Turnaround')[0]
    const prompt = buildViewPrompt({ style: defaultStyleBible, asset: amina, variant: 'Weathered jacket', sheetType: 'Turnaround', view })
    expect(prompt).toContain('Amina')
    expect(prompt).toContain('Weathered jacket')
    expect(prompt).toContain('no text')
    expect(prompt).toContain('nothing cropped')
    expect(prompt).toContain('same face')
  })
  it('names files safely and by revision', () => {
    const view = viewsFor('character', 'Turnaround')[1]
    expect(outputName(amina, 'Dust-worn / jacket', 'Turnaround', view, 2)).toBe('CHAR-001_Amina_Dust-worn-jacket_Turnaround_three-quarter-front_v02')
  })
})
