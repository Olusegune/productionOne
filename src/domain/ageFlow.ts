import type { ExtractedAsset } from './productionStudio'
import { addRevision, approvedPicture, createEntity, findEntity, latestApproved, type AgeSpec, type Ref, type VariationState } from './variations'

/** Changes for the Age Studio, as plain changes to the records. Nothing here generates anything. */

/** The queue variant name for a character at an age: it is also the look's name, so it reads well in the Look list. */
export const ageLookName = (characterName: string, targetAge: string) => `${characterName} at ${targetAge.trim()}`.slice(0, 80)

/**
 * A candidate age variant. Making the same age again for the same character (same mode) is a new revision of that variant, so a second try keeps the
 * history; another age is another variant. The character's own record is not changed.
 */
export function newAgeVariant(state: VariationState, input: { character: ExtractedAsset; spec: Omit<AgeSpec, 'characterId' | 'variant'>; now: string }): { variations: VariationState; ref: Ref; variant: string } {
  const variant = ageLookName(input.character.name, input.spec.targetAge)
  const spec: AgeSpec = { ...input.spec, characterId: input.character.id, variant, ...(input.spec.keep ? { keep: [...input.spec.keep] } : {}), ...(input.spec.anchors ? { anchors: [...input.spec.anchors] } : {}), ...(input.spec.adjustments ? { adjustments: { ...input.spec.adjustments } } : {}) }
  const existing = state.entities.find((e) => e.kind === 'age' && e.characterId === input.character.id && e.name === variant)
  if (existing) { const made = addRevision(state, existing.id, { spec, now: input.now }); return { variations: made.state, ref: made.ref, variant } }
  const made = createEntity(state, 'age', { name: variant, characterId: input.character.id, spec, now: input.now })
  return { variations: made.state, ref: made.ref, variant }
}

/** The approved picture of an age variant's newest approved revision. */
export function agePicture(state: VariationState, ageId: string): { ref: Ref; path: string } | undefined {
  const e = findEntity(state, ageId)
  const rev = e && latestApproved(e)
  const media = rev && approvedPicture(rev)
  return rev && media ? { ref: { id: ageId, revision: rev.n }, path: media.path } : undefined
}

/** The age variants of a character, in the order they were made. */
export const agesOf = (state: VariationState, characterId: string) => state.entities.filter((e) => e.kind === 'age' && e.characterId === characterId)

/**
 * A relative is a separate character, linked to this one. It starts without a picture, so its identity is made the normal way, and it carries
 * `relativeOf` so the link is not lost. It is never an age variant of the character it came from.
 */
export function newRelative(assets: ExtractedAsset[], of: ExtractedAsset, input: { name: string; relation: string; description?: string }): { assets: ExtractedAsset[]; asset: ExtractedAsset } {
  const slug = input.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'RELATIVE'
  let id = `CHAR-REL-${slug}`
  for (let n = 2; assets.some((a) => a.id === id); n++) id = `CHAR-REL-${slug}-${n}`
  const relation = input.relation.trim() || 'relative'
  const asset: ExtractedAsset = {
    id, name: input.name.trim().toUpperCase(), type: 'character', sceneIds: [], status: 'planned', relativeOf: { assetId: of.id, relation },
    description: input.description?.trim() || `${input.name.trim()}, ${of.name}'s ${relation}. A separate person who shares a family resemblance with ${of.name}.`,
    ...(of.race ? { race: of.race } : {}), ...(of.ethnicity ? { ethnicity: of.ethnicity } : {}),
  }
  return { assets: [...assets, asset], asset }
}
