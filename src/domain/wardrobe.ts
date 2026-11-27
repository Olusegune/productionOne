import { artifactGuidance } from './cleanGuidance'
import type { JobRequest } from './generationQueue'
import { identityFacts, backdropLine, outputName, type ViewSpec } from './sheetSpecs'
import { styleGuidance, type StyleBible } from './visualDevelopment'
import type { ExtractedAsset } from './productionStudio'
import type { GarmentSpec, Ref } from './variations'

/**
 * Wardrobe: designing a garment, then fitting it to a character.
 *
 * A garment is designed on its own, as clothing only, so it never depends on what a character reference happens to be wearing.
 * A fit puts an approved garment on an approved character. Image models cannot do that deterministically, so a fit is always a candidate
 * a person looks at: the prompt names which reference picture is the person and which is the garment, and what must not change.
 */

export const garmentCategories = ['Coat or jacket', 'Shirt or top', 'Dress or robe', 'Trousers or skirt', 'Uniform', 'Armor or protective gear', 'Footwear', 'Headwear', 'Accessory', 'Full outfit', 'Custom'] as const

/** Fields people can fill in. Every one is optional free text: the presets are starting points, and any field can say something else. */
export const garmentFieldList: ReadonlyArray<{ key: string; label: string; hint: string; advanced?: boolean }> = [
  { key: 'silhouette', label: 'Silhouette and cut', hint: 'for example long, boxy, nipped at the waist' },
  { key: 'fabric', label: 'Fabric and finish', hint: 'for example waxed cotton, matte, heavy' },
  { key: 'colour', label: 'Colour and pattern', hint: 'for example deep green with a faint check' },
  { key: 'closures', label: 'Closures and pockets', hint: 'for example brass buttons, two flap pockets' },
  { key: 'era', label: 'Era and culture', hint: 'for example 1940s coastal Britain', advanced: true },
  { key: 'occupation', label: 'Occupation or occasion', hint: 'for example harbour pilot, formal dinner', advanced: true },
  { key: 'climate', label: 'Climate', hint: 'for example wet and cold', advanced: true },
  { key: 'trim', label: 'Trim and embellishment', hint: 'for example corduroy collar, contrast stitching', advanced: true },
  { key: 'layering', label: 'Layering', hint: 'for example over a knit, under a cloak', advanced: true },
  { key: 'footwear', label: 'Footwear, headwear, protection', hint: 'for example leather boots, flat cap', advanced: true },
  { key: 'practical', label: 'Movement and practical fit', hint: 'for example room to climb, sleeves that push up', advanced: true },
]

/** The garment as one plain paragraph for a prompt, in the person's own words. */
export function garmentText(spec: GarmentSpec): string {
  const parts = [spec.description.trim()]
  if (spec.category && spec.category !== 'Custom') parts.push(`Category: ${spec.category}.`)
  if (spec.pieces?.length) parts.push(`Pieces: ${spec.pieces.join(', ')}.`)
  for (const f of garmentFieldList) { const v = spec.details?.[f.key]?.trim(); if (v) parts.push(`${f.label}: ${v}.`) }
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ')
}

const view = (key: string, label: string, instruction: string, aspect = '3:4'): ViewSpec => ({ key, label, instruction, fullBody: false, aspect })

/** Clothing-only views. No person, no body. */
export const garmentViews: ViewSpec[] = [
  view('garment-front', 'Garment front', 'The complete garment shown from the front, laid out flat or held on an invisible form, every piece visible.'),
  view('garment-back', 'Garment back', 'The same garment from the back, showing the back construction, seams and any back closure or vent.'),
  view('garment-detail', 'Fabric and construction', 'A close-up of the same garment: fabric weave and finish, stitching, seams, closures, trim and pockets.', '1:1'),
]

export interface GarmentPromptInput { style: StyleBible; name: string; spec: GarmentSpec; view: ViewSpec; model?: string; notes?: string; /** An earlier approved picture of this garment is attached, for a new version of it. */ hasSourcePicture?: boolean }

