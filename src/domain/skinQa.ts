import type { Finding } from './visualReview'
import type { ImageJob } from './generationQueue'
import { expectedColourEffect } from './skinLighting'
import type { LightingRecord } from './lighting'
import { approvedMachine } from './machineLab'
import { ageDetailLine, isPhotorealStyle, skinPromptFor } from './skin'
import type { TransformationSpec, VariationState } from './variations'

/**
 * Skin surface checks. These are advisory heuristics over real measurements of the face area (fine-detail energy, share of very bright pixels, average colour)
 * compared with the approved original. They can notice a picture that is much smoother, much rougher, shinier or a different average colour than the original.
 * They cannot tell whether a face is the same person, whether it has aged, whether a mark moved, or whether makeup changed: those are left to a person and are
 * named as not checked. Measurements are shown as what they are, never as a quality score, and a difference can come from framing, focus or resolution.
 */
export const SKIN_CHECKER = 'Skin surface heuristics v1'
export const SKIN_CHECKER_NOTE = 'Advisory heuristics over measured fine-detail energy, highlight share and average colour of the face area. Not a judgement of identity or quality.'

export interface SkinMetrics { texture: number; highlight: number; r: number; g: number; b: number; usedHead: boolean }
export interface SkinMeasurement { original: SkinMetrics; candidate: SkinMetrics }

export const SMOOTH_BELOW = 0.6
export const ROUGH_ABOVE = 1.8
export const SHINE_MIN_SHARE = 0.03
export const COLOUR_SHIFT = 0.03

export type SkinFindingKind = 'smoothing' | 'over-texture' | 'shine' | 'colour-shift'
export interface SkinFinding { kind: SkinFindingKind; title: string; severity: 'low' | 'medium'; evidence: string; uncertainty: string; action: string; region: string; checker: string }

export type SkinQaState = 'not-checked' | 'needs-review' | 'passed' | 'unable'
export const SKIN_QA_LABELS: Record<SkinQaState, string> = { 'not-checked': 'Not checked', 'needs-review': 'Needs review', passed: 'Passed for the checks performed', unable: 'Unable to check' }

/** What these heuristics cannot see, so a pass is never read as more than it is. */
export const SKIN_NOT_CHECKED = ['Identity: is it still the same person', 'Unintended aging', 'Distinctive marks missing or moved', 'Makeup or temporary condition drift', 'Detail consistency across views', 'Sharpening halos']

export interface SkinQaReport { state: SkinQaState; findings: SkinFinding[]; checked: string[]; notChecked: string[]; note: string; checker: string }

const pct = (n: number) => `${Math.round(n * 100)}%`
const chroma = (m: SkinMetrics) => { const t = m.r + m.g + m.b || 1; return { r: m.r / t, g: m.g / t, b: m.b / t } }

export interface SkinQaInput { measurement: SkinMeasurement | null; light?: LightingRecord; error?: string }

/** The report for one candidate against its approved original. */
export function skinSurfaceReport(input: SkinQaInput): SkinQaReport {
  const base = { checker: SKIN_CHECKER, notChecked: SKIN_NOT_CHECKED }
  if (!input.measurement) return { ...base, state: 'unable', findings: [], checked: [], note: input.error ? `The pictures could not be measured: ${input.error}` : 'The pictures could not be measured.' }
  const { original: o, candidate: c } = input.measurement
  const region = c.usedHead && o.usedHead ? 'the face (found automatically)' : 'the middle of the picture (no head was found, so a fixed area was measured)'
  const findings: SkinFinding[] = []
  const checked = ['Smoothing or over-texture (fine-detail energy)', 'Uniform shine (share of very bright pixels)', 'Average colour of the face area']
  const caveat = 'A difference can also come from framing, focus or resolution, so look at the picture before acting on it.'
  let note = ''
  if (o.texture < 1) {
    note = 'The original has almost no fine detail in the measured area, so texture could not be compared.'
    checked.shift()
  } else {
    const ratio = c.texture / o.texture
    if (ratio < SMOOTH_BELOW) findings.push({ kind: 'smoothing', title: 'Possible excessive smoothing', severity: 'medium', evidence: `Fine-detail energy in ${region} is ${pct(ratio)} of the original's.`, uncertainty: `Heuristic. ${caveat}`, action: 'Compare the close-ups. If the skin looks waxy, generate again with a higher texture detail, or keep the original.', region, checker: SKIN_CHECKER })
    else if (ratio > ROUGH_ABOVE) findings.push({ kind: 'over-texture', title: 'Possible exaggerated texture', severity: 'medium', evidence: `Fine-detail energy in ${region} is ${pct(ratio)} of the original's.`, uncertainty: `Heuristic. ${caveat}`, action: 'Compare the close-ups. If pores or noise look repeated or too strong, lower the texture detail and generate again.', region, checker: SKIN_CHECKER })
  }
  if (c.highlight >= SHINE_MIN_SHARE && c.highlight > o.highlight * 2 + 0.01) findings.push({ kind: 'shine', title: 'Possible uniform shine', severity: 'medium', evidence: `${pct(c.highlight)} of the measured area is very bright, against ${pct(o.highlight)} in the original.`, uncertainty: `Heuristic. A brighter light or a different exposure also does this. ${caveat}`, action: 'Look for broad, even highlights. If they look plastic, choose a matte or natural finish and generate again.', region, checker: SKIN_CHECKER })
  const [a, b] = [chroma(o), chroma(c)]
  const shift = Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
  if (shift >= COLOUR_SHIFT) {
    const explained = input.light ? expectedColourEffect(input.light) : ''
    const lit = !!input.light && (input.light.colorTempK < 4500 || input.light.colorTempK > 6200)
    findings.push({ kind: 'colour-shift', title: lit ? 'Average colour differs, which this light may explain' : 'Possible complexion shift', severity: lit ? 'low' : 'medium', evidence: `The average colour of ${region} differs from the original's by ${(shift * 100).toFixed(1)} points of colour balance.`, uncertainty: `${explained ? `${explained} ` : ''}Warm light and natural undertones can be intentional. ${caveat}`, action: 'Compare the complexion with the approved reference, allowing for the light. Change something only if the shift is more than the light explains.', region, checker: SKIN_CHECKER })
  }
  return { ...base, state: findings.length ? 'needs-review' : 'passed', findings, checked, note }
}

