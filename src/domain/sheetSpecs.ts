import type { ExtractedAsset } from './productionStudio'
import { artifactGuidance } from './cleanGuidance'
import { styleGuidance, type SheetType, type StyleBible } from './visualDevelopment'
import type { ExpressionNeed } from '../engine/emotion'
import { anchoredPromptLine } from './identityAnchor'
import { guideLine } from './proportionGuide'
import { adaptViewFor2D, twoDAnchoredLine, twoDPhotoLine, twoDReinterpretLine } from './style2d'

/** One separate image inside a reference sheet. Each view is generated and saved as its own original-resolution file. */
export interface ViewSpec {
  key: string
  label: string
  instruction: string
  /** True when the whole figure must be inside the frame, so QA can flag a cropped head or feet. */
  fullBody: boolean
  aspect: string
}

/** Common delivery and reference-sheet canvases, including cinema, broadcast, print and social formats. */
import { describeColour } from './backdropColour'

export type Backdrop = 'gray' | 'white' | 'match' | 'front'
export const backdropChoices: ReadonlyArray<{ value: Backdrop; label: string }> = [
  { value: 'gray', label: 'Flat grey (default)' },
  { value: 'white', label: 'Flat white' },
  { value: 'match', label: 'Match the reference image (flat tone)' },
  { value: 'front', label: 'Same as my front view (colour and lighting)' },
]

/** One backdrop rule for every view of a sheet, so the views agree with each other. A flat field, not a room: nothing to stand on, no cast shadow, nothing spilling onto it. */
export function backdropLine(backdrop: Backdrop = 'gray', anchored = false, backdropHex = ''): string {
  const tail = 'no gradient, no vignette, no floor, no wall, no horizon, and no cast or contact shadow, glow or colour spill anywhere on it. Even, shadowless lighting on the subject, no text, no labels, no borders, no watermark.'
  if (backdrop === 'white') return `The background is one flat, uniform pure-white field from corner to corner: ${tail}`
  if (backdrop === 'front' && anchored) {
    const word = backdropHex ? describeColour(backdropHex) : ''
    const colour = backdropHex ? ` Its colour is ${word ? `${word}, ` : ''}about ${backdropHex}.` : ''
    return `The background is exactly the background of the attached reference image: the same colour, the same soft studio lighting and the same gentle falloff across the frame.${colour} Add nothing to it: no props, no floor line, no horizon, no text, no labels, no borders, no watermark.`
  }
  if (backdrop === 'match' && anchored) return `The background is the same single flat, plain tone as the attached reference image, uniform from corner to corner: ${tail}`
  return `The background is one flat, uniform neutral mid-grey field (about 18% grey) from corner to corner: ${tail}`
}

/** Shapes every image provider here accepts. The per-sheet shape control offers only these. */
export const shapeChoices = [
  { value: '3:4', label: 'Portrait 3:4' },
  { value: '9:16', label: 'Tall 9:16' },
  { value: '1:1', label: 'Square 1:1' },
  { value: '4:3', label: 'Landscape 4:3' },
  { value: '16:9', label: 'Wide 16:9' },
] as const

/** A shape such as "16:9" as a CSS aspect-ratio ("16 / 9"). Anything that is not a plain ratio falls back to portrait, so a bad value can never break a layout. */
export function aspectCss(shape: string): string {
  return /^\d{1,2}:\d{1,2}$/.test(shape) ? shape.replace(':', ' / ') : '3 / 4'
}

/** The shape a view is made in: the person's choice for the sheet when there is one, otherwise the view's own default. */
export function shapeFor(view: { aspect: string }, override?: string): string {
  return override && shapeChoices.some((s) => s.value === override) ? override : view.aspect
}

