import { artifactGuidance } from './cleanGuidance'
import type { JobRequest } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import { backdropLine, closeUpReframeLine, identityFacts, outputName, viewsFor, type ViewSpec } from './sheetSpecs'
import { sideLineFor } from './sides'
import { styleGuidance, type StyleBible } from './visualDevelopment'
import type { AgeSpec, Ref } from './variations'

/**
 * Age Studio: the same character at another age.
 *
 * Three different things, kept apart:
 *   - the same person at another age (a variant of the character: recognisably them),
 *   - a younger- or older-looking redesign (a variant, with more freedom in the face),
 *   - a relative (a new, separate character linked to this one; see ageFlow.ts). It is never an age variant.
 * Image models do not predict how a particular person ages. A candidate is a plausible picture for a person to judge, and the prompt asks for the
 * recognisable anchors the person named to be kept, not for a guarantee.
 */

export const ageModes: ReadonlyArray<{ key: AgeSpec['mode'] | 'relative'; label: string; help: string }> = [
  { key: 'same-person', label: 'The same person at another age', help: 'Recognisably them, a different age. A variant of this character.' },
  { key: 'redesign', label: 'A younger- or older-looking redesign', help: 'The same role and costume language with more freedom in the face. A variant of this character.' },
  { key: 'relative', label: 'A relative (a new character)', help: 'A parent, child or sibling. This makes a separate, linked character, not a variant.' },
]

/** Advanced controls. Every one is optional free text, so a simple target age is enough on its own. */
export const ageAdjustmentList: ReadonlyArray<{ key: string; label: string; hint: string }> = [
  { key: 'face', label: 'Facial maturity', hint: 'for example softer jaw, deeper smile lines' },
  { key: 'skin', label: 'Skin detail', hint: 'for example light crow’s feet, no blemishes' },
  { key: 'hair', label: 'Hair colour, density and hairline', hint: 'for example silver at the temples, receding hairline' },
  { key: 'body', label: 'Age-appropriate body proportions', hint: 'for example a little softer through the middle' },
  { key: 'posture', label: 'Posture', hint: 'for example a slight stoop, shoulders rounded' },
  { key: 'hands', label: 'Hands and other visible age cues', hint: 'for example knuckles prominent, veins visible' },
  { key: 'clothing', label: 'Clothing fit', hint: 'for example the coat hangs looser on the shoulders' },
]

export const ageKeepChoices: ReadonlyArray<{ key: string; label: string; line: string }> = [
  { key: 'costume', label: 'Costume', line: 'the costume: its cut, colours and details' },
  { key: 'pose', label: 'Pose', line: 'the standing pose' },
  { key: 'accessories', label: 'Accessories', line: 'the accessories (jewellery, glasses, bag)' },
  { key: 'marks', label: 'Scars and marks', line: 'any scars, birthmarks or tattoos' },
]
export const defaultAgeKeep = ['costume', 'pose', 'marks']

/** The first number in a piece of text ("40s", "about 65", "Age 12"), or null. */
export function ageNumber(text: string | undefined): number | null {
  const m = /(\d{1,3})/.exec(text ?? '')
  return m ? Number(m[1]) : null
}

/** Whether the target is older, younger, or the same as where the character is now. Null when either age cannot be read as a number. */
export function ageDirection(source: string | undefined, target: string): 'older' | 'younger' | 'same' | null {
  const a = ageNumber(source)
  const b = ageNumber(target)
  if (a === null || b === null) return null
  return b > a ? 'older' : b < a ? 'younger' : 'same'
}

export interface AgePromptInput {
  style: StyleBible
  character: Pick<ExtractedAsset, 'id' | 'name' | 'age' | 'gender' | 'race' | 'ethnicity' | 'role' | 'never'>
  spec: AgeSpec
  view: ViewSpec
  model?: string
  notes?: string
  /** Overrides the anchors saved in the settings (a person's own words). */
  anchors?: string[]
}

