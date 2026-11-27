import type { ExtractedAsset } from './productionStudio'
import { addRevision, approvedPicture, createEntity, findEntity, findRevision, latestApproved, type Ref, type TransformationSpec, type VariationState } from './variations'

/** Changes for the Transformation Studio, as plain changes to the records. Nothing here generates anything. */

/** The queue variant name for a stage of a transformation of a character. It is also the look's name. */
export const stageLookName = (characterName: string, kind: string, stage: string) => `${characterName} · ${kind.trim()} · ${stage.trim().toLowerCase()}`.slice(0, 90)

/**
 * A candidate stage. A stage continues from the approved stage before it (`from`), which must belong to the same character and the same kind of
 * transformation, so the stages are one character changing. A first stage has no `from` and starts from the character's own approved picture.
 * Making the same stage again is a new revision of that stage. The character's own record is not changed.
 */
export function newStage(
  state: VariationState,
  input: { character: ExtractedAsset; spec: Omit<TransformationSpec, 'characterId' | 'variant' | 'from'>; from?: Ref; now: string },
): { variations: VariationState; ref: Ref; variant: string } {
  if (input.from) {
    const prev = findEntity(state, input.from.id)
    const rev = findRevision(state, input.from)
    if (!prev || prev.kind !== 'transformation' || !rev) throw new Error('The earlier stage is not in this project.')
    if (rev.status !== 'approved') throw new Error('A stage can only continue from an approved stage.')
    const p = rev.spec as TransformationSpec
    if (p.characterId !== input.character.id) throw new Error('A stage can only continue from a stage of the same character.')
    if (p.kind.trim().toLowerCase() !== input.spec.kind.trim().toLowerCase()) throw new Error('A stage can only continue from a stage of the same kind of transformation.')
  }
  const variant = stageLookName(input.character.name, input.spec.kind, input.spec.stage)
  const spec: TransformationSpec = {
    ...input.spec, characterId: input.character.id, variant, ...(input.from ? { from: input.from } : {}),
    ...(input.spec.anchors ? { anchors: [...input.spec.anchors] } : {}),
    ...(input.spec.expectedAnatomy ? { expectedAnatomy: [...input.spec.expectedAnatomy] } : {}),
    ...(input.spec.details ? { details: { ...input.spec.details } } : {}),
  }
  const existing = state.entities.find((e) => e.kind === 'transformation' && e.characterId === input.character.id && e.name === variant)
  if (existing) { const made = addRevision(state, existing.id, { spec, now: input.now }); return { variations: made.state, ref: made.ref, variant } }
  const made = createEntity(state, 'transformation', { name: variant, characterId: input.character.id, spec, now: input.now, ...(input.from ? { parent: input.from } : {}) })
  return { variations: made.state, ref: made.ref, variant }
}

/** The approved picture of a stage's newest approved revision. */
export function stagePicture(state: VariationState, stageId: string): { ref: Ref; path: string } | undefined {
  const e = findEntity(state, stageId)
  const rev = e && latestApproved(e)
  const media = rev && approvedPicture(rev)
  return rev && media ? { ref: { id: stageId, revision: rev.n }, path: media.path } : undefined
}

export interface StageNode { entityId: string; name: string; stage: string; status: 'approved' | 'candidate'; intensity?: number }
export interface StageLine { kind: string; stages: StageNode[] }

/**
 * The transformations of a character as lines of stages: each line starts at a stage with no earlier stage and follows the stages that continue from it.
 * Two kinds of transformation on one character are two lines.
 */
export function stageLines(state: VariationState, characterId: string): StageLine[] {
  const mine = state.entities.filter((e) => e.kind === 'transformation' && e.characterId === characterId)
  const specOf = (id: string) => { const e = findEntity(state, id)!; return e.revisions[e.revisions.length - 1].spec as TransformationSpec }
  const fromOf = (id: string) => specOf(id).from?.id
  const node = (id: string): StageNode => { const e = findEntity(state, id)!; const s = specOf(id); return { entityId: id, name: e.name, stage: s.stage, status: latestApproved(e) ? 'approved' : 'candidate', intensity: s.intensity } }
  const lines: StageLine[] = []
  for (const root of mine.filter((e) => { const f = fromOf(e.id); return !f || !mine.some((m) => m.id === f) })) {
    const stages = [node(root.id)]
    const seen = new Set([root.id])
    let cursor = root.id
    for (;;) {
      const next = mine.find((m) => !seen.has(m.id) && fromOf(m.id) === cursor)
      if (!next) break
      stages.push(node(next.id)); seen.add(next.id); cursor = next.id
    }
    lines.push({ kind: specOf(root.id).kind, stages })
  }
  return lines
}

/** The last approved stage in a character's line of a kind: the stage the next one continues from. Undefined when there is none yet (the next stage starts from the character). */
export function lastApprovedStage(state: VariationState, characterId: string, kind: string): { entityId: string; ref: Ref; stage: string; path: string } | undefined {
  const line = stageLines(state, characterId).find((l) => l.kind.trim().toLowerCase() === kind.trim().toLowerCase())
  if (!line) return undefined
  for (const s of [...line.stages].reverse()) {
    const pic = stagePicture(state, s.entityId)
    if (pic) return { entityId: s.entityId, ref: pic.ref, stage: s.stage, path: pic.path }
  }
  return undefined
}
