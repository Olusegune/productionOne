import { describe, expect, it } from 'vitest'
import { applyCustomPreset, controlSpecs, createProfile, describe as describeProportions, schematic, setControl, setStylization, setLinked, specFor, stackedOf, tabOf, toCustomPreset } from './proportions'

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

describe('every control shows in the drawing', () => {
  it('changing any control other than the target height changes the figure', () => {
    const base = createProfile('a')
    const before = JSON.stringify(schematic(base))
    const dead: string[] = []
    for (const spec of controlSpecs) {
      if (spec.id === 'heightInHeads') continue
      const moved = setControl(base, spec.id, spec.default === spec.max ? spec.min : spec.max)
      if (JSON.stringify(schematic(moved)) === before) dead.push(spec.id)
    }
    expect(dead).toEqual([])
  })
  it('a larger hand is drawn longer and thicker, and takes its length from the arm', () => {
    const small = schematic(setControl(createProfile('a'), 'handSize', 0.5))
    const large = schematic(setControl(createProfile('a'), 'handSize', 1.2))
    const hand = (art: ReturnType<typeof schematic>) => art.shapes.find((s) => s.id === 'hand-r')!
    expect(((hand(large).y2 ?? 0) - hand(large).y)).toBeGreaterThan(((hand(small).y2 ?? 0) - hand(small).y))
    expect(hand(large).weight!).toBeGreaterThan(hand(small).weight!)
    expect(hand(large).y2).toBeCloseTo(hand(small).y2!, 1)
  })
  it('the rounded-to-angular control softens or sharpens the corners', () => {
    const corner = (score: number) => schematic(setControl(createProfile('a'), 'shapeLanguage', score)).shapes.find((s) => s.id === 'torso')!.corner!
    expect(corner(-100)).toBeGreaterThan(corner(0))
    expect(corner(0)).toBeGreaterThan(corner(100))
  })
})

describe('the proportions as words for a prompt', () => {
  it('grades how far a control is from typical, and says nothing for a typical figure', () => {
    const base = createProfile('a')
    expect(describeProportions(base)).toBe('')
    const long = describeProportions(setControl(base, 'legLength', 4))
    const veryLong = describeProportions(setControl(base, 'legLength', 5.6))
    expect(long).toMatch(/\blong legs\b/)
    expect(long).not.toMatch(/very long legs/)
    expect(veryLong).toMatch(/very long legs|extremely long legs/)
  })
  it('gives the same facts once as numbers in head units, for models that can use them', () => {
    const text = describeProportions(setControl(createProfile('a'), 'legLength', 4.4))
    expect(text).toMatch(/In head units \(one head = chin to crown\): [\d.]+ tall, legs 4\.4, arms 3, shoulders 2\.6 head widths wide\./)
  })
  it('says when the style is stylized, the legs outrun the torso, and the story height is not the usual one', () => {
    const p = { ...setControl(setStylization(createProfile('a'), 70), 'legLength', 4.8), heightM: 1.95 }
    const text = describeProportions(p)
    expect(text).toMatch(/strongly stylized/)
    expect(text).toMatch(/legs clearly longer than the torso/)
    expect(text).toMatch(/about 1\.95 m tall in the story/)
  })
  it('names the face and hands, not only the body', () => {
    const p = setControl(setControl(setControl(createProfile('a'), 'handSize', 1.2), 'noseLength', 0.38), 'jawChin', 0.5)
    const text = describeProportions(p)
    expect(text).toMatch(/large hands/)
    expect(text).toMatch(/long nose/)
    expect(text).toMatch(/pointed chin/)
  })
  it('keeps the prefix that the storyboard prompt strips and the whole text on one line', () => {
    const text = describeProportions(createProfile('a', 'large-headed'))
    expect(text.startsWith('Body and face proportions (target, keep the same in every view): ')).toBe(true)
    expect(text).not.toMatch(/\n/)
  })
})

describe('the words never contradict themselves', () => {
  it('when the Total height control disagrees with the parts, the prompt follows the parts', () => {
    const p = setControl(setControl(createProfile('a'), 'legLength', 4.9), 'armLength', 4.0)
    // parts: 1 + 0.3 + 3 + 4.9 = 9.2 head units, while the control still says 7.5
    const text = describeProportions(p)
    expect(text).toMatch(/9\.2 tall/)
    expect(text).not.toMatch(/7\.5 tall/)
    expect(text).toMatch(/very tall, slender build \(about 9\.2 heads tall\)/)
  })
  it('when they agree, the control is used as it is', () => {
    expect(describeProportions(setLinked(createProfile('a'), 'legLength', 4.9))).toMatch(/9\.2 tall/)
  })
})
