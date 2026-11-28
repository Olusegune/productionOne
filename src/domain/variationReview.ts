import { checkAgeSpec } from './age'
import { checkCondition } from './conditionChecks'
import type { ImageJob } from './generationQueue'
import { checkTransformation } from './transformation'
import { stalenessOf } from './variationGraph'
import { findEntity, findRevision, type AgeSpec, type TransformationSpec, type VariationState } from './variations'
import type { Category, Finding } from './visualReview'

/**
 * Findings about the records behind a candidate picture: fixed rules over the records (a condition that names no side, an outfit made from a garment that
 * changed, a reference that is missing). These are facts about the records. They say nothing about the picture and never count as "the picture was checked".
 * What the picture shows is looked at separately, by closed questions to a vision model (see visionProbes.ts).
 */

// ---------- findings about the records (no picture is looked at) ----------

const base = (job: ImageJob) => ({ targetId: job.assetId, outputJobId: job.id, outputRevision: job.revision, confidence: 1, source: 'deterministic' as const, status: 'open' as const })

/** Facts about the records behind a candidate picture. They are not a check of the picture, so the caller does not list any category as checked for them. */
export function variationDeterministic(state: VariationState, job: ImageJob): Finding[] {
  const link = job.variation
  if (!link) return []
  const entity = findEntity(state, link.id)
  const rev = findRevision(state, { id: link.id, revision: link.revision })
  if (!entity || !rev) return []
  const out: Finding[] = []
  let n = 0
  const make = (category: Category, severity: Finding['severity'], expected: string, observed: string, action: string): void => {
    out.push({ ...base(job), id: `F-${job.id}-vr-${++n}`, category, severity, expected, observed, sourceRule: 'Record check', suggestedAction: action })
  }
  const ref = { id: link.id, revision: link.revision }
  if (link.role === 'condition-preview') {
    for (const c of checkCondition(state, ref).checks.filter((x) => x.result === 'fail')) make('K', 'medium', c.label, c.detail, 'Fix the condition in the Wardrobe studio and make a new version.')
  }
  if (link.role === 'age-candidate') {
    for (const c of checkAgeSpec({ age: undefined }, rev.spec as AgeSpec).checks.filter((x) => x.result === 'fail' && x.id !== 'changes-age')) make('A', 'low', c.label, c.detail, 'Change the age settings and make a new version.')
  }
  if (link.role === 'transformation-candidate') {
    for (const c of checkTransformation(rev.spec as TransformationSpec).checks.filter((x) => x.result === 'fail')) make(c.id === 'expected-anatomy' ? 'G' : 'A', 'low', c.label, c.detail, 'Change the transformation settings and make a new version.')
  }
  const needed = link.role === 'fit-candidate' ? 2 : link.role === 'age-candidate' || link.role === 'transformation-candidate' ? 1 : 0
  if (needed && job.references.length < needed) make('C', 'medium', `${needed} reference picture${needed === 1 ? '' : 's'} sent with this request`, `${job.references.length} was sent, so this picture was made without what it should be compared against.`, 'Make it again with a model that accepts reference pictures.')
  if (rev.status === 'approved' && stalenessOf(state, ref).stale) make('C', 'low', 'Made from the current versions', 'Something this was made from has a newer approved version.', 'See what needs updating in Looks and continuity.')
  return out
}