export function garmentPrompt({ style, name, spec, view: v, model, notes, hasSourcePicture }: GarmentPromptInput): string {
  return [
    `Production reference image: ${v.label} of the garment "${name}" (clothing design sheet).`,
    v.instruction,
    `Garment design: ${garmentText(spec)}`,
    'Show the garment only: no person, no mannequin head, no hands, no feet and no body parts. It is a clothing design reference, not a portrait.',
    hasSourcePicture ? 'The attached picture is the approved design of this garment. Keep its cut, colours, pattern, closures and trim exactly; change only what the garment design above says is different.' : '',
    notes ? `Production notes: ${notes}` : '',
    `Visual style bible: ${styleGuidance(style, 'technical')}.`,
    backdropLine('gray', false, ''),
    'Neutral, even reference lighting with no dramatic shadows.',
    'Exactly ONE single image of ONE garment in ONE view. Do not make a grid, contact sheet, collage or several views side by side.',
    artifactGuidance(style, model ?? '', notes ?? ''),
  ].filter(Boolean).join('\n')
}

export const keepChoices: ReadonlyArray<{ key: string; label: string; line: string }> = [
  { key: 'face', label: 'Face and hairstyle', line: 'the face, skin tone and hairstyle' },
  { key: 'body', label: 'Body proportions', line: 'the body build and proportions' },
  { key: 'pose', label: 'Pose', line: 'the standing pose' },
  { key: 'accessories', label: 'Accessories', line: 'the accessories the character wears (jewellery, glasses, bag)' },
]

export const defaultKeep = ['face', 'body', 'pose']

export interface FitPromptInput {
  style: StyleBible
  character: Pick<ExtractedAsset, 'id' | 'name' | 'age' | 'gender' | 'race' | 'ethnicity' | 'role' | 'never'>
  garmentName: string
  garment: GarmentSpec
  keep: string[]
  view: ViewSpec
  model?: string
  notes?: string
  /** Words for the body when the person set target proportions. */
  proportions?: string
  /** What the garment's condition requires, in words, when it is not pristine. */
  conditionText?: string
  /** When the body is not the base one (an age variant): the garment is fitted to that body, not to the base. */
  bodyText?: string
}

/**
 * Puts a garment on a character. The reference pictures are named by role, in order: first the character, then the garment.
 * The character's own description is left out on purpose: it may describe the clothing being replaced.
 */
export function fitPrompt({ style, character, garmentName, garment, keep, view: v, model, notes, proportions, conditionText, bodyText }: FitPromptInput): string {
  const kept = keepChoices.filter((k) => keep.includes(k.key)).map((k) => k.line)
  return [
    `Production reference image: ${v.label} of the character ${character.name} wearing the garment "${garmentName}" (outfit fitting).`,
    v.instruction,
    identityFacts(character),
    proportions ?? '',
    bodyText ? `Reference image 1 is the approved character ${bodyText}. It fixes who this is and the body the garment must be fitted to: cut, drape and size the garment for this body, not for a younger or older version of it. Reference image 2` : 'Reference image 1 is the approved character. It fixes who this is. Reference image 2 is the approved garment design. It fixes the cut, colours, pattern, closures and trim.',
    `Dress the character from reference image 1 in the garment from reference image 2. Do not copy the clothing the character wears in reference image 1: it is being replaced by this garment.`,
    `Garment design: ${garmentText(garment)}`,
    conditionText ? `The garment is worn, damaged or dirty. Show it exactly as it appears in reference image 2, with these requirements kept in place: ${conditionText} Do not repair, clean or add to them. Left and right mean the wearer’s left and right, not the picture’s.` : '',
    kept.length ? `Keep exactly the same: ${kept.join('; ')}. Change only the clothing.` : 'Change only the clothing.',
    notes ? `Production notes: ${notes}` : '',
    `Visual style bible: ${styleGuidance(style, 'technical')}.`,
    backdropLine('gray', true, ''),
    'Keep the same face, hairstyle and body in every view of this character.',
    'Exactly ONE single image of ONE subject in ONE view. Do not make a grid, contact sheet, collage, split-screen or several views side by side.',
    v.fullBody ? 'The entire figure from the top of the head to the soles of the feet must be fully visible with clear margin; nothing cropped.' : '',
    artifactGuidance(style, model ?? '', notes ?? ''),
  ].filter(Boolean).join('\n')
}

export const fitFrontView: ViewSpec = { key: 'costume-front', label: 'Costume front', instruction: 'Full body standing FRONT view, dead-on to the camera, relaxed arms slightly away from the body, the complete outfit clearly visible, whole figure from head to feet inside the frame.', fullBody: true, aspect: '3:4' }

export type FitCapability = { ok: true } | { ok: false; message: string }

