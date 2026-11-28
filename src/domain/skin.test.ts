import { describe, expect, it } from 'vitest'
import { approveRevision, emptyVariations, type SkinSpec } from './variations'
import { approvedSkin, checkSkinSpec, isPhotorealStyle, newSkin, overridesOf, presetById, protectLine, readSkinSpec, recordSkin, skinLine, skinPromptFor, SKIN_PRESETS, withPreset } from './skin'
import { deriveFromLegacy, readVariations, variationsOf } from './variationMigration'
import { staleRevisions } from './variationGraph'
import { buildViewPrompt } from './sheetSpecs'
import { defaultStyleBible } from './visualDevelopment'
import { readLighting, lightingPresets } from './lighting'

const photo = { family: 'Realistic 3D', name: 'Photoreal cinematic CG', rendering: 'photographic' }

describe('presets are structured data, not prompt strings', () => {
  it('Natural, Clean portrait, Weathered and Custom each set the five essential controls as named levels', () => {
    expect(SKIN_PRESETS.map((p) => p.id)).toEqual(['natural', 'clean-portrait', 'weathered', 'custom'])
    for (const p of SKIN_PRESETS) expect(Object.keys(p.controls).sort(), p.id).toEqual(['fineFacialHair', 'retouching', 'surfaceFinish', 'textureDetail', 'tonalVariation'])
    expect(presetById('natural').controls).toEqual({ textureDetail: 'natural', surfaceFinish: 'natural', tonalVariation: 'natural', fineFacialHair: 'natural', retouching: 'none' })
    expect(presetById('weathered').controls).toMatchObject({ textureDetail: 'pronounced', surfaceFinish: 'matte', tonalVariation: 'varied' })
    expect(presetById('clean-portrait').controls.retouching).toBe('moderate')
  })
  it('Weathered changes surface only: it has no age field and the age is protected by default', () => {
    const w = withPreset(newSkin('C1'), 'weathered')
    expect(Object.keys(w)).not.toContain('age')
    expect(w.protect).toContain('age')
    expect(protectLine(w)).toMatch(/the apparent age/)
  })
  it('choosing a preset keeps what belongs to the person, and the person\'s changes show as overrides from the preset', () => {
    let s: SkinSpec = { ...newSkin('C1'), complexion: 'warm olive', makeup: 'light lip colour', marks: [{ what: 'a small scar', where: 'the left eyebrow' }], conditions: ['sweat'] }
    expect(overridesOf(s)).toEqual([])
    s = { ...s, retouching: 'light', textureDetail: 'pronounced' }
    expect(overridesOf(s).map((o) => `${o.label}: ${o.from} to ${o.to}`)).toEqual(['Texture detail: Natural to Pronounced', 'Retouching: None to Light'])
    const swapped = withPreset(s, 'clean-portrait')
    expect(swapped).toMatchObject({ preset: 'clean-portrait', retouching: 'moderate', complexion: 'warm olive', makeup: 'light lip colour', conditions: ['sweat'] })
    expect(swapped.marks).toEqual(s.marks)
    expect(overridesOf(swapped)).toEqual([])
  })
})

