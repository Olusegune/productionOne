import type { VariationLink } from './variationLink'
import { primaryViewKeys } from './sheetSpecs'
import type { Provenance } from './characterLayers'

export type ImageJobStatus = 'pending' | 'queued' | 'generating' | 'validating' | 'completed' | 'needs-review' | 'failed' | 'cancelled'
export type SubmissionState = 'not-submitted' | 'intent-persisted' | 'accepted' | 'completed' | 'ambiguous' | 'failed'

export interface ImageJob {
  id: string
  /** Idempotency key: the same sheet view is never queued twice at the same revision. */
  key: string
  assetId: string
  variant: string
  sheetType: string
  viewKey: string
  label: string
  prompt: string
  aspect: string
  fullBody: boolean
  provider: string
  model: string
  references: string[]
  /** When true the approved front view of the same asset and variant is sent as the reference, and this job waits for it if one is still in progress. */
  useAnchor: boolean
  outputName: string
  revision: number
  status: ImageJobStatus
  attempts: number
  maxAttempts: number
  /** Epoch ms before which a retry must not start (rate-limit back-off). */
  notBefore?: number
  outputPath?: string
  width?: number
  height?: number
  qaNotes: string[]
  error?: string
  approved: boolean
  rejected: boolean
  /** Set when the picture's file went missing: where it was and what you had decided, so finding the file again can put both back. */
  lost?: { path: string; approved: boolean; rejected: boolean }
  /** 'supplied' means the person brought this image themselves; it is stored byte for byte and approved on arrival. */
  source?: 'generated' | 'supplied' | 'cleaned' | 'enhanced'
  /** Topaz credits this picture used (only for an enhanced picture, and only when Topaz reported them). Billed by Topaz, not counted as image requests. */
  topazCredits?: number
  createdAt: number
  updatedAt: number
  /** Durable submission provenance. Optional for legacy .pone/.pguy files. */
  attemptId?: string
  submissionState?: SubmissionState
  providerTaskId?: string
  receiptAt?: number
  recoveryNote?: string
  /** The style the picture was asked for in (name and a fingerprint of its compiled instructions). A later style change marks it as made in an earlier style; it is never re-approved automatically. */
  styleName?: string
  styleFp?: string
  /** The exact proportion profile and reference pictures this output was made with. */
  provenance?: Provenance
  /** The variation record revision this picture was made for (a garment design, a fit, a look). Lets the project tie pictures to revisions and keep them across retries. */
  variation?: VariationLink
}

export interface QueueState {
  jobs: ImageJob[]
  paused: boolean
  concurrency: number
  /** Optional spending guard. Off by default so generation flows without interruption; when on, nothing starts past the person's own ceiling. Catalog prices are never invented. */
  guard: boolean
  perImageUsd: number | null
  totalCeilingUsd: number | null
  quality: string
}

export const emptyQueue = (): QueueState => ({ jobs: [], paused: false, concurrency: 2, guard: false, perImageUsd: null, totalCeilingUsd: null, quality: 'medium' })

export interface JobRequest {
  assetId: string
  variant: string
  sheetType: string
  viewKey: string
  label: string
  prompt: string
  aspect: string
  fullBody: boolean
  provider: string
  model: string
  references: string[]
  useAnchor?: boolean
  styleName?: string
  styleFp?: string
  provenance?: Provenance
  variation?: VariationLink
  outputName: (revision: number) => string
}

const keyOf = (r: Pick<JobRequest, 'assetId' | 'variant' | 'sheetType' | 'viewKey'>, revision: number) => [r.assetId, r.variant, r.sheetType, r.viewKey, revision].join('|')
const touch = (job: ImageJob, patch: Partial<ImageJob>, now: number): ImageJob => ({ ...job, ...patch, updatedAt: now })
const live: ImageJobStatus[] = ['pending', 'queued', 'generating', 'validating']

/**
 * Adds jobs. A view that already has a live job or an approved/unrejected result is skipped (idempotent). A view whose last result was rejected or failed gets
 * a NEW revision, so earlier files and approvals are never replaced.
 */