const FIND_ID = (job: ImageJob, kind: string) => `L-${kind}-${job.id}-${job.revision}`

/** The Review screen's findings for a report. Category L, never auto-resolved; confidence is "about half" because these are heuristics, not calibrated probabilities. */
export function toReviewFindings(report: SkinQaReport, job: ImageJob): Finding[] {
  return report.findings.map((f) => ({
    id: FIND_ID(job, f.kind), targetId: job.assetId, outputJobId: job.id, outputRevision: job.revision, category: 'L', severity: f.severity === 'medium' ? 'medium' : 'low', confidence: 0.5,
    expected: 'A natural surface close to the approved original, with its complexion.', observed: `${f.title}: ${f.evidence} ${f.uncertainty}`, sourceRule: `${f.checker}. ${SKIN_CHECKER_NOTE}`, suggestedAction: f.action, source: 'deterministic', status: 'open',
  } as Finding))
}

// ---------- which pictures the human-skin checks apply to ----------

const NON_HUMAN_KINDS = /robot|cyber|creature|animal|hybrid|element|monster|supernatural|zombie|infect/i

/** Whether a transformation stage replaces human skin (scales, metal, decay, another material), so human-skin rules must not be applied to it. */
export function stageReplacesSkin(spec: Pick<TransformationSpec, 'kind' | 'intensity' | 'details'> | undefined): boolean {
  if (!spec) return false
  if (!NON_HUMAN_KINDS.test(spec.kind ?? '')) return false
  return (spec.intensity ?? 3) >= 4 || /scale|metal|chrome|armou?r|stone|bark|fur|feather|rot|decay|ash|crystal|mechanical/i.test(spec.details?.skin ?? '')
}

export interface Applicability { applies: boolean; reason: string }

/** Whether the human-skin wording and checks apply to a picture. A robot, a stylized style and a stage that replaces skin are never judged as human skin. */
export function skinCheckApplies(input: { style: { family?: string; name?: string; rendering?: string } | undefined; state: VariationState; characterId: string; variant?: string }): Applicability {
  if (!isPhotorealStyle(input.style)) return { applies: false, reason: 'The style is not photorealistic, so human-skin checks do not apply.' }
  if (approvedMachine(input.state, input.characterId)) return { applies: false, reason: 'This character is declared as a machine, so human-skin checks do not apply.' }
  const stage = input.variant ? input.state.entities.find((e) => e.kind === 'transformation' && e.characterId === input.characterId && (e.revisions[e.revisions.length - 1].spec as TransformationSpec).variant === input.variant) : undefined
  if (stage && stageReplacesSkin(stage.revisions[stage.revisions.length - 1].spec as TransformationSpec)) return { applies: false, reason: 'This transformation stage replaces human skin (scales, metal, decay or another material), so human-skin checks do not apply.' }
  return { applies: true, reason: '' }
}

/** The skin wording for a prompt of one look: only when the checks apply to it. */
export function skinPromptForVariant(state: VariationState, characterId: string, style: Parameters<typeof skinCheckApplies>[0]['style'], variant: string | undefined): string | undefined {
  return skinCheckApplies({ style, state, characterId, variant }).applies ? skinPromptFor(state, characterId, style) : undefined
}

/** The skin wording for an age variant: the approved profile plus age-appropriate fine detail. Only for a photorealistic, human, approved profile. */
export function skinPromptForAge(state: VariationState, characterId: string, style: Parameters<typeof skinCheckApplies>[0]['style'], targetAge: string): string | undefined {
  const base = skinPromptForVariant(state, characterId, style, undefined)
  if (!base) return undefined
  return [base, ageDetailLine(targetAge)].filter(Boolean).join(' ')
}
