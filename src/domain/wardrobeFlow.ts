import type { ImageJob } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import { reconcileWithQueue } from './variationSync'
import { addRevision, approveRevision, approvedPicture, createEntity, findEntity, findRevision, latestApproved, type AgeSpec, type FitSpec, type GarmentSpec, type LookSpec, type Ref, type VariationState } from './variations'

/** The steps of wardrobe work as plain changes to the records. Nothing here generates anything: the screens queue pictures, then `syncWardrobe` follows what the queue made. */

export const garmentAssetId = (garmentId: string) => `COSTUME-${garmentId}`

/** A new garment: its record (a candidate) and the costume asset that will hold its pictures. */
export function newGarment(state: VariationState, assets: ExtractedAsset[], input: { name: string; spec: GarmentSpec; now: string }): { variations: VariationState; assets: ExtractedAsset[]; ref: Ref; assetId: string } {
  const made = createEntity(state, 'garment', { name: input.name, spec: input.spec, now: input.now })
  const assetId = garmentAssetId(made.ref.id)
  const asset: ExtractedAsset = { id: assetId, name: input.name.trim() || made.ref.id, type: 'costume', sceneIds: [], status: 'planned', description: input.spec.description }
  return { variations: made.state, assets: [...assets, asset], ref: made.ref, assetId }
}

/** A changed design of an existing garment: a new revision continuing from the newest approved one (or the newest of any kind). */
export function reviseGarment(state: VariationState, garmentId: string, spec: GarmentSpec, now: string): { variations: VariationState; ref: Ref } {
  const entity = findEntity(state, garmentId)
  if (!entity) throw new Error(`There is no garment ${garmentId}.`)
  const from = latestApproved(entity)?.n ?? Math.max(...entity.revisions.map((r) => r.n))
  const made = addRevision(state, garmentId, { spec, now, parent: { id: garmentId, revision: from } })
  return { variations: made.state, ref: made.ref }
}

/** The garment's approved picture, if its newest approved revision has one. */
export function garmentPicture(state: VariationState, garmentId: string): { ref: Ref; path: string } | undefined {
  const entity = findEntity(state, garmentId)
  const rev = entity && latestApproved(entity)
  const media = rev && approvedPicture(rev)
  return rev && media ? { ref: { id: garmentId, revision: rev.n }, path: media.path } : undefined
}

/** The queue variant name for an outfit: the character and the garment, so it reads well in the Look list. */
export const outfitName = (characterName: string, garmentName: string) => `${characterName} in ${garmentName}`.slice(0, 80)

/**
 * Starts a fit of an approved garment on a character: a candidate fit record. The same garment gets a separate fit for each character,
 * and a second try for the same pair is a new revision of the same fit.
 */
export function startFit(state: VariationState, input: { character: ExtractedAsset; garment: Ref; garmentName: string; keep: string[]; now: string; condition?: { ref: Ref; name: string }; body?: { ref: Ref; name: string } }): { variations: VariationState; ref: Ref; variant: string } {
  const rev = findRevision(state, input.garment)
  if (!rev || rev.status !== 'approved') throw new Error('Approve the garment before fitting it to a character.')
  if (input.condition) {
    const c = findRevision(state, input.condition.ref)
    if (!c || c.status !== 'approved') throw new Error('Approve the condition before fitting the garment in it.')
  }
  if (input.body) {
    const body = findRevision(state, input.body.ref)
    if (!body || body.status !== 'approved') throw new Error('Approve the age variant before fitting a garment to it.')
  }
  const worn = input.condition ? `${input.garmentName}, ${input.condition.name}` : input.garmentName
  // The body is part of the name: the same garment on the same person at another age is a separate fit and a separate look.
  const who = input.body ? input.body.name : input.character.name
  const variant = outfitName(who, worn)
  const spec: FitSpec = { garment: input.garment, characterId: input.character.id, keep: [...input.keep], variant, ...(input.condition ? { condition: input.condition.ref } : {}), ...(input.body ? { body: input.body.ref } : {}) }
  // One fit per character, garment and condition: another character, or the same garment in another condition, is a separate fit.
  const existing = state.entities.find((e) => e.kind === 'fit' && e.characterId === input.character.id && e.revisions.some((r) => (r.spec as FitSpec).garment.id === input.garment.id && (r.spec as FitSpec).condition?.id === input.condition?.ref.id && (r.spec as FitSpec).body?.id === input.body?.ref.id))
  if (existing) { const made = addRevision(state, existing.id, { spec, now: input.now }); return { variations: made.state, ref: made.ref, variant } }
  const made = createEntity(state, 'fit', { name: variant, characterId: input.character.id, spec, now: input.now })
  return { variations: made.state, ref: made.ref, variant }
}

