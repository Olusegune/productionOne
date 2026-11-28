import { dependentsOf } from './variationGraph'
import { findEntity, type Ref, type VariationState } from './variations'

/**
 * Preflight: what an action will do, said before it is done. It is built from the records, never from the picture model: what will be made, what is
 * protected, what stays as it is, what it affects, what it uses and what it costs. Nothing here starts anything.
 */
export interface Preflight {
  /** One line: what will be made. */
  makes: string
  /** The cost in plain words, exactly as it will be charged. */
  cost: string
  /** What must stay recognisable or unchanged. */
  protectedItems: string[]
  /** A sentence saying what is left alone. */
  untouched: string
  /** Approved things that depend on what is being changed. They are flagged afterwards, not changed. */
  affects: string[]
  /** The pictures and settings the work starts from. */
  uses: string[]
  /** What the person gets. */
  deliverables: string[]
}

/** The approved things that depend on a record, in plain words. Used so a person sees the effect before making a new version. */
export function affectedBy(state: VariationState, ref: Ref | undefined): string[] {
  if (!ref) return []
  const names = dependentsOf(state, ref).flatMap((d) => { const e = findEntity(state, d.id); const r = e?.revisions.find((x) => x.n === d.revision); return e && r?.status === 'approved' ? [e.name] : [] })
  return [...new Set(names)]
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export function buildPreflight(input: { count: number; what: string; costLabel: string; protectedItems: string[]; approvedUntouched: number; affects: string[]; uses: string[]; deliverables?: string[] }): Preflight {
  return {
    makes: `${plural(input.count, 'candidate picture')}: ${input.what}`,
    cost: input.costLabel,
    protectedItems: input.protectedItems.filter((x) => x.trim()),
    untouched: input.approvedUntouched > 0 ? `${plural(input.approvedUntouched, 'approved item')} stay exactly as they are. New pictures are candidates until you approve them.` : 'New pictures are candidates until you approve them. Nothing approved is changed.',
    affects: input.affects,
    uses: input.uses.filter((x) => x.trim()),
    deliverables: input.deliverables ?? [`${plural(input.count, 'candidate picture')} for you to approve or turn down`],
  }
}
