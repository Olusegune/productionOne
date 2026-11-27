import { artifactGuidance } from './cleanGuidance'
import type { ImageJob, JobRequest } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import { backdropLine, identityFacts, outputName, viewsFor, type ViewSpec } from './sheetSpecs'
import { styleGuidance, type StyleBible } from './visualDevelopment'
import { findEntity, latestApproved, type LookSpec, type Ref, type TransformationSpec, type VariationState } from './variations'

/**
 * Transformation Studio: intentional changes to a character's body and surface, in stages.
 *
 * A transformation is a line of stages (normal, subtle symptoms, partial transformation, full form). Each stage continues from the one before it
 * and records what changes, so the stages are one character changing, not unrelated characters. The art style is not part of a transformation and
 * is never reset by one. What must stay recognisable is named by the person; how recognisable it ends up is a creative target a person reviews, not a score.
 */

export interface Preset { key: string; label: string; help: string; anatomy: string; surface: string; features: string; symmetry: NonNullable<TransformationSpec['symmetry']> }

/** Starting points. Every field they fill can be changed, and Custom starts empty. */
export const transformationPresets: ReadonlyArray<Preset> = [
  { key: 'infected', label: 'Zombie or infected', help: 'A sickness that takes the body over.', anatomy: 'slightly hunched, joints stiff, limbs a little too long', surface: 'grey, waxy skin with dark veining', features: 'clouded eyes, thinning hair, cracked nails', symmetry: 'mixed' },
  { key: 'monster', label: 'Monster', help: 'A larger, heavier, frightening body.', anatomy: 'broader and taller, heavy shoulders, long arms', surface: 'thick, rough hide', features: 'small deep-set eyes, heavy brow, large teeth', symmetry: 'symmetric' },
  { key: 'supernatural', label: 'Supernatural form', help: 'Something not of this world shows through.', anatomy: 'slender and a little taller, movement too smooth', surface: 'pale, faintly luminous skin', features: 'eyes with an unnatural glow, hair that moves on its own', symmetry: 'symmetric' },
  { key: 'robotic', label: 'Robotic or cybernetic', help: 'Machine parts replace or join the body.', anatomy: 'human proportions with mechanical joints and plating', surface: 'brushed metal and ceramic panels over skin', features: 'one lens-like eye, exposed cabling at the neck', symmetry: 'asymmetric' },
  { key: 'hybrid', label: 'Animal or creature hybrid', help: 'Features of an animal join the person.', anatomy: 'changed posture and leg shape to match the animal', surface: 'fur or feathers growing over parts of the skin', features: 'animal eyes, ears and teeth', symmetry: 'symmetric' },
  { key: 'elemental', label: 'Elemental form', help: 'The body becomes fire, water, stone, ice or wind.', anatomy: 'the same outline, built from the element', surface: 'the element itself, with the skin showing through at the edges', features: 'eyes and mouth as light or shadow', symmetry: 'mixed' },
  { key: 'custom', label: 'Custom', help: 'Describe it yourself.', anatomy: '', surface: '', features: '', symmetry: 'mixed' },
]

export const stageNames = ['Subtle symptoms', 'Partial transformation', 'Full form'] as const
/** A starting intensity per stage, on the same 1 to 5 scale as the control. */
export const stageIntensity: Record<string, number> = { 'Subtle symptoms': 1, 'Partial transformation': 3, 'Full form': 5 }

export const intensityWords = ['barely there', 'slight', 'clear', 'strong', 'complete'] as const
export const recognisabilityWords = ['barely recognisable', 'faintly recognisable', 'clearly recognisable', 'strongly recognisable', 'unmistakably themselves'] as const
const word = (list: readonly string[], n: number | undefined, fallback: number) => list[Math.min(list.length, Math.max(1, Math.round(n ?? fallback))) - 1]

