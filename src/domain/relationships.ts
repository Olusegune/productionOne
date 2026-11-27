import { createEntity, findRevision, latestApproved, refKey, type AnyEntity, type Ref, type RelationKind, type RelationshipSpec, type Revision, type Subject, type VariationState } from './variations'
import { stalenessOf, type Reason } from './variationGraph'
import type { World } from './sceneState'

/**
 * Relationships between assets: ownership ("VIP chair belongs to Venomspur"), interaction ("the rapper sits on the sofa"), scale ("Venomspur is 1.4 times the height
 * of the rapper") and attachment. They are variation records (see variations.ts), so they have immutable revisions, are approved by a person, are pinned to the
 * body or outfit they were agreed for, and are flagged by the same staleness machinery when that changes.
 *
 * Scene states keep per-scene layout (where things are). Relationships keep what is true about two assets wherever they appear. `applyRelationships` lets the
 * second feed the first without storing anything twice, and nothing here changes an approved record.
 */

export const RELATION_KINDS: RelationKind[] = ['scale', 'interaction', 'ownership', 'attachment']
export const VERBS = ['sit', 'hold', 'wear', 'operate', 'open', 'carry'] as const

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

function readSubject(v: unknown): Subject | undefined {
  if (!isObj(v)) return undefined
  const asset = text(v.asset, 80)
  if (!asset) return undefined
  const pin = isObj(v.pin) && typeof v.pin.id === 'string' && v.pin.id && typeof v.pin.revision === 'number' && Number.isInteger(v.pin.revision) && v.pin.revision > 0 ? { id: v.pin.id, revision: v.pin.revision } : undefined
  return { asset, ...(pin ? { pin } : {}) }
}

/** Reads one relationship's settings from a saved file. Anything unusable returns undefined, so a damaged record is dropped and cannot break opening the project. */
export function readRelationshipSpec(raw: unknown): RelationshipSpec | undefined {
  if (!isObj(raw) || !RELATION_KINDS.includes(raw.relation as RelationKind)) return undefined
  const a = readSubject(raw.a), b = readSubject(raw.b)
  if (!a || !b || a.asset === b.asset) return undefined
  const relation = raw.relation as RelationKind
  const verb = text(raw.verb, 30)
  const ratio = typeof raw.ratio === 'number' && Number.isFinite(raw.ratio) && raw.ratio > 0 && raw.ratio <= 1000 ? raw.ratio : undefined
  if (relation === 'scale' && ratio === undefined) return undefined
  if (relation === 'interaction' && !verb) return undefined
  const note = text(raw.note, 300)
  const sceneIds = Array.isArray(raw.sceneIds) ? raw.sceneIds.filter((x): x is string => typeof x === 'string' && !!x).slice(0, 200) : undefined
  return {
    relation, a, b, basis: raw.basis === 'measured' ? 'measured' : 'declared',
    ...(relation === 'interaction' && verb ? { verb } : {}),
    ...(relation === 'ownership' ? { exclusive: raw.exclusive !== false } : {}),
    ...(relation === 'scale' && ratio !== undefined ? { ratio } : {}),
    ...(note ? { note } : {}), ...(sceneIds?.length ? { sceneIds } : {}),
  }
}

/** Why a relationship cannot be saved, in plain words, or undefined when it can. */
export function checkRelationship(spec: RelationshipSpec): string | undefined {
  if (!spec.a.asset || !spec.b.asset) return 'Choose both things.'
  if (spec.a.asset === spec.b.asset) return 'A thing cannot have a relationship with itself.'
  if (spec.relation === 'scale' && !(typeof spec.ratio === 'number' && spec.ratio > 0 && spec.ratio <= 1000)) return 'Give the size as a number greater than zero, such as 1.4.'
  if (spec.relation === 'interaction' && !spec.verb?.trim()) return 'Say what it does with it: sit, hold, wear, operate, open or carry.'
  return undefined
}

export interface RelationshipView { entity: AnyEntity; ref: Ref; spec: RelationshipSpec; status: Revision<RelationshipSpec>['status']; stale: boolean; reasons: Reason[] }

const relationshipEntities = (state: VariationState) => state.entities.filter((e) => e.kind === 'relationship' && !e.archived)

