import { betterTake, type ImageJob } from './generationQueue'
import { viewsFor } from './sheetSpecs'
import type { SheetType } from './visualDevelopment'

export type SectionId = 'identity' | 'turnaround' | 'poses' | 'expressions' | 'wardrobe' | 'detail' | 'motion' | 'voice'
export type SectionState = 'empty' | 'working' | 'review' | 'approved' | 'blocked' | 'ready'

export interface SectionProgress {
  id: SectionId
  state: SectionState
  approved: number
  total: number
  /** Plain-language next step for this section. */
  next: string
}

const SHEET_FOR: Partial<Record<SectionId, string>> = { identity: 'Identity', turnaround: 'Turnaround', poses: 'Poses', expressions: 'Expressions', wardrobe: 'Wardrobe', detail: 'Detail' }
/** Sheets with a fixed list of views. A sheet is only approved when every one of them is, not when the views made so far are. (Expressions follow the story, so they count what exists.) */
const FIXED_SHEETS = new Set(['Identity', 'Turnaround', 'Poses', 'Wardrobe', 'Detail'])
const live = new Set(['pending', 'queued', 'generating', 'validating'])
const LABEL: Record<SectionId, string> = { identity: 'identity', turnaround: 'turnaround', poses: 'pose', expressions: 'expression', wardrobe: 'wardrobe', detail: 'detail', motion: 'motion', voice: 'voice' }

/** The take that stands for each view: an approved one, otherwise the latest revision, so a rejected old attempt never hides a newer one and a kept older take is not hidden by a turned-down newer one. */
function latestViews(jobs: ImageJob[], assetId: string, sheet: string): ImageJob[] {
  const latest = new Map<string, ImageJob>()
  for (const job of jobs) {
    if (job.assetId !== assetId || job.sheetType !== sheet || job.status === 'cancelled') continue
    const key = `${job.variant}|${job.viewKey}`
    const prev = latest.get(key)
    latest.set(key, betterTake(prev, job))
  }
  return [...latest.values()]
}

/**
 * Derives each Character Bible section's state from real queue data. Motion needs approved identity and turnaround references;
 * voice needs at least one dialogue line for the character. Nothing here is guessed.
 */
export function characterBibleProgress(jobs: ImageJob[], assetId: string, dialogueLines: number): SectionProgress[] {
  const out: SectionProgress[] = []
  for (const id of Object.keys(LABEL) as SectionId[]) {
    const sheet = SHEET_FOR[id]
    if (!sheet) continue
    const views = latestViews(jobs, assetId, sheet)
    const approved = views.filter((v) => v.approved && !v.rejected).length
    const total = Math.max(views.length, FIXED_SHEETS.has(sheet) ? viewsFor('character', sheet as SheetType).length : 0)
    const working = views.some((v) => live.has(v.status))
    const state: SectionState = views.length === 0 ? 'empty' : working ? 'working' : approved === total ? 'approved' : 'review'
    const next = state === 'empty' ? `Generate the ${LABEL[id]} sheet.` : state === 'working' ? 'Generation is in progress.' : state === 'approved' ? 'Approved. Used as a reference for later sections.' : views.length === approved ? `${approved} of ${total} views are approved. Generate the other ${total - approved}.` : `Review ${views.length - approved} view${views.length - approved === 1 ? '' : 's'} and approve the best.`
    out.push({ id, state, approved, total, next })
  }
  const byId = (id: SectionId) => out.find((s) => s.id === id)!
  const anchored = byId('identity').state === 'approved' && byId('turnaround').state === 'approved'
  out.push({ id: 'motion', state: anchored ? 'ready' : 'blocked', approved: 0, total: 0, next: anchored ? 'Identity and turnaround are approved. Plan a short motion test from these references.' : 'Approve the Identity and Turnaround sheets first so motion keeps the same person.' })
  out.push({ id: 'voice', state: dialogueLines > 0 ? 'ready' : 'blocked', approved: 0, total: 0, next: dialogueLines > 0 ? `${dialogueLines} dialogue line${dialogueLines === 1 ? '' : 's'} found in the script for this character.` : 'No dialogue found for this character in the script. Add or propose lines in Story first.' })
  return out
}

/** Overall identity-lock readiness: true when every generated section that exists is built on an approved Identity sheet. */
export function identityAnchored(progress: SectionProgress[]): boolean {
  return progress.find((s) => s.id === 'identity')?.state === 'approved'
}
