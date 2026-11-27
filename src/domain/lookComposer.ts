import { stalenessOf } from './variationGraph'
import { addRevision, approveRevision, createEntity, findEntity, findRevision, latestApproved, type AgeSpec, type ConditionSpec, type FitSpec, type GarmentSpec, type LookSpec, type Ref, type TransformationSpec, type VariationState } from './variations'

/**
 * Composing a production look: choosing compatible parts (a body variant, an outfit, a condition, accessories), seeing what clashes, and approving the result.
 *
 * A look is only ever the combination of parts that already exist and are approved. Nothing here makes a picture, and nothing makes every combination:
 * the person picks, the conflicts are shown, and the look is approved with the exact revisions that were picked.
 *
 * Image models cannot be relied on for the picture of a combination, so a combination is only called complete when an approved outfit picture already shows it
 * (an outfit fitted to that body, in that condition). Where none does, the conflict says which outfit to make.
 */

export interface ComposeInput {
  characterId: string
  name: string
  /** A body variant: an age or a stage of a transformation. Absent means the character as approved. */
  age?: Ref
  transformation?: Ref
  fit?: Ref
  condition?: Ref
  accessories?: Ref[]
  sceneIds?: string[]
  styleFp?: string
}

export interface Conflict {
  id: string
  /** 'blocks' cannot be approved until fixed. 'warns' can be approved once the person has acknowledged it. */
  severity: 'blocks' | 'warns'
  message: string
  /** What to do about it, in plain words. */
  fix?: string
}

const accessorySlot = (spec: GarmentSpec) => (spec.details?.slot?.trim().toLowerCase() || (/^(headwear|footwear)$/i.test(spec.category ?? '') ? (spec.category as string).toLowerCase() : ''))

/** What picking these parts together raises. An empty list means nothing clashes. */
export function checkComposition(state: VariationState, input: ComposeInput): Conflict[] {
  const out: Conflict[] = []
  const add = (c: Conflict) => out.push(c)
  const rev = (ref: Ref | undefined) => (ref ? findRevision(state, ref) : undefined)
  const ent = (ref: Ref | undefined) => (ref ? findEntity(state, ref.id) : undefined)

  const parts: Array<[string, Ref | undefined]> = [['age', input.age], ['transformation stage', input.transformation], ['outfit', input.fit], ['condition', input.condition], ...(input.accessories ?? []).map((a): [string, Ref] => ['accessory', a])]
  for (const [label, ref] of parts) {
    if (!ref) continue
    const r = rev(ref)
    const e = ent(ref)
    if (!r || !e) { add({ id: `missing-${ref.id}`, severity: 'blocks', message: `The ${label} (${ref.id}) is not in this project.` }); continue }
    if (r.status !== 'approved') add({ id: `unapproved-${ref.id}`, severity: 'blocks', message: `The ${label} (${e.name}) is not approved yet.`, fix: 'Approve it first.' })
    if (e.characterId && e.characterId !== input.characterId && e.kind !== 'garment') add({ id: `other-character-${ref.id}`, severity: 'blocks', message: `The ${label} (${e.name}) belongs to a different character.` })
    if (r.status === 'approved' && stalenessOf(state, ref).stale) add({ id: `stale-${ref.id}`, severity: 'warns', message: `The ${label} (${e.name}) was approved before something it uses changed.`, fix: 'Make it again from the new version, or accept it as it is.' })
  }

  const fit = rev(input.fit)?.spec as FitSpec | undefined
  const body = input.transformation ?? input.age
  const bodyName = body ? (ent(body)?.name ?? body.id) : undefined

  if (input.age && input.transformation) {
    add({ id: 'age-and-transformation', severity: 'warns', message: 'No picture shows this age and this transformation stage together: a transformation stage is made from the character as approved or from the stage before it, not from an aged version.', fix: 'Approve it only as a record of what is intended, or choose one of the two.' })
  }

  if (fit) {
    const fitBody = fit.body
    if (body && (!fitBody || fitBody.id !== body.id || fitBody.revision !== body.revision)) {
      const transformed = findEntity(state, body.id)?.kind === 'transformation'
      add({
        id: 'fit-body', severity: 'blocks',
        message: transformed
          ? `The outfit was fitted to ${fitBody ? (ent(fitBody)?.name ?? 'another body') : 'the character as approved'}, but ${bodyName} changes the body: the clothes may not fit or may clash with the new anatomy.`
          : `The outfit was fitted to ${fitBody ? (ent(fitBody)?.name ?? 'another body') : 'the character as approved'}, not to ${bodyName}.`,
        fix: `Fit the garment to ${bodyName} in the Wardrobe studio.`,
      })
    } else if (!body && fitBody) {
      add({ id: 'fit-body', severity: 'blocks', message: `The outfit was fitted to ${ent(fitBody)?.name ?? 'another body'}, but no body variant is chosen for this look.`, fix: 'Choose that body variant, or fit the garment to the character as approved.' })
    }
  }

  const cond = rev(input.condition)?.spec as ConditionSpec | undefined
  if (input.condition && cond) {
    if (fit) {
      const fitCond = fit.condition
      if (!fitCond || fitCond.id !== input.condition.id || fitCond.revision !== input.condition.revision) {
        add({ id: 'fit-condition', severity: 'blocks', message: `The outfit picture shows ${fitCond ? (ent(fitCond)?.name ?? 'another condition') : 'the garment as new'}, not “${ent(input.condition)?.name}”.`, fix: `Fit the garment in the condition “${ent(input.condition)?.name}” in the Wardrobe studio.` })
      }
      if (cond.garment.id !== fit.garment.id || cond.garment.revision !== fit.garment.revision) {
        add({ id: 'condition-garment', severity: 'blocks', message: `The condition “${ent(input.condition)?.name}” was made from a different version of the garment than the outfit uses.`, fix: 'Make the condition again from the garment version the outfit uses, or fit the newer garment.' })
      }
    } else {
      add({ id: 'condition-needs-outfit', severity: 'blocks', message: 'A condition belongs to a garment: choose the outfit it is worn in.' })
    }
  } else if (fit?.condition && !input.condition) {
    add({ id: 'fit-has-condition', severity: 'blocks', message: `The outfit picture shows the garment in the condition “${ent(fit.condition)?.name}”, but no condition is chosen.`, fix: 'Choose that condition, or pick the pristine outfit.' })
  }

  // Accessories: two things that go in the same place cannot both be worn.
  const seen = new Map<string, string>()
  for (const a of input.accessories ?? []) {
    const e = ent(a)
    const spec = rev(a)?.spec as GarmentSpec | undefined
    if (!e || e.kind !== 'garment' || !spec) { if (e && e.kind !== 'garment') add({ id: `accessory-kind-${a.id}`, severity: 'blocks', message: `${e.name} is not a garment, so it cannot be an accessory.` }); continue }
    const slot = accessorySlot(spec)
    if (!slot) continue
    const first = seen.get(slot)
    if (first) add({ id: `accessory-${slot}`, severity: 'blocks', message: `${first} and ${e.name} both go on the ${slot}: they cannot both be worn.`, fix: 'Choose one of them.' })
    else seen.set(slot, e.name)
  }
  return out
}

