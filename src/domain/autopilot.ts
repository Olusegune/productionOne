import { proportionWords, provenanceFor } from './characterLayers'
import type { ProportionProfile } from './proportions'
import { buildShotPrompt, frameJobs, planCoverage, shotReferences } from './direct'
import { approve, committedUsd, enqueue, shouldAnchor, type ImageJob, type JobRequest, type QueueState } from './generationQueue'
import type { AnalysisResult, ExtractedAsset, ShotRecord } from './productionStudio'
import { buildViewPrompt, outputName, primaryViewKeys, sheetTypesFor, viewsFor, type ViewSpec } from './sheetSpecs'
import { styleFingerprint } from './style2d'
import type { SheetType, StyleBible } from './visualDevelopment'

/**
 * Autopilot: the steps the app already does, run one after another from a plan the person approved.
 * It spends only inside a budget the person set (the queue's spending guard enforces the ceiling), stops where the person asked it to,
 * and never changes a key, a setting or a style. Everything here is pure: the screen applies what it returns.
 */
export type Depth = 'quick' | 'standard'
export type Phase = 'idle' | 'concepts' | 'checkpoint' | 'sheets' | 'frames' | 'done' | 'stopped'

export interface AutopilotOptions {
  depth: Depth
  includeFrames: boolean
  /** Stop after the first concept of every item so the person can approve or replace each one. When false, a concept with no quality notes is approved automatically and the report says so. */
  stopAfterConcepts: boolean
  perImageUsd: number | null
  budgetUsd: number | null
  provider: string
  model: string
  takesReferences: boolean
  /** The project's shape, for example 9:16, used for storyboard frames. */
  aspect: string
  /** Target proportions per character, used in every picture request so the same body runs through every sheet and frame. */
  proportions?: Record<string, ProportionProfile>
  /** A proportion guide picture per character (path), attached as the last reference so the body follows the target proportions. */
  guides?: Record<string, string>
}

export interface AutopilotState {
  phase: Phase
  /** What the next step is waiting for, in plain words. */
  note: string
  /** Set by the person when they press Continue at a checkpoint. */
  continued: boolean
  conceptsSent: boolean
  sheetsSent: boolean
  framesSent: boolean
  autoApproved: string[]
}

export const initialState = (): AutopilotState => ({ phase: 'idle', note: '', continued: false, conceptsSent: false, sheetsSent: false, framesSent: false, autoApproved: [] })

/** The sheets made for each kind of item. Quick is one sheet each; standard is the working set. */
export function sheetPlan(depth: Depth): Record<'character' | 'costume' | 'prop' | 'set', SheetType[]> {
  return depth === 'quick'
    ? { character: ['Turnaround'], costume: ['Wardrobe'], prop: ['Multi-view'], set: ['Establishing'] }
    : { character: ['Turnaround', 'Expressions', 'Poses', 'Wardrobe'], costume: ['Wardrobe', 'Turnaround'], prop: ['Multi-view', 'Functional'], set: ['Establishing', 'Interior', 'Layout'] }
}

const kindOf = (asset: ExtractedAsset): 'character' | 'costume' | 'prop' | 'set' => (asset.type === 'environment' ? 'set' : (asset.type as 'character' | 'costume' | 'prop' | 'set'))

/** The first picture of an item: the first main view of its first sheet. Approving it makes it the reference the rest are built from. */
export function conceptView(asset: ExtractedAsset, depth: Depth): { sheet: SheetType; view: ViewSpec } {
  const sheets = sheetPlan(depth)[kindOf(asset)]
  for (const sheet of sheets) {
    const views = viewsFor(asset.type, sheet)
    const main = views.find((v) => primaryViewKeys.includes(v.key))
    if (main) return { sheet, view: main }
  }
  const sheet = sheetTypesFor(asset.type)[0]
  return { sheet, view: viewsFor(asset.type, sheet)[0] }
}

const effectiveStyle = (asset: ExtractedAsset, project: StyleBible) => asset.style ?? project