/** Would pressing Generate add a new revision for a view whose latest job is `latest`? Shared by enqueue and the cost preview so they can never disagree. */
export function wouldEnqueue(latest: ImageJob | undefined, force = false): boolean {
  if (!latest) return true
  if (live.includes(latest.status)) return false
  if (!force && (latest.status === 'needs-review' || (latest.status === 'completed' && !latest.rejected))) return false
  return true
}

/** What a paid click will cost at the person's own price per request. Catalog prices are never invented: with no price set, the count is still shown and the cost says so. */
export function costPreview(count: number, perImageUsd: number | null): { count: number; usd: number | null; label: string } {
  const noun = `${count} image${count === 1 ? '' : 's'}`
  if (count === 0) return { count, usd: 0, label: 'Nothing new to generate' }
  if (perImageUsd === null) return { count, usd: null, label: `${noun} · cost unknown: set a price in the spending limit` }
  const usd = count * perImageUsd
  return { count, usd, label: `${noun} · about $${usd.toFixed(2)} at your $${perImageUsd.toFixed(2)} each` }
}

export function enqueue(state: QueueState, requests: JobRequest[], now = Date.now(), force = false): { state: QueueState; added: number; skipped: number } {
  let jobs = state.jobs
  let added = 0
  let skipped = 0
  for (const request of requests) {
    const same = jobs.filter((j) => j.assetId === request.assetId && j.variant === request.variant && j.sheetType === request.sheetType && j.viewKey === request.viewKey)
    const latest = same.reduce<ImageJob | undefined>((a, b) => (!a || b.revision > a.revision ? b : a), undefined)
    if (!wouldEnqueue(latest, force)) { skipped++; continue }
    const revision = latest ? latest.revision + 1 : 1
    jobs = [...jobs, { id: `IMG-${request.assetId}-${now.toString(36)}-${jobs.length + 1}`, key: keyOf(request, revision), assetId: request.assetId, variant: request.variant, sheetType: request.sheetType, viewKey: request.viewKey, label: request.label, prompt: request.prompt, aspect: request.aspect, fullBody: request.fullBody, provider: request.provider, model: request.model, references: request.references, useAnchor: request.useAnchor ?? false, styleName: request.styleName, styleFp: request.styleFp, ...(request.provenance ? { provenance: request.provenance } : {}), ...(request.variation ? { variation: request.variation } : {}), outputName: request.outputName(revision), revision, status: 'queued', attempts: 0, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, submissionState: 'not-submitted', createdAt: now, updatedAt: now }]
    added++
  }
  return { state: { ...state, jobs }, added, skipped }
}

/** Every attempt that was sent counts toward the ceiling, because a failed attempt may still be billed. */
/** A failed job that a newer revision of the same view has replaced is history, not a problem: it stays in the record and the attempt count, but is not reported as failed. */
export function isSuperseded(state: QueueState, job: ImageJob): boolean {
  return state.jobs.some((o) => o.assetId === job.assetId && o.variant === job.variant && o.sheetType === job.sheetType && o.viewKey === job.viewKey && o.revision > job.revision)
}
export const unresolvedFailures = (state: QueueState) => state.jobs.filter((j) => j.status === 'failed' && !isSuperseded(state, j))

export const attemptsSent = (state: QueueState) => state.jobs.reduce((n, j) => n + j.attempts, 0)
export const committedUsd = (state: QueueState) => (state.perImageUsd ?? 0) * attemptsSent(state)

export type StartCheck = { ok: true } | { ok: false; reason: string }

export function spendGate(state: QueueState): StartCheck {
  if (!state.guard) return { ok: true }
  if (state.perImageUsd === null || state.totalCeilingUsd === null) return { ok: false, reason: 'Enter your price per image and a total spending ceiling and confirm before generating.' }
  if (committedUsd(state) + state.perImageUsd > state.totalCeilingUsd + 1e-9) return { ok: false, reason: `The spending ceiling of $${state.totalCeilingUsd.toFixed(2)} would be exceeded.` }
  return { ok: true }
}

