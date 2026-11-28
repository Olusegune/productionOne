import { approvedRelationships } from './relationships'
import { findEntity, findRevision, latestApproved, type AnySpec, type LookSpec, type Ref, type SceneSnapshot, type VariationState } from './variations'

/**
 * Scene continuity. A snapshot freezes what a scene was made with: for each person in it, the EXACT revision of their look, and the exact revisions of the
 * relationships in force. There is no "current condition" field anywhere: every reference names a revision, and a revision never changes, so a historical
 * snapshot keeps showing what it showed when it was frozen, whatever has been approved since.
 *
 * Snapshots are append-only. Making a branch copies the latest snapshot of another branch into a new one ("what if this scene is the night version?"); both
 * keep their own history. Nothing here edits an approved record.
 */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const readRef = (v: unknown): Ref | undefined => (isObj(v) && typeof v.id === 'string' && v.id && typeof v.revision === 'number' && Number.isInteger(v.revision) && v.revision > 0 ? { id: v.id, revision: v.revision } : undefined)

/** Reads saved continuity. Damaged snapshots are dropped; snapshots on a branch are kept in order with their own numbers. */
export function readContinuity(raw: unknown): Record<string, SceneSnapshot[]> | undefined {
  if (!isObj(raw)) return undefined
  const out: Record<string, SceneSnapshot[]> = {}
  for (const [sceneId, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue
    const snaps: SceneSnapshot[] = []
    for (const s of list) {
      if (!isObj(s) || typeof s.branch !== 'string' || !s.branch.trim() || typeof s.n !== 'number' || !Number.isInteger(s.n) || s.n < 1 || typeof s.createdAt !== 'string' || !Array.isArray(s.cast)) continue
      const cast = s.cast.flatMap((c) => {
        if (!isObj(c) || typeof c.assetId !== 'string' || !c.assetId) return []
        const look = readRef(c.look)
        const relationships = (Array.isArray(c.relationships) ? c.relationships : []).map(readRef).filter((r): r is Ref => !!r).slice(0, 100)
        return [{ assetId: c.assetId.slice(0, 80), ...(look ? { look } : {}), relationships }]
      }).slice(0, 200)
      const from = isObj(s.fromBranch) && typeof s.fromBranch.branch === 'string' && typeof s.fromBranch.n === 'number' ? { branch: s.fromBranch.branch.slice(0, 60), n: s.fromBranch.n } : undefined
      const note = typeof s.note === 'string' && s.note.trim() ? s.note.trim().slice(0, 300) : undefined
      snaps.push({ n: s.n, branch: s.branch.trim().slice(0, 60), createdAt: s.createdAt, cast, ...(from ? { fromBranch: from } : {}), ...(note ? { note } : {}) })
    }
    if (snaps.length) out[sceneId] = snaps
  }
  return Object.keys(out).length ? out : undefined
}

export const snapshotsOf = (state: VariationState, sceneId: string, branch?: string): SceneSnapshot[] => (state.continuity?.[sceneId] ?? []).filter((s) => !branch || s.branch === branch)
export const branchesOf = (state: VariationState, sceneId: string): string[] => [...new Set(snapshotsOf(state, sceneId).map((s) => s.branch))]
export const latestSnapshot = (state: VariationState, sceneId: string, branch = 'main'): SceneSnapshot | undefined => snapshotsOf(state, sceneId, branch).sort((a, b) => b.n - a.n)[0]

export interface CastInput { assetId: string; look?: Ref }

/**
 * Freezes the scene as it is now on a branch. Every look must be an exact, approved revision of a look; the relationships in force are the approved ones that
 * connect people in this scene (and apply to it), recorded by exact revision. A new numbered snapshot is added; earlier ones are untouched.
 */
export function freezeScene(state: VariationState, sceneId: string, cast: CastInput[], opts: { now: string; branch?: string; note?: string }): { state: VariationState; snapshot: SceneSnapshot } | { error: string } {
  const branch = opts.branch ?? 'main'
  if (!cast.length) return { error: 'Put at least one person in the scene before freezing it.' }
  if (branch !== 'main' && !branchesOf(state, sceneId).includes(branch)) return { error: `There is no branch called "${branch}" for this scene. Make the branch first.` }
  const ids = new Set(cast.map((c) => c.assetId))
  if (ids.size !== cast.length) return { error: 'Someone is listed twice.' }
  for (const c of cast) {
    if (!c.look) continue
    const e = findEntity(state, c.look.id), r = findRevision(state, c.look)
    if (!e || !r || e.kind !== 'look') return { error: `${c.assetId}: that look is not in this project.` }
    if (r.status !== 'approved') return { error: `${e.name} version ${c.look.revision} is not approved, so it cannot be frozen into a scene.` }
  }
  const inForce = approvedRelationships(state, sceneId).filter((r) => ids.has(r.spec.a.asset) && ids.has(r.spec.b.asset)).map((r) => r.ref)
  const previous = snapshotsOf(state, sceneId, branch)
  const n = previous.reduce((m, s) => Math.max(m, s.n), 0) + 1
  const snapshot: SceneSnapshot = {
    n, branch, createdAt: opts.now, cast: cast.map((c) => ({ assetId: c.assetId, ...(c.look ? { look: { ...c.look } } : {}), relationships: inForce.filter((rf) => { const spec = findRevision(state, rf)?.spec as { a?: { asset: string }; b?: { asset: string } } | undefined; return spec?.a?.asset === c.assetId || spec?.b?.asset === c.assetId }) })),
    ...(opts.note?.trim() ? { note: opts.note.trim().slice(0, 300) } : {}),
  }
  return { state: { ...state, continuity: { ...(state.continuity ?? {}), [sceneId]: [...(state.continuity?.[sceneId] ?? []), snapshot] } }, snapshot }
}

/** Starts a new branch from the latest snapshot of another one. The copy keeps the exact same references; the original is untouched. */
export function branchScene(state: VariationState, sceneId: string, from: string, name: string, now: string): { state: VariationState; snapshot: SceneSnapshot } | { error: string } {
  const label = name.trim()
  if (!label) return { error: 'Give the branch a name, for example "night version".' }
  if (branchesOf(state, sceneId).some((b) => b.toLowerCase() === label.toLowerCase())) return { error: `There is already a branch called "${label}".` }
  const source = latestSnapshot(state, sceneId, from)
  if (!source) return { error: `Freeze the "${from}" branch first; there is nothing to branch from yet.` }
  const snapshot: SceneSnapshot = { n: 1, branch: label.slice(0, 60), createdAt: now, cast: structuredClone(source.cast), fromBranch: { branch: source.branch, n: source.n }, note: `Branched from ${source.branch} (snapshot ${source.n}).` }
  return { state: { ...state, continuity: { ...(state.continuity ?? {}), [sceneId]: [...(state.continuity?.[sceneId] ?? []), snapshot] } }, snapshot }
}

export interface ResolvedCast { assetId: string; look?: { ref: Ref; name: string; spec: LookSpec }; relationships: Array<{ ref: Ref; spec: AnySpec }>; newerLook?: number }

/** What a snapshot shows: the exact revision of each look and relationship it pinned, as it was when frozen. A newer version never replaces it; it is only noted. */
export function resolveSnapshot(state: VariationState, snap: SceneSnapshot): ResolvedCast[] {
  return snap.cast.map((c) => {
    const e = c.look ? findEntity(state, c.look.id) : undefined
    const r = c.look ? findRevision(state, c.look) : undefined
    const newest = e ? latestApproved(e) : undefined
    return {
      assetId: c.assetId,
      ...(c.look && e && r ? { look: { ref: c.look, name: e.name, spec: r.spec as LookSpec } } : {}),
      relationships: c.relationships.flatMap((ref) => { const rr = findRevision(state, ref); return rr ? [{ ref, spec: rr.spec }] : [] }),
      ...(c.look && newest && newest.n > c.look.revision ? { newerLook: newest.n } : {}),
    }
  })
}

/** Plain-words notes on what has been approved since a snapshot was frozen. Informational: it never changes the snapshot. */
export function driftSince(state: VariationState, snap: SceneSnapshot, nameOf: (assetId: string) => string = (id) => id): string[] {
  const out: string[] = []
  for (const c of resolveSnapshot(state, snap)) {
    if (c.look && c.newerLook) out.push(`${nameOf(c.assetId)}: ${c.look.name} has a newer approved version (${c.newerLook}); this scene was frozen with version ${c.look.ref.revision}.`)
    const pinned = snap.cast.find((x) => x.assetId === c.assetId)?.look
    if (pinned && !c.look) out.push(`${nameOf(c.assetId)}: the look this scene was frozen with is no longer in the project.`)
  }
  return out
}
