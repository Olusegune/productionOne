import { artifactGuidance } from './cleanGuidance'
import { type ImageJob, type JobRequest, type QueueState } from './generationQueue'
import { describeLighting, lightingPresetById, readLighting, type LightingRecord } from './lighting'
import type { ExtractedAsset } from './productionStudio'
import { backdropLine, identityFacts, outputName, type ViewSpec } from './sheetSpecs'
import { isPhotorealStyle, protectLine, skinLine } from './skin'
import { sourceForView } from './skinRefine'
import { styleGuidance, type StyleBible } from './visualDevelopment'
import { addRevision, createEntity, findEntity, latestApproved, type LightingTestSpec, type Ref, type SkinSpec, type VariationState } from './variations'
import { approvedSkin } from './skin'

/**
 * Lighting test for a photorealistic character: the same approved person, with the same skin profile, under four plain lighting setups, so the skin can be
 * judged in more than one light. Lighting is stored in its own record, separate from the skin profile, and pinned to the exact skin revision it was made
 * with, so a change to the skin profile marks the test out of date without touching anything else.
 *
 * Each picture is a NEW candidate made by an image model from the approved reference. It is not relighting of known geometry and is never made by a LUT or a
 * colour filter. Warm light and natural undertones can be intentional, so nothing here tries to "remove yellow"; a colour difference is judged by a person against
 * the approved reference and what the light itself would do.
 */
export interface SkinLight { id: string; label: string; purpose: string; record: LightingRecord }

const neutral = lightingPresetById('neutral-reference')!.record
const hardSide = lightingPresetById('hard-side-light')!.record

export const SKIN_LIGHTS: SkinLight[] = [
  { id: 'neutral-diffuse', label: 'Neutral diffuse', purpose: 'Even, soft light from the front: the baseline for skin texture and tone.', record: { ...neutral, presetId: 'neutral-reference', colorTempK: 5600 } },
  { id: 'soft-side', label: 'Soft side light', purpose: 'A large soft source from one side: shows texture gently with soft shadows.', record: { presetId: 'soft-side', keyAzimuth: -50, keyElevation: 30, sourceSize: 'large', contrast: 'low', rim: false, practicals: '', ambient: 'normal', colorTempK: 5600, timeOfDay: 'daylight', exposure: 'normal' } },
  { id: 'directional', label: 'Directional light', purpose: 'A small, harder source from the side: shows surface detail and highlights most strongly.', record: { ...hardSide, presetId: 'hard-side-light', contrast: 'medium', colorTempK: 5600 } },
  { id: 'backlight', label: 'Backlight', purpose: 'Light from behind with the face still readable: tests edge highlights without losing the skin.', record: { presetId: 'skin-backlight', keyAzimuth: 160, keyElevation: 25, sourceSize: 'medium', contrast: 'medium', rim: true, practicals: '', ambient: 'normal', colorTempK: 5600, timeOfDay: 'daylight', exposure: 'normal' } },
]
export const lightById = (id: string) => SKIN_LIGHTS.find((l) => l.id === id)

export const lightViewKey = (lightId: string) => `light-${lightId}`
export const lightingViews: ViewSpec[] = SKIN_LIGHTS.map((l) => ({ key: lightViewKey(l.id), label: l.label, instruction: `Head-and-shoulders portrait facing the camera, neutral expression, eyes to lens. ${l.purpose}`, fullBody: false, aspect: '3:4' }))

export const lightingLookName = (characterName: string) => `${characterName}, lighting test`.slice(0, 80)

/** The picture the test starts from: the approved refined picture when there is one, otherwise the approved original. Never anything unapproved. */
export function lightingSource(queue: QueueState, state: VariationState, character: ExtractedAsset): { path: string; kind: 'refined' | 'original' } | undefined {
  const skin = approvedSkin(state, character.id)
  const variant = skin?.spec.variant
  if (variant) {
    const refined = queue.jobs.filter((j) => j.assetId === character.id && j.variant === variant && j.approved && !!j.outputPath && (j.viewKey === 'portrait' || j.viewKey === 'full-front'))
    const best = refined.sort((a, b) => (a.viewKey === 'portrait' ? -1 : 1) - (b.viewKey === 'portrait' ? -1 : 1) || b.revision - a.revision)[0]
    if (best?.outputPath) return { path: best.outputPath, kind: 'refined' }
  }
  const original = sourceForView(queue, character, 'portrait')
  return original ? { path: original, kind: 'original' } : undefined
}