export const symmetryChoices: ReadonlyArray<{ value: NonNullable<TransformationSpec['symmetry']>; label: string; line: string }> = [
  { value: 'symmetric', label: 'Symmetric', line: 'The change is symmetric: both sides of the body change the same way.' },
  { value: 'asymmetric', label: 'Asymmetric', line: 'The change is asymmetric: one side of the body is changed more than the other.' },
  { value: 'mixed', label: 'No rule', line: '' },
]
export const costumeChoices: ReadonlyArray<{ value: NonNullable<TransformationSpec['costume']>; label: string; line: string }> = [
  { value: 'keep', label: 'Keep the costume as it is', line: 'Keep the costume exactly as it is in the reference picture: its cut, colours and details. Do not change or damage it.' },
  { value: 'adapt', label: 'Adapt it to the new body', line: 'Keep the same costume but adapt it to the changed body: stretched, split or re-fitted where the new shape needs it, with the same design, colours and details.' },
  { value: 'damage', label: 'Let the change damage it', line: 'The change damages the costume: torn, strained or burst where the body has changed, still recognisably the same costume.' },
]
export const audienceChoices: ReadonlyArray<{ value: NonNullable<TransformationSpec['audience']>; label: string; line: string }> = [
  { value: 'family', label: 'All ages', line: 'Keep it suitable for a family audience: no gore and no graphic injury. Unsettling only through shape, colour and mood.' },
  { value: 'teen', label: 'Teen and up', line: 'Keep it suitable for a teen audience: creepy or intense is fine, but no gore and no graphic injury.' },
  { value: 'mature', label: 'Mature', line: 'It may be dark and intense for a mature audience, but without gratuitous gore.' },
]

export const detailFields: ReadonlyArray<{ key: string; label: string; hint: string }> = [
  { key: 'anatomy', label: 'Anatomy and silhouette', hint: 'for example broader shoulders, long arms, hunched' },
  { key: 'surface', label: 'Skin and surface', hint: 'for example grey waxy skin with dark veins' },
  { key: 'features', label: 'Eyes, hair, teeth, horns, claws and other features', hint: 'for example clouded eyes, cracked nails' },
  { key: 'differences', label: 'What changes from the previous stage', hint: 'for example the veins spread to the neck and the left hand' },
]

// ---------- anatomy the body is meant to have ----------

export interface AnatomyRule { part: string; rule: string; source: 'human-default' | 'declared' }

/** What a plain human body is expected to have. A declared line for the same part replaces it. */
export const humanAnatomyDefaults: ReadonlyArray<{ part: string; rule: string }> = [
  { part: 'fingers', rule: 'five fingers on each hand' },
  { part: 'arms', rule: 'two arms' },
  { part: 'legs', rule: 'two legs' },
  { part: 'eyes', rule: 'two eyes' },
  { part: 'head', rule: 'one head' },
]

const PART_ALIASES: Record<string, string> = { finger: 'fingers', hand: 'fingers', hands: 'fingers', arm: 'arms', leg: 'legs', eye: 'eyes', heads: 'head' }
const partKey = (text: string) => { const k = text.trim().toLowerCase(); return PART_ALIASES[k] ?? k }

/** "fingers: six on each hand" is a rule about the fingers. A line with no colon is a free statement about what the body has. */
export function parseExpectedAnatomy(lines: string[] | undefined): Array<{ part: string; statement: string }> {
  return (lines ?? []).map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(':')
    return i > 0 && i < 28 ? { part: partKey(l.slice(0, i)), statement: l.slice(i + 1).trim() } : { part: '', statement: l }
  })
}

/**
 * The anatomy a picture of this character is judged against. With no transformation it is the plain human defaults. With one, anything the person
 * declared replaces the default for that part, so a creature designed with six fingers is judged as six, not five. Declared statements about other parts are added.
 */
export function anatomyRules(spec?: TransformationSpec): AnatomyRule[] {
  const declared = parseExpectedAnatomy(spec?.expectedAnatomy)
  const overridden = new Set(declared.map((d) => d.part).filter(Boolean))
  const defaults = humanAnatomyDefaults.filter((d) => !overridden.has(d.part)).map((d) => ({ part: d.part, rule: d.rule, source: 'human-default' as const }))
  return [...defaults, ...declared.map((d) => ({ part: d.part, rule: d.part ? `${d.part}: ${d.statement}` : d.statement, source: 'declared' as const }))]
}