/**
 * The character's current age is left out of their identity facts on purpose (it would contradict the target), and so is their description
 * (it may state an age or describe the clothes). Reference image 1 is the approved character at their current age.
 */
export function agePrompt({ style, character, spec, view, model, notes, anchors }: AgePromptInput): string {
  const named = anchors ?? spec.anchors ?? []
  const direction = ageDirection(character.age, spec.targetAge)
  const toward = direction === 'older' ? 'older' : direction === 'younger' ? 'younger' : 'a different age'
  const kept = ageKeepChoices.filter((k) => (spec.keep ?? []).includes(k.key)).map((k) => k.line)
  const adjustments = ageAdjustmentList.filter((a) => spec.adjustments?.[a.key]?.trim()).map((a) => `- ${a.label}: ${spec.adjustments![a.key].trim()}`)
  const same = spec.mode === 'same-person'
  return [
    `Production reference image: ${view.label} of the character ${character.name} at age ${spec.targetAge} (age variant).`,
    view.instruction,
    identityFacts({ ...character, age: undefined }),
    `Reference image 1 is the approved character${character.age ? ` at age ${character.age}` : ''}. It fixes who this is.`,
    same
      ? `Show the SAME person at age ${spec.targetAge}, ${toward === 'a different age' ? '' : `${toward} than in the reference, `}so that anyone who knows reference image 1 would recognise them: the same bone structure, eye shape and colour, nose, mouth and ear shape, with only the changes that time makes.`
      : `Show a ${toward === 'a different age' ? '' : `${toward}-looking `}redesign of this character at age ${spec.targetAge}. Keep their role, costume language and overall character, and take more freedom with the face than a same-person aged picture would.`,
    named.length ? `What must stay recognisable: ${named.join('; ')}.` : '',
    adjustments.length ? `Age cues to show:\n${adjustments.join('\n')}` : '',
    sideLineFor(view.key, ...named, ...adjustments),
    kept.length ? `Keep exactly the same: ${kept.join('; ')}. Change only what age changes.` : 'Change only what age changes.',
    style.spec2d
      ? 'This is a flat 2D drawing. Show age through drawn line, shape and colour. Do not introduce photographic or 3D rendering, skin pores, realistic wrinkle texture or lens effects.'
      : 'Show age through the same rendering as the reference picture: do not switch to photographic skin or a different level of realism.',
    notes ? `Production notes: ${notes}` : '',
    `Visual style bible: ${styleGuidance(style, 'technical')}.`,
    backdropLine('gray', true, ''),
    'Exactly ONE single image of ONE subject in ONE view. Do not make a grid, contact sheet, collage, split-screen or several views side by side.',
    view.fullBody ? 'The entire figure from the top of the head to the soles of the feet must be fully visible with clear margin; nothing cropped.' : closeUpReframeLine,
    artifactGuidance(style, model ?? '', notes ?? ''),
  ].filter(Boolean).join('\n')
}

export type AgeCapability = { ok: true } | { ok: false; message: string }

/** An aged picture of a particular person needs the reference picture; a model that cannot see one would invent a stranger. */
export function ageCapability(takesReferences: boolean): AgeCapability {
  return takesReferences
    ? { ok: true }
    : { ok: false, message: 'This model cannot receive reference pictures, so it cannot keep this person recognisable at another age. Choose a model that takes reference images (such as Nano Banana). Without one, each picture would show a different person.' }
}

/** The two candidate views for an age variant: the full-body front (which later sheets are made from) and a head-and-shoulders portrait. */
export const ageViews: ViewSpec[] = (() => {
  const all = viewsFor('character', 'Identity')
  return [all.find((v) => v.key === 'full-front'), all.find((v) => v.key === 'portrait')].filter((v): v is ViewSpec => !!v)
})()

