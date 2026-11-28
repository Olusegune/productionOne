import { createEntity, latestApproved, type Ref, type SkinControls, type SkinSpec, type VariationState } from './variations'

/**
 * Skin & Surface. A Skin Profile states the DESIRED look of a photorealistic character's skin as structured choices: texture detail, surface finish, tonal
 * variation, fine facial hair, retouching, distinctive marks with where they are, and what must be protected. An image model is asked to attempt it; nothing
 * here is a physical shader value and nothing guarantees the result, so every candidate is reviewed by a person.
 *
 * Kept apart on purpose: age (the age record), lighting (lighting.ts), grading (look records), makeup (its own field here) and temporary conditions such as sweat
 * or dirt (their own list, which never edits the approved profile). Complexion and undertone are only what the person writes: no other field, wording or
 * check is ever derived from them, and nothing about personality or health is inferred from complexion or ethnicity.
 */
export type Level<T extends string> = { id: T; label: string; hint: string }

export const TEXTURE: Array<Level<SkinControls['textureDetail']>> = [
  { id: 'subtle', label: 'Subtle', hint: 'Fine texture, soft at normal viewing distance' },
  { id: 'natural', label: 'Natural', hint: 'Visible fine texture that varies across the face' },
  { id: 'pronounced', label: 'Pronounced', hint: 'Clearly visible texture, still varied and never uniform' },
]
export const FINISH: Array<Level<SkinControls['surfaceFinish']>> = [
  { id: 'matte', label: 'Matte', hint: 'Little shine' },
  { id: 'natural', label: 'Natural', hint: 'Restrained highlights where skin catches light' },
  { id: 'dewy', label: 'Dewy', hint: 'A soft sheen, still broken up and never uniform' },
]
export const TONAL: Array<Level<SkinControls['tonalVariation']>> = [
  { id: 'even', label: 'Even', hint: 'Gentle, soft tonal changes' },
  { id: 'natural', label: 'Natural', hint: 'Normal variation between forehead, cheeks, nose and chin' },
  { id: 'varied', label: 'Varied', hint: 'More noticeable variation, such as ruddiness or freckling' },
]
export const FINE_HAIR: Array<Level<SkinControls['fineFacialHair']>> = [
  { id: 'none', label: 'None', hint: 'No visible fine hair' },
  { id: 'light', label: 'Light', hint: 'Faint fine hair at the edges of the face' },
  { id: 'natural', label: 'Natural', hint: 'Fine hair where it normally grows, catching light softly' },
]
export const RETOUCH: Array<Level<SkinControls['retouching']>> = [
  { id: 'none', label: 'None', hint: 'As photographed' },
  { id: 'light', label: 'Light', hint: 'Small blemishes softened, texture kept' },
  { id: 'moderate', label: 'Moderate', hint: 'Polished presentation, texture still natural' },
]

export const SKIN_REGIONS = ['forehead', 'cheeks', 'nose', 'eye area', 'lips', 'neck', 'hands'] as const
export type SkinRegion = (typeof SKIN_REGIONS)[number]

export const PROTECT_CHOICES: ReadonlyArray<{ id: SkinSpec['protect'][number]; label: string; line: string }> = [
  { id: 'facial-structure', label: 'Facial structure', line: 'the facial structure' },
  { id: 'complexion', label: 'Complexion', line: 'the complexion' },
  { id: 'age', label: 'Age', line: 'the apparent age' },
  { id: 'expression', label: 'Expression', line: 'the expression' },
  { id: 'hair', label: 'Hair', line: 'the hairstyle' },
  { id: 'marks', label: 'Distinctive marks', line: 'the distinctive marks' },
  { id: 'body', label: 'Body proportions', line: 'the body proportions' },
  { id: 'wardrobe', label: 'Wardrobe', line: 'the wardrobe' },
  { id: 'pose', label: 'Pose', line: 'the pose' },
  { id: 'background', label: 'Background', line: 'the background' },
]
export const DEFAULT_PROTECT: SkinSpec['protect'] = ['facial-structure', 'complexion', 'age', 'expression', 'hair', 'marks']

