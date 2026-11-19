import { describe, expect, it } from 'vitest'
import { stylePresets, type StyleBible } from './visualDevelopment'
import { PROJECT_FAMILY, familyCounts, filterStyles, hasOwnThumb, loadFavorites, saveFavorites, styleSlug, thumbFor } from './styleGallery'
import { styleThumbSlugs } from './styleThumbs'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const none = new Set<string>()
const base = { query: '', family: 'All', onlyFavorites: false, favorites: none }

describe('style gallery data', () => {
  it('has a picture on disk for every family that claims one, and none for project presets', () => {
    // The 2D presets have no generated picture (they show a drawn schematic from their settings), so only the photo families are checked here.
    const families = new Set(stylePresets.filter((s) => !s.spec2d || hasOwnThumb(s)).map((s) => s.family).filter(Boolean))
    expect(families.size).toBeGreaterThanOrEqual(8)
    for (const family of families) {
      const url = thumbFor({ name: 'no own picture', family })
      expect(url, `${family} has a picture`).toBeTruthy()
      expect(existsSync(resolve(process.cwd(), 'public', url!.slice(1))), `${url} exists`).toBe(true)
    }
    expect(thumbFor({ name: 'no own picture' })).toBeNull()
  })
  it('has a picture of its own for every one of the styles, on disk, and the list matches the folder exactly', () => {
    const dir = resolve(process.cwd(), 'public/style-thumbs/styles')
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')).sort() : []
    expect([...styleThumbSlugs].sort()).toEqual(files)
    const photoStyles = stylePresets.filter((s) => !s.spec2d || hasOwnThumb(s))
    const missing = photoStyles.filter((s) => !hasOwnThumb(s)).map((s) => s.name)
    expect(missing, `styles without their own picture: ${missing.join(', ')}`).toEqual([])
    for (const s of photoStyles) {
      const url = thumbFor(s)!
      expect(url).toBe(`/style-thumbs/styles/${styleSlug(s.name)}.webp`)
      const size = statSync(resolve(process.cwd(), 'public', url.slice(1))).size
      expect(size, `${s.name} picture is a real image`).toBeGreaterThan(5_000)
      expect(size, `${s.name} picture is small enough to bundle`).toBeLessThan(120_000)
    }
  })
  it('slugs are unique, so two styles never share a file', () => {
    expect(new Set(stylePresets.map((s) => styleSlug(s.name))).size).toBe(stylePresets.length)
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
