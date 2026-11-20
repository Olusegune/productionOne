import type { ImageJob, QueueState } from './generationQueue'

/**
 * Undo for a decision you made on a picture (approve, reject, or take a decision back). It notices when exactly one waiting or decided picture changed its decision
 * between two queue states, and keeps what that picture was before. Undoing puts that one picture back. It never touches a file, and it does nothing if the picture
 * has moved on since (regenerated, or decided again).
 */
export interface DecisionSnapshot {
  jobId: string
  assetId: string
  kind: 'approved' | 'rejected' | 'reset'
  /** The picture's record as it was before the decision. */
  prev: ImageJob
  /** The asset's approved picture and status before, so Undo can put those back too. */
  prevOutput: string | undefined
  prevAssetStatus: string | undefined
}

const decided = (j: ImageJob) => (j.approved ? 'approved' : j.rejected ? 'rejected' : 'waiting')

export function detectDecision(before: QueueState, after: QueueState, ctx: { outputs: Record<string, string>; assetStatus: (assetId: string) => string | undefined }): DecisionSnapshot | null {
  const was = new Map(before.jobs.map((j) => [j.id, j]))
  const changed: Array<{ prev: ImageJob; next: ImageJob }> = []
  for (const next of after.jobs) {
    const prev = was.get(next.id)
    if (!prev) continue
    if (decided(prev) !== decided(next)) changed.push({ prev, next })
  }
  if (changed.length !== 1) return null
  const { prev, next } = changed[0]
  // Only a person's decision: the picture was already there to be judged (waiting, or decided earlier), not still being made.
  if (prev.revision !== next.revision || !next.outputPath) return null
  if (prev.status !== 'needs-review' && prev.status !== 'completed') return null
  const kind = next.approved ? 'approved' : next.rejected ? 'rejected' : 'reset'
  return { jobId: next.id, assetId: next.assetId, kind, prev, prevOutput: ctx.outputs[next.assetId], prevAssetStatus: ctx.assetStatus(next.assetId) }
}

/** The queue with that one picture put back, or the same queue when the picture is no longer as the decision left it. */
export function undoDecision(queue: QueueState, snap: DecisionSnapshot): QueueState {
  const now = queue.jobs.find((j) => j.id === snap.jobId)
  if (!now || now.revision !== snap.prev.revision) return queue
  if (decided(now) === decided(snap.prev)) return queue
  return { ...queue, jobs: queue.jobs.map((j) => (j.id === snap.jobId ? { ...snap.prev, updatedAt: Date.now() } : j)) }
}

export const decisionWords = (s: DecisionSnapshot, label: string): string =>
  s.kind === 'approved' ? `Approved ${label}.` : s.kind === 'rejected' ? `Rejected ${label}.` : `Took back the decision on ${label}.`
