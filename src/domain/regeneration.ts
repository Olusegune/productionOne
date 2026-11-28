import { depsOf, staleRevisions, stalenessOf, type Reason } from './variationGraph'
import { addRevision, approveRevision, findEntity, findRevision, latestApproved, type AnyEntity, type AnySpec, type EntityKind, type LookSpec, type Ref, type VariationState } from './variations'

/**
 * Targeted regeneration. When something upstream changes (a garment gets a new version, an age is made again), only what was built on the old version is stale.
 * This lists exactly those items in the order they should be remade, says why, and counts the approvals that are untouched. It makes nothing and spends nothing:
 * each step is for a person to start.
 */
export interface PlanStep {
  ref: Ref
  entityId: string
  name: string
  kind: EntityKind
  /** What to do, in plain words. */
  action: string
  /** Why it is out of date. */
  because: string[]
  /** 0 for things that depend on nothing that changed, then 1, 2 ... so earlier steps come first. */
  order: number
}

export const reasonText = (state: VariationState, r: Reason): string => {
  const name = findEntity(state, r.dependsOn.id)?.name ?? r.dependsOn.id
  switch (r.kind) {
    case 'newer': return `${name} (${r.role}) has a newer approved version (${r.newer}); this was made from version ${r.dependsOn.revision}.`
    case 'missing': return `${name} (${r.role}) is no longer in the project.`
    case 'not-approved': return `${name} (${r.role}) is not approved.`
    case 'wrong-kind': return `${name} (${r.role}) is a ${r.found}, which does not belong there.`
    case 'upstream-stale': return `${name} (${r.role}) is itself out of date.`
    case 'cycle': return `${name} (${r.role}) points back at this item.`
  }
}

const actionFor = (state: VariationState, e: AnyEntity, spec: AnySpec): string => {
  switch (e.kind) {
    case 'fit': { const s = spec as { garment: Ref; condition?: Ref; body?: Ref }; const g = findEntity(state, s.garment.id)?.name ?? 'the garment'; return `Make a new fit of ${g}${s.condition ? ` in its condition` : ''} on ${e.name.split(' in ')[0]}, then approve it.` }
    case 'condition': return 'Make this condition again from the newer garment (or the earlier condition that changed), then approve it.'
    case 'transformation': return 'Make this stage again from the earlier stage that changed, then approve it.'
    case 'age': return 'Make this age again, then approve it.'
    case 'garment': return 'Make this garment again, then approve it.'
    case 'look': return 'Update the look to the newer versions once its parts are remade.'
    case 'prop': return 'Confirm the prop size again, then approve it.'
    case 'relationship': return 'Look at this relationship again: one of the things it was agreed for has changed. Approve a new version if it still holds.'
  }
}

/** How far down a chain of dependencies an item is, counting only items that are themselves stale. 0 means it depends on no other stale item. */
function depthAmongStale(state: VariationState, ref: Ref, stale: Set<string>, seen = new Set<string>()): number {
  const key = `${ref.id}@${ref.revision}`
  if (seen.has(key)) return 0
  const rev = findRevision(state, ref)
  const e = findEntity(state, ref.id)
  if (!rev || !e) return 0
  const next = new Set(seen).add(key)
  const ds = depsOf(e.kind, rev.spec).filter((d) => stale.has(`${d.ref.id}@${d.ref.revision}`)).map((d) => 1 + depthAmongStale(state, d.ref, stale, next))
  return ds.length ? Math.max(...ds) : 0
}

export interface Plan { steps: PlanStep[]; untouchedApprovals: number }

export function regenerationPlan(state: VariationState): Plan {
  // Only each record's current approved version matters: an older version that has been replaced is history, not something to remake.
  const stale = staleRevisions(state).filter((s) => latestApproved(findEntity(state, s.ref.id) as AnyEntity)?.n === s.ref.revision)
  const keys = new Set(stale.map((s) => `${s.ref.id}@${s.ref.revision}`))
  const steps: PlanStep[] = stale.map((s) => {
    const e = findEntity(state, s.ref.id) as AnyEntity
    const rev = findRevision(state, s.ref)!
    return { ref: s.ref, entityId: e.id, name: e.name, kind: e.kind, action: actionFor(state, e, rev.spec), because: s.reasons.map((r) => reasonText(state, r)), order: depthAmongStale(state, s.ref, keys) }
  }).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const current = state.entities.filter((e) => latestApproved(e)).length
  return { steps, untouchedApprovals: current - steps.length }
}

/**
 * Brings a look up to date: a new approved revision whose parts point at the newest approved revision of each part. Refuses unless every part has one and
 * none of them is itself stale, so it cannot hide a part that still needs remaking. The earlier revision of the look stays as it was.
 */
export function refreshLook(state: VariationState, lookId: string, now: string): { variations: VariationState; ref: Ref } {
  const look = findEntity(state, lookId)
  const rev = look && latestApproved(look)
  if (!look || look.kind !== 'look' || !rev) throw new Error('Only an approved look can be brought up to date.')
  const spec = { ...(rev.spec as LookSpec) } as LookSpec & Record<string, unknown>
  const move = (ref: Ref | undefined): Ref | undefined => {
    if (!ref) return ref
    const e = findEntity(state, ref.id)
    const newest = e && latestApproved(e)
    if (!e || !newest) throw new Error(`${ref.id} has no approved version to move to.`)
    return { id: ref.id, revision: newest.n }
  }
  for (const slot of ['age', 'transformation', 'fit', 'condition'] as const) if (spec[slot]) spec[slot] = move(spec[slot] as Ref)
  if (spec.accessories) spec.accessories = spec.accessories.map((a) => move(a) as Ref)
  const made = addRevision(state, lookId, { spec: spec as LookSpec, now, parent: { id: lookId, revision: rev.n }, note: 'Brought up to date' })
  const approved = approveRevision(made.state, made.ref)
  const still = staleRevisionsOf(approved, made.ref)
  if (still) throw new Error(`The look cannot be brought up to date yet: ${still}`)
  return { variations: approved, ref: made.ref }
}

function staleRevisionsOf(state: VariationState, ref: Ref): string | undefined {
  const s = stalenessOf(state, ref)
  return s.stale ? s.reasons.map((r) => reasonText(state, r)).join(' ') : undefined
}
