import type { ImageJob } from './generationQueue'
import { madeWithEarlierProportions } from './characterLayers'
import type { FitRule } from './fit'
import { controlSpecs, type ControlId, type ProportionProfile } from './proportions'
import { unexplainedDrift, worldAtShot, worldIssues, type SceneState } from './sceneState'

/**
 * Visual review. Deterministic checks (rules over the project's own records) and vision-model findings (a model looking at the picture) are kept in separate
 * lists and never mixed. An output that has not been checked is shown as "Not checked", never as clean. Whether a vision model is accurate is not something
 * this code can claim: that needs human-labelled evaluation.
 */
export type Category = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'
export const categoryLabels: Record<Category, string> = {
  A: 'Identity', B: 'Proportions and silhouette', C: 'Costume continuity', D: 'Set landmarks', E: 'Placement and chair assignment', F: 'Scale and fit', G: 'Hands and anatomy', H: 'Intersections and ground contact', I: 'Art-style adherence', J: 'Lighting and colour continuity',
}
export const categories = Object.keys(categoryLabels) as Category[]
/** Which categories a rule over the records can check. The rest need a vision model (or a person). */
export const deterministicCategories: Category[] = ['B', 'E', 'F', 'I']

export type Severity = 'info' | 'low' | 'medium' | 'high'
export type FindingStatus = 'open' | 'accepted' | 'dismissed' | 'intentional-exception' | 'corrected'
export type FindingSource = 'deterministic' | 'vision'

export interface Region { x: number; y: number; w: number; h: number }

export interface Finding {
  id: string
  /** The asset or shot the output belongs to. */
  targetId: string
  /** The exact output revision the finding is about (job id and revision). */
  outputJobId: string
  outputRevision: number
  category: Category
  severity: Severity
  /** 0..1. Deterministic findings are 1: they are facts about the records. */
  confidence: number
  /** Where in the picture, when the checker can say (fractions of the image). */
  region?: Region
  expected: string
  observed: string
  sourceRule: string
  suggestedAction: string
  source: FindingSource
  status: FindingStatus
  /** Why a finding was not left open (for example the proportion was marked intentional). */
  reason?: string
  /** The proportion control the finding is about, if any (lets an exception match it). */
  control?: ControlId
}

export interface Reviews { deterministic: Finding[]; vision: Finding[]; /** Per output job id: which categories were actually checked, by whom. */ checked: Record<string, { deterministic: Category[]; vision: Category[]; visionUnable?: boolean }> }
export const emptyReviews = (): Reviews => ({ deterministic: [], vision: [], checked: {} })

export type OutputStatus = 'passed' | 'needs-review' | 'not-checked' | 'unable-to-assess'

/**
 * "Passed" means: at least one category was checked and no open finding remains. It says which categories, never that the picture is perfect. An output that was
 * not checked is "not-checked", and one a vision model could not assess is "unable-to-assess".
 */
export function outputStatus(reviews: Reviews, jobId: string): { status: OutputStatus; checkedCategories: Category[] } {
  const c = reviews.checked[jobId]
  const checkedCategories = [...new Set([...(c?.deterministic ?? []), ...(c?.vision ?? [])])].sort() as Category[]
  const open = [...reviews.deterministic, ...reviews.vision].some((f) => f.outputJobId === jobId && f.status === 'open')
  if (open) return { status: 'needs-review', checkedCategories }
  if (c?.visionUnable && !(c.deterministic?.length)) return { status: 'unable-to-assess', checkedCategories }
  if (!checkedCategories.length) return { status: c?.visionUnable ? 'unable-to-assess' : 'not-checked', checkedCategories }
  return { status: 'passed', checkedCategories }
}

export interface DeterministicInput {
  job: ImageJob
  /** Current target proportions for the character the output is of (if any). */
  profile?: ProportionProfile
  fitRules?: FitRule[]
  /** The scene state and shot order, for placement checks. */
  scene?: SceneState
  shotOrder?: string[]
  /** The current style fingerprint for this output's asset. */
  currentStyleFp?: string
  /** Furniture seat heights actually used in the layout, by furniture id, in metres. */
  seatHeightsM?: Record<string, number>
}

const base = (job: ImageJob) => ({ targetId: job.assetId, outputJobId: job.id, outputRevision: job.revision, confidence: 1, source: 'deterministic' as const, status: 'open' as const })

