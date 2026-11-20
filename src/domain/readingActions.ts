import type { ExtractedAsset } from './productionStudio'

const clean = (s: string) => s.trim().replace(/\s+/g, ' ')

/** Add a prop the script reading missed. Never duplicates an existing asset of the same name. */
export function addPropAsset(assets: ExtractedAsset[], name: string, sceneId: string, now = Date.now()): { assets: ExtractedAsset[]; added: boolean; reason?: string } {
  const label = clean(name)
  if (!label) return { assets, added: false, reason: 'Type the prop\'s name first.' }
  if (assets.some((a) => a.name.trim().toLowerCase() === label.toLowerCase())) return { assets, added: false, reason: `${label} is already in the asset list.` }
  const id = `MANU-PROP-${String(assets.length + 1).padStart(3, '0')}-${now.toString(36).slice(-4).toUpperCase()}`
  return { assets: [...assets, { id, name: label, type: 'prop', sceneIds: [sceneId], status: 'planned' }], added: true }
}

export type NewAssetKind = 'character' | 'costume' | 'prop' | 'set'
export const newAssetKinds: Array<{ kind: NewAssetKind; label: string; noun: string }> = [
  { kind: 'character', label: 'Character', noun: 'character' },
  { kind: 'costume', label: 'Costume', noun: 'costume' },
  { kind: 'prop', label: 'Prop', noun: 'prop' },
  { kind: 'set', label: 'Set or location', noun: 'set' },
]
const idPart: Record<NewAssetKind, string> = { character: 'CHAR', costume: 'COST', prop: 'PROP', set: 'SET' }

/**
 * Add a character, costume, prop or set the script reading did not find, or that the person already has an image of (for example a Midjourney render).
 * Never duplicates a name. Sheets are planned for it exactly as for an asset found in the script.
 */
export function addProductionAsset(assets: ExtractedAsset[], kind: NewAssetKind, name: string, sceneId: string, now = Date.now(), gender = '', extras: { description?: string; layout?: string } = {}): { assets: ExtractedAsset[]; added: boolean; asset?: ExtractedAsset; reason?: string } {
  const noun = newAssetKinds.find((k) => k.kind === kind)?.noun ?? 'asset'
  const label = clean(name)
  if (!label) return { assets, added: false, reason: `Type the ${noun}'s name first.` }
  if (assets.some((a) => a.name.trim().toLowerCase() === label.toLowerCase())) return { assets, added: false, reason: `${label} is already in the asset list.` }
  const id = `MANU-${idPart[kind]}-${String(assets.length + 1).padStart(3, '0')}-${now.toString(36).slice(-4).toUpperCase()}`
  const asset: ExtractedAsset = { id, name: label, type: kind, sceneIds: [sceneId], status: 'planned', ...(kind === 'character' && clean(gender) ? { gender: clean(gender) } : {}), ...(clean(extras.description ?? '') ? { description: clean(extras.description ?? '') } : {}), ...((kind === 'set') && clean(extras.layout ?? '') ? { layout: clean(extras.layout ?? '') } : {}) }
  return { assets: [...assets, asset], added: true, asset }
}

/**
 * A readable name from an image's file name: "Venom_spur-front.png" -> "Venom spur front". Long generated names (a prompt, then a code) are cut at a word,
 * hex codes and pure numbers are dropped, and an empty result becomes "Character 1", "Prop 2" and so on. Never repeats a name already in use.
 */
export function nameFromFile(path: string, taken: string[], kind: NewAssetKind, n: number): string {
  const file = path.split(/[\\/]/).pop() ?? ''
  let stem = file.replace(/\.[A-Za-z0-9]{2,5}$/, '')
  stem = stem.replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, ' ').replace(/\b[0-9a-f]{16,}\b/gi, ' ')
  stem = stem.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
  const words = stem.split(' ').filter((w) => w && !/^\d+$/.test(w))
  let name = ''
  for (const w of words) { if ((name + ' ' + w).trim().length > 40) break; name = (name + ' ' + w).trim() }
  const noun = newAssetKinds.find((k) => k.kind === kind)?.label.split(' ')[0] ?? 'Asset'
  if (name.length < 2) name = `${noun} ${n}`
  name = name.charAt(0).toUpperCase() + name.slice(1)
  const used = new Set(taken.map((t) => t.trim().toLowerCase()))
  let out = name; let i = 2
  while (used.has(out.toLowerCase())) out = `${name} ${i++}`
  return out
}

