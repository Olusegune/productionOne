import { createEntity, latestApproved, type AbilitySpec, type AbilityState, type Ref, type VariationState } from './variations'

/**
 * Powers and abilities. A power has one visual language (colour, shape, motion) and six states from inactive to aftermath; the language stays the same and
 * only the intensity changes. Each state is a declared description a picture can be held to. A picture may only be called "transparent" when the file really
 * has transparency: `pngHasAlpha` reads that from the file's own header.
 */
export const ABILITY_STATES: AbilityState[] = ['inactive', 'activation', 'controlled', 'peak', 'recovery', 'aftermath']
/** How strong the effect is in each state, 0 to 5, used to scale wording and never the visual language. */
export const STATE_INTENSITY: Record<AbilityState, number> = { inactive: 0, activation: 2, controlled: 3, peak: 5, recovery: 2, aftermath: 1 }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined)

/** Reads a saved ability. Unusable settings return undefined and the record is dropped. */
export function readAbilitySpec(raw: unknown): AbilitySpec | undefined {
  if (!isObj(raw) || typeof raw.assetId !== 'string' || !raw.assetId.trim()) return undefined
  const name = text(raw.name, 60)
  const colour = isObj(raw.language) ? text(raw.language.colour, 60) : undefined
  const shape = isObj(raw.language) ? text(raw.language.shape, 80) : undefined
  if (!name || !colour || !shape) return undefined
  const motion = isObj(raw.language) ? text(raw.language.motion, 80) : undefined
  const states: AbilitySpec['states'] = {}
  if (isObj(raw.states)) for (const s of ABILITY_STATES) { const d = text(raw.states[s], 300); if (d) states[s] = d }
  const transparency = raw.transparency === 'translucent' || raw.transparency === 'alpha-required' ? raw.transparency : 'none'
  return { assetId: raw.assetId.trim().slice(0, 80), name, language: { colour, shape, ...(motion ? { motion } : {}) }, states, transparency }
}

export function checkAbilitySpec(spec: AbilitySpec): string | undefined {
  if (!spec.name.trim()) return 'Give the power a name.'
  if (!spec.language.colour.trim() || !spec.language.shape.trim()) return 'Describe its colour and its shape. The same two words are used in every state, so the power looks like one power.'
  if (!ABILITY_STATES.some((s) => spec.states[s]?.trim())) return 'Describe at least one state, for example what it looks like at its peak.'
  return undefined
}

/** The states that have no description yet. */
export const missingStates = (spec: AbilitySpec): AbilityState[] => ABILITY_STATES.filter((s) => !spec.states[s]?.trim())

/** A prompt sentence for one state: the fixed visual language, the state's own description, and how strong it is. Inactive says that no effect shows at all. */
export function abilityLine(spec: AbilitySpec, state: AbilityState): string {
  const level = STATE_INTENSITY[state]
  if (state === 'inactive') return `${spec.name}, inactive: no visible effect at all${spec.states.inactive ? `. ${spec.states.inactive}` : ''}.`
  const lang = `${spec.language.colour}, ${spec.language.shape}${spec.language.motion ? `, ${spec.language.motion}` : ''}`
  return `${spec.name}, ${state}: visual language is always ${lang} (never change the colour or the shape, only how strong it is). Strength ${level} of 5.${spec.states[state] ? ` ${spec.states[state]}` : ''}${spec.transparency === 'none' ? '' : ' The effect is drawn on a plain background so it can be cut out; it is not made transparent by the picture itself.'}`
}

/** The six states in order with their intensity, so a set of pictures can be laid out and checked. */
export const abilityRamp = (spec: AbilitySpec) => ABILITY_STATES.map((state) => ({ state, intensity: STATE_INTENSITY[state], described: !!spec.states[state]?.trim() }))

/**
 * Whether PNG bytes really carry transparency: a colour type with an alpha channel (grey+alpha or RGBA), or a tRNS chunk. Reads only the header and chunk
 * names; it does not decode the picture. Anything that is not a PNG answers false.
 */
export function pngHasAlpha(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 33 || sig.some((b, i) => bytes[i] !== b)) return false
  const colourType = bytes[25]
  if (colourType === 4 || colourType === 6) return true
  let pos = 8
  while (pos + 8 <= bytes.length) {
    const len = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7])
    if (type === 'tRNS') return true
    if (type === 'IDAT' || type === 'IEND') return false
    pos += 12 + len
  }
  return false
}

/** Why a picture may not be labelled transparent, or undefined when it may (or the power does not claim it). */
export function transparencyProblem(spec: AbilitySpec, fileHasAlpha: boolean): string | undefined {
  if (spec.transparency === 'alpha-required' && !fileHasAlpha) return 'This power is meant to come with real transparency, but the picture has none. It cannot be labelled transparent: remove the background in a separate step, or call it a design reference on a plain background.'
  return undefined
}

export function approvedAbilities(state: VariationState, assetId: string): Array<{ ref: Ref; spec: AbilitySpec }> {
  const out: Array<{ ref: Ref; spec: AbilitySpec }> = []
  for (const e of state.entities) {
    if (e.kind !== 'ability' || e.archived) continue
    const rev = latestApproved(e)
    if (rev && (rev.spec as AbilitySpec).assetId === assetId) out.push({ ref: { id: e.id, revision: rev.n }, spec: rev.spec as AbilitySpec })
  }
  return out
}

/** Records an ability as a candidate. A power with the same name on the same being gets a new revision; a different name is a different power. */
export function recordAbility(state: VariationState, spec: AbilitySpec, beingName: string, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const bad = checkAbilitySpec(spec)
  if (bad) return { error: bad }
  const same = (s: AbilitySpec) => s.assetId === spec.assetId && s.name.trim().toLowerCase() === spec.name.trim().toLowerCase()
  const existing = state.entities.find((e) => e.kind === 'ability' && !e.archived && same(e.revisions[e.revisions.length - 1].spec as AbilitySpec))
  if (existing) {
    const n = existing.revisions.reduce((m, x) => Math.max(m, x.n), 0) + 1
    const updated = { ...existing, revisions: [...existing.revisions, { n, createdAt: now, status: 'candidate' as const, spec: structuredClone(spec), parent: { id: existing.id, revision: n - 1 }, media: [] }] }
    return { state: { ...state, entities: state.entities.map((e) => (e.id === existing.id ? (updated as typeof e) : e)) }, ref: { id: existing.id, revision: n } }
  }
  return createEntity(state, 'ability', { name: `${beingName}: ${spec.name}`, spec, now })
}