/**
 * Checks that need no model: they compare the output's recorded provenance with the project's current records. Returns the findings and the categories that
 * were actually checked (a category with nothing to compare is not listed as checked).
 */
export function deterministicChecks(input: DeterministicInput): { findings: Finding[]; checked: Category[] } {
  const { job } = input
  const findings: Finding[] = []
  const checked: Category[] = []
  // Ids come from the output and the rule, in order, so the same input always gives the same ids.
  let n = 0
  const fid = (_job: ImageJob, rule: string) => `F-${job.id}-${rule}-${++n}`
  // B: proportions. Only when the output recorded a profile or the character has one now.
  if (job.provenance || input.profile) {
    checked.push('B')
    if (madeWithEarlierProportions(job.provenance, input.profile)) {
      const changed = job.provenance?.proportionProfile ? controlSpecs.filter((c) => input.profile && job.provenance!.proportionProfile!.controls[c.id].value !== input.profile.controls[c.id].value) : []
      findings.push({ ...base(job), id: fid(job, 'B'), category: 'B', severity: 'medium', control: changed.length === 1 ? changed[0].id : undefined, expected: 'Made with the current target proportions.', observed: `Made with earlier proportions${changed.length ? ` (changed: ${changed.map((c) => c.label).join(', ')})` : ''}.`, sourceRule: 'Output provenance fingerprint differs from the character\'s current profile.', suggestedAction: 'Regenerate this view with the current proportions, or keep it if the change does not matter here.' })
    }
  }
  // I: art style. Compare the style fingerprint the picture was asked for with the current one.
  if (job.styleFp && input.currentStyleFp) {
    checked.push('I')
    if (job.styleFp !== input.currentStyleFp) findings.push({ ...base(job), id: fid(job, 'I'), category: 'I', severity: 'medium', expected: 'Made in the current style.', observed: `Made in ${job.styleName ?? 'an earlier style'}; the style has changed since.`, sourceRule: 'Style fingerprint at generation differs from the current style.', suggestedAction: 'Regenerate with the current style, or reinterpret the approved picture in it.' })
  }
  // E: placement. World problems in the scene, and unexplained drift between consecutive shots.
  if (input.scene && input.shotOrder?.length) {
    const shotIds = input.shotOrder
    const at = shotIds.indexOf(job.assetId)
    if (at >= 0) {
      checked.push('E')
      const world = worldAtShot(input.scene, job.assetId, shotIds)
      for (const issue of worldIssues(world)) findings.push({ ...base(job), id: fid(job, `E-${issue.kind}`), category: 'E', severity: 'high', expected: 'Each chair holds one person, the one it is assigned to, where that chair is.', observed: issue.message, sourceRule: `Scene layout: ${issue.kind}.`, suggestedAction: 'Fix the layout in the blocking map, then regenerate this frame.' })
      if (at > 0) {
        const explained = new Set(input.scene.changes.filter((c) => c.shotId === job.assetId).map((c) => c.thingId))
        for (const d of unexplainedDrift(worldAtShot(input.scene, shotIds[at - 1], shotIds), world, explained)) findings.push({ ...base(job), id: fid(job, 'E-drift'), category: 'E', severity: 'medium', expected: 'Things stay where they were unless a change between shots says otherwise.', observed: d.what, sourceRule: 'World at this shot differs from the previous shot with no recorded change.', suggestedAction: 'Record the movement as an intentional change, or correct the layout.' })
      }
    }
  }
  // F: scale and fit. Approved fit rules against the furniture actually in the layout.
  if (input.profile && input.fitRules?.length && input.seatHeightsM && Object.keys(input.seatHeightsM).length) {
    const seatRule = input.fitRules.find((r) => r.key === 'seat-height' && r.status === 'approved')
    if (seatRule && seatRule.valueM !== undefined && seatRule.intent === 'fit') {
      checked.push('F')
      for (const [id, h] of Object.entries(input.seatHeightsM)) if (Math.abs(h - seatRule.valueM) / seatRule.valueM > 0.25) findings.push({ ...base(job), id: fid(job, 'F'), category: 'F', severity: 'low', expected: `A seat about ${seatRule.valueM} m high (approved rule).`, observed: `${id} is ${h} m high.`, sourceRule: 'Approved fit rule: seat height.', suggestedAction: 'Resize the furniture, or mark the rule intentionally cramped or oversized.' })
    }
  }
  return { findings, checked: [...new Set(checked)] as Category[] }
}

