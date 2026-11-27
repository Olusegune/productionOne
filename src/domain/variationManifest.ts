import { checkAgeSpec } from './age'
import { checkCondition } from './conditionChecks'
import type { ImageJob, QueueState } from './generationQueue'
import { depsOf, staleRevisions } from './variationGraph'
import { regenerationPlan } from './regeneration'
import { checkTransformation } from './transformation'
import { currentPath } from './variationSync'
import type { AgeSpec, AnyEntity, ConditionSpec, Ref, TransformationSpec, VariationState } from './variations'

/**
 * The variation section of a production package: every garment, fit, condition, age, transformation and look with its revision ids and approvals, what each
 * revision depends on, which approvals are out of date, and for each picture made for them the provider, model, attempts, estimated cost, prompt and the
 * reference pictures with the part each one played. Only file names are written (directories are machine-specific), and no credentials.
 */
export const VARIATIONS_MANIFEST_FORMAT = 'production-one-variations'
export const VARIATIONS_MANIFEST_VERSION = 1

const fileName = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? ''
const refText = (r: Ref) => `${r.id}@${r.revision}`

function qaFor(state: VariationState, e: AnyEntity, n: number): { state: string; summary: string } | undefined {
  const rev = e.revisions.find((r) => r.n === n)
  if (!rev) return undefined
  if (e.kind === 'condition') { const r = checkCondition(state, { id: e.id, revision: n }); return { state: r.state, summary: r.summary } }
  if (e.kind === 'age') { const r = checkAgeSpec({ age: undefined }, rev.spec as AgeSpec); return { state: r.state, summary: r.summary } }
  if (e.kind === 'transformation') { const r = checkTransformation(rev.spec as TransformationSpec); return { state: r.state, summary: r.summary } }
  return undefined
}

export function variationManifest(state: VariationState, queue: QueueState) {
  const jobs = queue.jobs
  const price = queue.perImageUsd
  const stale = new Set(staleRevisions(state).map((s) => refText(s.ref)))
  const linked = jobs.filter((j) => j.variation)
  return {
    format: VARIATIONS_MANIFEST_FORMAT,
    version: VARIATIONS_MANIFEST_VERSION,
    note: 'Garments, fits, conditions, age variants, transformations, production looks and relationships between assets (ownership, interaction, scale), with revision ids, approvals, dependencies and generation records. Quality states are for the checks that were run on the records; whether a picture is right was decided by a person.',
    entities: state.entities.map((e) => ({
      id: e.id, kind: e.kind, name: e.name, characterId: e.characterId ?? null, archived: !!e.archived,
      revisions: e.revisions.map((r) => ({
        revision: r.n, ref: refText({ id: e.id, revision: r.n }), status: r.status, createdAt: r.createdAt,
        parent: r.parent ? refText(r.parent) : null,
        dependsOn: depsOf(e.kind, r.spec).map((d) => ({ ref: refText(d.ref), role: d.role })),
        stale: r.status === 'approved' && stale.has(refText({ id: e.id, revision: r.n })),
        spec: r.spec,
        media: r.media.map((m) => ({ file: fileName(currentPath(m, jobs)), role: m.role, view: m.view ?? null, jobId: m.jobId ?? null })),
        quality: qaFor(state, e, r.n) ?? null,
        legacy: r.legacy ?? null, note: r.note ?? null,
      })),
    })),
    outOfDate: regenerationPlan(state).steps.map((s) => ({ ref: refText(s.ref), name: s.name, action: s.action, because: s.because })),
    generation: linked.map((j: ImageJob) => ({
      jobId: j.id, revisionLink: refText({ id: j.variation!.id, revision: j.variation!.revision }), role: j.variation!.role,
      uses: (j.variation!.uses ?? []).map((u) => ({ ref: u.revision ? refText({ id: u.id, revision: u.revision }) : u.id, role: u.role, file: u.path ? fileName(u.path) : null })),
      assetId: j.assetId, variant: j.variant, sheetType: j.sheetType, view: j.viewKey, queueRevision: j.revision,
      provider: j.provider, model: j.model, status: j.status, approved: j.approved, attempts: j.attempts, maxAttempts: j.maxAttempts,
      providerTaskId: j.providerTaskId ?? null, submissionState: j.submissionState ?? null,
      estimatedCostUsd: price === null ? null : Math.round(j.attempts * price * 100) / 100,
      style: j.styleName ?? null, prompt: j.prompt,
      referenceFiles: j.references.map(fileName), file: j.outputPath ? fileName(j.outputPath) : null,
    })),
  }
}

