import { primaryViewKeys } from './sheetSpecs'

export type ImageJobStatus = 'pending' | 'queued' | 'generating' | 'validating' | 'completed' | 'needs-review' | 'failed' | 'cancelled'

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
  /** 'supplied' means the person brought this image themselves; it is stored byte for byte and approved on arrival. */
  source?: 'generated' | 'supplied'
  createdAt: number
  updatedAt: number
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
  outputName: (revision: number) => string
}

const keyOf = (r: Pick<JobRequest, 'assetId' | 'variant' | 'sheetType' | 'viewKey'>, revision: number) => [r.assetId, r.variant, r.sheetType, r.viewKey, revision].join('|')
const touch = (job: ImageJob, patch: Partial<ImageJob>, now: number): ImageJob => ({ ...job, ...patch, updatedAt: now })
const live: ImageJobStatus[] = ['pending', 'queued', 'generating', 'validating']

/**
 * Adds jobs. A view that already has a live job or an approved/unrejected result is skipped (idempotent). A view whose last result was rejected or failed gets
 * a NEW revision, so earlier files and approvals are never replaced.
 */
export function enqueue(state: QueueState, requests: JobRequest[], now = Date.now(), force = false): { state: QueueState; added: number; skipped: number } {
  let jobs = state.jobs
  let added = 0
  let skipped = 0
  for (const request of requests) {
    const same = jobs.filter((j) => j.assetId === request.assetId && j.variant === request.variant && j.sheetType === request.sheetType && j.viewKey === request.viewKey)
    const latest = same.reduce<ImageJob | undefined>((a, b) => (!a || b.revision > a.revision ? b : a), undefined)
    if (latest && (live.includes(latest.status) || (!force && (latest.status === 'needs-review' || (latest.status === 'completed' && !latest.rejected))))) { skipped++; continue }
    const revision = latest ? latest.revision + 1 : 1
    jobs = [...jobs, { id: `IMG-${request.assetId}-${now.toString(36)}-${jobs.length + 1}`, key: keyOf(request, revision), assetId: request.assetId, variant: request.variant, sheetType: request.sheetType, viewKey: request.viewKey, label: request.label, prompt: request.prompt, aspect: request.aspect, fullBody: request.fullBody, provider: request.provider, model: request.model, references: request.references, useAnchor: request.useAnchor ?? false, outputName: request.outputName(revision), revision, status: 'queued', attempts: 0, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: now, updatedAt: now }]
    added++
  }
  return { state: { ...state, jobs }, added, skipped }
}

/** Every attempt that was sent counts toward the ceiling, because a failed attempt may still be billed. */
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

/** True while an anchor view exists in the queue but is not approved yet. */
export function waitingForAnchor(state: QueueState, job: ImageJob): boolean {
  if (!job.useAnchor || anchorFor(state, job)) return false
  return state.jobs.some((j) => sameSubject(j, job) && primaryViewKeys.includes(j.viewKey) && !j.rejected && ['queued', 'pending', 'generating', 'validating', 'needs-review'].includes(j.status))
}

const patchJob = (state: QueueState, id: string, fn: (j: ImageJob) => ImageJob): QueueState => ({ ...state, jobs: state.jobs.map((j) => (j.id === id ? fn(j) : j)) })

export const markGenerating = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'queued' ? touch(j, { status: 'generating', attempts: j.attempts + 1, error: undefined, notBefore: undefined }, now) : j))

export const markValidating = (state: QueueState, id: string, file: { path: string; width: number; height: number }, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'generating' ? touch(j, { status: 'validating', outputPath: file.path, width: file.width, height: file.height }, now) : j))

/** Validation done: any note sends the image to a person (needs-review); a clean pass still waits for approval, never auto-approves. */
export const markValidated = (state: QueueState, id: string, notes: string[], now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'validating' ? touch(j, { status: 'needs-review', qaNotes: notes }, now) : j))

export interface FailureKind { retryable: boolean; delayMs: number; advice: string }

export function classifyError(message: string): FailureKind {
  const code = /\((\d{3})\)/.exec(message)?.[1]
  if (code === '429') return { retryable: true, delayMs: 30_000, advice: 'The provider is rate limiting requests; retrying shortly.' }
  if (code && Number(code) >= 500) return { retryable: true, delayMs: 10_000, advice: 'The provider had a server error; retrying shortly.' }
  if (/timed out|timeout|could not be reached/i.test(message)) return { retryable: true, delayMs: 10_000, advice: 'The connection failed; retrying shortly.' }
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

export const approve = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'needs-review' ? touch(j, { status: 'completed', approved: true, rejected: false }, now) : j))

/** Rejecting keeps the file and its record; regenerate then adds a new revision. */
export const reject = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'needs-review' || (j.status === 'completed' && !j.approved) ? touch(j, { status: 'completed', approved: false, rejected: true }, now) : j))

export const cancel = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'queued' || j.status === 'pending' ? touch(j, { status: 'cancelled' }, now) : j))

/** A running request cannot be recalled from the provider, so cancelling one only stops its result from being used. */
export const cancelAllWaiting = (state: QueueState, now = Date.now()) => ({ ...state, jobs: state.jobs.map((j) => (j.status === 'queued' || j.status === 'pending' ? touch(j, { status: 'cancelled' }, now) : j)) })

export const retry = (state: QueueState, id: string, now = Date.now()) =>
  patchJob(state, id, (j) => (j.status === 'failed' || j.status === 'cancelled' ? touch(j, { status: 'queued', attempts: 0, error: undefined, notBefore: undefined }, now) : j))

/** Moves jobs that have not produced a file to another provider/model. Completed work is never reassigned. */
export const reassignModel = (state: QueueState, ids: string[], provider: string, model: string, now = Date.now()): QueueState => ({
  ...state,
  jobs: state.jobs.map((j) => (ids.includes(j.id) && (j.status === 'queued' || j.status === 'failed' || j.status === 'cancelled') ? touch(j, { provider, model, status: j.status === 'queued' ? 'queued' : 'queued', attempts: j.status === 'queued' ? j.attempts : 0, error: undefined }, now) : j)),
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
      if (j.status === 'generating') return touch(j, { status: 'queued', error: 'The app closed while this was generating. It will run again when you resume.' }, now)
      return j
    }),
  }
}

export function summarize(state: QueueState) {
  const count = (s: ImageJobStatus) => state.jobs.filter((j) => j.status === s).length
  return { requests: attemptsSent(state), pending: count('pending'), queued: count('queued'), generating: count('generating'), validating: count('validating'), completed: count('completed'), needsReview: count('needs-review'), failed: count('failed'), cancelled: count('cancelled'), total: state.jobs.length, committedUsd: committedUsd(state) }
}

/** Upper bound for what the waiting jobs could still cost at the person's own price. Not a provider quote. */
export function estimateRemainingUsd(state: QueueState): number | null {
  if (state.perImageUsd === null) return null
  return state.jobs.filter((j) => j.status === 'queued' || j.status === 'pending').reduce((n, j) => n + state.perImageUsd! * Math.max(1, j.maxAttempts - j.attempts), 0)
}
