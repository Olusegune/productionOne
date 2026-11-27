import { addRevision, createEntity, type AnySpec, type EntityKind, type MediaRef, type Ref, type Revision, type VariationState } from './variations'

/**
 * The one workflow every studio (wardrobe, age, transformation, looks) follows:
 * configure, preview, compare, approve, then make the reference sheets.
 * These are plain rules about where a revision stands. Nothing here starts a request or spends money.
 */
export type Stage = 'configure' | 'preview' | 'compare' | 'approve' | 'sheets'

export interface Standing {
  stage: Stage
  /** Whether a person can approve it now. Approval needs a picture to look at, except for records carried over from an older project. */
  canApprove: boolean
  /** One plain sentence on what to do next. */
  next: string
}

export function standingOf(revision: Revision<AnySpec>, opts: { hasSource: boolean }): Standing {
  if (revision.status === 'approved') return { stage: 'sheets', canApprove: false, next: 'Approved. Make its reference sheets.' }
  if (revision.status === 'rejected') return { stage: 'configure', canApprove: false, next: 'Turned down. Change the settings and make a new candidate.' }
  if (revision.media.length === 0) {
    return revision.legacy
      ? { stage: 'approve', canApprove: true, next: 'Carried over from an older project. Approve it to use it in looks.' }
      : { stage: 'preview', canApprove: false, next: 'Make a preview picture to look at.' }
  }
  return opts.hasSource
    ? { stage: 'compare', canApprove: true, next: 'Compare it with the source, then approve or turn it down.' }
    : { stage: 'approve', canApprove: true, next: 'Look at it, then approve or turn it down.' }
}

/** What a set of requests is expected to cost, from the price per request the person entered. Null when no price is set, never a guess. */
export function estimateCost(count: number, perRequestUsd: number | null): { requests: number; usd: number | null } {
  return { requests: count, usd: perRequestUsd === null ? null : Math.round(count * perRequestUsd * 100) / 100 }
}

/**
 * Settings being adjusted but not yet turned into a candidate. Moving a slider edits only this local copy: the project's records are not touched
 * and no request is made until the person presses the button that makes a candidate.
 */
export interface Draft<S extends AnySpec> { kind: EntityKind; spec: S; /** The revision these settings started from, when there was one. */ base?: Ref; edits: number }

export const startDraft = <S extends AnySpec>(kind: EntityKind, spec: S, base?: Ref): Draft<S> => ({ kind, spec: structuredClone(spec), ...(base ? { base } : {}), edits: 0 })

export const editDraft = <S extends AnySpec>(draft: Draft<S>, change: Partial<S>): Draft<S> => ({ ...draft, spec: { ...draft.spec, ...change }, edits: draft.edits + 1 })

/**
 * Turns a draft into a candidate record. The new revision continues from the one the draft started from, so the history reads as a line of choices.
 * Pass `entityId` to add a revision to an existing record, or `name` to start a new one.
 */
export function commitDraft<S extends AnySpec>(
  state: VariationState,
  draft: Draft<S>,
  target: { entityId: string } | { name: string; characterId?: string },
  now: string,
  media: MediaRef[] = [],
): { state: VariationState; ref: Ref } {
  if ('entityId' in target) return addRevision(state, target.entityId, { spec: draft.spec, now, ...(draft.base ? { parent: draft.base } : {}), media })
  return createEntity(state, draft.kind, { name: target.name, characterId: target.characterId, spec: draft.spec, now, ...(draft.base ? { parent: draft.base } : {}), media })
}
