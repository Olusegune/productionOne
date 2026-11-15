import type { StyleBible } from './visualDevelopment'

/** Where a style family's picture lives. One picture per family, all made from the same subject so only the look changes. */
const thumbFiles: Record<string, string> = {
  'Illustrated 2.5D': 'illustrated-25d',
  'Paper and collage': 'paper-collage',
  'Stylized 3D': 'stylized-3d',
  'Painterly 3D': 'painterly-3d',
  Handmade: 'handmade',
  'Miniature worlds': 'miniature-worlds',
  'Realistic 3D': 'realistic-3d',
  'Experimental 3D': 'experimental-3d',
}

/** The picture for a style, or null for a project preset, which is shown with its palette instead. Never a stand-in for a style that has no picture. */
export function thumbFor(style: Pick<StyleBible, 'family'>): string | null {
  const file = style.family ? thumbFiles[style.family] : undefined
  return file ? `/style-thumbs/${file}.webp` : null
}

export const PROJECT_FAMILY = 'Project presets'

export interface GalleryFilter { query: string; family: string; onlyFavorites: boolean; favorites: ReadonlySet<string> }

export const familyOf = (style: Pick<StyleBible, 'family'>) => style.family ?? PROJECT_FAMILY

/** Families in a stable order with how many styles each holds, for the filter chips. */
export function familyCounts(styles: StyleBible[]): Array<{ family: string; count: number }> {
  const counts = new Map<string, number>()
  for (const s of styles) counts.set(familyOf(s), (counts.get(familyOf(s)) ?? 0) + 1)
  return [...counts.entries()].map(([family, count]) => ({ family, count }))
}

/** Search matches the name, the description and the family, ignoring case; every word must match somewhere. */
export function filterStyles(styles: StyleBible[], f: GalleryFilter): StyleBible[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  return styles.filter((s) => {
    if (f.family !== 'All' && familyOf(s) !== f.family) return false
    if (f.onlyFavorites && !f.favorites.has(s.name)) return false
    if (!words.length) return true
    const hay = `${s.name} ${s.description} ${familyOf(s)}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

const KEY = 'po.style.favorites'
export function loadFavorites(): Set<string> {
  try { const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []) } catch { return new Set() }
}
export function saveFavorites(set: ReadonlySet<string>) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])) } catch { /* storage unavailable: favourites last for this session only */ }
}