/** The newest revision of each relationship (what a person is looking at), with whether it still holds. */
export function relationshipViews(state: VariationState): RelationshipView[] {
  const out: RelationshipView[] = []
  for (const e of relationshipEntities(state)) {
    const r = [...e.revisions].sort((x, y) => y.n - x.n)[0] as Revision<RelationshipSpec>
    const ref = { id: e.id, revision: r.n }
    const s = r.status === 'approved' ? stalenessOf(state, ref) : { stale: false, reasons: [] as Reason[] }
    out.push({ entity: e, ref, spec: r.spec, status: r.status, stale: s.stale, reasons: s.reasons })
  }
  return out
}

/** Every relationship that mentions this asset, newest revision first of each. */
export const relationshipsFor = (state: VariationState, assetId: string): RelationshipView[] => relationshipViews(state).filter((v) => v.spec.a.asset === assetId || v.spec.b.asset === assetId)

const inScene = (spec: RelationshipSpec, sceneId?: string) => !spec.sceneIds?.length || !sceneId || spec.sceneIds.includes(sceneId)

/** The approved relationships that currently hold (the newest approved revision of each), optionally for one scene. A relationship that is out of date is still returned, because it still says what was agreed; its `stale` flag says to look again. */
export function approvedRelationships(state: VariationState, sceneId?: string): Array<{ ref: Ref; spec: RelationshipSpec; stale: boolean }> {
  const out: Array<{ ref: Ref; spec: RelationshipSpec; stale: boolean }> = []
  for (const e of relationshipEntities(state)) {
    const r = latestApproved(e) as Revision<RelationshipSpec> | undefined
    if (!r || !inScene(r.spec, sceneId)) continue
    const ref = { id: e.id, revision: r.n }
    out.push({ ref, spec: r.spec, stale: stalenessOf(state, ref).stale })
  }
  return out
}

export interface RelationshipConflict { kind: 'two-owners' | 'scale-disagrees'; message: string; refs: Ref[] }

/** Approved relationships that contradict each other: two exclusive owners of one thing, or two different sizes for the same pair. */
export function relationshipConflicts(state: VariationState, nameOf: (assetId: string) => string = (id) => id, sceneId?: string): RelationshipConflict[] {
  const rel = approvedRelationships(state, sceneId)
  const out: RelationshipConflict[] = []
  const owners = new Map<string, typeof rel>()
  for (const r of rel.filter((x) => x.spec.relation === 'ownership' && x.spec.exclusive !== false)) owners.set(r.spec.b.asset, [...(owners.get(r.spec.b.asset) ?? []), r])
  for (const [thing, list] of owners) {
    const distinct = new Set(list.map((x) => x.spec.a.asset))
    if (distinct.size > 1) out.push({ kind: 'two-owners', message: `${nameOf(thing)} is assigned to ${[...distinct].map(nameOf).join(' and ')}, but only one can own it.`, refs: list.map((x) => x.ref) })
  }
  const pairs = new Map<string, typeof rel>()
  for (const r of rel.filter((x) => x.spec.relation === 'scale')) {
    const [lo, hi] = [r.spec.a.asset, r.spec.b.asset].sort()
    pairs.set(`${lo}|${hi}`, [...(pairs.get(`${lo}|${hi}`) ?? []), r])
  }
  for (const list of pairs.values()) {
    // Put every ratio on the same footing: how many times the first-sorted asset is as tall as the other.
    const norm = list.map((x) => (x.spec.a.asset < x.spec.b.asset ? x.spec.ratio! : 1 / x.spec.ratio!))
    if (Math.max(...norm) / Math.min(...norm) > 1.1) out.push({ kind: 'scale-disagrees', message: `${nameOf(list[0].spec.a.asset)} and ${nameOf(list[0].spec.b.asset)} have two different sizes recorded.`, refs: list.map((x) => x.ref) })
  }
  return out
}

/**
 * Feeds approved ownership into a scene's layout: a thing with no owner of its own takes the owner the relationship names. The scene state is not edited or saved
 * with this; it is the world as it should be read. An owner set in the scene itself is left as it is.
 */