describe('what is kept apart', () => {
  it('complexion, undertone and makeup are quoted as written and nothing else changes with them', () => {
    const a = skinLine({ ...newSkin('C1'), complexion: 'deep brown', undertone: 'warm', makeup: 'none' })
    const b = skinLine({ ...newSkin('C1'), complexion: 'pale', undertone: 'cool', makeup: 'none' })
    expect(a).toContain('Complexion (the person\'s own description, keep it): deep brown.')
    expect(b).toContain('Complexion (the person\'s own description, keep it): pale.')
    expect(a.replace('deep brown', 'X').replace('warm', 'Y')).toBe(b.replace('pale', 'X').replace('cool', 'Y'))
    expect(a).not.toMatch(/healthy|unhealthy|sick|rough|coarse|aged|youthful|dirty|clean skin|personality|character/i)
  })
  it('skin wording never mentions lighting, grading or temporary conditions', () => {
    const line = skinLine({ ...newSkin('C1'), conditions: ['sweat', 'mud'], makeup: '' })
    expect(line).not.toMatch(/sweat|mud|wet|dirt|bruis/i)
    expect(line).not.toMatch(/key light|backlight|rim light|LUT|grade|grading|exposure|white balance|warm light/i)
    const lighting = JSON.stringify(readLighting(lightingPresets[0].record))
    expect(lighting).not.toMatch(/textureDetail|surfaceFinish|complexion/)
  })
  it('a temporary condition never edits the approved profile', () => {
    const made = recordSkin(emptyVariations(), newSkin('C1'), 'Mara', 'a'); if ('error' in made) throw new Error()
    const approved = approveRevision(made.state, made.ref)
    const before = structuredClone(approvedSkin(approved, 'C1'))
    const withSweat = recordSkin(approved, { ...newSkin('C1'), conditions: ['sweat'] }, 'Mara', 'b'); if ('error' in withSweat) throw new Error()
    expect(approvedSkin(withSweat.state, 'C1')).toEqual(before) // only a candidate exists until a person approves it
  })
  it('protected features and marks are said in the wording', () => {
    const s: SkinSpec = { ...newSkin('C1'), marks: [{ what: 'a mole', where: 'the right cheek' }, { what: 'a scar', where: 'the chin' }] }
    expect(skinLine(s)).toContain('Distinctive marks, keep each exactly where it is: a mole (the right cheek); a scar (the chin).')
    expect(protectLine(s)).toBe('Preserve the facial structure, the complexion, the apparent age, the expression, the hairstyle and the distinctive marks.')
    expect(skinLine(s)).toMatch(/do not smooth the skin into plastic.*no sharpening halos, no uniform shine/)
  })
})

describe('checks, in plain words', () => {
  it('a mark needs both what and where, and listed marks must stay protected', () => {
    expect(checkSkinSpec({ ...newSkin('C1'), marks: [{ what: 'a scar', where: '' }] })).toMatch(/needs both what it is and where it is/)
    expect(checkSkinSpec({ ...newSkin('C1'), marks: [{ what: 'a scar', where: 'chin' }], protect: ['age'] })).toMatch(/did not protect them/)
    expect(checkSkinSpec({ ...newSkin('C1'), marks: [{ what: 'a scar', where: 'chin' }] })).toBeUndefined()
    expect(checkSkinSpec(newSkin('C1'))).toBeUndefined()
  })
})

describe('only photorealistic characters get skin wording; other styles are untouched', () => {
  it('recognises photorealistic styles and not 2D or stylized ones', () => {
    expect(isPhotorealStyle(photo)).toBe(true)
    expect(isPhotorealStyle({ name: 'Naturalistic digital human' })).toBe(true)
    expect(isPhotorealStyle({ name: 'Live-action VFX integration' })).toBe(true)
    expect(isPhotorealStyle({ family: 'Family 3D', name: 'Family 3D Feature', rendering: 'stylized 3D' })).toBe(false)
    expect(isPhotorealStyle({ family: '2D', name: 'Ink and watercolour', rendering: 'flat 2D' })).toBe(false)
    expect(isPhotorealStyle(undefined)).toBe(false)
  })
  it('the skin wording reaches prompts only for an approved profile on a photorealistic character', () => {
    const made = recordSkin(emptyVariations(), newSkin('C1'), 'Mara', 'a'); if ('error' in made) throw new Error()
    expect(skinPromptFor(made.state, 'C1', photo)).toBeUndefined() // still a candidate
    const s = approveRevision(made.state, made.ref)
    expect(skinPromptFor(s, 'C1', photo)).toMatch(/^Skin and surface/)
    expect(skinPromptFor(s, 'C1', { family: 'Family 3D', name: 'Family 3D Feature' })).toBeUndefined()
    expect(skinPromptFor(s, 'C2', photo)).toBeUndefined()
    const view = { key: 'portrait', label: 'Portrait', aspect: '3:4', fullBody: false } as never
    const base = { style: defaultStyleBible, variant: 'Canonical', sheetType: 'Identity' as never, view }
    const ch = buildViewPrompt({ ...base, asset: { id: 'C1', name: 'Mara', type: 'character' } as never, skin: skinPromptFor(s, 'C1', photo) } as never)
    expect(ch).toMatch(/Skin and surface \(the desired look to attempt, not exact values\)/)
    const prop = buildViewPrompt({ ...base, asset: { id: 'P1', name: 'Staff', type: 'prop' } as never, skin: 'Skin and surface x' } as never)
    expect(prop).not.toMatch(/Skin and surface/)
    expect(buildViewPrompt({ ...base, asset: { id: 'C1', name: 'Mara', type: 'character' } as never } as never)).not.toMatch(/Skin and surface/)
  })
})