function request(asset: ExtractedAsset, sheet: SheetType, view: ViewSpec, style: StyleBible, queue: QueueState, refs: string[], o: AutopilotOptions): JobRequest {
  const anchored = o.takesReferences && shouldAnchor(queue, { assetId: asset.id, variant: 'Canonical', sheetType: sheet, viewKey: view.key })
  return {
    assetId: asset.id, variant: 'Canonical', sheetType: sheet, viewKey: view.key, label: view.label,
    prompt: buildViewPrompt({ style, asset, variant: 'Canonical', sheetType: sheet, view, model: o.model, anchored, backdrop: 'gray', photoRefs: refs.length > 0, proportions: proportionWords(o.proportions?.[asset.id]), guide: !!(o.takesReferences && o.guides?.[asset.id]) }),
    aspect: view.aspect, fullBody: view.fullBody, provider: o.provider, model: o.model,
    references: o.takesReferences ? [...refs, ...(o.guides?.[asset.id] ? [o.guides[asset.id]] : [])] : [], useAnchor: anchored, styleName: style.name, styleFp: styleFingerprint(style),
    provenance: provenanceFor(o.proportions?.[asset.id], o.takesReferences ? refs.map((path) => ({ path })) : []),
    outputName: (revision: number) => outputName(asset, 'Canonical', sheet, view, revision),
  }
}

/** The first picture for every item that has none yet and has no approved picture of its own. */
export function conceptRequests(analysis: AnalysisResult, style: StyleBible, queue: QueueState, assetRefs: Record<string, string[]>, o: AutopilotOptions): JobRequest[] {
  return analysis.assets.filter((a) => !hasPicture(queue, a)).map((a) => {
    const { sheet, view } = conceptView(a, o.depth)
    return request(a, sheet, view, effectiveStyle(a, style), queue, assetRefs[a.id] ?? [], o)
  })
}

const hasPicture = (queue: QueueState, asset: ExtractedAsset) => queue.jobs.some((j) => j.assetId === asset.id && !!j.outputPath && !j.rejected)
const approvedAnchor = (queue: QueueState, asset: ExtractedAsset) => queue.jobs.some((j) => j.assetId === asset.id && j.approved && !!j.outputPath && primaryViewKeys.includes(j.viewKey))

/** The rest of each item's sheets, for items whose first picture is approved. Views that already exist are skipped by the queue. */
export function sheetRequests(analysis: AnalysisResult, style: StyleBible, queue: QueueState, assetRefs: Record<string, string[]>, o: AutopilotOptions): JobRequest[] {
  const out: JobRequest[] = []
  for (const asset of analysis.assets) {
    if (!approvedAnchor(queue, asset)) continue
    for (const sheet of sheetPlan(o.depth)[kindOf(asset)]) {
      if (!sheetTypesFor(asset.type).includes(sheet)) continue
      for (const view of viewsFor(asset.type, sheet)) out.push(request(asset, sheet, view, effectiveStyle(asset, style), queue, assetRefs[asset.id] ?? [], o))
    }
  }
  return out
}

/** One storyboard frame for every planned shot that has none. */
export function frameRequests(analysis: AnalysisResult, shots: ShotRecord[], style: StyleBible, queue: QueueState, assetRefs: Record<string, string[]>, o: AutopilotOptions): JobRequest[] {
  return shots.filter((s) => !frameJobs(queue, s.id).some((j) => j.outputPath || ['queued', 'generating', 'validating', 'pending'].includes(j.status))).map((s) => {
    const refs = o.takesReferences ? shotReferences(s, analysis, queue, assetRefs) : []
    return {
      assetId: s.id, variant: 'Storyboard', sheetType: 'Storyboard', viewKey: 'frame', label: s.title ?? s.id, aspect: o.aspect, fullBody: false, provider: o.provider, model: o.model,
      prompt: buildShotPrompt(s, analysis, style, refs, o.aspect, o.model, o.proportions), references: refs.map((r) => r.path), styleName: style.name, styleFp: styleFingerprint(style),
      outputName: (rev: number) => `${s.id}_storyboard_v${String(rev).padStart(2, '0')}`,
    }
  })
}

export interface PlanSummary {
  concepts: number
  sheets: number
  frames: number
  images: number
  costUsd: number | null
  /** True when the estimate is more than the budget, or the cost cannot be worked out because no price was given. */
  needsAttention: boolean
  reason: string
  steps: string[]
}