/** Why a lighting test cannot start, in plain words, or undefined when it can. */
export function lightingBlocker(input: { style: { family?: string; name?: string; rendering?: string }; state: VariationState; character: ExtractedAsset; source: string | undefined; takesReferences: boolean }): string | undefined {
  if (!isPhotorealStyle(input.style)) return `This project's style (${input.style.name || 'not set'}) is not photorealistic, so a lighting test of skin does not apply.`
  if (!approvedSkin(input.state, input.character.id)) return 'Save and approve the skin profile first. The test keeps its settings the same in every light.'
  if (!input.source) return `Approve ${input.character.name}'s front view first (Sheets, Identity). Every light starts from the approved picture and there is none yet.`
  if (!input.takesReferences) return 'This model cannot take the approved picture as a reference, so it cannot keep the same person in each light. Choose a model that takes references (Providers).'
  return undefined
}

/** What a light is expected to do to colour, in words. A cast that this explains is not a fault; one it does not explain is worth a look. */
export function expectedColourEffect(record: LightingRecord): string {
  const k = record.colorTempK
  if (k < 4500) return `A warm light (about ${k} K) is expected to warm the skin. That can be intentional.`
  if (k > 6200) return `A cool light (about ${k} K) is expected to cool the skin. That can be intentional.`
  return `A near-neutral light (about ${k} K): the complexion should stay close to the approved reference.`
}

/** The questions a person answers for each picture. Identity and surface and colour are separate. */
export function colourReviewQuestions(record: LightingRecord, spec: SkinSpec): string[] {
  return [
    'Is it still the same person, with the same age, expression and marks?',
    `Is the complexion${spec.complexion.trim() ? ` ("${spec.complexion.trim()}")` : ''} the same as the approved reference, allowing for this light? ${expectedColourEffect(record)}`,
    'Is the surface still natural: not smoothed to plastic, no uniform shine, no halos around edges?',
  ]
}

export interface LightingPromptInput { style: StyleBible; character: ExtractedAsset; spec: SkinSpec; light: SkinLight; view: ViewSpec; model?: string }

export function lightingTestPrompt({ style, character, spec, light, view, model }: LightingPromptInput): string {
  return [
    `Production reference image: ${view.label} of the character ${character.name}, a lighting test.`,
    view.instruction,
    identityFacts(character),
    `Reference image 1 is the approved picture of ${character.name}. It fixes who this is.`,
    `Show the SAME person in the SAME head-and-shoulders framing. Only the lighting changes. ${protectLine(spec)}`,
    `Lighting: ${describeLighting(light.record)}. This is real light falling on the subject, not a colour filter or tint laid over the picture.`,
    skinLine(spec),
    'Do not replace the face, change the apparent age, change the expression or redesign the costume.',
    `Visual style bible: ${styleGuidance(style, 'technical')}.`,
    backdropLine('gray', true, ''),
    'Exactly ONE single image of ONE subject in ONE view. Do not make a grid, contact sheet, collage, split-screen or several views side by side.',
    // The light's own colour and the person's own colour words count as "a warm look is wanted" when they say so; nothing removes a warm cast the light or the undertone explains.
    artifactGuidance(style, model ?? '', [describeLighting(light.record), spec.complexion, spec.undertone, spec.makeup].filter(Boolean).join(' ')),
  ].filter(Boolean).join('\n')
}

const readSetups = (raw: unknown): LightingTestSpec['setups'] => (Array.isArray(raw) ? raw : []).flatMap((s) => {
  if (typeof s !== 'object' || s === null) return []
  const o = s as Record<string, unknown>
  const record = readLighting(o.record)
  return typeof o.id === 'string' && typeof o.label === 'string' && record ? [{ id: o.id.slice(0, 40), label: o.label.slice(0, 60), record }] : []
}).slice(0, 12)

