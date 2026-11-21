import { controlIds, type CustomPreset } from '../domain/proportions'

/** Presets you saved from the proportions workspace. They live on this computer (not in the project), so they are there for the next project too. */
const KEY = 'po.proportion.presets'
const MAX = 24

function valid(x: unknown): x is CustomPreset {
  if (!x || typeof x !== 'object') return false
  const c = x as CustomPreset
  if (typeof c.name !== 'string' || !c.name.trim() || typeof c.stylization !== 'number' || !c.values || typeof c.values !== 'object') return false
  return Object.entries(c.values).every(([k, v]) => (controlIds as string[]).includes(k) && typeof v === 'number' && Number.isFinite(v))
}

export function readPresets(): CustomPreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter(valid).slice(0, MAX) : []
  } catch { return [] }
}

function write(list: CustomPreset[]): CustomPreset[] {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private window: it lasts until the app closes */ }
  return list
}

/** Saves under the name (replacing one with the same name, without regard to case). Returns the new list. */
export function savePreset(preset: CustomPreset): CustomPreset[] {
  const name = preset.name.trim()
  if (!name) return readPresets()
  const rest = readPresets().filter((p) => p.name.toLowerCase() !== name.toLowerCase())
  return write([...rest, { ...preset, name }].slice(-MAX))
}

export function deletePreset(name: string): CustomPreset[] {
  return write(readPresets().filter((p) => p.name.toLowerCase() !== name.toLowerCase()))
}