/** What pressing Start would do and cost. Sheet and frame counts are for the whole production; concepts already made are not counted again. */
export function summarize(analysis: AnalysisResult, shots: ShotRecord[], style: StyleBible, queue: QueueState, assetRefs: Record<string, string[]>, o: AutopilotOptions): PlanSummary {
  const planned = shots.length ? shots : planCoverage(analysis)
  let concepts = 0
  let sheets = 0
  for (const asset of analysis.assets) {
    let total = 0
    for (const sheet of sheetPlan(o.depth)[kindOf(asset)]) if (sheetTypesFor(asset.type).includes(sheet)) total += viewsFor(asset.type, sheet).length
    const existing = queue.jobs.filter((j) => j.assetId === asset.id && !!j.outputPath && !j.rejected).length
    const toMake = Math.max(0, total - existing)
    if (!hasPicture(queue, asset)) { concepts += 1; sheets += Math.max(0, toMake - 1) } else sheets += toMake
  }
  const frames = o.includeFrames ? planned.filter((s) => !frameJobs(queue, s.id).some((j) => j.outputPath)).length : 0
  const images = concepts + sheets + frames
  const costUsd = o.perImageUsd === null ? null : images * o.perImageUsd
  let reason = ''
  if (o.perImageUsd === null) reason = 'Enter what one picture costs you, so the cost can be worked out and held to your budget.'
  else if (o.budgetUsd === null) reason = 'Set a budget. The Assistant never starts without one.'
  else if (costUsd !== null && costUsd > o.budgetUsd + 1e-9) reason = `The plan needs about $${costUsd.toFixed(2)} and your budget is $${o.budgetUsd.toFixed(2)}. Raise the budget or choose a shorter plan.`
  const steps = [
    `Make a first concept for ${concepts} item${concepts === 1 ? '' : 's'}`,
    o.stopAfterConcepts ? 'Stop so you can approve or replace each concept' : 'Approve a concept automatically when it has no quality notes (and say so in the report)',
    `Make ${sheets} sheet picture${sheets === 1 ? '' : 's'} from the approved concepts (${o.depth === 'quick' ? 'one sheet each' : 'turnaround, expressions, poses, costume, prop and place sheets'})`,
    ...(o.includeFrames ? [`Make ${frames} storyboard frame${frames === 1 ? '' : 's'} in ${o.aspect}`] : []),
    'Stop at the budget, and write a report of what was made, what failed and what was skipped',
  ]
  return { concepts, sheets, frames, images, costUsd, needsAttention: !!reason, reason, steps }
}

/** The queue with the spending guard set to the person's price and budget. Nothing starts once the ceiling would be passed. */
export function withBudget(queue: QueueState, o: Pick<AutopilotOptions, 'perImageUsd' | 'budgetUsd'>): QueueState {
  return { ...queue, guard: true, perImageUsd: o.perImageUsd, totalCeilingUsd: o.budgetUsd }
}

const live = (j: ImageJob) => ['pending', 'queued', 'generating', 'validating'].includes(j.status)
const settledFor = (queue: QueueState, ids: string[]) => !queue.jobs.some((j) => ids.includes(j.assetId) && live(j))

export interface StepResult {
  state: AutopilotState
  queue: QueueState
  /** Pictures approved automatically on this step. */
  approvedNow: ImageJob[]
  message: string
}

/**
 * One move. Called whenever the queue changes. Starts the next batch when the last one has settled, approves where allowed, and says what it is waiting for.
 * Returning the same state and queue means nothing happened.
 */
