import type { ImageJob, QueueState } from './generationQueue'
import { isMissingFile, unresolvedFailures } from './generationQueue'
import type { AnalysisResult } from './productionStudio'
import { primaryViewKeys } from './sheetSpecs'

/** Pictures waiting for a person's decision, newest first. */
export const awaitingReview = (queue: QueueState): ImageJob[] =>
  queue.jobs.filter((j) => j.status === 'needs-review' && j.outputPath).sort((a, b) => b.updatedAt - a.updatedAt)

/** Pictures a person turned down, newest first, so a mistaken rejection can be found again. */
export const turnedDown = (queue: QueueState): ImageJob[] =>
  queue.jobs.filter((j) => j.rejected && j.outputPath).sort((a, b) => b.updatedAt - a.updatedAt)

/** Pictures that are approved, newest first, so an approval made by mistake can be taken back. */
export const approvedPictures = (queue: QueueState): ImageJob[] =>
  queue.jobs.filter((j) => j.approved && !j.rejected && j.outputPath).sort((a, b) => b.updatedAt - a.updatedAt)

/** The approved picture to compare a new one against: the newest approved front view of the same asset and look. Null when nothing is approved yet. */
export function approvedReference(queue: QueueState, job: ImageJob): ImageJob | null {
  const found = queue.jobs
    .filter((j) => j.id !== job.id && j.assetId === job.assetId && j.variant === job.variant && j.approved && j.outputPath && primaryViewKeys.includes(j.viewKey))
    .sort((a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt)
  return found[0] ?? null
}

/** Every picture of the same view (same asset, look, sheet and view) that can still be chosen between, newest revision first. */
export const revisionsOfView = (queue: QueueState, job: ImageJob): ImageJob[] =>
  queue.jobs
    .filter((j) => j.assetId === job.assetId && j.variant === job.variant && j.sheetType === job.sheetType && j.viewKey === job.viewKey && j.outputPath && (j.status === 'needs-review' || j.status === 'completed'))
    .sort((a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt)

/** The other takes of this view, newest first. */
export const otherRevisions = (queue: QueueState, job: ImageJob): ImageJob[] => revisionsOfView(queue, job).filter((j) => j.id !== job.id)

/** The take to show beside this one by default: the approved one if there is one, otherwise the newest other take. Null when there is only one take. */
export const defaultCompareTarget = (queue: QueueState, job: ImageJob): ImageJob | null => {
  const others = otherRevisions(queue, job)
  return others.find((j) => j.approved) ?? others[0] ?? null
}

/**
 * Keep one take of a view and turn the others down. The kept take is approved; every other take of the same view that was approved or waiting for a decision is rejected.
 * Files are never deleted, so a turned-down take can be found again under "Turned down" and kept later.
 */
export function keepRevision(queue: QueueState, keepId: string, now = Date.now()): QueueState {
  const keep = queue.jobs.find((j) => j.id === keepId)
  if (!keep || !keep.outputPath || (keep.status !== 'needs-review' && keep.status !== 'completed')) return queue
  const group = new Set(revisionsOfView(queue, keep).map((j) => j.id))
  return {
    ...queue,
    jobs: queue.jobs.map((j) => {
      if (!group.has(j.id)) return j
      if (j.id === keepId) return { ...j, status: 'completed' as const, approved: true, rejected: false, updatedAt: now }
      return j.approved || j.status === 'needs-review' ? { ...j, status: 'completed' as const, approved: false, rejected: true, updatedAt: now } : j
    }),
  }
}

export type ChecklistGroup = 'blocker' | 'review' | 'optional'
export const checklistGroups: Array<{ id: ChecklistGroup; title: string; note: string }> = [
  { id: 'blocker', title: 'Blockers', note: 'Must be done to export a verified package' },
  { id: 'review', title: 'Review', note: 'Quality checks and approvals' },
  { id: 'optional', title: 'Optional', note: 'Recommended to improve the package' },
]

export interface ChecklistItem {
  id: string
  state: 'ok' | 'todo'
  /** Blockers stop a verified package; Review is quality checks and approvals; Optional improves the package but is not needed to make one. */
  group: ChecklistGroup
  label: string
  detail: string
  /** Where the fix is. */
  fix?: { kind: 'review' | 'style' | 'asset' | 'script' | 'failed' | 'relink'; assetId?: string; label: string }
}

/** What stands between this project and a verified package, in the order a person would fix it. Every line says where to go. */
export function deliveryChecklist(args: { analysis: AnalysisResult; queue: QueueState; missingAssets: string[]; incompleteShots: string[]; styleLocked: boolean }): ChecklistItem[] {
  const { analysis, queue, missingAssets, incompleteShots, styleLocked } = args
  const name = (id: string) => analysis.assets.find((a) => a.id === id)?.name ?? id
  const review = queue.jobs.filter((j) => j.status === 'needs-review').length
  const open = unresolvedFailures(queue)
  const gone = open.filter(isMissingFile)
  const failed = open.length - gone.length
  const items: ChecklistItem[] = []
  items.push(analysis.assets.length
    ? { id: 'script', state: 'ok', group: 'blocker', label: 'Script read', detail: `${analysis.assets.length} asset${analysis.assets.length === 1 ? '' : 's'} found` }
    : { id: 'script', state: 'todo', group: 'blocker', label: 'No script yet', detail: 'Import or paste a script so there are assets to prepare.', fix: { kind: 'script', label: 'Open Script' } })
  items.push(styleLocked
    ? { id: 'style', state: 'ok', group: 'blocker', label: 'Visual style locked', detail: 'Every sheet uses the same look.' }
    : { id: 'style', state: 'todo', group: 'blocker', label: 'Visual style not locked', detail: 'Lock the look so every sheet matches.', fix: { kind: 'style', label: 'Choose a style' } })
  items.push(missingAssets.length === 0
    ? { id: 'sheets', state: 'ok', group: 'blocker', label: 'Every asset has an approved sheet', detail: '' }
    : { id: 'sheets', state: 'todo', group: 'blocker', label: `${missingAssets.length} asset${missingAssets.length === 1 ? '' : 's'} without an approved sheet`, detail: missingAssets.slice(0, 3).map(name).join(', ') + (missingAssets.length > 3 ? ` and ${missingAssets.length - 3} more` : ''), fix: { kind: 'asset', assetId: missingAssets[0], label: `Open ${name(missingAssets[0])}` } })
  items.push(review === 0
    ? { id: 'review', state: 'ok', group: 'review', label: 'Nothing waiting for review', detail: '' }
    : { id: 'review', state: 'todo', group: 'review', label: `${review} picture${review === 1 ? '' : 's'} waiting for your decision`, detail: 'Approve, request changes or reject each one.', fix: { kind: 'review', label: 'Open Review' } })
  if (gone.length > 0) items.push({ id: 'gone', state: 'todo', group: 'blocker', label: `${gone.length} picture${gone.length === 1 ? ' is' : 's are'} not on this computer`, detail: 'If you still have the files, point to the folder and they are linked back. Otherwise press Generate on the view, or add your own with Use my image.', fix: { kind: 'relink', label: 'Find the files…' } })
  if (failed > 0) items.push({ id: 'failed', state: 'todo', group: 'review', label: `${failed} failed job${failed === 1 ? '' : 's'}`, detail: 'Retry them, or choose a different model.', fix: { kind: 'failed', label: 'See failed jobs' } })
  if (incompleteShots.length > 0) items.push({ id: 'shots', state: 'todo', group: 'optional', label: `${incompleteShots.length} storyboard frame${incompleteShots.length === 1 ? '' : 's'} not approved`, detail: 'Only matters if you use the optional storyboard.' })
  return items
}

/** A package is verified only when nothing on the checklist is open. Anything else is a draft and must say so. */
export const packageKind = (items: ChecklistItem[]): 'verified' | 'draft' => (items.every((i) => i.state === 'ok') ? 'verified' : 'draft')