/** Jobs that may start now: respects pause, concurrency, retry back-off and the spending ceiling. */
export function startable(state: QueueState, now = Date.now()): ImageJob[] {
  if (state.paused) return []
  const running = state.jobs.filter((j) => j.status === 'generating' || j.status === 'validating').length
  let room = Math.max(0, state.concurrency - running)
  const out: ImageJob[] = []
  let projected = committedUsd(state)
  for (const job of state.jobs) {
    if (room === 0) break
    if (job.status !== 'queued' || (job.notBefore ?? 0) > now) continue
    if (waitingForAnchor(state, job)) continue
    if (state.guard) {
      if (state.perImageUsd === null || state.totalCeilingUsd === null) break
      if (projected + state.perImageUsd > state.totalCeilingUsd + 1e-9) break
      projected += state.perImageUsd
    }
    out.push(job)
    room--
  }
  return out
}

const sameSubject = (a: ImageJob, b: ImageJob) => a.assetId === b.assetId && a.variant === b.variant

/** The approved primary view (front, full-front, ...) of the same asset and variant, if there is one. */
export function anchorFor(state: QueueState, job: ImageJob): string | undefined {
  const approved = state.jobs.filter((j) => sameSubject(j, job) && j.approved && j.outputPath && primaryViewKeys.includes(j.viewKey))
  // The newest approved revision is the anchor; older approved files stay in the history untouched.
  return approved.sort((a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt)[0]?.outputPath
}

/**
 * Should this view be generated with the character's approved image as a reference? Non-primary views always are. A primary view (front, costume front, ...) is the one that
 * normally *makes* the identity, so it goes without a reference only when nothing is approved yet. If another approved primary view of the same asset and look exists (the
 * Turnaround front, say, when the Wardrobe sheet's costume front is generated), it is used, so the Wardrobe sheet cannot invent a different person.
 */
export function shouldAnchor(state: QueueState, subject: { assetId: string; variant: string; sheetType: string; viewKey: string }): boolean {
  if (!primaryViewKeys.includes(subject.viewKey)) return true
  return state.jobs.some((j) => j.assetId === subject.assetId && j.variant === subject.variant && j.approved && !!j.outputPath && primaryViewKeys.includes(j.viewKey) && !(j.sheetType === subject.sheetType && j.viewKey === subject.viewKey))
}

export interface SuppliedRequest {
  assetId: string
  variant: string
  sheetType: string
  viewKey: string
  label: string
  aspect: string
  fullBody: boolean
  path: string
  width: number
  height: number
}

/**
 * Records an image the person brought themselves as the newest revision of a view, already approved. Anything still waiting to be generated for that view is cancelled so it cannot
 * replace it, and earlier revisions (including approved ones) are kept.
 */
export function addSupplied(state: QueueState, r: SuppliedRequest, now = Date.now()): { state: QueueState; job: ImageJob } {
  const same = (j: ImageJob) => j.assetId === r.assetId && j.variant === r.variant && j.sheetType === r.sheetType && j.viewKey === r.viewKey
  const revision = state.jobs.filter(same).reduce((n, j) => Math.max(n, j.revision), 0) + 1
  const jobs = state.jobs.map((j) => (same(j) && (j.status === 'queued' || j.status === 'pending') ? touch(j, { status: 'cancelled' }, now) : j))
  const job: ImageJob = {
    id: `IMG-${r.assetId}-${now.toString(36)}-${jobs.length + 1}`, key: keyOf(r, revision), assetId: r.assetId, variant: r.variant, sheetType: r.sheetType, viewKey: r.viewKey, label: r.label,
    prompt: '', aspect: r.aspect, fullBody: r.fullBody, provider: 'you', model: 'your image', references: [], useAnchor: false, outputName: `${r.assetId}_${r.viewKey}_v${String(revision).padStart(2, '0')}_yours`,
    revision, status: 'completed', attempts: 0, maxAttempts: 1, outputPath: r.path, width: r.width, height: r.height, qaNotes: [], approved: true, rejected: false, source: 'supplied', createdAt: now, updatedAt: now,
  }
  return { state: { ...state, jobs: [...jobs, job] }, job }
}

/**
 * A CleanRender correction saved as a new revision of the same view. The image it was made from stays in the history; the new one keeps its approval.
 */
export function addCleaned(state: QueueState, from: ImageJob, file: { path: string; width: number; height: number }, now = Date.now()): { state: QueueState; job: ImageJob } {
  const same = (j: ImageJob) => j.assetId === from.assetId && j.variant === from.variant && j.sheetType === from.sheetType && j.viewKey === from.viewKey
  const revision = state.jobs.filter(same).reduce((n, j) => Math.max(n, j.revision), 0) + 1
  const job: ImageJob = { ...from, id: `IMG-${from.assetId}-${now.toString(36)}-${state.jobs.length + 1}`, key: [from.assetId, from.variant, from.sheetType, from.viewKey, revision].join('|'), revision, outputName: `${from.outputName}_clean`, outputPath: file.path, width: file.width, height: file.height, status: 'completed', attempts: 0, qaNotes: [], error: undefined, source: 'cleaned', approved: from.approved, rejected: false, createdAt: now, updatedAt: now }
  return { state: { ...state, jobs: [...state.jobs, job] }, job }
}

/**
 * A picture enlarged and sharpened by Topaz, saved as a new revision of the same view. The picture it was made from stays in the history. Unlike a clean-up, an enhanced
 * picture is NOT approved automatically: it is a new picture, so it waits for your decision.
 */
export function addEnhanced(state: QueueState, from: ImageJob, file: { path: string; width: number; height: number; credits?: number | null }, now = Date.now()): { state: QueueState; job: ImageJob } {
  const same = (j: ImageJob) => j.assetId === from.assetId && j.variant === from.variant && j.sheetType === from.sheetType && j.viewKey === from.viewKey
  const revision = state.jobs.filter(same).reduce((n, j) => Math.max(n, j.revision), 0) + 1
  const job: ImageJob = { ...from, id: `IMG-${from.assetId}-${now.toString(36)}-${state.jobs.length + 1}`, key: [from.assetId, from.variant, from.sheetType, from.viewKey, revision].join('|'), revision, outputName: `${from.outputName}_topaz`, outputPath: file.path, width: file.width, height: file.height, status: 'needs-review', attempts: 0, qaNotes: [], error: undefined, source: 'enhanced', approved: false, rejected: false, createdAt: now, updatedAt: now, ...(typeof file.credits === 'number' ? { topazCredits: file.credits } : { topazCredits: undefined }) }
  return { state: { ...state, jobs: [...state.jobs, job] }, job }
}

/**
 * Which of two takes of the same view stands for it: an approved take beats one that is not, and between equals the newer revision wins.
 * Without this, keeping an older take (Review, "Keep revision 1") would leave the newer, turned-down one on show.
 */
export const betterTake = <T extends { revision: number; approved: boolean; rejected?: boolean }>(a: T | undefined, b: T): T => {
  if (!a) return b
  const rank = (j: T) => (j.approved && !j.rejected ? 1 : 0)
  return rank(b) !== rank(a) ? (rank(b) > rank(a) ? b : a) : b.revision > a.revision ? b : a
}

/** True while an anchor view exists in the queue but is not approved yet. */
export function waitingForAnchor(state: QueueState, job: ImageJob): boolean {
  if (!job.useAnchor || anchorFor(state, job)) return false
  return state.jobs.some((j) => sameSubject(j, job) && primaryViewKeys.includes(j.viewKey) && !j.rejected && ['queued', 'pending', 'generating', 'validating', 'needs-review'].includes(j.status))
}

const patchJob = (state: QueueState, id: string, fn: (j: ImageJob) => ImageJob): QueueState => ({ ...state, jobs: state.jobs.map((j) => (j.id === id ? fn(j) : j)) })

export const markGenerating = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'queued' ? touch(j, { status: 'generating', attempts: j.attempts + 1, attemptId: `${j.id}-attempt-${j.attempts + 1}`, submissionState: 'intent-persisted', error: undefined, notBefore: undefined }, now) : j))