/** The transformation a picture was made for: by the revision it is linked to, else by the look its variant name belongs to. */
export function transformationForJob(state: VariationState, job: Pick<ImageJob, 'assetId' | 'variant' | 'variation'>): { ref: Ref; spec: TransformationSpec } | undefined {
  const linked = job.variation ? findEntity(state, job.variation.id) : undefined
  if (linked?.kind === 'transformation') {
    const rev = linked.revisions.find((r) => r.n === job.variation!.revision) ?? latestApproved(linked)
    if (rev) return { ref: { id: linked.id, revision: rev.n }, spec: rev.spec as TransformationSpec }
  }
  for (const e of state.entities) {
    if (e.kind !== 'look' || e.characterId !== job.assetId) continue
    const rev = latestApproved(e)
    const spec = rev?.spec as LookSpec | undefined
    if (!spec?.transformation || spec.queueVariant !== job.variant) continue
    const t = findEntity(state, spec.transformation.id)
    const tr = t?.revisions.find((r) => r.n === spec.transformation!.revision)
    if (t && tr) return { ref: spec.transformation, spec: tr.spec as TransformationSpec }
  }
  return undefined
}

/** Rules for the anatomy check of a vision review: the body this picture is meant to have, so deliberate features are not reported as mistakes. Empty when no transformation applies. */
export function visionAnatomyRules(state: VariationState, job: Pick<ImageJob, 'assetId' | 'variant' | 'variation'>): string[] {
  const found = transformationForJob(state, job)
  if (!found) return []
  const rules = anatomyRules(found.spec)
  const declared = rules.filter((r) => r.source === 'declared').map((r) => r.rule)
  const defaults = rules.filter((r) => r.source === 'human-default').map((r) => r.rule)
  return [
    `This character is intentionally transformed (${found.spec.stage}). The body is meant to have: ${declared.length ? declared.join('; ') : 'nothing beyond a normal body'}. Do not report these as mistakes.`,
    defaults.length ? `For everything not listed, a normal body applies: ${defaults.join('; ')}.` : '',
    'Do report anything else that looks wrong: parts that are merged, melted, missing or repeated beyond what is listed.',
  ].filter(Boolean)
}

// ---------- prompts ----------

export const transformationViews: ViewSpec[] = (() => {
  const all = viewsFor('character', 'Identity')
  return [all.find((v) => v.key === 'full-front'), all.find((v) => v.key === 'portrait')].filter((v): v is ViewSpec => !!v)
})()

export interface TransformationPromptInput {
  style: StyleBible
  character: Pick<ExtractedAsset, 'id' | 'name' | 'age' | 'gender' | 'race' | 'ethnicity' | 'role' | 'never'>
  spec: TransformationSpec
  view: ViewSpec
  /** What reference image 1 shows: the character as they are (no earlier stage) or the approved earlier stage. */
  source: 'base' | { stage: string }
  model?: string
  notes?: string
}