/** Reads a saved lighting test. Unusable settings return undefined and the record is dropped. */
export function readLightingTestSpec(raw: unknown): LightingTestSpec | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const o = raw as Record<string, unknown>
  const sk = o.skin as Record<string, unknown> | undefined
  if (typeof o.characterId !== 'string' || !o.characterId.trim() || !sk || typeof sk.id !== 'string' || !sk.id || typeof sk.revision !== 'number' || !Number.isInteger(sk.revision) || sk.revision < 1) return undefined
  const setups = readSetups(o.setups)
  if (!setups.length) return undefined
  const variant = typeof o.variant === 'string' && o.variant.trim() ? o.variant.trim().slice(0, 80) : undefined
  return { characterId: o.characterId.trim().slice(0, 80), skin: { id: sk.id, revision: sk.revision }, setups, ...(variant ? { variant } : {}) }
}

/**
 * Starts a lighting test: a CANDIDATE record pinned to the exact approved skin revision, with the four lighting setups stored in it (apart from the skin
 * profile). A repeat is a new revision of the same record, so history is kept.
 */
export function startLightingTest(state: VariationState, input: { character: ExtractedAsset; now: string }): { variations: VariationState; ref: Ref; variant: string; spec: LightingTestSpec } | { error: string } {
  const skin = approvedSkin(state, input.character.id)
  if (!skin) return { error: 'Save and approve the skin profile first. The test keeps its settings the same in every light.' }
  const variant = lightingLookName(input.character.name)
  const spec: LightingTestSpec = { characterId: input.character.id, skin: skin.ref, setups: SKIN_LIGHTS.map((l) => ({ id: l.id, label: l.label, record: structuredClone(l.record) })), variant }
  const existing = state.entities.find((e) => e.kind === 'lighting-test' && !e.archived && e.characterId === input.character.id)
  if (existing) { const made = addRevision(state, existing.id, { spec, now: input.now, note: 'Lighting test' }); return { variations: made.state, ref: made.ref, variant, spec } }
  const made = createEntity(state, 'lighting-test', { name: variant, characterId: input.character.id, spec, now: input.now })
  return { variations: made.state, ref: made.ref, variant, spec }
}

export interface LightingRequestInput { style: StyleBible; provider: string; model: string; character: ExtractedAsset; lookName: string; test: Ref; spec: SkinSpec; source: string; styleFp?: string }

/** One request per light, each with exactly one reference (the approved picture). Nothing is sent until the person presses Generate. */
export function lightingRequests(input: LightingRequestInput): JobRequest[] {
  return SKIN_LIGHTS.map((light, i) => {
    const view = lightingViews[i]
    return {
      assetId: input.character.id, variant: input.lookName, sheetType: 'Identity', viewKey: view.key, label: view.label,
      prompt: lightingTestPrompt({ style: input.style, character: input.character, spec: input.spec, light, view, model: input.model }),
      aspect: view.aspect, fullBody: false, provider: input.provider as JobRequest['provider'], model: input.model,
      references: [input.source], useAnchor: false, styleName: input.style.name, ...(input.styleFp ? { styleFp: input.styleFp } : {}),
      variation: { id: input.test.id, revision: input.test.revision, role: 'lighting-candidate', uses: [{ id: input.character.id, revision: 0, role: 'reference-1-approved', path: input.source }] },
      outputName: (revision: number) => outputName(input.character, input.lookName, 'Identity', view, revision),
    }
  })
}

/** The newest approved lighting test for a character and whether the skin profile has changed since it was made. */
export function lightingTestStanding(state: VariationState, characterId: string): { ref: Ref; spec: LightingTestSpec; outOfDate: boolean } | undefined {
  const e = state.entities.find((x) => x.kind === 'lighting-test' && !x.archived && x.characterId === characterId)
  const rev = e && latestApproved(e)
  if (!e || !rev) return undefined
  const spec = rev.spec as LightingTestSpec
  const skin = findEntity(state, spec.skin.id)
  const newest = skin && latestApproved(skin)
  return { ref: { id: e.id, revision: rev.n }, spec, outOfDate: !!newest && newest.n > spec.skin.revision }
}

/** The pictures of a lighting test, by light. */
export const lightJobs = (queue: QueueState, test: Ref): Record<string, ImageJob | undefined> =>
  Object.fromEntries(SKIN_LIGHTS.map((l) => [l.id, queue.jobs.filter((j) => j.variation?.id === test.id && j.variation.revision === test.revision && j.viewKey === lightViewKey(l.id)).sort((a, b) => b.revision - a.revision)[0]]))
