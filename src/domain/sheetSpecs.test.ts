import { describe, expect, it } from 'vitest'
import { aspectCss, buildViewPrompt, identityFacts, outputName, shapeFor, viewsFor } from './sheetSpecs'
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
  it('builds expression views from the story plan with its own intensities and reasons', () => {
    const views = viewsFor('character', 'Expressions', 'moderate', [
      { emotion: 'neutral', intensity: 'subtle', peak: 1, sceneIds: [], why: 'Baseline reference for the face.' },
      { emotion: 'fear', intensity: 'moderate', peak: 5, sceneIds: ['SCENE-001'], why: 'Scene 1: I am afraid.' },
    ])
    expect(views.map((v) => v.key)).toEqual(['neutral-subtle', 'fear-moderate'])
    expect(views[1].instruction).toContain('Scene 1')
    expect(views[0].instruction).not.toContain('Story moment')
  })
  it('covers props and sets, and returns nothing for an unplanned combination', () => {
    expect(viewsFor('prop', 'Multi-view')).toHaveLength(4)
    expect(viewsFor('set', 'Layout')[0].label).toBe('Floor plan')
    expect(viewsFor('prop', 'Turnaround')).toEqual([])
  })
  it('tells the model the reference image is the same subject only when one is attached', () => {
    const view = viewsFor('character', 'Turnaround')[1]
    const base = { style: defaultStyleBible, asset: amina, variant: 'Canonical', sheetType: 'Turnaround' as const, view }
    expect(buildViewPrompt({ ...base, anchored: true })).toMatch(/attached reference image is this exact same subject/)
    expect(buildViewPrompt(base)).not.toMatch(/attached reference image/)
  })
  it('writes prompts that demand identity, neutral light, no text and no cropping', () => {
    const view = viewsFor('character', 'Turnaround')[0]
    const prompt = buildViewPrompt({ style: defaultStyleBible, asset: amina, variant: 'Weathered jacket', sheetType: 'Turnaround', view })
    expect(prompt).toContain('Amina')
    expect(prompt).toContain('Weathered jacket')
    expect(prompt).toContain('no text')
    expect(prompt).toMatch(/ONE single image/)
    expect(prompt).toMatch(/grid, contact sheet, collage/)
    expect(prompt).toContain('nothing cropped')
    expect(prompt).toContain('same face')
  })
  it('names files safely and by revision', () => {
    const view = viewsFor('character', 'Turnaround')[1]
    expect(outputName(amina, 'Dust-worn / jacket', 'Turnaround', view, 2)).toBe('CHAR-001_Amina_Dust-worn-jacket_Turnaround_three-quarter-front_v02')
  })

  it('uses one flat backdrop rule, by default flat grey, and honours white or match-the-reference', () => {
    const view = viewsFor('character', 'Turnaround')[1]
    const base = { style: defaultStyleBible, asset: amina, variant: 'Canonical', sheetType: 'Turnaround' as const, view }
    expect(buildViewPrompt(base)).toMatch(/flat, uniform neutral mid-grey field \(about 18% grey\)/)
    expect(buildViewPrompt({ ...base, anchored: true })).toMatch(/mid-grey/)
    expect(buildViewPrompt({ ...base, backdrop: 'white' })).toMatch(/pure-white field/)
    expect(buildViewPrompt({ ...base, anchored: true, backdrop: 'match' })).toMatch(/same single flat, plain tone as the attached reference image/)
    expect(buildViewPrompt({ ...base, anchored: false, backdrop: 'match' }), 'nothing to match without a reference').toMatch(/mid-grey/)
    expect(buildViewPrompt(base)).toMatch(/no floor, no wall, no horizon, and no cast or contact shadow/)
  })

  it('uses a chosen shape for a sheet and falls back to the default of each view', () => {
    const view = viewsFor('character', 'Turnaround')[0]
    expect(view.aspect).toBe('3:4')
    expect(shapeFor(view)).toBe('3:4')
    expect(shapeFor(view, '16:9')).toBe('16:9')
    expect(shapeFor(view, '')).toBe('3:4')
    expect(shapeFor(view, '7:5'), 'a shape no provider here accepts is ignored').toBe('3:4')
    expect(shapeFor(viewsFor('prop', 'Multi-view')[0])).toBe('4:3')
    expect(shapeFor(viewsFor('set', 'Establishing')[0])).toBe('16:9')
  })
})

describe('the never clause', () => {
  it('is written into the identity facts as the person wrote it, alone or with the other facts', () => {
    expect(identityFacts({ type: 'character', never: 'never pale porcelain skin.  ' })).toBe('Must never drift: never pale porcelain skin.')
    expect(identityFacts({ type: 'character', age: '40', gender: 'male', never: 'a teeth-showing smile' })).toBe('Confirmed character identity: age 40, male. Must never drift: a teeth-showing smile.')
    expect(identityFacts({ type: 'character', age: '40' })).toBe('Confirmed character identity: age 40.')
    expect(identityFacts({ type: 'character', never: '   ' })).toBe('')
  })
  it('is ignored for props and sets, and reaches every character prompt', () => {
    expect(identityFacts({ type: 'prop', never: 'rust' })).toBe('')
    const view = viewsFor('character', 'Turnaround')[0]
    const prompt = buildViewPrompt({ style: defaultStyleBible, asset: { ...amina, never: 'never a smile showing teeth' }, variant: 'Canonical', sheetType: 'Turnaround', view })
    expect(prompt).toMatch(/Must never drift: never a smile showing teeth\./)
  })
})

describe('thumbnail shape', () => {
  it('turns a shape into a CSS aspect-ratio and falls back to portrait for anything odd', () => {
    expect(aspectCss('16:9')).toBe('16 / 9')
    expect(aspectCss('3:4')).toBe('3 / 4')
    expect(aspectCss('1:1')).toBe('1 / 1')
    expect(aspectCss('banana')).toBe('3 / 4')
    expect(aspectCss('16:9; background:red')).toBe('3 / 4')
    expect(aspectCss('')).toBe('3 / 4')
  })
})

describe('sets are drawn full frame', () => {
  it('a set prompt asks for the place edge to edge, not a flat grey field; a character still gets the flat backdrop', () => {
    const style = defaultStyleBible
    const view = { key: 'establishing', label: 'Establishing view', instruction: 'Wide view.', aspect: '16:9', fullBody: false } as never
    const set = buildViewPrompt({ style, asset: { id: 'S', name: 'OFFICE', type: 'set' }, variant: 'Canonical', sheetType: 'Establishing' as never, view })
    expect(set).toMatch(/fills the entire frame edge to edge/)
    expect(set).not.toMatch(/flat, uniform neutral mid-grey/)
    const person = buildViewPrompt({ style, asset: { id: 'C', name: 'AMINA', type: 'character' }, variant: 'Canonical', sheetType: 'Turnaround' as never, view })
    expect(person).toMatch(/mid-grey field/)
  })
})
