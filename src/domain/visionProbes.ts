import { describeRegion, inheritedRegions, pictureSide } from './conditions'
import type { ImageJob } from './generationQueue'
import { garmentText } from './wardrobe'
import { findEntity, findRevision, type ConditionSpec, type FitSpec, type GarmentSpec, type TransformationSpec, type VariationState } from './variations'
import type { Category, Finding, VisionProvider } from './visualReview'

/**
 * Probes: closed questions put to a vision model, with the answer compared by the app.
 *
 * A small local model cannot judge ("is the tear on the correct side?"): in the labelled test described in docs/VARIATIONS_ARCHITECTURE.md it called a torn
 * jacket undamaged and failed outright on questions that compared three pictures. It can answer a narrow question about what it sees ("is the torn sleeve on the
 * left or the right of the picture?", "are these two the same person?", "is he wearing a green waxed jacket?") and in that test it did so correctly every time.
 * So the model only reports what it sees; the app holds the expectation (the wearer's side turned into the picture's side for this view) and does the comparing.
 *
 * Only the kinds of question that were tested are asked. A question is asked twice; two different answers mean "could not tell", never a finding.
 */
export type ProbeKind = 'side' | 'same-person' | 'wearing'

export interface Probe {
  id: string
  kind: ProbeKind
  category: Category
  /** The pictures to show, in order. */
  images: string[]
  question: string
  answerKey: string
  /** What the app expects, and how to say a different answer in words. */
  expect: string | boolean
  expected: string
  observe: (answer: string | boolean) => string
  severity: Finding['severity']
  action: string
}

const sideQuestion = (what: string) => `This picture shows a garment, or a person wearing a garment. Look for this on the garment: ${what}. Look at the picture exactly as you see it. Is it on the LEFT side of the picture, the RIGHT side of the picture, on BOTH sides, or NOT visible? Answer with JSON only: {"side_of_picture": "left" | "right" | "both" | "none"}`
const samePersonQuestion = 'You are given two pictures of full-body characters. Do they show the same person (the same face, the same person, possibly older or in different clothes), or two different people? Answer with JSON only: {"same_person": true | false}'
const wearingQuestion = (garment: string) => `This picture shows a person. Are they wearing this: ${garment}? Answer with JSON only: {"wearing_it": true | false}`

const shorten = (text: string, n: number) => (text.length <= n ? text : `${text.slice(0, n - 1).replace(/\s+\S*$/, '')}…`)