/** Whether a model can fit a garment to a character at all. A model that cannot see pictures cannot keep a face, so it is refused with the reason rather than guessed at. */
export function fitCapability(takesReferences: boolean): FitCapability {
  return takesReferences
    ? { ok: true }
    : { ok: false, message: 'This model cannot receive reference pictures, so it cannot keep the character’s face while it changes the clothes. Choose a model that takes reference images (such as Nano Banana), or make new candidates of the character wearing the garment from text alone and check each one carefully.' }
}

interface Common { style: StyleBible; provider: string; model: string; notes?: string; styleFp?: string }

export interface GarmentRequestInput extends Common {
  /** The costume asset that holds this garment's pictures. */
  assetId: string
  assetName: string
  garment: Ref
  garmentName: string
  spec: GarmentSpec
  views?: ViewSpec[]
  /** An approved picture of the earlier revision, when this one continues from it and the model takes references. */
  source?: string
}

export function garmentRequests(input: GarmentRequestInput): JobRequest[] {
  const variant = `${input.garment.id} r${input.garment.revision}`
  return (input.views ?? garmentViews).map((v) => ({
    assetId: input.assetId, variant, sheetType: 'Wardrobe', viewKey: v.key, label: v.label,
    prompt: garmentPrompt({ style: input.style, name: input.garmentName, spec: input.spec, view: v, model: input.model, notes: input.notes, hasSourcePicture: !!input.source }),
    aspect: v.aspect, fullBody: false, provider: input.provider, model: input.model,
    references: input.source ? [input.source] : [], useAnchor: false, styleName: input.style.name, ...(input.styleFp ? { styleFp: input.styleFp } : {}),
    variation: { id: input.garment.id, revision: input.garment.revision, role: 'garment-preview', ...(input.source ? { uses: [{ id: input.garment.id, revision: input.garment.revision - 1, role: 'source-picture', path: input.source }] } : {}) },
    outputName: (revision: number) => outputName({ id: input.assetId, name: input.assetName }, variant, 'Wardrobe', v, revision),
  }))
}

export interface FitRequestInput extends Common {
  character: ExtractedAsset
  /** The queue variant name for this outfit (the look's name), so the outfit's pictures stay apart from the base character's. */
  lookName: string
  fit: Ref
  garment: Ref
  garmentName: string
  garmentSpec: GarmentSpec
  keep: string[]
  /** Approved picture of the character, then of the garment, in that order. */
  characterPicture: string
  garmentPicture: string
  proportions?: string
  /** The condition the garment is in, and what it requires in words. `garmentPicture` is then the picture of that condition. */
  condition?: Ref
  conditionText?: string
  /** The age variant the fit is for, when the body is not the base one. `characterPicture` is then that variant's approved picture. */
  body?: Ref
  bodyText?: string
}

export function fitRequests(input: FitRequestInput): JobRequest[] {
  const v = fitFrontView
  return [{
    assetId: input.character.id, variant: input.lookName, sheetType: 'Wardrobe', viewKey: v.key, label: v.label,
    prompt: fitPrompt({ style: input.style, character: input.character, garmentName: input.garmentName, garment: input.garmentSpec, keep: input.keep, view: v, model: input.model, notes: input.notes, proportions: input.proportions, conditionText: input.conditionText, bodyText: input.bodyText }),
    aspect: v.aspect, fullBody: true, provider: input.provider, model: input.model,
    references: [input.characterPicture, input.garmentPicture], useAnchor: false, styleName: input.style.name, ...(input.styleFp ? { styleFp: input.styleFp } : {}),
    variation: { id: input.fit.id, revision: input.fit.revision, role: 'fit-candidate', uses: [
      { id: input.character.id, revision: 0, role: 'reference-1-character', path: input.characterPicture },
      { id: (input.condition ?? input.garment).id, revision: (input.condition ?? input.garment).revision, role: input.condition ? 'reference-2-garment-in-condition' : 'reference-2-garment', path: input.garmentPicture },
      ...(input.condition ? [{ id: input.garment.id, revision: input.garment.revision, role: 'garment' }] : []),
      ...(input.body ? [{ id: input.body.id, revision: input.body.revision, role: 'body-variant' }] : []),
    ] },
    outputName: (revision: number) => outputName(input.character, input.lookName, 'Wardrobe', v, revision),
  }]
}