/** Findings about a control the character has marked as an intentional exception are set aside with a visible reason; they can be reopened. Nothing is deleted. */
export function applyExceptions(findings: Finding[], profile: ProportionProfile | undefined): Finding[] {
  if (!profile) return findings
  const excused = new Set(profile.exceptions.map((e) => e.control))
  return findings.map((f) => (f.status === 'open' && f.control && excused.has(f.control) ? { ...f, status: 'intentional-exception' as const, reason: `${controlSpecs.find((c) => c.id === f.control)?.label ?? f.control} is marked intentional for this character.` } : f))
}

// ----------------------------------------------------------------- vision model findings

export const VISION_INSTRUCTIONS = [
  'You are checking one production picture against stated rules. Report only what you can actually see.',
  'Intentional exaggeration is not a defect: if a rule says a feature is deliberately large, small or long, do not report it.',
  'Before reporting a proportion mismatch, consider occlusion, foreshortening and perspective. If you cannot tell, say so with low confidence, or answer "unable".',
  'Answer with JSON only: {"unable": false, "findings": [{"category": "A"-"J", "severity": "info|low|medium|high", "confidence": 0-1, "region": {"x":0-1,"y":0-1,"w":0-1,"h":0-1} or null, "expected": "...", "observed": "...", "rule": "...", "action": "..."}]}.',
  'If nothing is wrong in the categories you were asked about, return an empty findings list.',
].join(' ')

export interface VisionRequest { job: ImageJob; categories: Category[]; rules: string[]; imagePaths: string[] }

export function visionPrompt(req: VisionRequest): string {
  return `${VISION_INSTRUCTIONS}\nCategories to check: ${req.categories.map((c) => `${c} ${categoryLabels[c]}`).join('; ')}.\nRules for this picture:\n${req.rules.map((r) => `- ${r}`).join('\n')}\nThe first image is the output to check; any others are approved references.`
}

const SEVERITIES: Severity[] = ['info', 'low', 'medium', 'high']

/** Reads a vision model's answer strictly. Unknown categories are dropped, numbers are clamped, and anything that is not the expected JSON is "unable to assess" rather than guessed at. */
export function parseVisionAnswer(text: string, job: ImageJob, allowed: Category[]): { findings: Finding[]; unable: boolean; error?: string } {
  const json = /\{[\s\S]*\}/.exec(text)?.[0]
  if (!json) return { findings: [], unable: true, error: 'The model did not answer in the expected form.' }
  let data: unknown
  try { data = JSON.parse(json) } catch { return { findings: [], unable: true, error: 'The model\'s answer was not valid JSON.' } }
  if (typeof data !== 'object' || data === null) return { findings: [], unable: true, error: 'The model\'s answer was not an object.' }
  const d = data as Record<string, unknown>
  if (d.unable === true) return { findings: [], unable: true }
  if (!Array.isArray(d.findings)) return { findings: [], unable: true, error: 'The model\'s answer had no findings list.' }
  const out: Finding[] = []
  for (const raw of d.findings) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as Record<string, unknown>
    const category = String(r.category).toUpperCase() as Category
    if (!categories.includes(category) || !allowed.includes(category)) continue
    const conf = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.min(1, Math.max(0, r.confidence)) : 0.3
    const reg = r.region as Record<string, unknown> | null | undefined
    const region = reg && ['x', 'y', 'w', 'h'].every((k) => typeof reg[k] === 'number') ? { x: Math.min(1, Math.max(0, reg.x as number)), y: Math.min(1, Math.max(0, reg.y as number)), w: Math.min(1, Math.max(0, reg.w as number)), h: Math.min(1, Math.max(0, reg.h as number)) } : undefined
    out.push({
      id: `F-${job.id}-v${category}-${out.length + 1}`, targetId: job.assetId, outputJobId: job.id, outputRevision: job.revision, category, source: 'vision', status: 'open', confidence: conf,
      severity: SEVERITIES.includes(r.severity as Severity) ? (r.severity as Severity) : 'low', ...(region ? { region } : {}),
      expected: String(r.expected ?? '').slice(0, 300), observed: String(r.observed ?? '').slice(0, 300), sourceRule: String(r.rule ?? 'Vision review').slice(0, 300), suggestedAction: String(r.action ?? 'Look at the picture and decide.').slice(0, 300),
    })
  }
  return { findings: out, unable: false }
}

/** The provider that looks at a picture. A real one (a local vision model) or a mock in tests. It may fail or decline. */
export interface VisionProvider { assess: (prompt: string, imagePaths: string[]) => Promise<string> }