export function applyRelationships(world: World, state: VariationState, sceneId?: string): World {
  const owner = new Map<string, string>()
  for (const r of approvedRelationships(state, sceneId)) if (r.spec.relation === 'ownership' && r.spec.exclusive !== false) owner.set(r.spec.b.asset, r.spec.a.asset)
  if (!owner.size) return world
  return { ...world, things: world.things.map((t) => (!t.ownedBy && owner.has(t.id) ? { ...t, ownedBy: owner.get(t.id) } : t)) }
}

/** What the scene already says, as relationships that could be recorded: who owns what and who sits where. Nothing is saved; a person chooses what to keep. */
export function proposeFromScene(world: World, state: VariationState, sceneId?: string): RelationshipSpec[] {
  const have = approvedRelationships(state, sceneId).concat(relationshipViews(state).filter((v) => v.status === 'candidate').map((v) => ({ ref: v.ref, spec: v.spec, stale: false })))
  const exists = (relation: RelationKind, a: string, b: string, verb?: string) => have.some((h) => h.spec.relation === relation && h.spec.a.asset === a && h.spec.b.asset === b && (verb ? h.spec.verb === verb : true))
  const out: RelationshipSpec[] = []
  for (const t of world.things) {
    if (t.ownedBy && !exists('ownership', t.ownedBy, t.id)) out.push({ relation: 'ownership', a: { asset: t.ownedBy }, b: { asset: t.id }, exclusive: true, basis: 'declared', ...(sceneId ? { sceneIds: [sceneId] } : {}) })
    if (t.occupies && !exists('interaction', t.id, t.occupies, 'sit')) out.push({ relation: 'interaction', a: { asset: t.id }, b: { asset: t.occupies }, verb: 'sit', basis: 'declared', ...(sceneId ? { sceneIds: [sceneId] } : {}) })
  }
  return out
}

/** A short, plain sentence for a relationship. */
export function describeRelationship(spec: RelationshipSpec, nameOf: (assetId: string) => string = (id) => id): string {
  const a = nameOf(spec.a.asset), b = nameOf(spec.b.asset)
  switch (spec.relation) {
    case 'ownership': return spec.exclusive === false ? `${b} belongs to ${a}` : `${b} belongs to ${a} alone`
    case 'interaction': return `${a} ${spec.verb === 'sit' ? 'sits on' : spec.verb ?? 'uses'} ${b}`
    case 'scale': {
      const r = spec.ratio ?? 1
      return r === 1 ? `${a} is the same height as ${b}` : r > 1 ? `${a} is ${trim(r)} times the height of ${b}` : `${a} is ${trim(1 / r)} times shorter than ${b}`
    }
    case 'attachment': return `${a} is attached to ${b}`
  }
}
const trim = (n: number) => String(Math.round(n * 100) / 100)

/** Makes a candidate relationship. The caller approves it when the person does. */
export function addRelationship(state: VariationState, spec: RelationshipSpec, nameOf: (assetId: string) => string, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const bad = checkRelationship(spec)
  if (bad) return { error: bad }
  const dup = relationshipViews(state).find((v) => v.spec.relation === spec.relation && v.spec.a.asset === spec.a.asset && v.spec.b.asset === spec.b.asset && (v.spec.verb ?? '') === (spec.verb ?? '') && v.status !== 'rejected')
  if (dup) return { error: `That already exists: ${describeRelationship(dup.spec, nameOf)}.` }
  return createEntity(state, 'relationship', { name: describeRelationship(spec, nameOf), spec, now })
}

/** Plain-words problems with the records themselves: a relationship about an asset that is no longer in the project. */
export function relationshipProblems(state: VariationState, assetIds: Set<string>, nameOf: (assetId: string) => string = (id) => id): string[] {
  const out: string[] = []
  for (const v of relationshipViews(state)) {
    for (const s of [v.spec.a, v.spec.b]) if (!assetIds.has(s.asset)) out.push(`${describeRelationship(v.spec, nameOf)}: ${s.asset} is not in this project.`)
    for (const s of [v.spec.a, v.spec.b]) if (s.pin && !findRevision(state, s.pin)) out.push(`${describeRelationship(v.spec, nameOf)}: ${refKey(s.pin)} is not in this project.`)
  }
  return out
}

