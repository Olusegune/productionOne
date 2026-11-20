import { createProfile, presets, setControl, setHeightM, setStylization, type ControlId, type PresetId, type ProportionProfile, controlIds } from './proportions'

/**
 * World rules: the defaults every character in this production starts from (a starting profile and its stylization) and the one scale convention used for fit and
 * Scale and Fit work. Inheritance is project to character only: a character's own profile is the world default plus that character's own changes ("deltas").
 * There is no group behaviour yet, so no group field exists.
 */
export interface WorldRules {
  /** The starting point new characters begin from. Absent: Natural. */
  profile?: { preset: PresetId; stylization: number }
  scaleConvention: 'metres'
  notes?: string
}
export const defaultWorld = (): WorldRules => ({ scaleConvention: 'metres' })

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function readWorld(raw: unknown): WorldRules {
  if (!isObject(raw)) return defaultWorld()
  const world = defaultWorld()
  if (isObject(raw.profile) && presets.some((p) => p.id === (raw.profile as Record<string, unknown>).preset)) {
    const p = raw.profile as Record<string, unknown>
    world.profile = { preset: p.preset as PresetId, stylization: typeof p.stylization === 'number' && Number.isFinite(p.stylization) ? Math.min(100, Math.max(0, Math.round(p.stylization))) : 0 }
  }
  if (typeof raw.notes === 'string') world.notes = raw.notes.slice(0, 500)
  return world
}

/** A character's profile: the world's starting point, then the changes particular to that character. */
export function profileFromWorld(world: WorldRules | undefined, id: string, deltas: Partial<Record<ControlId, number>> = {}, heightM?: number): ProportionProfile {
  let p = world?.profile ? setStylization(createProfile(id, world.profile.preset), world.profile.stylization) : createProfile(id)
  for (const cid of controlIds) if (deltas[cid] !== undefined) p = setControl(p, cid, deltas[cid] as number)
  if (heightM !== undefined) p = setHeightM(p, heightM)
  return p
}

/** What a character changes from the world default, for display: only the controls that are overridden. */
export function deltasOf(p: ProportionProfile): Partial<Record<ControlId, number>> {
  const out: Partial<Record<ControlId, number>> = {}
  for (const id of controlIds) if (p.controls[id].source === 'override') out[id] = p.controls[id].value
  return out
}
