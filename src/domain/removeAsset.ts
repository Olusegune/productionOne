import type { QueueState } from './generationQueue'
import type { AnalysisResult, ShotRecord } from './productionStudio'
import type { ProportionProfile } from './proportions'
import type { FitRule } from './fit'
import type { SceneState } from './sceneState'
import type { Reviews } from './visualReview'

/**
 * Removing a character, costume, prop or set from the project. It removes the item and everything that points only at it (its pictures in the queue, its notes,
 * its proportions and fit rules, its place in shots and on the blocking map, its review findings). The picture FILES stay on this computer: nothing is deleted from
 * disk. A removal can be undone from a snapshot of exactly what was removed.
 */
export interface ProjectSlice {
  analysis: AnalysisResult
  queue: QueueState
  assetOutputs: Record<string, string>
  assetRefs: Record<string, string[]>
  proportions: Record<string, ProportionProfile>
  fitRules: Record<string, FitRule[]>
  sheetNotes: Record<string, string>
  sheetSettings: Record<string, string>
  shots: ShotRecord[]
  sceneStates: Record<string, SceneState>
  reviews: Reviews
}

export interface RemovalSummary {
  found: boolean
  name: string
  type: string
  /** Pictures made for it (files are kept on the computer). */
  pictures: number
  approved: number
  shots: number
  /** In the script: it comes back the next time the script is analyzed, unless the script no longer names it. */
  fromScript: boolean
}

export function describeRemoval(slice: ProjectSlice, id: string): RemovalSummary {
  const asset = slice.analysis.assets.find((a) => a.id === id)
  const jobs = slice.queue.jobs.filter((j) => j.assetId === id && !!j.outputPath)
  return {
    found: !!asset, name: asset?.name ?? '', type: asset?.type ?? '', pictures: jobs.length, approved: jobs.filter((j) => j.approved).length,
    shots: slice.shots.filter((s) => s.assetIds.includes(id) || s.focusAssetId === id || s.setAssetId === id).length, fromScript: !!asset && !asset.id.startsWith('MANU-'),
  }
}

const without = <T,>(m: Record<string, T>, id: string): Record<string, T> => { const { [id]: _drop, ...rest } = m; return rest }

export function removeAsset(slice: ProjectSlice, id: string): ProjectSlice {
  if (!slice.analysis.assets.some((a) => a.id === id)) return slice
  const gone = new Set(slice.queue.jobs.filter((j) => j.assetId === id).map((j) => j.id))
  const things = (s: SceneState): SceneState => ({
    ...s,
    world: { ...s.world, things: s.world.things.filter((t) => t.id !== id).map((t) => ({ ...t, ...(t.occupies === id ? { occupies: undefined } : {}), ...(t.ownedBy === id ? { ownedBy: undefined } : {}) })) },
    changes: s.changes.filter((c) => c.thingId !== id),
  })
  const findings = <T extends { targetId: string; outputJobId: string }>(list: T[]) => list.filter((f) => f.targetId !== id && !gone.has(f.outputJobId))
  const checked = Object.fromEntries(Object.entries(slice.reviews.checked).filter(([job]) => !gone.has(job)))
  return {
    analysis: { ...slice.analysis, assets: slice.analysis.assets.filter((a) => a.id !== id), scenes: slice.analysis.scenes.map((sc) => ('assetIds' in sc && Array.isArray((sc as { assetIds?: string[] }).assetIds) ? { ...sc, assetIds: (sc as { assetIds: string[] }).assetIds.filter((x) => x !== id) } : sc)) },
    queue: { ...slice.queue, jobs: slice.queue.jobs.filter((j) => j.assetId !== id) },
    assetOutputs: without(slice.assetOutputs, id),
    assetRefs: without(slice.assetRefs, id),
    proportions: without(slice.proportions, id),
    fitRules: without(slice.fitRules, id),
    sheetNotes: without(slice.sheetNotes, id),
    sheetSettings: Object.fromEntries(Object.entries(slice.sheetSettings).filter(([k]) => k !== id && !k.startsWith(`${id}|`))),
    shots: slice.shots.map((s) => {
      if (!s.assetIds.includes(id) && s.focusAssetId !== id && s.setAssetId !== id && !s.looks?.[id] && s.camera?.focusTarget !== id) return s
      const { focusAssetId, setAssetId, looks, camera, ...rest } = s
      return { ...rest, assetIds: s.assetIds.filter((x) => x !== id), ...(focusAssetId && focusAssetId !== id ? { focusAssetId } : {}), ...(setAssetId && setAssetId !== id ? { setAssetId } : {}), ...(looks ? { looks: without(looks, id) } : {}), ...(camera ? { camera: camera.focusTarget === id ? { ...camera, focusTarget: undefined } : camera } : {}) }
    }),
    sceneStates: Object.fromEntries(Object.entries(slice.sceneStates).map(([k, v]) => [k, things(v)])),
    reviews: { deterministic: findings(slice.reviews.deterministic), vision: findings(slice.reviews.vision), checked },
  }
}