export interface AgeRequestInput {
  style: StyleBible; provider: string; model: string; styleFp?: string; notes?: string
  character: ExtractedAsset
  /** The queue variant name for this age (the look's name). */
  lookName: string
  age: Ref
  spec: AgeSpec
  /** Approved picture of the character at their current age: reference image 1. */
  characterPicture: string
}

export function ageRequests(input: AgeRequestInput): JobRequest[] {
  return ageViews.map((v) => ({
    assetId: input.character.id, variant: input.lookName, sheetType: 'Identity', viewKey: v.key, label: v.label,
    prompt: agePrompt({ style: input.style, character: input.character, spec: input.spec, view: v, model: input.model, notes: input.notes }),
    aspect: v.aspect, fullBody: v.fullBody, provider: input.provider, model: input.model,
    references: [input.characterPicture], useAnchor: false, styleName: input.style.name, ...(input.styleFp ? { styleFp: input.styleFp } : {}),
    variation: { id: input.age.id, revision: input.age.revision, role: 'age-candidate', uses: [{ id: input.character.id, revision: 0, role: 'reference-1-character', path: input.characterPicture }] },
    outputName: (revision: number) => outputName(input.character, input.lookName, 'Identity', v, revision),
  }))
}

// ---------- checks on the record ----------

export interface AgeCheck { id: string; label: string; result: 'pass' | 'fail' | 'not-checked'; detail: string }
export interface AgeReport { state: 'passed-for-checks-performed' | 'needs-review'; checks: AgeCheck[]; summary: string }

/**
 * Checks that can be run on the settings, without looking at a picture. Whether the aged face is still recognisable is a person's call and is
 * left "not checked": there is no number for it.
 */
export function checkAgeSpec(character: Pick<ExtractedAsset, 'age'>, spec: AgeSpec): AgeReport {
  const anchors = spec.anchors ?? []
  const checks: AgeCheck[] = []
  const target = ageNumber(spec.targetAge)
  checks.push({ id: 'target-age', label: 'The target age is a number', result: target === null ? 'fail' : target < 0 || target > 120 ? 'fail' : 'pass', detail: target === null ? 'Enter an age such as 65.' : target > 120 ? 'That is outside a believable age.' : `Age ${target}.` })
  const dir = ageDirection(character.age, spec.targetAge)
  checks.push({ id: 'changes-age', label: 'It is a different age from now', result: dir === 'same' ? 'fail' : dir === null ? 'not-checked' : 'pass', detail: dir === 'same' ? 'The target is the same as the character’s age now.' : dir === null ? 'The character’s current age is not a number, so this was not compared.' : `${dir === 'older' ? 'Older' : 'Younger'} than now.` })
  checks.push({ id: 'anchors', label: 'You named what must stay recognisable', result: spec.mode === 'same-person' ? (anchors.length ? 'pass' : 'fail') : 'not-checked', detail: spec.mode === 'same-person' ? (anchors.length ? `${anchors.length} named.` : 'Name at least one feature that must stay (for example “the scar through the left eyebrow”).') : 'Not needed for a redesign.' })
  checks.push({ id: 'costume-kept', label: 'The costume is kept', result: (spec.keep ?? []).includes('costume') ? 'pass' : 'not-checked', detail: (spec.keep ?? []).includes('costume') ? 'The prompt keeps the costume the same.' : 'Costume is not marked to keep: the model may change the clothing.' })
  checks.push({ id: 'recognisable', label: 'The aged picture is recognisably the same person', result: 'not-checked', detail: 'This is a human judgement. Compare the candidate with the source in the studio.' })
  const failed = checks.filter((c) => c.result === 'fail')
  return { state: failed.length ? 'needs-review' : 'passed-for-checks-performed', checks, summary: failed.length ? `${failed.length} check${failed.length === 1 ? '' : 's'} need a look: ${failed.map((c) => c.label.toLowerCase()).join('; ')}.` : 'Passed for the setting checks performed. Recognisability was not checked.' }
}
