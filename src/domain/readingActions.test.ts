import { describe, expect, it } from 'vitest'
import { addAssetsFromImages, nameFromFile, addCharacterAsset, addProductionAsset, addPropAsset, applyReadAge, ownImageSlot } from './readingActions'
import type { ExtractedAsset } from './productionStudio'

const base: ExtractedAsset[] = [
  { id: 'A1', name: 'AMINA', type: 'character', sceneIds: ['S1'], status: 'planned' },
  { id: 'P1', name: 'Solar compass', type: 'prop', sceneIds: ['S1'], status: 'planned' },
]

describe('reading actions', () => {
  it('adds a missed prop once', () => {
    const r = addPropAsset(base, '  rusty   key ', 'S1', 1)
    expect(r.added).toBe(true)
    expect(r.assets.at(-1)).toMatchObject({ name: 'rusty key', type: 'prop', sceneIds: ['S1'], status: 'planned' })
    expect(addPropAsset(r.assets, 'Rusty Key', 'S1').added).toBe(false)
  })
  it('refuses an empty name and an existing asset, with a reason', () => {
    expect(addPropAsset(base, '   ', 'S1').reason).toContain('name')
    expect(addPropAsset(base, 'solar compass', 'S1').reason).toContain('already')
  })
  it('uses a read age only on the matching character', () => {
    const r = applyReadAge(base, 'amina', 'Age 34')
    expect(r.applied).toBe(true)
    expect(r.assets.find((a) => a.id === 'A1')?.age).toBe('34')
    expect(r.assets.find((a) => a.id === 'P1')?.age).toBeUndefined()
    expect(applyReadAge(base, 'NOBODY', 'Age 9').applied).toBe(false)
  })
})

describe('adding a character from an image', () => {
  it('adds a character once and never duplicates a name', () => {
    const r = addCharacterAsset(base, '  Dominic ', 'S1', 5)
    expect(r.added).toBe(true)
    expect(r.asset).toMatchObject({ name: 'Dominic', type: 'character', status: 'planned', sceneIds: ['S1'] })
    expect(r.assets).toHaveLength(3)
    const again = addCharacterAsset(r.assets, 'dominic', 'S1', 6)
    expect(again.added).toBe(false)
    expect(again.assets).toBe(r.assets)
  })
  it('records a gender only when one is given, so the voice picker can match it', () => {
    expect(addCharacterAsset(base, 'Mara', 'S1', 1, 'female').asset?.gender).toBe('female')
    expect(addCharacterAsset(base, 'Mara', 'S1', 1).asset).not.toHaveProperty('gender')
    expect(addCharacterAsset(base, 'Mara', 'S1', 1, '  ').asset).not.toHaveProperty('gender')
  })
  it('asks for a name', () => {
    expect(addCharacterAsset(base, '   ', 'S1').added).toBe(false)
    expect(addCharacterAsset(base, '   ', 'S1').reason).toMatch(/name/i)
  })
})

describe('adding any kind of asset', () => {
  it('adds a set, a prop and a costume with their own ids, no gender, and never a duplicate name', () => {
    let r = addProductionAsset([], 'set', ' Rooftop  at night ', 'S1', 5, 'male')
    expect(r.asset).toMatchObject({ type: 'set', name: 'Rooftop at night', status: 'planned', sceneIds: ['S1'] })
    expect(r.asset?.gender).toBeUndefined()
    expect(r.asset?.id).toMatch(/^MANU-SET-001-/)
    r = addProductionAsset(r.assets, 'prop', 'Golden microphone', 'S1', 6)
    expect(r.asset?.id).toMatch(/^MANU-PROP-002-/)
    r = addProductionAsset(r.assets, 'costume', 'Pink puffer', 'S1', 7)
    expect(r.asset?.type).toBe('costume')
    const dup = addProductionAsset(r.assets, 'prop', 'golden MICROPHONE', 'S1', 8)
    expect(dup.added).toBe(false)
    expect(dup.reason).toMatch(/already in the asset list/)
  })
  it('asks for a name in the right words', () => {
    expect(addProductionAsset([], 'set', ' ', 'S1').reason).toMatch(/set's name/)
  })
  it('keeps the gender for a character', () => {
    expect(addProductionAsset([], 'character', 'Mara', 'S1', 1, 'female').asset?.gender).toBe('female')
  })
  it('puts your own image on the primary view of the first sheet for each kind, so it becomes the reference', async () => {
    const { primaryViewKeys, viewsFor, sheetTypesFor } = await import('./sheetSpecs')
    for (const kind of ['character', 'costume', 'prop', 'set'] as const) {
      const slot = ownImageSlot(kind)
      expect(primaryViewKeys).toContain(slot.viewKey)
      expect(sheetTypesFor(kind)).toContain(slot.sheetType)
      expect(viewsFor(kind, slot.sheetType as never).some((v) => v.key === slot.viewKey)).toBe(true)
    }
  })
})

describe('adding a folder of images at once', () => {
  it('names each asset from its file, cutting long generated names and dropping codes', () => {
    expect(nameFromFile('C:\\pics\\venomspur_front-view.png', [], 'character', 1)).toBe('Venomspur front view')
    expect(nameFromFile('/a/b/a_tall_pale_man_in_a_black_suit_standing_in_a_neon_alley_3f2a9c1e-1b2c-4d3e-8f90-123456789abc.png', [], 'character', 1).length).toBeLessThanOrEqual(40)
    expect(nameFromFile('/a/b/3f2a9c1e-1b2c-4d3e-8f90-123456789abc.webp', [], 'prop', 2)).toBe('Prop 2')
    expect(nameFromFile('/a/b/0001.png', [], 'set', 3)).toBe('Set 3')
    expect(nameFromFile('/a/b/silver microphone.JPG', [], 'prop', 1)).toBe('Silver microphone')
  })
  it('never repeats a name', () => {
    expect(nameFromFile('/a/microphone.png', ['Microphone'], 'prop', 1)).toBe('Microphone 2')
    expect(nameFromFile('/a/microphone.png', ['Microphone', 'microphone 2'], 'prop', 1)).toBe('Microphone 3')
  })
  it('adds one asset per image, in order, all of the chosen kind', () => {
    const out = addAssetsFromImages([], 'prop', ['/x/pen.png', '/x/pen.png', '/x/lamp.png', '/x/12345.png'], 'SCENE-001')
    expect(out.added.map((a) => a.name)).toEqual(['Pen', 'Pen 2', 'Lamp', 'Prop 4'])
    expect(out.added.every((a) => a.type === 'prop' && a.status === 'planned')).toBe(true)
    expect(new Set(out.assets.map((a) => a.id)).size).toBe(4)
  })
})