export function probesFor(state: VariationState, job: ImageJob): Probe[] {
  const link = job.variation
  if (!link || !job.outputPath) return []
  const rev = findRevision(state, { id: link.id, revision: link.revision })
  if (!rev) return []
  const out: Probe[] = []
  const character = (job.variation?.uses ?? []).find((u) => u.path && /reference-1-(character|earlier-stage)/.test(u.role))?.path ?? job.references[0]
  const add = (p: Probe) => out.push(p)

  // Where the changes are, for a garment in a condition (alone, or on a person).
  const conditionRef = link.role === 'condition-preview' ? { id: link.id, revision: link.revision } : link.role === 'fit-candidate' ? (rev.spec as FitSpec).condition : undefined
  if (conditionRef) {
    const { earlier, own } = inheritedRegions(state, conditionRef)
    let n = 0
    for (const x of [...earlier, ...own]) {
      const want = pictureSide(x.region.side, job.viewKey)
      if (!want || !x.region.description.trim()) continue
      const what = `${x.region.component}: ${x.region.description.trim()}`
      const wearer = x.region.side === 'character-left' ? 'left' : 'right'
      add({
        id: `side-${++n}`, kind: 'side', category: 'K', images: [job.outputPath], question: sideQuestion(what), answerKey: 'side_of_picture', expect: want,
        expected: `The ${what.toLowerCase()} should be on the ${want} of the picture (the wearer's ${wearer}).`,
        observe: (a) => (a === 'none' ? 'The model could not see it at all.' : a === 'both' ? 'The model sees it on both sides.' : `The model sees it on the ${a} of the picture.`),
        severity: 'high', action: 'Look at the picture. If it is on the wrong side, make it again and say the side in picture terms (for example "on the right of the picture").',
      })
    }
  }

  // Is it the same person as the picture it was made from?
  const intensity = link.role === 'transformation-candidate' ? ((rev.spec as TransformationSpec).intensity ?? 3) : 0
  if (character && (link.role === 'age-candidate' || link.role === 'fit-candidate' || (link.role === 'transformation-candidate' && intensity <= 3))) {
    add({
      id: 'same-person', kind: 'same-person', category: 'A', images: [job.outputPath, character], question: samePersonQuestion, answerKey: 'same_person', expect: true,
      expected: 'The same person as the approved picture it was made from.',
      observe: (a) => (a === false ? 'The model thinks this is a different person.' : 'The model thinks this is the same person.'),
      severity: 'high', action: 'Compare the face with the approved picture. If it has drifted, make it again.',
    })
  }

  // Is the garment being worn?
  if (link.role === 'fit-candidate') {
    const fit = rev.spec as FitSpec
    const garment = findEntity(state, fit.garment.id)?.revisions.find((r) => r.n === fit.garment.revision)?.spec as GarmentSpec | undefined
    if (garment?.description.trim()) {
      const what = shorten(garmentText({ ...garment, details: undefined, pieces: undefined, category: undefined }), 150)
      add({
        id: 'wearing', kind: 'wearing', category: 'C', images: [job.outputPath], question: wearingQuestion(what), answerKey: 'wearing_it', expect: true,
        expected: `The person wearing the garment: ${what}`,
        observe: (a) => (a === false ? 'The model does not see the garment being worn.' : 'The model sees the garment being worn.'),
        severity: 'high', action: 'Look at the picture. If the garment is not what was designed, make the fit again.',
      })
    }
  }
  return out
}

export interface ProbeResult { probe: Probe; answers: Array<string | boolean | undefined>; verdict: 'match' | 'differs' | 'unsure' }

export async function runProbes(provider: VisionProvider, job: ImageJob, probes: Probe[], asks = 2): Promise<{ findings: Finding[]; checked: Category[]; unable: boolean; results: ProbeResult[]; /** The first thing the model reported going wrong, if anything did. */ error?: string }> {
  const results: ProbeResult[] = []
  let error: string | undefined
  for (const probe of probes) {
    const answers: Array<string | boolean | undefined> = []
    for (let i = 0; i < asks; i++) {
      try {
        const text = await provider.assess(probe.question, probe.images)
        const json = /\{[\s\S]*\}/.exec(text)?.[0]
        const value = json ? (JSON.parse(json) as Record<string, unknown>)[probe.answerKey] : undefined
        answers.push(typeof value === 'string' || typeof value === 'boolean' ? value : undefined)
      } catch (e) { error ??= String(e); answers.push(undefined) }
    }
    const known = answers.filter((a) => a !== undefined)
    const agreed = known.length === asks && known.every((a) => a === known[0])
    results.push({ probe, answers, verdict: !agreed ? 'unsure' : known[0] === probe.expect ? 'match' : 'differs' })
  }
  let n = 0
  const findings: Finding[] = results.filter((r) => r.verdict === 'differs').map((r) => ({
    id: `F-${job.id}-pb-${++n}`, targetId: job.assetId, outputJobId: job.id, outputRevision: job.revision, category: r.probe.category, severity: r.probe.severity,
    // Two matching answers is all the confidence a small model's answer earns; "could not see it" is weaker still.
    confidence: r.answers[0] === 'none' ? 0.5 : 0.8,
    expected: r.probe.expected, observed: `${r.probe.observe(r.answers[0] as string | boolean)} (asked ${r.answers.length} times, same answer)`,
    sourceRule: 'Closed question to the vision model, compared by the app', suggestedAction: r.probe.action, source: 'vision' as const, status: 'open' as const,
  }))
  const decided = results.filter((r) => r.verdict !== 'unsure')
  const checked = [...new Set(decided.map((r) => r.probe.category))]
  return { findings, checked, unable: probes.length > 0 && decided.length === 0, results, ...(error ? { error } : {}) }
}
