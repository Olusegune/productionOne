import { describe, expect, it } from 'vitest'
import { addPropAsset, applyReadAge } from './readingActions'
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
