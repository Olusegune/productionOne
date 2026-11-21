import { describe, expect, it } from 'vitest'
import { applyCustomPreset, controlSpecs, createProfile, setControl, setLinked, specFor, stackedOf, tabOf, toCustomPreset } from './proportions'

describe('linked proportions', () => {
  it('moving the legs moves the total height by the same amount', () => {
    const p = createProfile('a')
    const next = setLinked(p, 'legLength', 4.2)
    expect(next.controls.legLength.value).toBe(4.2)
    expect(next.controls.heightInHeads.value).toBeCloseTo(stackedOf(next), 3)
    expect(next.controls.heightInHeads.value).toBeCloseTo(p.controls.heightInHeads.value + 1, 3)
  })
  it('moving the total height moves the legs and keeps the parts adding up', () => {
    const p = createProfile('a')
    const next = setLinked(p, 'heightInHeads', 8.5)
    expect(next.controls.heightInHeads.value).toBe(8.5)
    expect(next.controls.torsoLength.value).toBe(p.controls.torsoLength.value)
    expect(stackedOf(next)).toBeCloseTo(8.5, 2)
  })
  it('when the legs run out of range the torso takes the rest, and nothing leaves its range', () => {
    const p = setControl(setControl(setControl(createProfile('a'), 'legLength', 5.95), 'torsoLength', 1.5), 'neckLength', 0.05)
    const next = setLinked(p, 'heightInHeads', 10)
    for (const spec of controlSpecs) expect(next.controls[spec.id].value).toBeGreaterThanOrEqual(spec.min)
    expect(next.controls.legLength.value).toBeLessThanOrEqual(specFor('legLength').max)
    expect(next.controls.torsoLength.value).toBeGreaterThan(p.controls.torsoLength.value)
    expect(stackedOf(next)).toBeCloseTo(10, 2)
  })
  it('other controls are set on their own, and a bad number changes nothing', () => {
    const p = createProfile('a')
    expect(setLinked(p, 'handSize', 1).controls.heightInHeads.value).toBe(p.controls.heightInHeads.value)
    expect(setLinked(p, 'legLength', Number.NaN)).toBe(p)
  })
})

describe('your own presets', () => {
  it('saves every control by name and applies it to another character, keeping its story height', () => {
    const made = setControl(setControl(createProfile('a'), 'legLength', 4.5), 'shoulderWidth', 3.1)
    const saved = toCustomPreset(made, '  Hero  ')
    expect(saved.name).toBe('Hero')
    const other = { ...createProfile('b'), heightM: 1.9 }
    const applied = applyCustomPreset(other, saved)
    expect(applied.id).toBe('b')
    expect(applied.preset).toBe('custom')
    expect(applied.heightM).toBe(1.9)
    expect(applied.controls.legLength.value).toBe(4.5)
    expect(applied.controls.shoulderWidth.value).toBe(3.1)
  })
})

describe('control tabs', () => {
  it('puts body and limbs together, the face on its own, and shape language under advanced', () => {
    expect(tabOf(specFor('legLength'))).toBe('body')
    expect(tabOf(specFor('handSize'))).toBe('body')
    expect(tabOf(specFor('eyeSize'))).toBe('face')
    expect(tabOf(specFor('shapeLanguage'))).toBe('advanced')
  })
  it('names the height control so it is not mistaken for head size', () => {
    expect(specFor('heightInHeads').label).toBe('Total height')
    expect(specFor('heightInHeads').shown).toBe('head units')
  })
})
