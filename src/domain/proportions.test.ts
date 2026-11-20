import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT, PROPORTION_SCHEMA_VERSION, addException, commit, controlIds, controlSpecs, createProfile, derivedValue, describe as describeProfile, newHistory, overrideCount,
  presets, ratios, readProfile, readProfiles, redo, removeException, resetControl, resetProfile, schematic, setControl, setPreset, setStylization, undo, warnings,
} from './proportions'

describe('control definitions', () => {
  it('every control has a documented range, default, unit and measurement', () => {
    expect(controlSpecs).toHaveLength(17)
    for (const c of controlSpecs) {
      expect(c.min).toBeLessThan(c.max)
      expect(c.default).toBeGreaterThanOrEqual(c.min)
      expect(c.default).toBeLessThanOrEqual(c.max)
      expect(c.measure.length).toBeGreaterThan(20)
      if (c.stylizedTarget !== undefined) { expect(c.stylizedTarget).toBeGreaterThanOrEqual(c.min); expect(c.stylizedTarget).toBeLessThanOrEqual(c.max) }
    }
  })
  it('lists the eight starter profiles, each within range', () => {
    expect(presets.map((p) => p.id)).toEqual(['natural', 'elongated', 'compact', 'large-headed', 'long-limbed', 'angular', 'rounded', 'custom'])
    for (const p of presets) for (const [id, v] of Object.entries(p.values)) { const spec = controlSpecs.find((c) => c.id === id)!; expect(v).toBeGreaterThanOrEqual(spec.min); expect(v).toBeLessThanOrEqual(spec.max) }
  })
})

describe('ratios', () => {
  it('Natural stacks to its own height and reads as an ordinary adult', () => {
    const p = createProfile('a')
    const r = ratios(p)
    expect(p.controls.heightInHeads.value).toBe(7.5)
    expect(r.stackedHeight).toBe(7.5)
    expect(r.legToTorso).toBeCloseTo(3.2 / 3, 2)
    expect(r.shoulderToHip).toBeCloseTo(1.3, 2)
    expect(r.eyesAcrossFace).toBeCloseTo(0.6, 2)
  })
  it('eyes across the face follow the eye size and spacing', () => {
    const p = setControl(setControl(createProfile('a'), 'eyeSize', 0.3), 'eyeSpacing', 2)
    expect(ratios(p).eyesAcrossFace).toBeCloseTo(1.2, 5)
  })
})

describe('linked controls (stylization)', () => {
  it('stylization moves the linked controls toward their targets and leaves the others', () => {
    const base = createProfile('a')
    const full = setStylization(base, 100)
    expect(full.controls.heightInHeads.value).toBe(5)
    expect(full.controls.eyeSize.value).toBe(0.3)
    expect(full.controls.shoulderWidth.value).toBe(base.controls.shoulderWidth.value)
    expect(full.controls.shapeLanguage.value).toBe(0)
    const half = setStylization(base, 50)
    expect(half.controls.heightInHeads.value).toBeCloseTo(6.25, 3)
  })
  it('an override is not moved by stylization, and reset hands the control back', () => {
    let p = setControl(createProfile('a'), 'eyeSize', 0.12)
    p = setStylization(p, 100)
    expect(p.controls.eyeSize).toMatchObject({ value: 0.12, source: 'override' })
    expect(p.controls.heightInHeads.value).toBe(5)
    p = resetControl(p, 'eyeSize')
    expect(p.controls.eyeSize).toMatchObject({ value: 0.3, source: 'default' })
  })
  it('choosing a preset keeps overrides, and reset profile removes every override and exception', () => {
    let p = setControl(createProfile('a'), 'handSize', 1.1)
    p = addException(p, 'handSize', 'Big hands are the joke')
    p = setPreset(p, 'compact')
    expect(p.controls.handSize.value).toBe(1.1)
    expect(p.controls.legLength.value).toBeLessThan(3.2)
    expect(overrideCount(p)).toBe(1)
    const reset = resetProfile(p)
    expect(overrideCount(reset)).toBe(0)
    expect(reset.exceptions).toEqual([])
    expect(reset.preset).toBe('compact')
  })
  it('clamps to the documented range and ignores non-numbers', () => {
    const p = createProfile('a')
    expect(setControl(p, 'eyeSize', 5).controls.eyeSize.value).toBe(0.4)
    expect(setControl(p, 'eyeSize', -5).controls.eyeSize.value).toBe(0.1)
    expect(setControl(p, 'eyeSize', Number.NaN)).toBe(p)
    expect(derivedValue('heightInHeads', 'natural', 500)).toBe(5)
  })
})

describe('warnings', () => {
  it('Natural and every starter profile (at several stylization amounts) have no conflicts', () => {
    for (const preset of presets) for (const s of [undefined, 0, 50, 100]) {
      const conflicts = warnings(createProfile('a', preset.id, s)).filter((w) => w.level === 'conflict')
      expect(conflicts, `${preset.id} @ ${s}`).toEqual([])
    }
  })
  it('warns, never blocks, and says which controls are involved', () => {
    const p = setControl(setControl(createProfile('a'), 'heightInHeads', 9.5), 'eyeSpacing', 2.2)
    const w = warnings(p)
    expect(w.some((x) => x.id === 'conflict-height' && x.controls.includes('legLength'))).toBe(true)
    expect(w.some((x) => x.id === 'extreme-eyeSpacing')).toBe(true)
    expect(p.controls.heightInHeads.value).toBe(9.5)
  })
  it('detects eyes that do not fit and arms too short for the body', () => {
    expect(warnings(setControl(setControl(createProfile('a'), 'eyeSize', 0.35), 'eyeSpacing', 1.5)).some((w) => w.id === 'conflict-eyes')).toBe(true)
    expect(warnings(setControl(createProfile('a'), 'armLength', 1.8)).some((w) => w.id === 'conflict-reach')).toBe(true)
  })
  it('a deliberate exception hides that warning, and removing it brings it back', () => {
    let p = setControl(createProfile('a'), 'eyeSize', 0.4)
    expect(warnings(p).some((w) => w.id === 'extreme-eyeSize')).toBe(true)
    p = addException(p, 'eyeSize', 'Huge eyes are the design')
    expect(warnings(p).some((w) => w.id === 'extreme-eyeSize')).toBe(false)
    expect(removeException(p, 'eyeSize').exceptions).toEqual([])
    expect(warnings(removeException(p, 'eyeSize')).some((w) => w.id === 'extreme-eyeSize')).toBe(true)
  })
})

