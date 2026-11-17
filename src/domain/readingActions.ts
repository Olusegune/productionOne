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
export function addProductionAsset(assets: ExtractedAsset[], kind: NewAssetKind, name: string, sceneId: string, now = Date.now(), gender = ''): { assets: ExtractedAsset[]; added: boolean; asset?: ExtractedAsset; reason?: string } {
  const noun = newAssetKinds.find((k) => k.kind === kind)?.noun ?? 'asset'
  const label = clean(name)
  if (!label) return { assets, added: false, reason: `Type the ${noun}'s name first.` }
  if (assets.some((a) => a.name.trim().toLowerCase() === label.toLowerCase())) return { assets, added: false, reason: `${label} is already in the asset list.` }
  const id = `MANU-${idPart[kind]}-${String(assets.length + 1).padStart(3, '0')}-${now.toString(36).slice(-4).toUpperCase()}`
  const asset: ExtractedAsset = { id, name: label, type: kind, sceneIds: [sceneId], status: 'planned', ...(kind === 'character' && clean(gender) ? { gender: clean(gender) } : {}) }
  return { assets: [...assets, asset], added: true, asset }
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