describe('records with history, older projects and damaged files', () => {
  it('a new profile for the same character is a new revision; only an approved one counts; nothing else is flagged', () => {
    const one = recordSkin(emptyVariations(), newSkin('C1'), 'Mara', 'a'); if ('error' in one) throw new Error()
    expect(approvedSkin(one.state, 'C1')).toBeUndefined()
    const s1 = approveRevision(one.state, one.ref)
    const two = recordSkin(s1, withPreset(newSkin('C1'), 'weathered'), 'Mara', 'b'); if ('error' in two) throw new Error()
    expect(two.ref).toEqual({ id: one.ref.id, revision: 2 })
    expect(approvedSkin(two.state, 'C1')?.spec.preset).toBe('natural')
    expect(approvedSkin(approveRevision(two.state, two.ref), 'C1')?.spec.preset).toBe('weathered')
    expect(staleRevisions(s1)).toEqual([])
    expect('error' in recordSkin(s1, { ...newSkin('C1'), marks: [{ what: 'x', where: '' }] }, 'M', 'c')).toBe(true)
  })
  it('a project saved before skin profiles has none, and opening it adds nothing', () => {
    const legacy = deriveFromLegacy({ analysis: { assets: [] } })
    expect(legacy.entities.filter((e) => e.kind === 'skin')).toHaveLength(0)
    expect(variationsOf({ analysis: { assets: [] } })).toEqual(legacy)
    expect(readVariations({ schema: 1, entities: [], counters: {} })).toEqual({ schema: 1, entities: [], counters: {} })
  })
  it('survives a save and reload exactly', () => {
    const spec: SkinSpec = { ...withPreset(newSkin('C1'), 'weathered'), complexion: 'warm olive', undertone: 'golden', makeup: 'none', marks: [{ what: 'a scar', where: 'left brow' }], regions: { forehead: { texture: 'subtle' }, hands: { finish: 'matte' } }, conditions: ['wet'], identityJobId: 'JOB-9', identityRevision: 2 }
    const made = recordSkin(emptyVariations(), spec, 'Mara', 'a'); if ('error' in made) throw new Error()
    const s = approveRevision(made.state, made.ref)
    expect(readVariations(JSON.parse(JSON.stringify(s)))?.entities[0].revisions[0].spec).toEqual(spec)
  })
  it('unreadable settings are dropped, unknown choices fall back to Natural, long text is capped', () => {
    expect(readSkinSpec({ preset: 'natural' })).toBeUndefined()
    expect(readSkinSpec('x')).toBeUndefined()
    const s = readSkinSpec({ characterId: 'C1', preset: 'glam', textureDetail: 'huge', surfaceFinish: 7, complexion: 'c'.repeat(900), marks: [{ what: 'a', where: '' }, { what: 'scar', where: 'chin' }, 'x'], regions: { forehead: { texture: 'wild' }, nose: { finish: 'dewy' }, elbow: { texture: 'subtle' } }, protect: ['age', 'age', 'soul'], conditions: ['sweat', 5], identityRevision: -3 })!
    expect(s).toMatchObject({ preset: 'natural', textureDetail: 'natural', surfaceFinish: 'natural', marks: [{ what: 'scar', where: 'chin' }], regions: { nose: { finish: 'dewy' } }, protect: ['age'], conditions: ['sweat'] })
    expect(s.complexion).toHaveLength(200)
    expect(s.identityRevision).toBeUndefined()
  })
})