/** Every approved fit becomes a production look with that outfit, once. Approving an outfit in this version approves its look; combining age and condition comes later. */
function ensureLooks(state: VariationState, now: string): VariationState {
  let next = state
  // An approved age variant is a look of the character at that age.
  for (const e of state.entities) {
    if (e.kind !== 'age') continue
    for (const r of e.revisions) {
      if (r.status !== 'approved') continue
      const ref = { id: e.id, revision: r.n }
      if (next.entities.some((l) => l.kind === 'look' && l.revisions.some((lr) => (lr.spec as LookSpec).age?.id === ref.id && (lr.spec as LookSpec).age?.revision === ref.revision && !(lr.spec as LookSpec).fit))) continue
      const spec = r.spec as AgeSpec
      const look: LookSpec = { characterId: spec.characterId, age: ref, queueVariant: spec.variant ?? e.name }
      const sameName = next.entities.find((l) => l.kind === 'look' && l.characterId === e.characterId && l.name === e.name)
      const made = sameName ? addRevision(next, sameName.id, { spec: look, now }) : createEntity(next, 'look', { name: e.name, characterId: e.characterId, spec: look, now })
      next = approveRevision(made.state, made.ref)
    }
  }
  for (const e of state.entities) {
    if (e.kind !== 'fit') continue
    for (const r of e.revisions) {
      if (r.status !== 'approved') continue
      const ref = { id: e.id, revision: r.n }
      const has = next.entities.some((l) => l.kind === 'look' && l.revisions.some((lr) => (lr.spec as LookSpec).fit?.id === ref.id && (lr.spec as LookSpec).fit?.revision === ref.revision))
      if (has) continue
      const spec = r.spec as FitSpec
      const sameName = next.entities.find((l) => l.kind === 'look' && l.characterId === e.characterId && l.name === e.name)
      const look: LookSpec = { characterId: spec.characterId, fit: ref, ...(spec.condition ? { condition: spec.condition } : {}), ...(spec.body ? { age: spec.body } : {}), queueVariant: spec.variant ?? e.name }
      const made = sameName ? addRevision(next, sameName.id, { spec: look, now }) : createEntity(next, 'look', { name: e.name, characterId: e.characterId, spec: look, now })
      next = approveRevision(made.state, made.ref)
    }
  }
  return next
}

/** Follows the queue (pictures attached, approvals and rejections carried over) and makes the looks for newly approved outfits. Returns the same object when nothing changed. */
export function syncWardrobe(state: VariationState, jobs: ImageJob[], now: string): VariationState {
  const reconciled = reconcileWithQueue(state, jobs)
  const withLooks = ensureLooks(reconciled, now)
  return withLooks
}

/** The outfit looks of a character that the queue files pictures under, apart from "Canonical" (those come from the story). Approved looks only, in the order they were made. */
export function lookNamesFor(state: VariationState, characterId: string | undefined): string[] {
  if (!characterId) return []
  const names: string[] = []
  for (const e of state.entities) {
    if (e.kind !== 'look' || e.characterId !== characterId) continue
    const rev = latestApproved(e)
    const name = rev && (rev.spec as LookSpec).queueVariant
    if (name && name !== 'Canonical' && !names.includes(name)) names.push(name)
  }
  return names
}
