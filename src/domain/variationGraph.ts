import { findEntity, findRevision, latestApproved, refKey, type AnyEntity, type AnySpec, type EntityKind, type Ref, type VariationState } from './variations'

/**
 * Which revisions a revision depends on, read from its spec. A garment depends on nothing. A fit depends on its garment (and the body variant it was
 * made for). A condition depends on its garment and the condition it continues. An age variant depends on nothing here (its character is the base).
 * A transformation depends on the stage before it. A look depends on every slot it fills.
 */
export function depsOf(kind: EntityKind, spec: AnySpec): Array<{ ref: Ref; expects: EntityKind[]; role: string }> {
  const s = spec as unknown as Record<string, unknown>
  const out: Array<{ ref: Ref; expects: EntityKind[]; role: string }> = []
  const add = (ref: unknown, expects: EntityKind[], role: string) => { if (ref && typeof ref === 'object') out.push({ ref: ref as Ref, expects, role }) }
  switch (kind) {
    case 'fit': add(s.garment, ['garment'], 'garment'); add(s.condition, ['condition'], 'condition'); add(s.body, ['age', 'transformation'], 'body variant'); break
    case 'condition': add(s.garment, ['garment'], 'garment'); add(s.from, ['condition'], 'earlier condition'); break
    case 'transformation': add(s.from, ['transformation'], 'earlier stage'); break
    case 'look':
      add(s.age, ['age'], 'age'); add(s.transformation, ['transformation'], 'transformation'); add(s.fit, ['fit'], 'outfit fit'); add(s.condition, ['condition'], 'condition')
      for (const a of (s.accessories as Ref[] | undefined) ?? []) add(a, ['garment', 'fit'], 'accessory')
      break
    default: break
  }
  return out
}

export type Reason =
  | { kind: 'newer'; dependsOn: Ref; newer: number; role: string }
  | { kind: 'missing'; dependsOn: Ref; role: string }
  | { kind: 'not-approved'; dependsOn: Ref; role: string }
  | { kind: 'wrong-kind'; dependsOn: Ref; role: string; found: EntityKind }
  | { kind: 'upstream-stale'; dependsOn: Ref; role: string }
  | { kind: 'cycle'; dependsOn: Ref; role: string }

export interface Staleness { ref: Ref; stale: boolean; reasons: Reason[] }

/**
 * Whether a pinned revision is still current. It is stale when something it was made from has a newer approved revision, can no longer be found,
 * is not approved, is the wrong kind of record, or is itself stale. Nothing here changes anything: a stale look keeps pointing at the revisions it was
 * approved with, and unrelated records are never touched.
 */
export function stalenessOf(state: VariationState, ref: Ref, seen: Set<string> = new Set()): Staleness {
  const here = refKey(ref)
  const entity = findEntity(state, ref.id)
  const revision = findRevision(state, ref)
  if (!entity || !revision) return { ref, stale: true, reasons: [{ kind: 'missing', dependsOn: ref, role: 'itself' }] }
  const reasons: Reason[] = []
  const nextSeen = new Set(seen).add(here)
  for (const dep of depsOf(entity.kind, revision.spec)) {
    const target = findEntity(state, dep.ref.id)
    const targetRev = findRevision(state, dep.ref)
    if (!target || !targetRev) { reasons.push({ kind: 'missing', dependsOn: dep.ref, role: dep.role }); continue }
    if (!dep.expects.includes(target.kind)) { reasons.push({ kind: 'wrong-kind', dependsOn: dep.ref, role: dep.role, found: target.kind }); continue }
    if (nextSeen.has(refKey(dep.ref))) { reasons.push({ kind: 'cycle', dependsOn: dep.ref, role: dep.role }); continue }
    if (targetRev.status !== 'approved') { reasons.push({ kind: 'not-approved', dependsOn: dep.ref, role: dep.role }); continue }
    const newest = latestApproved(target)
    if (newest && newest.n > dep.ref.revision) { reasons.push({ kind: 'newer', dependsOn: dep.ref, newer: newest.n, role: dep.role }); continue }
    if (stalenessOf(state, dep.ref, nextSeen).stale) reasons.push({ kind: 'upstream-stale', dependsOn: dep.ref, role: dep.role })
  }
  return { ref, stale: reasons.length > 0, reasons }
}

/** Every revision that is stale because of what it depends on. Candidates are skipped: they have not been relied on yet. */
export function staleRevisions(state: VariationState): Staleness[] {
  const out: Staleness[] = []
  for (const e of state.entities) for (const r of e.revisions) {
    if (r.status !== 'approved') continue
    const s = stalenessOf(state, { id: e.id, revision: r.n })
    if (s.stale) out.push(s)
  }
  return out
}

/** The approved revisions that directly or indirectly depend on a revision. This is what to mark when that revision is replaced. */
export function dependentsOf(state: VariationState, ref: Ref): Ref[] {
  const direct = (target: Ref): Ref[] => {
    const found: Ref[] = []
    for (const e of state.entities) for (const r of e.revisions) {
      if (depsOf(e.kind, r.spec).some((d) => d.ref.id === target.id && d.ref.revision === target.revision)) found.push({ id: e.id, revision: r.n })
    }
    return found
  }
  const seen = new Set<string>([refKey(ref)])
  const queue = [ref]
  const out: Ref[] = []
  while (queue.length) {
    const next = queue.shift() as Ref
    for (const d of direct(next)) if (!seen.has(refKey(d))) { seen.add(refKey(d)); out.push(d); queue.push(d) }
  }
  return out
}

export interface Problem { entityId: string; revision?: number; message: string }

/** Structural checks on the records themselves: dangling or mistyped references, revision numbering, and a look that mixes characters. */
export function validateVariations(state: VariationState): Problem[] {
  const problems: Problem[] = []
  const ids = new Set<string>()
  for (const e of state.entities) {
    if (ids.has(e.id)) problems.push({ entityId: e.id, message: `${e.id} is used twice.` })
    ids.add(e.id)
    const numbers = e.revisions.map((r) => r.n)
    if (new Set(numbers).size !== numbers.length) problems.push({ entityId: e.id, message: `${e.id} has two revisions with the same number.` })
    if (numbers.some((n, i) => i > 0 && n <= numbers[i - 1])) problems.push({ entityId: e.id, message: `${e.id} revisions are out of order.` })
    for (const r of e.revisions) {
      for (const d of depsOf(e.kind, r.spec)) {
        const target = findEntity(state, d.ref.id)
        if (!target || !findRevision(state, d.ref)) problems.push({ entityId: e.id, revision: r.n, message: `${e.id} revision ${r.n} points at ${refKey(d.ref)} (${d.role}), which is not in this project.` })
        else if (!d.expects.includes(target.kind)) problems.push({ entityId: e.id, revision: r.n, message: `${e.id} revision ${r.n}: the ${d.role} is a ${target.kind}, not a ${d.expects.join(' or ')}.` })
      }
      if (e.kind === 'look') {
        const mixed = depsOf('look', r.spec).map((d) => findEntity(state, d.ref.id)).filter((t): t is AnyEntity => !!t && !!t.characterId && !!e.characterId && t.characterId !== e.characterId)
        for (const t of mixed) problems.push({ entityId: e.id, revision: r.n, message: `${e.id} revision ${r.n} uses ${t.id}, which belongs to a different character.` })
      }
    }
  }
  return problems
}
