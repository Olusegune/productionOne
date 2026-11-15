import type { ImageJob, QueueState } from './generationQueue'
import type { AnalysisResult } from './productionStudio'
import { primaryViewKeys } from './sheetSpecs'

/** Pictures waiting for a person's decision, newest first. */
export const awaitingReview = (queue: QueueState): ImageJob[] =>
  queue.jobs.filter((j) => j.status === 'needs-review' && j.outputPath).sort((a, b) => b.updatedAt - a.updatedAt)

/** Pictures a person turned down, newest first, so a mistaken rejection can be found again. */
export const turnedDown = (queue: QueueState): ImageJob[] =>
  queue.jobs.filter((j) => j.rejected && j.outputPath).sort((a, b) => b.updatedAt - a.updatedAt)

/** The approved picture to compare a new one against: the newest approved front view of the same asset and look. Null when nothing is approved yet. */
export function approvedReference(queue: QueueState, job: ImageJob): ImageJob | null {
  const found = queue.jobs
    .filter((j) => j.id !== job.id && j.assetId === job.assetId && j.variant === job.variant && j.approved && j.outputPath && primaryViewKeys.includes(j.viewKey))
    .sort((a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt)
  return found[0] ?? null
}

export interface ChecklistItem {
  id: string
  state: 'ok' | 'todo'
  label: string
  detail: string
  /** Where the fix is. */
  fix?: { kind: 'review' | 'style' | 'asset' | 'script' | 'failed'; assetId?: string; label: string }
}

/** What stands between this project and a verified package, in the order a person would fix it. Every line says where to go. */
export function deliveryChecklist(args: { analysis: AnalysisResult; queue: QueueState; missingAssets: string[]; incompleteShots: string[]; styleLocked: boolean }): ChecklistItem[] {
  const { analysis, queue, missingAssets, incompleteShots, styleLocked } = args
  const name = (id: string) => analysis.assets.find((a) => a.id === id)?.name ?? id
  const review = queue.jobs.filter((j) => j.status === 'needs-review').length
  const failed = queue.jobs.filter((j) => j.status === 'failed' && !queue.jobs.some((o) => o.key === j.key && o.revision > j.revision)).length
  const items: ChecklistItem[] = []
  items.push(analysis.assets.length
    ? { id: 'script', state: 'ok', label: 'Script read', detail: `${analysis.assets.length} asset${analysis.assets.length === 1 ? '' : 's'} found` }
    : { id: 'script', state: 'todo', label: 'No script yet', detail: 'Import or paste a script so there are assets to prepare.', fix: { kind: 'script', label: 'Open Story' } })
  items.push(styleLocked
    ? { id: 'style', state: 'ok', label: 'Visual style locked', detail: 'Every sheet uses the same look.' }
    : { id: 'style', state: 'todo', label: 'Visual style not locked', detail: 'Lock the look so every sheet matches.', fix: { kind: 'style', label: 'Choose a style' } })
  items.push(missingAssets.length === 0
    ? { id: 'sheets', state: 'ok', label: 'Every asset has an approved sheet', detail: '' }
    : { id: 'sheets', state: 'todo', label: `${missingAssets.length} asset${missingAssets.length === 1 ? '' : 's'} without an approved sheet`, detail: missingAssets.slice(0, 3).map(name).join(', ') + (missingAssets.length > 3 ? ` and ${missingAssets.length - 3} more` : ''), fix: { kind: 'asset', assetId: missingAssets[0], label: `Open ${name(missingAssets[0])}` } })
  items.push(review === 0
    ? { id: 'review', state: 'ok', label: 'Nothing waiting for review', detail: '' }
    : { id: 'review', state: 'todo', label: `${review} picture${review === 1 ? '' : 's'} waiting for your decision`, detail: 'Approve, request changes or reject each one.', fix: { kind: 'review', label: 'Open Review' } })
  if (failed > 0) items.push({ id: 'failed', state: 'todo', label: `${failed} failed job${failed === 1 ? '' : 's'}`, detail: 'Retry them, or choose a different model.', fix: { kind: 'failed', label: 'See failed jobs' } })
  if (incompleteShots.length > 0) items.push({ id: 'shots', state: 'todo', label: `${incompleteShots.length} storyboard frame${incompleteShots.length === 1 ? '' : 's'} not approved`, detail: 'Only matters if you use the optional storyboard.' })
  return items
}

/** A package is verified only when nothing on the checklist is open. Anything else is a draft and must say so. */
export const packageKind = (items: ChecklistItem[]): 'verified' | 'draft' => (items.every((i) => i.state === 'ok') ? 'verified' : 'draft')