export type PresetId = SkinSpec['preset']
export const SKIN_PRESETS: Array<{ id: PresetId; label: string; blurb: string; controls: SkinControls }> = [
  { id: 'natural', label: 'Natural', blurb: 'Balanced surface detail and restrained highlights.', controls: { textureDetail: 'natural', surfaceFinish: 'natural', tonalVariation: 'natural', fineFacialHair: 'natural', retouching: 'none' } },
  { id: 'clean-portrait', label: 'Clean portrait', blurb: 'A polished presentation that keeps natural detail.', controls: { textureDetail: 'natural', surfaceFinish: 'natural', tonalVariation: 'even', fineFacialHair: 'light', retouching: 'moderate' } },
  { id: 'weathered', label: 'Weathered', blurb: 'Environmental wear, matte and varied. It does not change the age.', controls: { textureDetail: 'pronounced', surfaceFinish: 'matte', tonalVariation: 'varied', fineFacialHair: 'natural', retouching: 'none' } },
  { id: 'custom', label: 'Custom', blurb: 'Start from Natural and set each control yourself.', controls: { textureDetail: 'natural', surfaceFinish: 'natural', tonalVariation: 'natural', fineFacialHair: 'natural', retouching: 'none' } },
]
export const presetById = (id: PresetId) => SKIN_PRESETS.find((p) => p.id === id) ?? SKIN_PRESETS[0]
const CONTROL_KEYS = ['textureDetail', 'surfaceFinish', 'tonalVariation', 'fineFacialHair', 'retouching'] as const satisfies ReadonlyArray<keyof SkinControls>
export const CONTROL_LABELS: Record<keyof SkinControls, string> = { textureDetail: 'Texture detail', surfaceFinish: 'Surface finish', tonalVariation: 'Tonal variation', fineFacialHair: 'Fine facial hair', retouching: 'Retouching' }

/** A new profile from a preset, for one character. */
export function newSkin(characterId: string, preset: PresetId = 'natural'): SkinSpec {
  return { characterId, preset, ...presetById(preset).controls, marks: [], regions: {}, makeup: '', complexion: '', undertone: '', protect: [...DEFAULT_PROTECT], conditions: [] }
}

/** Applies a preset's choices. Marks, descriptions, makeup, protection and conditions belong to the person and are kept. */
export function withPreset(spec: SkinSpec, preset: PresetId): SkinSpec { return { ...spec, preset, ...presetById(preset).controls } }

