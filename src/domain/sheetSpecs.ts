import type { ExtractedAsset } from './productionStudio'
import type { SheetType, StyleBible } from './visualDevelopment'
import type { ExpressionNeed } from '../engine/emotion'

/** One separate image inside a reference sheet. Each view is generated and saved as its own original-resolution file. */
export interface ViewSpec {
  key: string
  label: string
  instruction: string
  /** True when the whole figure must be inside the frame, so QA can flag a cropped head or feet. */
  fullBody: boolean
  aspect: '1:1' | '3:4' | '4:3' | '16:9'
}

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
    full('front', 'Front', 'Full body standing FRONT view, arms slightly away from the body, feet apart, head to feet fully inside the frame.'),
    full('three-quarter-front', 'Three-quarter front', 'Full body standing THREE-QUARTER FRONT view (about 45 degrees), same pose and scale as the front view.'),
    full('side', 'Side', 'Full body standing SIDE profile view (90 degrees), same pose and scale as the front view.'),
    full('three-quarter-rear', 'Three-quarter rear', 'Full body standing THREE-QUARTER REAR view (about 135 degrees), same pose and scale as the front view.'),
    full('rear', 'Rear', 'Full body standing REAR view, same pose and scale as the front view.'),
  ],
  Poses: [
    full('standing', 'Standing', 'Full body natural standing pose, weight on one leg.'),
    full('walking', 'Walking', 'Full body mid-stride walking pose, readable leg and arm swing.'),
    full('running', 'Running', 'Full body running pose with believable anatomy and balance.'),
    full('sitting', 'Sitting', 'Full body seated pose on a plain stool, feet visible.'),
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
  style: StyleBible
  asset: Pick<ExtractedAsset, 'id' | 'name' | 'type'>
  variant: string
  sheetType: SheetType
  view: ViewSpec
  notes?: string
}

export function buildViewPrompt({ style, asset, variant, sheetType, view, notes }: PromptInput): string {
  const subject = asset.type === 'character' ? `the character ${asset.name}` : `the ${asset.type} "${asset.name}"`
  const lines = [
    `Production reference image: ${view.label} of ${subject}${variant !== 'Canonical' ? `, story variant "${variant}"` : ''} (${sheetType} sheet).`,
    view.instruction,
    notes ? `Production notes: ${notes}` : '',
    `Visual style: ${style.name}. ${style.description} Materials: ${style.materials}. Rendering: ${style.rendering}. Lighting: ${style.lighting}.`,
    'Plain neutral light-grey background, even neutral lighting, no cast shadows on the background, no text, no labels, no borders, no watermark.',
    asset.type === 'character' ? 'Keep the same face, body proportions, hairstyle and costume construction in every view of this character.' : 'Keep the same design, proportions and materials in every view.',
    view.fullBody ? 'The entire figure from the top of the head to the soles of the feet must be fully visible with clear margin; nothing cropped.' : '',
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