/** Adds one asset of the same kind for each image, named from its file. Returns the new list and the assets in the order of the images. */
export function addAssetsFromImages(assets: ExtractedAsset[], kind: NewAssetKind, paths: string[], sceneId: string, now = Date.now()): { assets: ExtractedAsset[]; added: ExtractedAsset[] } {
  let list = assets
  const added: ExtractedAsset[] = []
  paths.forEach((path, i) => {
    const name = nameFromFile(path, list.map((a) => a.name), kind, i + 1)
    const result = addProductionAsset(list, kind, name, sceneId, now + i)
    if (result.added && result.asset) { list = result.assets; added.push(result.asset) }
  })
  return { assets: list, added }
}

/** Add a character that comes from an image the person already has. Never duplicates a name. */
export function addCharacterAsset(assets: ExtractedAsset[], name: string, sceneId: string, now = Date.now(), gender = '') {
  return addProductionAsset(assets, 'character', name, sceneId, now, gender)
}

/**
 * Where a person's own image goes for each kind of asset: the primary view of the first sheet, which is the one whose approval makes it the reference the other
 * views are built from. A set's reference is its establishing view.
 */
export function ownImageSlot(kind: NewAssetKind): { sheetType: string; viewKey: string; label: string; aspect: string; fullBody: boolean } {
  if (kind === 'prop') return { sheetType: 'Multi-view', viewKey: 'front', label: 'Front', aspect: '1:1', fullBody: false }
  if (kind === 'set') return { sheetType: 'Establishing', viewKey: 'establishing', label: 'Establishing view', aspect: '16:9', fullBody: false }
  if (kind === 'costume') return { sheetType: 'Wardrobe', viewKey: 'costume-front', label: 'Costume front', aspect: '3:4', fullBody: true }
  return { sheetType: 'Turnaround', viewKey: 'front', label: 'Front', aspect: '3:4', fullBody: true }
}

/** Use an age the reading found as the character's confirmed age. Only touches the named character. */
export function applyReadAge(assets: ExtractedAsset[], character: string, value: string): { assets: ExtractedAsset[]; applied: boolean } {
  const age = clean(value).replace(/^age\s+/i, '')
  const target = assets.find((a) => a.type === 'character' && a.name.trim().toLowerCase() === character.trim().toLowerCase())
  if (!target || !age) return { assets, applied: false }
  return { assets: assets.map((a) => (a.id === target.id ? { ...a, age } : a)), applied: true }
}

export interface ImageTarget {
  path: string
  /** Index of the picture in the list given. */
  index: number
  asset: ExtractedAsset
  /** The picture matched a character, prop, place or costume that was already in the project (from the script, for example). */
  matched: boolean
}

/** The file name as a name, without making it unique. */
const stemName = (path: string): string => nameFromFile(path, [], 'character', 1).toLowerCase()
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)

/**
 * Which existing item (of the same kind) a picture is for, judged only by its file name: "marcus.png" or "Marcus_front_v2.png" is for MARCUS. The name must match whole
 * words, so "Ann" does not match "Annabel". When several items match, the one with the longest name wins. Returns undefined when nothing matches.
 */
export function matchAssetByFileName(assets: ExtractedAsset[], kind: NewAssetKind, path: string): ExtractedAsset | undefined {
  const stem = words(stemName(path))
  if (!stem.length) return undefined
  const joined = ` ${stem.join(' ')} `
  const hits = assets.filter((a) => a.type === kind && words(a.name).length > 0 && joined.includes(` ${words(a.name).join(' ')} `))
  return hits.sort((a, b) => b.name.length - a.name.length)[0]
}

/**
 * Plans where each picture goes. A picture whose file name matches an item already in the project (a character from the script, say) is attached to that item, so the
 * story and the picture are about the same person. Any other picture becomes a new item named from its file. An item that already has its own approved picture in this
 * slot is never given a second one here: that picture is returned as skipped and nothing is replaced.
 */
export function planImageAssets(assets: ExtractedAsset[], kind: NewAssetKind, paths: string[], sceneId: string, hasApprovedInSlot: (assetId: string) => boolean, now = Date.now()): { assets: ExtractedAsset[]; targets: ImageTarget[]; skipped: Array<{ path: string; asset: ExtractedAsset }> } {
  let list = assets
  const targets: ImageTarget[] = []
  const skipped: Array<{ path: string; asset: ExtractedAsset }> = []
  const usedMatches = new Set<string>()
  paths.forEach((path, index) => {
    const match = matchAssetByFileName(list, kind, path)
    if (match) {
      if (hasApprovedInSlot(match.id) || usedMatches.has(match.id)) { skipped.push({ path, asset: match }); return }
      usedMatches.add(match.id)
      targets.push({ path, index, asset: match, matched: true })
      return
    }
    const name = nameFromFile(path, list.map((a) => a.name), kind, index + 1)
    const result = addProductionAsset(list, kind, name, sceneId, now + index)
    if (result.added && result.asset) { list = result.assets; targets.push({ path, index, asset: result.asset, matched: false }) }
  })
  return { assets: list, targets, skipped }
}
