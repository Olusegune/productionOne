import { primaryViewKeys } from './sheetSpecs'

interface JobLike { assetId: string; viewKey: string; approved: boolean; rejected?: boolean; outputPath?: string; revision: number }
interface AssetLike { id: string; status: 'planned' | 'approved' }

/**
 * An asset is marked Approved, and given a picture, when a front view is approved. If that picture is no longer on this computer, the label must not stay:
 * the picture is replaced by another approved front view that still has a file, or dropped, and an asset left with nothing goes back to planned.
 * Only assets whose own recorded picture is gone are touched, so approvals made another way are never undone by accident.
 * `jobs` are the takes after missing files were taken out of the queue (a gone file has no outputPath).
 */
export function reconcileMissing(
  assets: AssetLike[],
  outputs: Record<string, string>,
  jobs: JobLike[],
  missing: string[],
): { outputs: Record<string, string>; demoted: string[] } {
  const gone = new Set(missing)
  const next = { ...outputs }
  const demoted: string[] = []
  for (const [assetId, path] of Object.entries(outputs)) {
    if (!gone.has(path)) continue
    const standIn = jobs
      .filter((j) => j.assetId === assetId && j.approved && !j.rejected && !!j.outputPath && !gone.has(j.outputPath) && primaryViewKeys.includes(j.viewKey))
      .sort((a, b) => b.revision - a.revision)[0]
    if (standIn?.outputPath) { next[assetId] = standIn.outputPath; continue }
    delete next[assetId]
    if (assets.some((a) => a.id === assetId && a.status === 'approved')) demoted.push(assetId)
  }
  return { outputs: next, demoted }
}

/** Clips whose file is not on this computer are flagged (and un-flagged if it is back); the record and its prompt stay. Returns the same array when nothing changed. */
export function flagMissingClips<T extends { path: string; missing?: boolean }>(clips: T[], missing: string[]): T[] {
  const gone = new Set(missing)
  let changed = false
  const next = clips.map((c) => {
    const isGone = gone.has(c.path)
    if (isGone === !!c.missing) return c
    changed = true
    return isGone ? { ...c, missing: true } : { ...c, missing: undefined }
  })
  return changed ? next : clips
}

/** Reference photos that are gone are taken out, since a request that sends one fails. Returns the same object when nothing changed, and how many were removed. */
export function dropMissingRefs(refs: Record<string, string[]>, missing: string[]): { refs: Record<string, string[]>; dropped: number } {
  const gone = new Set(missing)
  let dropped = 0
  const next: Record<string, string[]> = {}
  for (const [id, list] of Object.entries(refs)) {
    const kept = list.filter((p) => !gone.has(p))
    dropped += list.length - kept.length
    next[id] = kept
  }
  return dropped ? { refs: next, dropped } : { refs, dropped: 0 }
}

interface ShotLike { id: string; storyboardStatus: string }
interface FrameJobLike { assetId: string; sheetType: string; approved: boolean; rejected?: boolean; outputPath?: string }

/**
 * A shot is Approved when its storyboard frame is. If that frame's file is gone, the shot must not stay Approved, or the Deliver audit calls the storyboard
 * complete and the package production-ready with a frame that does not exist. Only shots that had a frame go missing are touched: a shot approved by hand with
 * no frame (storyboards switched off, or waived) is left alone. `before` and `after` are the takes before and after the missing files were taken out.
 */
export function reconcileShots(shots: ShotLike[], before: FrameJobLike[], after: FrameJobLike[], missing: string[]): string[] {
  const gone = new Set(missing)
  const lost = new Set(before.filter((j) => j.sheetType === 'Storyboard' && !!j.outputPath && gone.has(j.outputPath)).map((j) => j.assetId))
  return shots
    .filter((s) => s.storyboardStatus === 'approved' && lost.has(s.id))
    .filter((s) => !after.some((j) => j.assetId === s.id && j.sheetType === 'Storyboard' && j.approved && !j.rejected && !!j.outputPath))
    .map((s) => s.id)
}
