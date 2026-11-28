import type { ImageJob, JobRequest, QueueState } from './generationQueue'
import { enqueue } from './generationQueue'
import type { Finding } from './visualReview'

/**
 * Correcting a finding. A correction is a NEW revision of the affected view only: it keeps a record of what it came from, is checked again where possible and
 * waits for a person's approval (a correction is never approved for you). Attempts and spend per finding are bounded, and repeated failures stop with an
 * explanation. Unaffected assets are never regenerated.
 */
export interface ProviderCaps { /** The provider and model can edit part of a picture from a mask. None of the adapters in this app can, today. */ inpainting: boolean }
export const noInpainting: ProviderCaps = { inpainting: false }

export interface CorrectionLimits { maxAttempts: number; maxUsd: number }
export const defaultLimits: CorrectionLimits = { maxAttempts: 3, maxUsd: 1 }

export interface CorrectionLedger { findingId: string; attempts: number; spentUsd: number; lastError?: string }
export type Ledgers = Record<string, CorrectionLedger>

export function canAttempt(ledgers: Ledgers, findingId: string, perImageUsd: number | null, limits: CorrectionLimits = defaultLimits): { ok: true } | { ok: false; reason: string } {
  const l = ledgers[findingId]
  if (l && l.attempts >= limits.maxAttempts) return { ok: false, reason: `This finding has had ${l.attempts} correction attempts and is still not fixed. Stopping so more money is not spent: look at the picture yourself, change the description or the layout, or mark it intentional.${l.lastError ? ` Last problem: ${l.lastError}` : ''}` }
  const next = (l?.spentUsd ?? 0) + (perImageUsd ?? 0)
  if (perImageUsd !== null && next > limits.maxUsd + 1e-9) return { ok: false, reason: `Another attempt would take this finding past $${limits.maxUsd.toFixed(2)} (spent $${(l?.spentUsd ?? 0).toFixed(2)}). Raise the limit or fix it another way.` }
  return { ok: true }
}

export function recordAttempt(ledgers: Ledgers, findingId: string, perImageUsd: number | null, error?: string): Ledgers {
  const l = ledgers[findingId] ?? { findingId, attempts: 0, spentUsd: 0 }
  return { ...ledgers, [findingId]: { ...l, attempts: l.attempts + 1, spentUsd: Math.round((l.spentUsd + (perImageUsd ?? 0)) * 100) / 100, ...(error ? { lastError: error } : {}) } }
}

export interface CorrectionPlan {
  mode: 'regenerate' | 'edit'
  /** Only this view is made again. */
  affected: { assetId: string; variant: string; sheetType: string; viewKey: string }
  references: string[]
  promptAddition: string
  note: string
}

/** What to do for a finding. A targeted edit only where the provider can edit part of a picture; otherwise the same view is regenerated with the right references. */
export function planCorrection(finding: Finding, job: ImageJob, caps: ProviderCaps, extraReferences: string[] = []): CorrectionPlan {
  const fix = `Correct this problem and change nothing else: ${finding.observed} It should be: ${finding.expected}`
  const refs = [...new Set([...(job.outputPath && caps.inpainting ? [job.outputPath] : []), ...job.references, ...extraReferences])]
  return {
    mode: caps.inpainting && finding.region ? 'edit' : 'regenerate',
    affected: { assetId: job.assetId, variant: job.variant, sheetType: job.sheetType, viewKey: job.viewKey },
    references: refs,
    promptAddition: fix,
    note: caps.inpainting && finding.region ? 'A targeted edit of the marked region.' : 'This provider cannot edit part of a picture, so this one view is regenerated with its references. The new picture may differ elsewhere too: compare it before approving.',
  }
}

/** Queues the correction as a new revision of that one view, recording where it came from. It is never approved here. */
export function queueCorrection(queue: QueueState, finding: Finding, job: ImageJob, plan: CorrectionPlan, now = Date.now()): { state: QueueState; added: boolean } {
  const request: JobRequest = {
    assetId: job.assetId, variant: job.variant, sheetType: job.sheetType, viewKey: job.viewKey, label: `${job.label} (correction)`,
    prompt: `${job.prompt}\n${plan.promptAddition}`, aspect: job.aspect, fullBody: job.fullBody, provider: job.provider, model: job.model, references: plan.references, useAnchor: job.useAnchor,
    styleName: job.styleName, styleFp: job.styleFp,
    // A correction of a candidate for a garment, an outfit, an age or a stage is another picture for the same record (kept only while it is still a candidate).
    ...(job.variation ? { variation: job.variation } : {}),
    provenance: { ...(job.provenance ?? { references: [] }), references: plan.references.map((path) => ({ path })), correctionOf: { findingId: finding.id, sourceJobId: job.id, sourceRevision: job.revision } },
    outputName: (revision: number) => `${job.assetId}_${job.sheetType}_${job.viewKey}_fix_v${String(revision).padStart(2, '0')}`.replace(/[^A-Za-z0-9_.-]+/g, '-'),
  }
  // force: the earlier revision is rejected or approved and stays as it is; this is a new revision beside it.
  const result = enqueue(queue, [request], now, true)
  return { state: result.state, added: result.added > 0 }
}

/** Jobs that would be touched by correcting a finding: exactly the one view, never another. */
export function affectedJobs(queue: QueueState, finding: Finding): ImageJob[] {
  return queue.jobs.filter((j) => j.id === finding.outputJobId)
}

/** Reads saved correction ledgers. Counts are kept non-negative and finite. */
export function readLedgers(raw: unknown): Ledgers {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Ledgers = {}
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null) continue
    const l = v as Record<string, unknown>
    const attempts = typeof l.attempts === 'number' && Number.isFinite(l.attempts) ? Math.max(0, Math.round(l.attempts)) : 0
    const spentUsd = typeof l.spentUsd === 'number' && Number.isFinite(l.spentUsd) ? Math.max(0, l.spentUsd) : 0
    out[id] = { findingId: id, attempts, spentUsd, ...(typeof l.lastError === 'string' ? { lastError: l.lastError.slice(0, 300) } : {}) }
  }
  return out
}
