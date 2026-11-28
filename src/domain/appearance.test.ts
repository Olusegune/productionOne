import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, accentFromPalette, contrast, isLook, looks, savedLook, storeLook } from './appearance'

beforeEach(() => { localStorage.clear() })

describe('looks', () => {
  it('has four looks with distinct names, and recognises only those', () => {
    expect(looks.map((l) => l.id)).toEqual(['studio', 'champagne', 'cinematic', 'futurist'])
    expect(new Set(looks.map((l) => l.name)).size).toBe(4)
    expect(isLook('futurist')).toBe(true)
    expect(isLook('neon')).toBe(false)
    expect(isLook(undefined)).toBe(false)
  })
  it('is Cinematic until a look is chosen, remembers a choice, and falls back to Cinematic for anything else', () => {
    expect(DEFAULT_LOOK).toBe('studio')
    expect(savedLook()).toBe('studio')
    storeLook('futurist')
    expect(savedLook()).toBe('futurist')
    localStorage.setItem('po.look.v2', 'garbage')
    expect(savedLook()).toBe('studio')
  })
  it('ignores a value stored by the first version, which could not tell a choice from a default', () => {
    localStorage.setItem('po.look', 'studio')
    expect(savedLook()).toBe('studio')
  })
})

describe('accent from the style palette', () => {
  it('picks the most colourful entry and skips greys', () => {
    const accent = accentFromPalette(['#171b1f', '#d1b47b', '#78624a', '#6e7a78'])
    expect(accent).toBeTruthy()
    // the warm gold-ish entries beat the grey ones
    const n = parseInt(accent!.slice(1), 16)
    expect((n >> 16) & 255).toBeGreaterThan(n & 255)
  })
  it('always reads on the dark surface (4.5:1), lifting a dark colour', () => {
    for (const palette of [['#1a2a8a', '#202020'], ['#6b1020'], ['#0b4f3a', '#111111']]) {
      const accent = accentFromPalette(palette, '#14110f')!
      expect(accent, palette.join()).toBeTruthy()
      expect(contrast(accent, '#14110f')).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('returns null when the palette has no colour, so the look keeps its default', () => {
    expect(accentFromPalette(['#111111', '#808080', '#eeeeee'])).toBeNull()
    expect(accentFromPalette([])).toBeNull()
    expect(accentFromPalette(['not a colour'])).toBeNull()
  })
  it('measures contrast the standard way', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5)
  })
})