export const aspectRatios = ['21:9', '2.39:1', '2:1', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'] as const

export type Intensity = 'subtle' | 'moderate' | 'exaggerated'
export const intensities: Intensity[] = ['subtle', 'moderate', 'exaggerated']

const full = (key: string, label: string, instruction: string): ViewSpec => ({ key, label, instruction, fullBody: true, aspect: '3:4' })
const close = (key: string, label: string, instruction: string, aspect: ViewSpec['aspect'] = '1:1'): ViewSpec => ({ key, label, instruction, fullBody: false, aspect })

const emotions = ['neutral', 'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'contempt']
const intensityWords: Record<Intensity, string> = {
  subtle: 'subtle, restrained: the emotion is visible mainly in the eyes and brows',
  moderate: 'clear and natural: the whole face is engaged',
  exaggerated: 'strongly exaggerated, theatrical acting: every feature pushed, still the same person',
}

const characterViews: Partial<Record<SheetType, ViewSpec[]>> = {
  Identity: [
    close('portrait', 'Head and shoulders', 'Head-and-shoulders portrait facing the camera, neutral expression, eyes to lens, ears and hairline fully visible.', '3:4'),
    full('full-front', 'Full body front', 'Full body standing front view, relaxed arms slightly away from the body, whole figure from head to feet inside the frame.'),
  ],
  Turnaround: [
    full('front', 'Front', 'Full body standing FRONT view, dead-on to the camera: shoulders and hips square and level, weight even on both feet, no twist and no hip tilt, arms slightly away from the body, feet apart, head to feet fully inside the frame.'),
    full('three-quarter-front', 'Three-quarter front', 'Full body standing THREE-QUARTER FRONT view (about 45 degrees), same pose and scale as the front view.'),
    full('side', 'Side', 'Full body standing SIDE profile view, a true 90 degrees, the whole body in clean profile with no turn of the shoulders toward the camera, same pose and scale as the front view.'),
    full('three-quarter-rear', 'Three-quarter rear', 'Full body standing THREE-QUARTER REAR view (about 135 degrees), same pose and scale as the front view.'),
    full('rear', 'Rear', 'Full body standing REAR view, dead-on from directly behind: shoulders and hips square and level, spine centred, no glance back over the shoulder, same pose and scale as the front view.'),
  ],
  Poses: [
    full('a-pose', 'Neutral A-pose', 'Full body neutral A-pose for rigging and proportion review, fingers separated, feet visible.'),
    full('standing', 'Standing', 'Full body natural standing pose, weight on one leg.'),
    full('profile', 'Profile stance', 'Full body side-profile stance with clear silhouette and readable posture.'),
    full('walking', 'Walking', 'Full body mid-stride walking pose, readable leg and arm swing.'),
    full('running', 'Running', 'Full body running pose with believable anatomy and balance.'),
    full('sitting', 'Sitting', 'Full body seated pose on a plain stool, feet visible.'),
    full('crouching', 'Crouching', 'Full body crouching pose with believable joint compression and grounded feet.'),
    full('gesture', 'Gesture', 'Full body pose making a clear communicative hand gesture, both hands visible.'),
  ],
  Wardrobe: [
    full('costume-front', 'Costume front', 'Full body front view that shows the complete costume clearly.'),
    full('costume-side', 'Costume side', 'Full body side view of the same costume.'),
    full('costume-rear', 'Costume rear', 'Full body rear view of the same costume, showing back construction.'),
    close('fabric', 'Fabric and construction', 'Close-up of the costume fabric, stitching, closures and trim.'),
  ],
  Detail: [
    close('face', 'Face', 'Large face close-up, neutral expression, even lighting, skin texture visible.'),
    close('hands', 'Hands', 'Close-up of both hands, fingers clearly drawn, with any rings or gloves.'),
    close('hair', 'Hair', 'Close-up of the hairstyle from the front and side, showing hairline and texture.'),
    close('accessories', 'Accessories', 'Close-up of the accessories worn, laid out clearly.'),
    close('footwear', 'Footwear', 'Close-up of the footwear from the side, soles and laces visible.'),
  ],
}

const propViews: Partial<Record<SheetType, ViewSpec[]>> = {
  'Multi-view': ['front', 'side', 'back', 'top'].map((v) => close(v, v[0].toUpperCase() + v.slice(1), `The prop from the ${v}, whole object inside the frame, orthographic feel.`, '4:3')),
  Functional: [
    close('in-use', 'Working state', 'The prop in its working state, showing how it functions.', '4:3'),
    close('scale', 'Scale reference', 'The prop held in an adult hand so its real size is clear.', '4:3'),
  ],
  Detail: [
    close('material', 'Material close-up', 'Macro close-up of the prop surface, materials and wear.', '4:3'),
    close('damage', 'Damage and aging', 'Close-up of damage, wear, repairs and aging on the prop as described.', '4:3'),
  ],
}

const setViews: Partial<Record<SheetType, ViewSpec[]>> = {
  Establishing: [close('establishing', 'Establishing view', 'Wide establishing view of the whole location.', '16:9'), close('reverse', 'Reverse view', 'The reverse angle of the same location, same architecture and lighting.', '16:9')],
  Interior: [close('interior', 'Interior', 'Interior view showing furniture, dressing and the entrances and exits.', '16:9')],
  Exterior: [close('exterior', 'Exterior', 'Exterior view showing the building or terrain and its surroundings.', '16:9')],
  Layout: [close('plan', 'Floor plan', 'Top-down architectural floor plan with furniture positions, doors and windows, clean technical drawing.', '4:3')],
  Lighting: [close('lighting', 'Practical lighting', 'The location lit only by its practical light sources, showing where each source sits.', '16:9')],
}

/** Expression views for the emotions a character actually plays in the story, each at the intensity the script calls for. */
export function emotionViews(needs: ExpressionNeed[]): ViewSpec[] {
  return needs.map((need) => close(`${need.emotion}-${need.intensity}`, `${need.emotion[0].toUpperCase() + need.emotion.slice(1)} (${need.intensity})`, `Large face close-up showing ${need.emotion}, ${intensityWords[need.intensity]}. Head fills most of the frame.${need.sceneIds.length ? ` Story moment: ${need.why}` : ''}`, '1:1'))
}

export function viewsFor(assetType: ExtractedAsset['type'], sheetType: SheetType, intensity: Intensity = 'moderate', plan?: ExpressionNeed[]): ViewSpec[] {
  if (assetType === 'character' && sheetType === 'Expressions' && plan?.length) return emotionViews(plan)
  if (assetType === 'character' && sheetType === 'Expressions') {
    return emotions.map((emotion) => close(`${emotion}-${intensity}`, `${emotion[0].toUpperCase() + emotion.slice(1)} (${intensity})`, `Large face close-up showing ${emotion}, ${intensityWords[intensity]}. Head fills most of the frame.`, '1:1'))
  }
  if (assetType === 'character' || assetType === 'costume') return characterViews[sheetType] ?? []
  if (assetType === 'prop') return propViews[sheetType] ?? []
  return setViews[sheetType] ?? []
}

export interface PromptInput {
  /** The model id the prompt is for. Used only to tailor artifact guidance. */
  model?: string
  style: StyleBible
  asset: Pick<ExtractedAsset, 'id' | 'name' | 'type'> & Partial<Pick<ExtractedAsset, 'age' | 'gender' | 'race' | 'ethnicity' | 'role' | 'never' | 'prompt' | 'description' | 'layout'>>
  variant: string
  sheetType: SheetType
  view: ViewSpec
  notes?: string
  /** True when the approved front view is sent along as a reference image. */
  anchored?: boolean
  /** The flat background for the whole sheet. Defaults to flat grey. */
  backdrop?: Backdrop
  /** For the 'front' backdrop: the colour read from the front view's own background, e.g. "#1e4a52". */
  backdropHex?: string
  /** Reference photographs are attached. In a 2D style they are identity references only. */
  photoRefs?: boolean
  /** This view is a deliberate redraw of the attached approved picture in the selected 2D style (a new revision for review). */
  reinterpret?: boolean
  /** The character's target proportions in words (see proportions.describe). Empty or absent: the prompt is exactly as it was. */
  proportions?: string
  /** A proportion guide image is attached as the last reference (see proportionGuide.ts). Only used together with `proportions`. */
  guide?: boolean
}

/** The identity facts a person confirmed for a character. Empty fields are omitted, never guessed. Every image and video prompt uses it so one identity runs through all outputs. */
export function identityFacts(asset: Partial<Pick<ExtractedAsset, 'type' | 'age' | 'gender' | 'race' | 'ethnicity' | 'role' | 'never'>>): string {
  if (asset.type && asset.type !== 'character') return ''
  const facts = [asset.age && `age ${asset.age}`, asset.gender, asset.race, asset.ethnicity, asset.role].filter(Boolean).join(', ')
  // The "never" clause is the person's own list of drifts to prevent. It is repeated as written, never rephrased or extended.
  const never = (asset.never ?? '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '')
  return [facts ? `Confirmed character identity: ${facts}.` : '', never ? `Must never drift: ${never}.` : ''].filter(Boolean).join(' ')
}

/** Added to the anchoring line when target proportions are set: the reference keeps identity, not the body. */
export const reshapeLine = "Its body proportions are NOT to be copied: draw the body to the target proportions stated above, even where they differ from this picture. Everything else about who this is stays."
export const photoReshapeLine = 'The attached photographs show who this is, not how the body is built: draw the body to the target proportions stated above, even where the photographs differ.'

/** A close-up made from a full-body reference: the reference gives identity, not the framing (a model otherwise repeats the full-body picture). */
export const closeUpReframeLine = 'FRAMING comes from this request, not from the attached picture: this is a close-up. Do not reproduce the full-body framing or pose of the attached picture. Crop in as described above so the face and upper body fill the frame, and show no legs or feet.'

/** A set sheet is the place for every later picture, so it is drawn empty: people in it make the model draw a scene, and a person in a set cannot be reused. */
export const emptyPlaceLine = 'This is a reference of the place itself, empty of people, creatures and characters: show only the architecture, furniture and fixed props, so any character can be placed in it later.'

export function buildViewPrompt({ style, asset, variant, sheetType, view, notes, model, anchored, backdrop, backdropHex, photoRefs, reinterpret, proportions, guide }: PromptInput): string {
  const subject = asset.type === 'character' ? `the character ${asset.name}` : `the ${asset.type} "${asset.name}"`
  const twoD = !!style.spec2d
  const place = asset.type === 'set' || asset.type === 'environment'
  // Target proportions only mean something if the picture sent along is not told to be copied exactly. The anchoring line says "keep the body build"; when the person has set
  // target proportions, the body is the one thing that is allowed to change, and the prompt says so.
  const hasTarget = asset.type === 'character' && !!proportions
  const anchorLine = !anchored ? '' : twoD ? twoDAnchoredLine : anchoredPromptLine
  const reshaped = hasTarget && anchorLine ? `${anchorLine.replace('silhouette, body proportions, ', 'silhouette, ').replace('body build, ', '')} ${reshapeLine}` : anchorLine
  const lines = [
    `Production reference image: ${view.label} of ${subject}${variant !== 'Canonical' ? `, story variant "${variant}"` : ''} (${sheetType} sheet).`,
    twoD ? adaptViewFor2D(view.instruction) : view.instruction,
    identityFacts(asset),
    asset.type === 'character' ? proportions ?? '' : '',
    asset.description?.trim() ? `Description (the person's own words): ${asset.description.trim().replace(/\s+/g, ' ')}` : '',
    place ? (asset.layout?.trim() ? `Fixed layout of this place, the same in every view: ${asset.layout.trim().replace(/\s+/g, ' ')}. Show the same place from a different position: do not move, add or remove these landmarks.` : 'Every view of this place shows the same architecture, layout, landmarks and prop positions as the others, seen from a different position or in different light.') : '',
    // A costume made from the script's own description of a character keeps those words in every view.
    (asset.type === 'costume' && asset.prompt?.startsWith('Costume worn by')) || (asset.type === 'prop' && asset.prompt?.startsWith('As the script describes it')) ? `${asset.prompt}${asset.type === 'prop' ? ' It shows exactly this and nothing more: add no other people, figures or objects to what it shows.' : ''}` : '',
    reshaped,
    place ? emptyPlaceLine : '',
    anchored && !view.fullBody && asset.type === 'character' ? closeUpReframeLine : '',
    twoD && photoRefs ? twoDPhotoLine : '',
    hasTarget && photoRefs ? photoReshapeLine : '',
    hasTarget && guide ? guideLine : '',
    twoD && reinterpret ? twoDReinterpretLine : '',
    notes ? `Production notes: ${notes}` : '',
    `Visual style bible: ${styleGuidance(style, place ? 'scene' : 'technical')}.`,
    // A set or environment is a place, not a cut-out on a flat field: the place fills the frame edge to edge (a flat grey field made grey bars above and below the room).
    asset.type === 'set' || asset.type === 'environment' ? 'The place fills the entire frame edge to edge, with no grey or blank borders, no letterbox bars, no frame, no text, no labels and no watermark.' : backdropLine(backdrop, anchored, backdropHex),
    asset.type === 'character' ? (hasTarget ? 'Keep the same face, hairstyle and costume construction in every view of this character, with the target body proportions stated above.' : 'Keep the same face, body proportions, hairstyle and costume construction in every view of this character.') : 'Keep the same design, proportions and materials in every view.',
    'Exactly ONE single image of ONE subject in ONE view. Do not make a grid, contact sheet, collage, split-screen, triptych or several views side by side; no repeated copies of the subject.',
    view.fullBody ? 'The entire figure from the top of the head to the soles of the feet must be fully visible with clear margin; nothing cropped.' : '',
    artifactGuidance(style, model, notes ?? ''),
  ]
  return lines.filter(Boolean).join('\n')
}

const clean = (value: string) => value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** CHAR-001_Amina_Canonical_Turnaround_front_v01 : stable, sortable, safe as a file name. */
export function outputName(asset: Pick<ExtractedAsset, 'id' | 'name'>, variant: string, sheetType: SheetType, view: ViewSpec, revision: number): string {
  return [asset.id, clean(asset.name), clean(variant), clean(sheetType), clean(view.key)].join('_') + `_v${String(revision).padStart(2, '0')}`
}

export function sheetTypesFor(assetType: ExtractedAsset['type']): SheetType[] {
  if (assetType === 'character') return ['Identity', 'Turnaround', 'Expressions', 'Poses', 'Wardrobe', 'Detail']
  if (assetType === 'costume') return ['Wardrobe', 'Turnaround', 'Detail']
  if (assetType === 'prop') return ['Multi-view', 'Functional', 'Detail']
  return ['Establishing', 'Interior', 'Exterior', 'Layout', 'Lighting']
}

/** The view whose approval makes an asset's reference the production anchor. */
export const primaryViewKeys = ['front', 'full-front', 'costume-front', 'establishing', 'plan']
