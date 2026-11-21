import { waitingForAnchor, type ImageJob, type QueueState } from './generationQueue'

/**
 * What the strip along the bottom of the app shows: the work in progress first (running, then waiting), anything that failed, then the pictures waiting for your
 * decision. It only reads the queue. At most `limit` items are shown and the rest are counted.
 */
export type StripKind = 'running' | 'queued' | 'held' | 'failed' | 'review'
export interface StripItem { kind: StripKind; job: ImageJob }

export function stripItems(queue: QueueState, limit = 5): { shown: StripItem[]; more: number } {
  const jobs = queue.jobs
  const running: StripItem[] = jobs.filter((j) => j.status === 'generating' || j.status === 'validating').map((job) => ({ kind: 'running' as const, job }))
  const waiting: StripItem[] = jobs.filter((j) => j.status === 'queued' || j.status === 'pending').map((job) => ({ kind: (waitingForAnchor(queue, job) ? 'held' : 'queued') as StripKind, job }))
  // Only the newest failure of a view counts: a later revision that worked has replaced it.
  const failed: StripItem[] = jobs.filter((j) => j.status === 'failed' && !jobs.some((o) => o.key === j.key && o.revision > j.revision)).map((job) => ({ kind: 'failed' as const, job }))
  const review: StripItem[] = jobs.filter((j) => j.status === 'needs-review').map((job) => ({ kind: 'review' as const, job }))
  const all = [...running, ...waiting, ...failed, ...review]
  return { shown: all.slice(0, limit), more: Math.max(0, all.length - limit) }
}