/** Runs one opt-in vision review. A failure is recorded as "unable to assess", never as a pass. */
export async function runVisionReview(provider: VisionProvider, req: VisionRequest): Promise<{ findings: Finding[]; checked: Category[]; unable: boolean; error?: string }> {
  try {
    const answer = await provider.assess(visionPrompt(req), req.imagePaths)
    const parsed = parseVisionAnswer(answer, req.job, req.categories)
    return { findings: parsed.findings, checked: parsed.unable ? [] : req.categories, unable: parsed.unable, error: parsed.error }
  } catch (e) {
    return { findings: [], checked: [], unable: true, error: String(e).slice(0, 200) }
  }
}

/** Stores one output's results. Deterministic and vision results go to their own lists; older findings for the same output and source are replaced, decided ones are kept. */
export function recordReview(reviews: Reviews, jobId: string, source: FindingSource, findings: Finding[], checked: Category[], unable = false): Reviews {
  const keep = (list: Finding[]) => list.filter((f) => f.outputJobId !== jobId || f.status !== 'open')
  const prev = reviews.checked[jobId] ?? { deterministic: [], vision: [] }
  const { visionUnable: wasUnable, ...prevRest } = prev
  const stillUnable = source === 'vision' ? unable && checked.length === 0 : wasUnable === true
  const merged = { ...prevRest, [source]: [...new Set([...(prev[source] ?? []), ...checked])], ...(stillUnable ? { visionUnable: true } : {}) }
  return {
    deterministic: source === 'deterministic' ? [...keep(reviews.deterministic), ...findings] : reviews.deterministic,
    vision: source === 'vision' ? [...keep(reviews.vision), ...findings] : reviews.vision,
    checked: { ...reviews.checked, [jobId]: merged },
  }
}

export function setFindingStatus(reviews: Reviews, findingId: string, status: FindingStatus, reason?: string): Reviews {
  const patch = (list: Finding[]) => list.map((f) => (f.id === findingId ? { ...f, status, ...(reason ? { reason } : {}) } : f))
  return { ...reviews, deterministic: patch(reviews.deterministic), vision: patch(reviews.vision) }
}

export const allFindings = (r: Reviews): Finding[] => [...r.deterministic, ...r.vision]

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const STATUSES: FindingStatus[] = ['open', 'accepted', 'dismissed', 'intentional-exception', 'corrected']

/** Reads saved reviews. Damaged findings are dropped; an unknown status becomes "open" so a finding is never hidden by accident. */
export function readReviews(raw: unknown): Reviews {
  if (!isObject(raw)) return emptyReviews()
  const readList = (v: unknown, source: FindingSource): Finding[] => (Array.isArray(v) ? v : []).filter(isObject).filter((f) => typeof f.id === 'string' && typeof f.outputJobId === 'string' && categories.includes(f.category as Category)).map((f) => ({
    id: f.id as string, targetId: String(f.targetId ?? ''), outputJobId: f.outputJobId as string, outputRevision: typeof f.outputRevision === 'number' ? f.outputRevision : 1, category: f.category as Category,
    severity: SEVERITIES.includes(f.severity as Severity) ? (f.severity as Severity) : 'low', confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.3,
    ...(isObject(f.region) ? { region: f.region as unknown as Region } : {}), expected: String(f.expected ?? ''), observed: String(f.observed ?? ''), sourceRule: String(f.sourceRule ?? ''), suggestedAction: String(f.suggestedAction ?? ''),
    source, status: STATUSES.includes(f.status as FindingStatus) ? (f.status as FindingStatus) : 'open', ...(typeof f.reason === 'string' ? { reason: f.reason } : {}), ...(controlSpecs.some((c) => c.id === f.control) ? { control: f.control as ControlId } : {}),
  }))
  const checked: Reviews['checked'] = {}
  if (isObject(raw.checked)) for (const [id, c] of Object.entries(raw.checked)) if (isObject(c)) checked[id] = { deterministic: (Array.isArray(c.deterministic) ? c.deterministic : []).filter((x): x is Category => categories.includes(x as Category)), vision: (Array.isArray(c.vision) ? c.vision : []).filter((x): x is Category => categories.includes(x as Category)), ...(c.visionUnable === true ? { visionUnable: true } : {}) }
  return { deterministic: readList(raw.deterministic, 'deterministic'), vision: readList(raw.vision, 'vision'), checked }
}
