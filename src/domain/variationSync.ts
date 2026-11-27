import type { ImageJob } from './generationQueue'
import { approveWithPicture, attachMedia, findRevision, rejectRevision, type MediaRef, type Ref, type VariationState } from './variations'

/**
 * Keeps variation records in step with the generation queue, so a picture is only ever recorded once however many times it is retried or relinked,
 * and so approving a picture in Review (or anywhere else) is enough:
 *   - a finished picture made for a candidate revision is attached to it;
 *   - a candidate whose picture was approved becomes approved, with that picture recorded as the chosen one;
 *   - a candidate whose every picture was turned down becomes rejected.
 * Revisions that are already approved or rejected are never changed. Returns the same object when nothing needed to change.
 */
export function reconcileWithQueue(state: VariationState, jobs: ImageJob[]): VariationState {
  let next = state
  const linked = jobs.filter((j) => j.variation && j.outputPath && j.status !== 'failed' && j.status !== 'queued' && j.status !== 'pending' && j.status !== 'generating')
  for (const job of linked) {
    const ref: Ref = { id: job.variation!.id, revision: job.variation!.revision }
    const revision = findRevision(next, ref)
    if (!revision || revision.status !== 'candidate') continue
    if (!revision.media.some((m) => m.jobId === job.id)) {
      const media: MediaRef = { path: job.outputPath as string, role: job.variation!.role, jobId: job.id, view: job.viewKey }
      next = attachMedia(next, ref, media)
    }
  }
  // Decisions come after every picture is attached.
  const refs = new Map<string, Ref>()
  for (const job of linked) { const r = { id: job.variation!.id, revision: job.variation!.revision }; refs.set(`${r.id}@${r.revision}`, r) }
  for (const ref of refs.values()) {
    const revision = findRevision(next, ref)
    if (!revision || revision.status !== 'candidate') continue
    const own = jobs.filter((j) => j.variation?.id === ref.id && j.variation.revision === ref.revision)
    const chosen = own.filter((j) => j.approved && j.outputPath).sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (chosen && revision.media.some((m) => m.jobId === chosen.id)) { next = approveWithPicture(next, ref, chosen.id); continue }
    const pictured = own.filter((j) => j.outputPath)
    if (pictured.length > 0 && pictured.every((j) => j.rejected) && own.every((j) => j.status !== 'queued' && j.status !== 'pending' && j.status !== 'generating')) next = rejectRevision(next, ref)
  }
  return next
}

/** The file for a picture of a revision: the queue's current path when the job is known (it follows a relink), else the path saved with the record. */
export function currentPath(media: MediaRef, jobs: ImageJob[]): string {
  return (media.jobId ? jobs.find((j) => j.id === media.jobId)?.outputPath : undefined) ?? media.path
}

/** Every file the variation records point at, for saving and relinking a project. */
export function variationFiles(state: VariationState, jobs: ImageJob[]): Array<{ id: string; absolutePath: string }> {
  const out: Array<{ id: string; absolutePath: string }> = []
  for (const e of state.entities) for (const r of e.revisions) for (const m of r.media) out.push({ id: m.jobId ?? `${e.id}@${r.n}:${m.role}`, absolutePath: currentPath(m, jobs) })
  return out
}