export const markValidating = (state: QueueState, id: string, file: { path: string; width: number; height: number }, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'generating' ? touch(j, { status: 'validating', submissionState: 'completed', receiptAt: now, outputPath: file.path, width: file.width, height: file.height }, now) : j))

/** Validation done: any note sends the image to a person (needs-review); a clean pass still waits for approval, never auto-approves. */
export const markValidated = (state: QueueState, id: string, notes: string[], now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'validating' ? touch(j, { status: 'needs-review', qaNotes: notes }, now) : j))

export interface FailureKind { retryable: boolean; delayMs: number; advice: string }

export function classifyError(message: string): FailureKind {
  const code = /\((\d{3})\)/.exec(message)?.[1]
  if (code === '429') return { retryable: true, delayMs: 30_000, advice: 'The provider is rate limiting requests; retrying shortly.' }
  if (code && Number(code) >= 500) return { retryable: true, delayMs: 10_000, advice: 'The provider had a server error; retrying shortly.' }
  if (/timed out|timeout|could not be reached/i.test(message)) return { retryable: true, delayMs: 10_000, advice: 'The connection failed; retrying shortly.' }
  // Kie sometimes answers "no model page" for a model it served minutes earlier. It is not billed, so one more try after a pause is safe, and the attempt limit still applies.
  if (/no model page/i.test(message)) return { retryable: true, delayMs: 15_000, advice: 'Kie did not find the model page just now; retrying shortly. If it keeps failing, press Refresh models.' }
  if (code === '401' || code === '403' || /No .* key is saved/i.test(message)) return { retryable: false, delayMs: 0, advice: 'The key is missing or was rejected. Check Provider Settings.' }
  return { retryable: false, delayMs: 0, advice: 'The request was not accepted. Check the model, the prompt and the provider message.' }
}

