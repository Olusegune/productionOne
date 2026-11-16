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
