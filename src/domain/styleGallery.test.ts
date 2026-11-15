import { describe, expect, it } from 'vitest'
import { stylePresets, type StyleBible } from './visualDevelopment'
import { PROJECT_FAMILY, familyCounts, filterStyles, loadFavorites, saveFavorites, thumbFor } from './styleGallery'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const none = new Set<string>()
const base = { query: '', family: 'All', onlyFavorites: false, favorites: none }

describe('style gallery data', () => {
  it('has a picture on disk for every family that claims one, and none for project presets', () => {
    const families = new Set(stylePresets.map((s) => s.family).filter(Boolean))
    expect(families.size).toBeGreaterThanOrEqual(8)
    for (const family of families) {
      const url = thumbFor({ family })
      expect(url, `${family} has a picture`).toBeTruthy()
      expect(existsSync(resolve(process.cwd(), 'public', url!.slice(1))), `${url} exists`).toBe(true)
    }
    expect(thumbFor({})).toBeNull()
  })
  it('counts every style exactly once, with project presets in their own group', () => {
    const counts = familyCounts(stylePresets)
    expect(counts.reduce((n, c) => n + c.count, 0)).toBe(stylePresets.length)
    expect(counts.some((c) => c.family === PROJECT_FAMILY)).toBe(true)
  })
  it('style names are unique, so a pick and a favourite mean one style', () => {
    expect(new Set(stylePresets.map((s) => s.name)).size).toBe(stylePresets.length)
  })
})

describe('filtering', () => {
  const sample = (name: string, family: string | undefined, description = ''): StyleBible => ({ name, family, description, palette: ['#000'], materials: '', rendering: '', lighting: '', locked: false, revision: 1 })
  const list = [sample('Clay animation aesthetic', 'Handmade', 'tactile clay'), sample('Photoreal cinematic CG', 'Realistic 3D'), sample('Mine', undefined, 'my own')]
  it('matches every word anywhere in the name, description or family', () => {
    expect(filterStyles(list, { ...base, query: 'clay tactile' }).map((s) => s.name)).toEqual(['Clay animation aesthetic'])
    expect(filterStyles(list, { ...base, query: 'REALISTIC' }).map((s) => s.name)).toEqual(['Photoreal cinematic CG'])
    expect(filterStyles(list, { ...base, query: 'clay realistic' })).toEqual([])
  })
  it('filters by family and by favourites', () => {
    expect(filterStyles(list, { ...base, family: 'Handmade' })).toHaveLength(1)
    expect(filterStyles(list, { ...base, family: PROJECT_FAMILY }).map((s) => s.name)).toEqual(['Mine'])
    expect(filterStyles(list, { ...base, onlyFavorites: true, favorites: new Set(['Photoreal cinematic CG']) }).map((s) => s.name)).toEqual(['Photoreal cinematic CG'])
  })
})

describe('favourites storage', () => {
  it('round-trips, and ignores damaged data', () => {
    saveFavorites(new Set(['A', 'B']))
    expect([...loadFavorites()].sort()).toEqual(['A', 'B'])
    localStorage.setItem('po.style.favorites', '{not json')
    expect(loadFavorites().size).toBe(0)
    localStorage.setItem('po.style.favorites', JSON.stringify(['ok', 3, null]))
    expect([...loadFavorites()]).toEqual(['ok'])
  })
})