export function transformationPrompt({ style, character, spec, view, source, model, notes }: TransformationPromptInput): string {
  const d = spec.details ?? {}
  const sourceText = source === 'base' ? 'the approved character, before any change' : `the approved earlier stage (${source.stage})`
  const symmetry = symmetryChoices.find((x) => x.value === spec.symmetry)?.line
  const costume = costumeChoices.find((x) => x.value === (spec.costume ?? 'keep'))?.line
  const audience = audienceChoices.find((x) => x.value === spec.audience)?.line
  const anatomy = parseExpectedAnatomy(spec.expectedAnatomy)
  return [
    `Production reference image: ${view.label} of the character ${character.name}, stage "${spec.stage}" of a ${spec.kind} transformation (transformation sheet).`,
    view.instruction,
    identityFacts(character),
    `Reference image 1 is ${sourceText}. It fixes who this is.`,
    `This is the SAME character part-way through a change, not a new character. Change the body and surface as described below, to a ${word(intensityWords, spec.intensity, 3)} degree.`,
    spec.anchors?.length ? `What must stay recognisable: ${spec.anchors.join('; ')}. The character should remain ${word(recognisabilityWords, spec.recognisability, 3)}.` : `The character should remain ${word(recognisabilityWords, spec.recognisability, 3)}.`,
    d.differences?.trim() ? `What changes from ${source === 'base' ? 'the character as they are' : 'the earlier stage'}: ${d.differences.trim()}` : '',
    d.anatomy?.trim() ? `Anatomy and silhouette: ${d.anatomy.trim()}.` : '',
    d.surface?.trim() ? `Skin and surface: ${d.surface.trim()}.` : '',
    d.features?.trim() ? `Features: ${d.features.trim()}.` : '',
    anatomy.length ? `The body is intentionally designed to have: ${anatomy.map((a) => (a.part ? `${a.part}: ${a.statement}` : a.statement)).join('; ')}. These are deliberate: draw them exactly, and do not correct them to a normal human body.` : '',
    symmetry ?? '',
    costume ?? '',
    audience ?? '',
    style.spec2d
      ? 'This is a flat 2D drawing. Show the change through drawn line, shape and colour. Do not introduce photographic or 3D rendering, realistic skin texture or lens effects.'
      : 'Keep the same rendering and level of realism as the reference picture; do not switch to photographic skin or a different style.',
    notes ? `Production notes: ${notes}` : '',
    `Visual style bible: ${styleGuidance(style, 'technical')}.`,
    backdropLine('gray', true, ''),
    'Exactly ONE single image of ONE subject in ONE view. Do not make a grid, contact sheet, collage, split-screen or several views side by side.',
    view.fullBody ? 'The entire figure from the top of the head to the soles of the feet must be fully visible with clear margin; nothing cropped.' : '',
    artifactGuidance(style, model ?? '', notes ?? ''),
  ].filter(Boolean).join('\n')
}

export type TransformCapability = { ok: true } | { ok: false; message: string }

export function transformationCapability(takesReferences: boolean): TransformCapability {
  return takesReferences
    ? { ok: true }
    : { ok: false, message: 'This model cannot receive reference pictures, so each stage would be drawn from the words alone and would not be the same character. Choose a model that takes reference images (such as Nano Banana).' }
}

export interface TransformationRequestInput {
  style: StyleBible; provider: string; model: string; styleFp?: string; notes?: string
  character: ExtractedAsset
  lookName: string
  stage: Ref
  spec: TransformationSpec
  /** The approved picture this stage starts from, and what it is. */
  source: { path: string; of: 'base' | { stage: string }; ref?: Ref }
}

export function transformationRequests(input: TransformationRequestInput): JobRequest[] {
  return transformationViews.map((v) => ({
    assetId: input.character.id, variant: input.lookName, sheetType: 'Identity', viewKey: v.key, label: v.label,
    prompt: transformationPrompt({ style: input.style, character: input.character, spec: input.spec, view: v, source: input.source.of, model: input.model, notes: input.notes }),
    aspect: v.aspect, fullBody: v.fullBody, provider: input.provider, model: input.model,
    references: [input.source.path], useAnchor: false, styleName: input.style.name, ...(input.styleFp ? { styleFp: input.styleFp } : {}),
    variation: { id: input.stage.id, revision: input.stage.revision, role: 'transformation-candidate', uses: [
      input.source.ref ? { id: input.source.ref.id, revision: input.source.ref.revision, role: 'reference-1-earlier-stage', path: input.source.path } : { id: input.character.id, revision: 0, role: 'reference-1-character', path: input.source.path },
    ] },
    outputName: (revision: number) => outputName(input.character, input.lookName, 'Identity', v, revision),
  }))
}

// ---------- checks on the settings ----------