// ---------- assembled comparison sheets ----------

export interface SheetCell { path: string; label: string }
export interface ComparisonSheet { title: string; cells: SheetCell[]; columns: number }

const specNumber = (n: string): number => { const m = /\d+/.exec(n); return m ? Number(m[0]) : 0 }

/** The base character beside each approved age, youngest to oldest. Each label carries the revision id so a sheet can be traced. */
export function ageComparison(state: VariationState, characterName: string, characterId: string, basePath: string | undefined, jobs: ImageJob[]): ComparisonSheet {
  const cells: SheetCell[] = basePath ? [{ path: basePath, label: `${characterName}, as approved` }] : []
  const ages = state.entities.filter((e) => e.kind === 'age' && e.characterId === characterId).map((e) => ({ e, rev: [...e.revisions].reverse().find((r) => r.status === 'approved') })).filter((x) => x.rev)
    .sort((a, b) => specNumber((a.rev!.spec as AgeSpec).targetAge) - specNumber((b.rev!.spec as AgeSpec).targetAge))
  for (const { e, rev } of ages) {
    const pic = rev!.media.find((m) => m.role === 'approved')
    if (pic) cells.push({ path: currentPath(pic, jobs), label: `${e.name} (${e.id} v${rev!.n})` })
  }
  return { title: `${characterName} age comparison`, cells, columns: Math.min(5, Math.max(2, cells.length)) }
}

/** The base character and then each approved stage of one transformation, in order. */
export function transformationComparison(state: VariationState, characterName: string, characterId: string, kind: string, basePath: string | undefined, jobs: ImageJob[]): ComparisonSheet {
  const cells: SheetCell[] = basePath ? [{ path: basePath, label: `${characterName}, as approved` }] : []
  const mine = state.entities.filter((e) => e.kind === 'transformation' && e.characterId === characterId && (e.revisions[e.revisions.length - 1].spec as TransformationSpec).kind.trim().toLowerCase() === kind.trim().toLowerCase())
  const byFrom = new Map(mine.map((e) => [(e.revisions[e.revisions.length - 1].spec as TransformationSpec).from?.id ?? '', e]))
  const ordered: AnyEntity[] = []
  let cursor = byFrom.get('')
  const seen = new Set<string>()
  while (cursor && !seen.has(cursor.id)) { ordered.push(cursor); seen.add(cursor.id); cursor = byFrom.get(cursor.id) }
  for (const e of ordered) {
    const rev = [...e.revisions].reverse().find((r) => r.status === 'approved')
    const pic = rev?.media.find((m) => m.role === 'approved')
    if (rev && pic) cells.push({ path: currentPath(pic, jobs), label: `${(rev.spec as TransformationSpec).stage} (${e.id} v${rev.n})` })
  }
  return { title: `${characterName} ${kind} stages`, cells, columns: Math.min(5, Math.max(2, cells.length)) }
}

/** The garment as designed and then each approved condition of it. */
export function conditionComparison(state: VariationState, garmentId: string, jobs: ImageJob[]): ComparisonSheet {
  const g = state.entities.find((e) => e.id === garmentId)
  const gRev = g && [...g.revisions].reverse().find((r) => r.status === 'approved')
  const cells: SheetCell[] = []
  const gPic = gRev?.media.find((m) => m.role === 'approved')
  if (g && gRev && gPic) cells.push({ path: currentPath(gPic, jobs), label: `${g.name}, as designed (${g.id} v${gRev.n})` })
  for (const e of state.entities.filter((x) => x.kind === 'condition' && x.revisions.some((r) => (r.spec as ConditionSpec).garment.id === garmentId))) {
    const rev = [...e.revisions].reverse().find((r) => r.status === 'approved')
    const pic = rev?.media.find((m) => m.role === 'approved')
    if (rev && pic) cells.push({ path: currentPath(pic, jobs), label: `${e.name} (${e.id} v${rev.n})` })
  }
  return { title: `${g?.name ?? 'Garment'} conditions`, cells, columns: Math.min(5, Math.max(2, cells.length)) }
}