describe('undo and redo', () => {
  it('walks back and forward through at least 50 steps', () => {
    let h = newHistory(createProfile('a'))
    for (let i = 0; i < 60; i++) h = commit(h, setControl(h.present, 'eyeSize', 0.1 + i * 0.004))
    expect(h.past.length).toBe(60)
    const final = h.present
    for (let i = 0; i < 55; i++) h = undo(h)
    expect(h.present.controls.eyeSize.value).toBeCloseTo(0.1 + 4 * 0.004, 3)
    for (let i = 0; i < 55; i++) h = redo(h)
    expect(h.present).toBe(final)
  })
  it('keeps at most the limit, drops redo after a new edit, and ignores a no-op', () => {
    let h = newHistory(0)
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = commit(h, i)
    expect(h.past.length).toBe(HISTORY_LIMIT)
    expect(HISTORY_LIMIT).toBeGreaterThanOrEqual(50)
    h = undo(h)
    h = commit(h, 999)
    expect(h.future).toEqual([])
    expect(commit(h, 999)).toBe(h)
    expect(undo(newHistory(1)).present).toBe(1)
    expect(redo(newHistory(1)).present).toBe(1)
  })
})

describe('schematic preview', () => {
  it('is deterministic: the same profile always gives the same shapes', () => {
    expect(schematic(createProfile('a', 'angular'))).toEqual(schematic(createProfile('b', 'angular')))
  })
  it('a longer leg makes the drawing taller, and the head stays one unit tall', () => {
    const a = schematic(createProfile('a'))
    const longLegs = schematic(setControl(createProfile('a'), 'legLength', 4.5))
    expect(longLegs.height).toBeGreaterThan(a.height)
    expect(longLegs.shapes.find((s) => s.id === 'head')!.h).toBe(a.unitPx)
  })
  it('redraws in well under a frame (16 ms)', () => {
    const p = createProfile('a', 'elongated')
    schematic(p)
    const start = performance.now()
    for (let i = 0; i < 500; i++) schematic(setControl(p, 'legLength', 2 + (i % 40) / 10))
    expect((performance.now() - start) / 500).toBeLessThan(16)
  })
})

describe('reading saved data', () => {
  it('a missing or damaged profile becomes the documented defaults', () => {
    expect(readProfile(undefined, 'x')).toEqual(createProfile('x'))
    expect(readProfile('junk', 'x')).toEqual(createProfile('x'))
    const p = readProfile({ preset: 'nonsense', stylization: 'lots', controls: { eyeSize: { value: 9, source: 'override' }, handSize: { value: 'big', source: 'override' }, fake: { value: 1, source: 'override' } }, exceptions: [{ control: 'nope' }, { control: 'eyeSize', note: 'ok' }] }, 'x')
    expect(p.preset).toBe('natural')
    expect(p.schemaVersion).toBe(PROPORTION_SCHEMA_VERSION)
    expect(p.controls.eyeSize).toMatchObject({ value: 0.4, source: 'override' })
    expect(p.controls.handSize.source).toBe('default')
    expect(p.exceptions).toEqual([{ control: 'eyeSize', note: 'ok' }])
    expect(controlIds.every((id) => p.controls[id])).toBe(true)
  })
  it('round-trips a profile through JSON unchanged', () => {
    let p = setStylization(setPreset(createProfile('a'), 'rounded'), 70)
    p = addException(setControl(p, 'armLength', 3.9), 'armLength', 'Long arms on purpose')
    expect(readProfile(JSON.parse(JSON.stringify(p)), 'a')).toEqual(p)
  })
  it('a project with no profiles reads as none', () => {
    expect(readProfiles(undefined)).toEqual({})
    expect(Object.keys(readProfiles({ 'CHAR-1': { preset: 'compact' } }))).toEqual(['CHAR-1'])
  })
})

describe('words for prompts', () => {
  it('adds nothing for no profile or Natural, and names what differs otherwise', () => {
    expect(describeProfile(undefined)).toBe('')
    expect(describeProfile(createProfile('a'))).toBe('')
    const text = describeProfile(createProfile('a', 'large-headed'))
    expect(text).toMatch(/large head on a small body/)
    expect(text).toMatch(/large eyes/)
  })
})

describe("documentation matches the code", () => {
  it("docs/design/proportions.md lists every control and starter profile with its numbers", async () => {
    const { readFileSync } = await import("node:fs")
    const doc = readFileSync("docs/design/proportions.md", "utf8")
    for (const c of controlSpecs) expect(doc).toContain(`| \`${c.id}\` | ${c.label} | ${c.unit} | ${c.min} | ${c.max} | ${c.default} |`)
    for (const p of presets) expect(doc).toContain(`| ${p.label} | ${p.stylization} |`)
  })
})