/** Whether a set of conflicts lets the look be approved: nothing blocks, and every warning has been acknowledged by id. */
export function canApprove(conflicts: Conflict[], acknowledged: string[] = []): boolean {
  return conflicts.every((c) => c.severity === 'warns' && acknowledged.includes(c.id))
}

/** What the look's reference picture is: the approved outfit picture when the outfit is chosen, else the body variant's, else none (the character as approved). */
export function lookQueueVariant(state: VariationState, input: ComposeInput): string {
  const fit = input.fit && (findRevision(state, input.fit)?.spec as FitSpec | undefined)
  if (fit?.variant) return fit.variant
  const body = input.transformation ?? input.age
  const spec = body && (findRevision(state, body)?.spec as AgeSpec | TransformationSpec | undefined)
  if (spec && 'variant' in spec && spec.variant) return spec.variant
  return 'Canonical'
}

/**
 * Approves the combination as a production look, pinned to exactly the revisions that were chosen. Refuses while anything blocks or a warning has not been
 * acknowledged. Composing the same name again for the same character is a new revision of that look.
 */
export function composeLook(state: VariationState, input: ComposeInput, now: string, acknowledged: string[] = []): { variations: VariationState; ref: Ref } {
  const conflicts = checkComposition(state, input)
  if (!canApprove(conflicts, acknowledged)) {
    const first = conflicts.find((c) => c.severity === 'blocks' || !acknowledged.includes(c.id))
    throw new Error(`This look cannot be approved yet: ${first?.message ?? 'a conflict is not resolved.'}`)
  }
  const spec: LookSpec = {
    characterId: input.characterId,
    ...(input.age ? { age: { ...input.age } } : {}), ...(input.transformation ? { transformation: { ...input.transformation } } : {}),
    ...(input.fit ? { fit: { ...input.fit } } : {}), ...(input.condition ? { condition: { ...input.condition } } : {}),
    ...(input.accessories?.length ? { accessories: input.accessories.map((a) => ({ ...a })) } : {}),
    ...(input.sceneIds?.length ? { sceneIds: [...new Set(input.sceneIds)].sort() } : {}), ...(input.styleFp ? { styleFp: input.styleFp } : {}),
    queueVariant: lookQueueVariant(state, input),
  }
  const name = input.name.trim() || 'Look'
  const existing = state.entities.find((e) => e.kind === 'look' && e.characterId === input.characterId && e.name === name)
  const made = existing ? addRevision(state, existing.id, { spec, now, ...(latestApproved(existing) ? { parent: { id: existing.id, revision: latestApproved(existing)!.n } } : {}), note: acknowledged.length ? `Acknowledged: ${acknowledged.join(', ')}` : undefined })
    : createEntity(state, 'look', { name, characterId: input.characterId, spec, now, note: acknowledged.length ? `Acknowledged: ${acknowledged.join(', ')}` : undefined })
  return { variations: approveRevision(made.state, made.ref), ref: made.ref }
}