export function advance(state: AutopilotState, analysis: AnalysisResult, shots: ShotRecord[], style: StyleBible, queue0: QueueState, assetRefs: Record<string, string[]>, o: AutopilotOptions): StepResult {
  let queue = queue0
  const nothing = (note = state.note, message = ''): StepResult => ({ state: { ...state, note }, queue, approvedNow: [], message })
  if (state.phase === 'idle' || state.phase === 'done' || state.phase === 'stopped') return nothing()
  const ids = analysis.assets.map((a) => a.id)
  const frameIds = shots.map((s) => s.id)

  if (state.phase === 'concepts') {
    if (!state.conceptsSent) {
      const res = enqueue(queue, conceptRequests(analysis, style, queue, assetRefs, o))
      queue = res.state
      return { state: { ...state, conceptsSent: true, note: `Making ${res.added} first concept${res.added === 1 ? '' : 's'}…` }, queue, approvedNow: [], message: `Making ${res.added} first concept${res.added === 1 ? '' : 's'}.` }
    }
    if (!settledFor(queue, ids)) return nothing('Waiting for the concepts…')
    const approvedNow: ImageJob[] = []
    const waiting = queue.jobs.filter((j) => ids.includes(j.assetId) && j.status === 'needs-review' && !!j.outputPath && !j.approved && !j.rejected)
    if (!o.stopAfterConcepts) {
      for (const job of waiting) if (job.qaNotes.length === 0) { queue = approve(queue, job.id); approvedNow.push(queue.jobs.find((j) => j.id === job.id)!) }
    }
    const still = queue.jobs.filter((j) => ids.includes(j.assetId) && j.status === 'needs-review' && !j.approved && !j.rejected)
    if (still.length) return { state: { ...state, phase: 'checkpoint', autoApproved: [...state.autoApproved, ...approvedNow.map((j) => j.id)], note: `${still.length} concept${still.length === 1 ? '' : 's'} waiting for you. Approve, replace or reject each one, then press Continue.` }, queue, approvedNow, message: 'Stopped for your review of the concepts.' }
    return { state: { ...state, phase: 'sheets', autoApproved: [...state.autoApproved, ...approvedNow.map((j) => j.id)], note: 'Concepts approved. Making the sheets…' }, queue, approvedNow, message: 'Concepts approved.' }
  }

  if (state.phase === 'checkpoint') {
    if (!state.continued) return nothing()
    return { state: { ...state, phase: 'sheets', continued: false, note: 'Making the sheets…' }, queue, approvedNow: [], message: 'Continuing.' }
  }

  if (state.phase === 'sheets') {
    if (!state.sheetsSent) {
      const res = enqueue(queue, sheetRequests(analysis, style, queue, assetRefs, o))
      queue = res.state
      return { state: { ...state, sheetsSent: true, note: `Making ${res.added} sheet picture${res.added === 1 ? '' : 's'}…` }, queue, approvedNow: [], message: `Making ${res.added} sheet pictures.` }
    }
    if (!settledFor(queue, ids)) return nothing('Waiting for the sheets…')
    return { state: { ...state, phase: o.includeFrames && shots.length ? 'frames' : 'done', note: o.includeFrames && shots.length ? 'Making the storyboard frames…' : 'Finished.' }, queue, approvedNow: [], message: 'Sheets finished.' }
  }

  if (state.phase === 'frames') {
    if (!state.framesSent) {
      const res = enqueue(queue, frameRequests(analysis, shots, style, queue, assetRefs, o))
      queue = res.state
      return { state: { ...state, framesSent: true, note: `Making ${res.added} storyboard frame${res.added === 1 ? '' : 's'}…` }, queue, approvedNow: [], message: `Making ${res.added} storyboard frames.` }
    }
    if (!settledFor(queue, frameIds)) return nothing('Waiting for the frames…')
    return { state: { ...state, phase: 'done', note: 'Finished.' }, queue, approvedNow: [], message: 'Frames finished.' }
  }
  return nothing()
}

export interface Report {
  made: number
  needsReview: number
  approved: number
  failed: Array<{ label: string; asset: string; error: string }>
  skippedForBudget: number
  autoApproved: number
  spentUsd: number | null
}

/** What happened, honestly: what was made, what needs a decision, what failed and why, and what the budget stopped. */
/** `perImageUsd` is the price the person entered for this run (the queue's own price has been put back by the time the report is read). */
export function report(queue: QueueState, analysis: AnalysisResult, state: AutopilotState, perImageUsd: number | null = queue.perImageUsd): Report {
  const name = (id: string) => analysis.assets.find((a) => a.id === id)?.name ?? id
  const failed = queue.jobs.filter((j) => j.status === 'failed' && j.source !== 'supplied').map((j) => ({ label: j.label, asset: name(j.assetId), error: j.error ?? 'failed' }))
  const made = queue.jobs.filter((j) => !!j.outputPath).length
  return {
    made, needsReview: queue.jobs.filter((j) => j.status === 'needs-review' && !j.approved && !j.rejected).length, approved: queue.jobs.filter((j) => j.approved).length,
    failed, skippedForBudget: queue.jobs.filter((j) => ['queued', 'pending'].includes(j.status)).length, autoApproved: state.autoApproved.length,
    spentUsd: perImageUsd === null ? null : committedUsd({ ...queue, perImageUsd }),
  }
}
