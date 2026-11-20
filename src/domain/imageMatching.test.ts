import { describe, expect, it } from 'vitest'
import { matchAssetByFileName, planImageAssets } from './readingActions'
import type { ExtractedAsset } from './productionStudio'

const a = (id: string, name: string, type: ExtractedAsset['type'] = 'character'): ExtractedAsset => ({ id, name, type, sceneIds: ['SC-1'], status: 'planned' })
const cast = [a('C1', 'MARCUS'), a('C2', 'AMINA'), a('C3', 'ANN'), a('C4', 'ANNABEL'), a('P1', 'LANTERN', 'prop'), a('S1', 'OLD HARBOUR', 'set')]

describe('matching a picture to something already in the project', () => {
  it('matches by whole words in the file name, case and punctuation aside', () => {
    expect(matchAssetByFileName(cast, 'character', 'C:/pics/marcus.png')?.id).toBe('C1')
    expect(matchAssetByFileName(cast, 'character', 'C:/pics/Marcus_front-v2.JPG')?.id).toBe('C1')
    expect(matchAssetByFileName(cast, 'character', 'C:/pics/amina and the sea.webp')?.id).toBe('C2')
  })
  it('does not match part of a word, another kind, or nothing', () => {
    expect(matchAssetByFileName(cast, 'character', 'C:/pics/annabel.png')?.id).toBe('C4')
    expect(matchAssetByFileName(cast, 'character', 'C:/pics/annabelle.png')).toBeUndefined()
    expect(matchAssetByFileName(cast, 'prop', 'C:/pics/marcus.png')).toBeUndefined()
    expect(matchAssetByFileName(cast, 'character', 'C:/pics/IMG_0041.png')).toBeUndefined()
  })
  it('matches multi-word names and prefers the longest name', () => {
    expect(matchAssetByFileName(cast, 'set', 'C:/pics/old_harbour_wide.png')?.id).toBe('S1')
    const both = [a('X1', 'MARCUS'), a('X2', 'MARCUS REED')]
    expect(matchAssetByFileName(both, 'character', 'C:/p/marcus reed.png')?.id).toBe('X2')
  })
})

describe('planning where pictures go', () => {
  it('attaches a matching picture to the existing item instead of making a duplicate, and adds the rest as new items', () => {
    const plan = planImageAssets(cast, 'character', ['C:/p/marcus.png', 'C:/p/Odette.png'], 'SC-1', () => false, 1)
    expect(plan.targets.map((t) => [t.asset.name, t.matched])).toEqual([['MARCUS', true], ['Odette', false]])
    expect(plan.assets).toHaveLength(cast.length + 1)
    expect(plan.assets.filter((x) => x.name.toLowerCase().startsWith('marcus'))).toHaveLength(1)
  })
  it('never gives an item a second approved picture, and never replaces one', () => {
    const plan = planImageAssets(cast, 'character', ['C:/p/marcus.png'], 'SC-1', (id) => id === 'C1')
    expect(plan.targets).toEqual([])
    expect(plan.skipped.map((s) => s.asset.name)).toEqual(['MARCUS'])
    expect(plan.assets).toEqual(cast)
  })
  it('two pictures for the same item: the first is attached, the second is left out', () => {
    const plan = planImageAssets(cast, 'character', ['C:/p/amina_front.png', 'C:/p/amina_side.png'], 'SC-1', () => false)
    expect(plan.targets).toHaveLength(1)
    expect(plan.skipped).toHaveLength(1)
  })
  it('with nothing in the project every picture is a new item named from its file (as before)', () => {
    const plan = planImageAssets([], 'prop', ['C:/p/Venom_spur-front.png', 'C:/p/IMG_1.png'], 'SC-1', () => false, 5)
    expect(plan.targets.map((t) => t.asset.name)).toEqual(['Venom spur front', 'IMG'])
    expect(plan.targets.every((t) => !t.matched)).toBe(true)
  })
})