export function markFailed(state: QueueState, id: string, message: string, now = Date.now()): QueueState {
  const kind = classifyError(message)
  return patchJob(state, id, (j) => {
    if (j.status !== 'generating' && j.status !== 'validating') return j
    if (kind.retryable && j.attempts < j.maxAttempts) return touch(j, { status: 'queued', notBefore: now + kind.delayMs * j.attempts, error: `${message} ${kind.advice}` }, now)
    return touch(j, { status: 'failed', error: `${message} ${kind.advice}` }, now)
  })
}

/** A decision can be changed at any time: a picture that is waiting, turned down or already approved can be approved (a picture with no file cannot). */
export const approve = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => ((j.status === 'needs-review' || j.status === 'completed') && !!j.outputPath && !j.approved ? touch(j, { status: 'completed', approved: true, rejected: false }, now) : j))

/** Rejecting keeps the file and its record; regenerate then adds a new revision. An approved picture can be rejected too (the approval is taken back). */
export const reject = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => ((j.status === 'needs-review' || j.status === 'completed') && !j.rejected ? touch(j, { status: 'completed', approved: false, rejected: true }, now) : j))

/** "I have not decided": takes back an approval or a rejection and puts the picture back among those waiting for a decision. The file is untouched and nothing is generated. */
export const reconsider = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'completed' && !!j.outputPath && (j.approved || j.rejected) ? touch(j, { status: 'needs-review', approved: false, rejected: false }, now) : j))

export const cancel = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'queued' || j.status === 'pending' ? touch(j, { status: 'cancelled' }, now) : j))

/** A running request cannot be recalled from the provider, so cancelling one only stops its result from being used. */
export const cancelAllWaiting = (state: QueueState, now = Date.now()) => ({ ...state, jobs: state.jobs.map((j) => (j.status === 'queued' || j.status === 'pending' ? touch(j, { status: 'cancelled' }, now) : j)) })

/**
 * Pictures that are no longer on this computer (a project opened elsewhere, files deleted). Such a take cannot be shown, used as a reference or kept approved,
 * so it becomes a failed take that says why. The view then counts as needing a picture: Generate and Use my image both work on it.
 */
/** The message a take carries when its picture is not on this computer. Other screens use it to tell this apart from a provider failure. */
export const MISSING_FILE_ERROR = 'This picture is no longer on this computer, for example because the project was opened somewhere its files are not. Press Generate, or add it again with Use my image.'
export const isMissingFile = (j: { status: string; error?: string }) => j.status === 'failed' && j.error === MISSING_FILE_ERROR

