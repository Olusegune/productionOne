import type { ExtractedAsset } from './productionStudio'
import { describe as describeProportions, fingerprint, type ProportionProfile } from './proportions'
import type { StyleBible } from './visualDevelopment'

/**
 * A character is three separate records that are related by the character's id:
 *   identity: who they are (face, age, hair, distinguishing features, costume, approved characteristics),
 *   proportion and shape: the target proportion profile,
 *   rendering style: the art style (the project's, or an override for this character).
 * Changing one never rewrites another: a new style does not reset anatomy, and new proportions do not replace identity.
 */
export interface IdentityLayer { id: string; name: string; age?: string; gender?: string; race?: string; ethnicity?: string; role?: string; never?: string; description?: string; status: ExtractedAsset['status'] }
export interface CharacterLayers { identity: IdentityLayer; proportions: ProportionProfile | undefined; style: StyleBible | undefined }

export function identityLayer(a: ExtractedAsset): IdentityLayer {
  return { id: a.id, name: a.name, age: a.age, gender: a.gender, race: a.race, ethnicity: a.ethnicity, role: a.role, never: a.never, description: a.description, status: a.status }
}

export const layersOf = (a: ExtractedAsset, profiles: Record<string, ProportionProfile>): CharacterLayers => ({ identity: identityLayer(a), proportions: profiles[a.id], style: a.style })

/** The character with a new style. Their proportions are in another record and are not touched. */
export function withStyle(a: ExtractedAsset, style: StyleBible | undefined): ExtractedAsset {
  if (style) return { ...a, style }
  const { style: _dropped, ...rest } = a
  return rest
}

/** The profiles with one character's replaced. The character record (identity) is not touched. */
export function withProfile(profiles: Record<string, ProportionProfile>, assetId: string, profile: ProportionProfile | undefined): Record<string, ProportionProfile> {
  const next = { ...profiles }
  if (profile) next[assetId] = profile
  else delete next[assetId]
  return next
}

/** What an output records about the proportions it was made with. */
export interface Provenance {
  /** The exact profile used, copied so it can be read later even if the profile has changed. */
  proportionProfile?: ProportionProfile
  proportionFp?: string
  /** The reference pictures sent with it, as files and (when known) the job and revision they came from. */
  references: Array<{ path: string; jobId?: string; revision?: number }>
}

export function provenanceFor(profile: ProportionProfile | undefined, references: Array<{ path: string; jobId?: string; revision?: number }>): Provenance {
  return { ...(profile ? { proportionProfile: structuredClone(profile), proportionFp: fingerprint(profile) } : {}), references }
}

/** The proportion wording for a prompt, or '' when the character has no profile (so their prompts are exactly as before). */
export const proportionWords = (profile: ProportionProfile | undefined): string => describeProportions(profile)

/** Was this output made with a different proportion profile than the character has now? An output made before profiles existed, or for a character with none, is not stale. */
export function madeWithEarlierProportions(provenance: Provenance | undefined, current: ProportionProfile | undefined): boolean {
  const then = provenance?.proportionFp
  const now = current ? fingerprint(current) : undefined
  if (!then && !now) return false
  return then !== now && !!then
}
