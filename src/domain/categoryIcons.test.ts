import { describe, expect, it } from 'vitest'
import { assetIconFor, assetIcons, sheetHints, sheetIconFor, sheetIcons } from './categoryIcons'
import { sheetTypesFor } from './sheetSpecs'

describe('category icons', () => {
  it('every kind of asset has its own icon, and an unknown one still gets one', () => {
    for (const t of ['character', 'costume', 'prop', 'set'] as const) expect(assetIcons[t]).toBeTruthy()
    expect(new Set(['character', 'costume', 'prop', 'set'].map((t) => assetIconFor(t))).size).toBe(4)
    expect(assetIconFor('environment')).toBe(assetIconFor('set'))
    expect(assetIconFor('something new')).toBeTruthy()
  })
  it('every reference sheet that can be made has an icon and a plain-words hint', () => {
    for (const asset of ['character', 'costume', 'prop', 'set'] as const) {
      for (const sheet of sheetTypesFor(asset)) {
        expect(sheetIcons[sheet], `${asset}/${sheet} icon`).toBeTruthy()
        expect(sheetHints[sheet].length, `${asset}/${sheet} hint`).toBeGreaterThan(10)
      }
    }
    expect(sheetIconFor('Turnaround')).not.toBe(sheetIconFor('Expressions'))
    expect(sheetIconFor('not a sheet')).toBeTruthy()
  })
})