export interface TransformCheck { id: string; label: string; result: 'pass' | 'fail' | 'not-checked'; detail: string }
export interface TransformReport { state: 'passed-for-checks-performed' | 'needs-review'; checks: TransformCheck[]; summary: string }

/**
 * Checks that can be run on the settings. Whether the picture is still recognisably the character, and whether its anatomy matches what was declared,
 * are for a person (or a vision review that is given the declared anatomy) and are reported as not checked here.
 */
export function checkTransformation(spec: TransformationSpec, previous?: TransformationSpec): TransformReport {
  const checks: TransformCheck[] = []
  const anchors = spec.anchors ?? []
  checks.push({ id: 'anchors', label: 'You named what must stay recognisable', result: anchors.length ? 'pass' : 'fail', detail: anchors.length ? `${anchors.length} named.` : 'Name at least one thing that must stay (for example “the scar through the left eyebrow”).' })
  const r = spec.recognisability
  checks.push({ id: 'recognisability', label: 'A recognisability target is set', result: r && r >= 1 && r <= 5 ? 'pass' : 'fail', detail: r && r >= 1 && r <= 5 ? `Aiming for: ${word(recognisabilityWords, r, 3)}. This is a creative target for a person to judge, not a measured score.` : 'Choose how recognisable they should remain.' })
  const d = spec.details ?? {}
  const hasBody = !!(d.anatomy?.trim() || d.surface?.trim() || d.features?.trim())
  checks.push({ id: 'describes-change', label: 'The change is described', result: hasBody ? 'pass' : 'fail', detail: hasBody ? 'Anatomy, surface or features are described.' : 'Describe what changes: anatomy, skin and surface, or features.' })
  const declaresAnatomy = (spec.expectedAnatomy ?? []).some((x) => x.trim())
  checks.push({ id: 'expected-anatomy', label: 'What the body is meant to have is recorded', result: d.anatomy?.trim() && !declaresAnatomy ? 'fail' : declaresAnatomy ? 'pass' : 'not-checked', detail: d.anatomy?.trim() && !declaresAnatomy ? 'The anatomy changes, but what the body is meant to have is not written down, so a deliberate feature could be reported as a mistake. Add lines such as “fingers: six on each hand”.' : declaresAnatomy ? 'Recorded, so these are judged as intended.' : 'No anatomy change described.' })
  if (previous) {
    const a = spec.intensity ?? 0
    const b = previous.intensity ?? 0
    checks.push({ id: 'progression', label: 'It goes further than the stage before', result: a > b ? 'pass' : 'fail', detail: a > b ? `Intensity ${b} to ${a}.` : `Intensity is ${a}, not above the previous stage (${b}). A stage should change more than the one before.` })
    checks.push({ id: 'differences', label: 'What changes from the previous stage is written down', result: d.differences?.trim() ? 'pass' : 'fail', detail: d.differences?.trim() ? 'Recorded.' : 'Say what is different from the previous stage so the stages read as one change.' })
  }
  checks.push({ id: 'costume', label: 'The costume is handled', result: spec.costume ? 'pass' : 'not-checked', detail: spec.costume ? 'Chosen.' : 'Not chosen: the costume is kept as it is.' })
  checks.push({ id: 'identity-in-picture', label: 'The picture is still recognisably the character', result: 'not-checked', detail: 'This is a human judgement. Compare the candidate with the source in the studio.' })
  checks.push({ id: 'anatomy-in-picture', label: 'The picture’s anatomy matches what was declared', result: 'not-checked', detail: 'Look at the hands and body yourself, or run the vision review, which is given the declared anatomy.' })
  const failed = checks.filter((c) => c.result === 'fail')
  return { state: failed.length ? 'needs-review' : 'passed-for-checks-performed', checks, summary: failed.length ? `${failed.length} check${failed.length === 1 ? '' : 's'} need a look: ${failed.map((c) => c.label.toLowerCase()).join('; ')}.` : 'Passed for the setting checks performed. Recognisability and the picture’s anatomy were not checked.' }
}