export function dropMissing(state: QueueState, missing: string[], now = Date.now()): { state: QueueState; dropped: number } {
  if (!missing.length) return { state, dropped: 0 }
  const gone = new Set(missing)
  let dropped = 0
  const jobs = state.jobs.map((j) => {
    if (!j.outputPath || !gone.has(j.outputPath) || (j.status !== 'completed' && j.status !== 'needs-review')) return j
    dropped++
    return { ...j, status: 'failed' as const, approved: false, rejected: false, outputPath: undefined, error: MISSING_FILE_ERROR, lost: { path: j.outputPath, approved: j.approved, rejected: j.rejected }, updatedAt: now }
  })
  return dropped ? { state: { ...state, jobs }, dropped } : { state, dropped: 0 }
}

export const retry = (state: QueueState, id: string, now = Date.now()) =>
  // Attempts are immutable submission history. A manual retry starts a new
  // retry cycle, but must never erase a request that may already be billable.
  patchJob(state, id, (j) => (j.status === 'failed' || j.status === 'cancelled' ? touch(j, { status: 'queued', error: undefined, notBefore: undefined }, now) : j))

/** Moves jobs that have not produced a file to another provider/model. Completed work is never reassigned. */
/** `takesReferences: false` also drops the reference and anchor from those views: an engine that cannot take them would otherwise refuse the request. */
export const reassignModel = (state: QueueState, ids: string[], provider: string, model: string, now = Date.now(), takesReferences = true): QueueState => ({
  ...state,
  jobs: state.jobs.map((j) => (ids.includes(j.id) && (j.status === 'queued' || j.status === 'failed' || j.status === 'cancelled') ? touch(j, { provider, model, status: 'queued', error: undefined, ...(takesReferences ? {} : { useAnchor: false, references: [] }) }, now) : j)),
})

/**
 * Crash recovery on load: a job that was mid-request has an unknown outcome. If it already has a saved file it goes to validation; otherwise it is queued again
 * and the attempt stays counted (it may have been billed), so the ceiling still holds.
 */
export function recover(state: QueueState, now = Date.now()): QueueState {
  return {
    ...state,
    // A cap is never switched on for the person: an old saved ceiling does not become a silent block.
    guard: state.guard ?? false,
    paused: state.jobs.some((j) => j.status === 'generating' || j.status === 'validating') ? true : state.paused,
    jobs: state.jobs.map((j) => {
      if (j.status === 'validating') return touch(j, { status: j.outputPath ? 'needs-review' : 'queued', qaNotes: [...j.qaNotes, 'Recovered after the app closed: re-check this image.'] }, now)
      if (j.status === 'generating') return touch(j, { status: 'failed', submissionState: 'ambiguous', recoveryNote: 'The app closed after submission intent was persisted. Reconcile the provider task before retrying; it may already be billable.', error: 'Ambiguous provider outcome after restart; reconciliation is required before retrying.' }, now)
      return j
    }),
  }
}

/** Topaz credits used by enhanced pictures in this project, and how many pictures that is. Billed by Topaz; separate from image requests. */
export function topazUse(state: QueueState): { credits: number; pictures: number } {
  const enhanced = state.jobs.filter((j) => j.source === 'enhanced')
  return { credits: enhanced.reduce((n, j) => n + (j.topazCredits ?? 0), 0), pictures: enhanced.length }
}

export function summarize(state: QueueState) {
  const count = (s: ImageJobStatus) => state.jobs.filter((j) => j.status === s).length
  return { requests: attemptsSent(state), pending: count('pending'), queued: count('queued'), generating: count('generating'), validating: count('validating'), completed: count('completed'), needsReview: count('needs-review'), failed: unresolvedFailures(state).length, cancelled: count('cancelled'), total: state.jobs.length, committedUsd: committedUsd(state) }
}

/** Upper bound for what the waiting jobs could still cost at the person's own price. Not a provider quote. */
export function estimateRemainingUsd(state: QueueState): number | null {
  if (state.perImageUsd === null) return null
  return state.jobs.filter((j) => j.status === 'queued' || j.status === 'pending').reduce((n, j) => n + state.perImageUsd! * Math.max(1, j.maxAttempts - j.attempts), 0)
}
