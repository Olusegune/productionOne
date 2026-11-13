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

/** Use an age the reading found as the character's confirmed age. Only touches the named character. */
export function applyReadAge(assets: ExtractedAsset[], character: string, value: string): { assets: ExtractedAsset[]; applied: boolean } {
  const age = clean(value).replace(/^age\s+/i, '')
  const target = assets.find((a) => a.type === 'character' && a.name.trim().toLowerCase() === character.trim().toLowerCase())
  if (!target || !age) return { assets, applied: false }
  return { assets: assets.map((a) => (a.id === target.id ? { ...a, age } : a)), applied: true }
}