/** The controls that differ from the preset (the person's own overrides). Always computed, never stored, so it cannot disagree with the settings. */
export function overridesOf(spec: SkinSpec): Array<{ key: keyof SkinControls; label: string; from: string; to: string }> {
  const base = presetById(spec.preset === 'custom' ? 'natural' : spec.preset).controls
  const levels = { textureDetail: TEXTURE, surfaceFinish: FINISH, tonalVariation: TONAL, fineFacialHair: FINE_HAIR, retouching: RETOUCH } as const
  return CONTROL_KEYS.filter((k) => spec[k] !== base[k]).map((k) => ({ key: k, label: CONTROL_LABELS[k], from: (levels[k] as Array<Level<string>>).find((l) => l.id === base[k])?.label ?? base[k], to: (levels[k] as Array<Level<string>>).find((l) => l.id === spec[k])?.label ?? spec[k] }))
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const pick = <T extends string>(list: Array<Level<T>>, v: unknown, d: T): T => (list.some((l) => l.id === v) ? (v as T) : d)

/** Reads a saved profile. Unusable settings return undefined and the record is dropped; unknown choices fall back to Natural's. */
export function readSkinSpec(raw: unknown): SkinSpec | undefined {
  if (!isObj(raw) || typeof raw.characterId !== 'string' || !raw.characterId.trim()) return undefined
  const preset = SKIN_PRESETS.some((p) => p.id === raw.preset) ? (raw.preset as PresetId) : 'natural'
  const marks = (Array.isArray(raw.marks) ? raw.marks : []).flatMap((m) => (isObj(m) && text(m.what, 80) && text(m.where, 80) ? [{ what: text(m.what, 80), where: text(m.where, 80) }] : [])).slice(0, 30)
  const regions: SkinSpec['regions'] = {}
  if (isObj(raw.regions)) for (const r of SKIN_REGIONS) { const v = raw.regions[r]; if (isObj(v)) { const texture = TEXTURE.some((l) => l.id === v.texture) ? (v.texture as SkinControls['textureDetail']) : undefined; const finish = FINISH.some((l) => l.id === v.finish) ? (v.finish as SkinControls['surfaceFinish']) : undefined; if (texture || finish) regions[r] = { ...(texture ? { texture } : {}), ...(finish ? { finish } : {}) } } }
  const protect = [...new Set((Array.isArray(raw.protect) ? raw.protect : []).filter((p): p is SkinSpec['protect'][number] => PROTECT_CHOICES.some((c) => c.id === p)))]
  const conditions = (Array.isArray(raw.conditions) ? raw.conditions : []).filter((c): c is string => typeof c === 'string' && !!c.trim()).map((c) => c.trim().slice(0, 80)).slice(0, 20)
  const base = presetById(preset).controls
  const identityJobId = text(raw.identityJobId, 80)
  const variant = text(raw.variant, 80)
  const identityRevision = typeof raw.identityRevision === 'number' && Number.isInteger(raw.identityRevision) && raw.identityRevision >= 0 ? raw.identityRevision : undefined
  return {
    characterId: raw.characterId.trim().slice(0, 80), preset,
    textureDetail: pick(TEXTURE, raw.textureDetail, base.textureDetail), surfaceFinish: pick(FINISH, raw.surfaceFinish, base.surfaceFinish), tonalVariation: pick(TONAL, raw.tonalVariation, base.tonalVariation),
    fineFacialHair: pick(FINE_HAIR, raw.fineFacialHair, base.fineFacialHair), retouching: pick(RETOUCH, raw.retouching, base.retouching),
    marks, regions, makeup: text(raw.makeup, 200), complexion: text(raw.complexion, 200), undertone: text(raw.undertone, 200), protect, conditions,
    ...(variant ? { variant } : {}), ...(identityJobId ? { identityJobId } : {}), ...(identityRevision !== undefined ? { identityRevision } : {}),
  }
}

/** Why a profile cannot be saved, in plain words, or undefined when it can. */
export function checkSkinSpec(spec: SkinSpec): string | undefined {
  if (!spec.characterId) return 'Choose the character.'
  const bad = spec.marks.find((m) => !m.what.trim() || !m.where.trim())
  if (bad) return 'A distinctive mark needs both what it is and where it is, for example "a small scar" on "the left eyebrow".'
  if (spec.marks.length > 0 && !spec.protect.includes('marks')) return 'You listed distinctive marks but did not protect them. Keep "Distinctive marks" protected so a refinement does not move or remove them.'
  return undefined
}

const phrase = {
  textureDetail: { subtle: 'fine, soft skin texture', natural: 'natural visible fine texture that varies across the face', pronounced: 'clearly visible skin texture that stays varied and never uniform' },
  surfaceFinish: { matte: 'a matte finish with little shine', natural: 'restrained highlights only where skin would catch light', dewy: 'a soft sheen that is broken up and never uniform' },
  tonalVariation: { even: 'gentle, soft tonal changes', natural: 'natural tonal variation between forehead, cheeks, nose and chin', varied: 'noticeable but natural tonal variation' },
  fineFacialHair: { none: 'no visible fine facial hair', light: 'faint fine hair at the edges of the face', natural: 'fine facial hair where it naturally grows, catching light softly' },
  retouching: { none: 'no retouching', light: 'light retouching that keeps texture', moderate: 'a polished but natural-looking retouch that keeps texture' },
} as const

/**
 * The profile as wording for a picture prompt: a desired look, stated as such. Complexion, undertone and makeup are quoted exactly as the person wrote them
 * and are never used to choose any other phrase. Nothing here asks for personality, health or character from skin.
 */
export function skinLine(spec: SkinSpec): string {
  const parts = [
    `Skin and surface (the desired look to attempt, not exact values): ${phrase.textureDetail[spec.textureDetail]}; ${phrase.surfaceFinish[spec.surfaceFinish]}; ${phrase.tonalVariation[spec.tonalVariation]}; ${phrase.fineFacialHair[spec.fineFacialHair]}; ${phrase.retouching[spec.retouching]}.`,
    'Soft transitions: do not smooth the skin into plastic, do not add exaggerated or repeating pores, no sharpening halos, no uniform shine.',
  ]
  const regional = SKIN_REGIONS.flatMap((r) => { const v = spec.regions[r]; if (!v) return []; const bits = [v.texture && phrase.textureDetail[v.texture], v.finish && phrase.surfaceFinish[v.finish]].filter(Boolean); return bits.length ? [`${r}: ${bits.join(', ')}`] : [] })
  if (regional.length) parts.push(`By region: ${regional.join('; ')}.`)
  if (spec.complexion.trim()) parts.push(`Complexion (the person's own description, keep it): ${spec.complexion.trim()}.`)
  if (spec.undertone.trim()) parts.push(`Undertone (the person's own description, keep it): ${spec.undertone.trim()}.`)
  if (spec.marks.length) parts.push(`Distinctive marks, keep each exactly where it is: ${spec.marks.map((m) => `${m.what} (${m.where})`).join('; ')}.`)
  if (spec.makeup.trim()) parts.push(`Makeup: ${spec.makeup.trim()}.`)
  return parts.join(' ')
}

/** The sentence that says what a refinement must not change. */
export function protectLine(spec: SkinSpec): string {
  const lines = PROTECT_CHOICES.filter((c) => spec.protect.includes(c.id)).map((c) => c.line)
  return lines.length ? `Preserve ${lines.length === 1 ? lines[0] : `${lines.slice(0, -1).join(', ')} and ${lines[lines.length - 1]}`}.` : ''
}

/** Whether a style is photorealistic. Only then is Skin & Surface shown prominently and written into prompts; 2D and stylized styles are never pushed toward realism. */
export function isPhotorealStyle(style: { family?: string; name?: string; rendering?: string } | undefined): boolean {
  if (!style) return false
  if (style.family === 'Realistic 3D') return true
  return /photo-?real|naturalistic digital human|live-action/i.test(`${style.name ?? ''} ${style.rendering ?? ''}`)
}

export function approvedSkin(state: VariationState, characterId: string): { ref: Ref; spec: SkinSpec } | undefined {
  for (const e of state.entities) {
    if (e.kind !== 'skin' || e.archived) continue
    const rev = latestApproved(e)
    if (rev && (rev.spec as SkinSpec).characterId === characterId) return { ref: { id: e.id, revision: rev.n }, spec: rev.spec as SkinSpec }
  }
  return undefined
}

/** The skin wording to write into a character's prompts: only for a photorealistic style and only once a profile is approved. */
export function skinPromptFor(state: VariationState, characterId: string, style: { family?: string; name?: string; rendering?: string } | undefined): string | undefined {
  if (!isPhotorealStyle(style)) return undefined
  const s = approvedSkin(state, characterId)
  return s ? skinLine(s.spec) : undefined
}

/** Records a profile as a candidate; a new one for the same character is a new revision of the same record, so history is kept. */
export function recordSkin(state: VariationState, spec: SkinSpec, characterName: string, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const bad = checkSkinSpec(spec)
  if (bad) return { error: bad }
  const existing = state.entities.find((e) => e.kind === 'skin' && !e.archived && (e.revisions[e.revisions.length - 1].spec as SkinSpec).characterId === spec.characterId)
  if (existing) {
    const n = existing.revisions.reduce((m, x) => Math.max(m, x.n), 0) + 1
    const updated = { ...existing, revisions: [...existing.revisions, { n, createdAt: now, status: 'candidate' as const, spec: structuredClone(spec), parent: { id: existing.id, revision: n - 1 }, media: [] }] }
    return { state: { ...state, entities: state.entities.map((e) => (e.id === existing.id ? (updated as typeof e) : e)) }, ref: { id: existing.id, revision: n } }
  }
  return createEntity(state, 'skin', { name: `${characterName} skin`, characterId: spec.characterId, spec, now })
}

/**
 * Age-appropriate fine detail for a target age, as wording. It is about the surface of the skin at that age and nothing else: it never asks for dirt, damage, heavy
 * weathering or extreme wrinkles, and it leaves the person's complexion, marks and protected features to the profile. Empty when the age is not a number.
 */
export function ageDetailLine(targetAge: string): string | undefined {
  const m = /(\d{1,3})/.exec(targetAge ?? '')
  if (!m) return undefined
  const age = Number(m[1])
  if (age < 0 || age > 120) return undefined
  const detail = age < 13 ? 'very smooth, fine skin with soft texture' : age < 25 ? 'youthful skin with fine texture and few lines' : age < 45 ? 'natural fine texture, with expression lines only where the face makes them' : age < 65 ? 'visible fine lines around the eyes and mouth and slightly more varied tone, without deep wrinkles unless asked for' : 'fine wrinkles and softer elasticity, still natural and not heavily weathered'
  return `Age-appropriate fine detail for about ${age}: ${detail}. Aging shows as fine surface detail only: it is not dirt, damage or heavy weathering, and the same marks and complexion are kept.`
}
