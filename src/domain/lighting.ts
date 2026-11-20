/**
 * Lighting design for a shot, kept apart from grading. A lighting record says where light comes from and how it feels; it contains no grade fields
 * (exposure and white balance corrections, contrast curves, saturation, LUTs). Grading is a separate record applied over a finished picture (Phase 5).
 * Asking a model for different lighting makes a new candidate picture; it is not relighting of known geometry.
 */
export const LIGHTING_NOTE = 'Changing the lighting asks the image model for a new candidate. It is not relighting of the same picture: the face, pose and set can change a little.'

export type SourceSize = 'small' | 'medium' | 'large'
export type Contrast = 'low' | 'medium' | 'high'
export type Ambient = 'dark' | 'dim' | 'normal' | 'bright'
export type Exposure = 'under' | 'normal' | 'over'

export interface LightingRecord {
  presetId?: string
  /** Direction the key light comes from, degrees around the subject as the camera sees it: 0 = from the camera, 90 = from the subject's left (frame right), -90 = from frame left, 180 = from behind. */
  keyAzimuth: number
  /** Key light height above the subject: 0 = level, 90 = straight above. */
  keyElevation: number
  sourceSize: SourceSize
  /** Fill or contrast intention: how deep the shadows are meant to be. */
  contrast: Contrast
  rim: boolean
  /** Lamps and windows that are visible in the shot, in words. */
  practicals: string
  ambient: Ambient
  colorTempK: number
  timeOfDay: string
  /** The intended exposure of the picture, as a lighting intention. Not a correction applied afterwards (that is grading). */
  exposure: Exposure
}

/** Every field of a lighting record. Used to prove it holds no grading fields. */
export const LIGHTING_KEYS: ReadonlyArray<keyof LightingRecord> = ['presetId', 'keyAzimuth', 'keyElevation', 'sourceSize', 'contrast', 'rim', 'practicals', 'ambient', 'colorTempK', 'timeOfDay', 'exposure']

export interface LightingPreset { id: string; label: string; purpose: string; record: LightingRecord }

const rec = (r: Partial<LightingRecord> & Pick<LightingRecord, 'keyAzimuth' | 'keyElevation' | 'sourceSize' | 'contrast' | 'colorTempK' | 'timeOfDay'>): LightingRecord => ({ rim: false, practicals: '', ambient: 'normal', exposure: 'normal', ...r })

export const lightingPresets: LightingPreset[] = [
  { id: 'neutral-reference', label: 'Neutral reference', purpose: 'Even, shadow-light reference for identity and costume checks.', record: rec({ presetId: 'neutral-reference', keyAzimuth: 0, keyElevation: 20, sourceSize: 'large', contrast: 'low', colorTempK: 5500, timeOfDay: 'neutral studio', ambient: 'bright' }) },
  { id: 'soft-daylight', label: 'Soft daylight', purpose: 'Open window or shade light, gentle shadows.', record: rec({ presetId: 'soft-daylight', keyAzimuth: -45, keyElevation: 35, sourceSize: 'large', contrast: 'low', colorTempK: 5600, timeOfDay: 'day', ambient: 'bright' }) },
  { id: 'overcast-exterior', label: 'Overcast exterior', purpose: 'Flat grey sky: no hard shadows, muted colour.', record: rec({ presetId: 'overcast-exterior', keyAzimuth: 0, keyElevation: 70, sourceSize: 'large', contrast: 'low', colorTempK: 6500, timeOfDay: 'overcast day', ambient: 'normal' }) },
  { id: 'warm-practical-interior', label: 'Warm practical interior', purpose: 'Lamps and candles in the room are the light; warm pools and falloff.', record: rec({ presetId: 'warm-practical-interior', keyAzimuth: 60, keyElevation: 25, sourceSize: 'small', contrast: 'medium', colorTempK: 2800, timeOfDay: 'evening interior', practicals: 'table lamp and a lit window', ambient: 'dim' }) },
  { id: 'moonlight', label: 'Moonlight', purpose: 'Cool, dim light from above and behind with soft edges.', record: rec({ presetId: 'moonlight', keyAzimuth: 135, keyElevation: 50, sourceSize: 'medium', contrast: 'high', colorTempK: 7500, timeOfDay: 'night', rim: true, ambient: 'dark', exposure: 'under' }) },
  { id: 'backlight-silhouette', label: 'Backlight / silhouette', purpose: 'Light behind the subject so the shape reads and the face does not.', record: rec({ presetId: 'backlight-silhouette', keyAzimuth: 180, keyElevation: 20, sourceSize: 'medium', contrast: 'high', colorTempK: 4500, timeOfDay: 'low sun', rim: true, ambient: 'dim', exposure: 'under' }) },
  { id: 'hard-side-light', label: 'Hard dramatic side light', purpose: 'A small hard source from one side: strong shadow shapes.', record: rec({ presetId: 'hard-side-light', keyAzimuth: 90, keyElevation: 30, sourceSize: 'small', contrast: 'high', colorTempK: 4500, timeOfDay: 'any', ambient: 'dark' }) },
  { id: 'miniature-stage', label: 'Miniature-stage lighting', purpose: 'Small, neat, theatrical lamps over a tiny set, as for a model.', record: rec({ presetId: 'miniature-stage', keyAzimuth: -30, keyElevation: 55, sourceSize: 'small', contrast: 'medium', colorTempK: 3800, timeOfDay: 'stage', practicals: 'small stage lamps', ambient: 'dim' }) },
]
export const lightingPresetById = (id: string) => lightingPresets.find((p) => p.id === id)

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Fills in missing fields and keeps values in range. Never throws. */
export function readLighting(raw: unknown): LightingRecord | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)
  return {
    ...(typeof o.presetId === 'string' ? { presetId: o.presetId } : {}),
    keyAzimuth: typeof o.keyAzimuth === 'number' && Number.isFinite(o.keyAzimuth) ? clamp(Math.round(o.keyAzimuth), -180, 180) : 0,
    keyElevation: typeof o.keyElevation === 'number' && Number.isFinite(o.keyElevation) ? clamp(Math.round(o.keyElevation), 0, 90) : 30,
    sourceSize: pick(o.sourceSize, ['small', 'medium', 'large'], 'medium'),
    contrast: pick(o.contrast, ['low', 'medium', 'high'], 'medium'),
    rim: o.rim === true,
    practicals: typeof o.practicals === 'string' ? o.practicals.slice(0, 200) : '',
    ambient: pick(o.ambient, ['dark', 'dim', 'normal', 'bright'], 'normal'),
    colorTempK: typeof o.colorTempK === 'number' && Number.isFinite(o.colorTempK) ? clamp(Math.round(o.colorTempK), 1500, 12000) : 5500,
    timeOfDay: typeof o.timeOfDay === 'string' ? o.timeOfDay.slice(0, 60) : '',
    exposure: pick(o.exposure, ['under', 'normal', 'over'], 'normal'),
  }
}

/** Direction the shadows fall: opposite the key light. Same convention as keyAzimuth. */
export const shadowAzimuth = (l: LightingRecord): number => { const a = l.keyAzimuth + 180; return a > 180 ? a - 360 : a }

const direction = (az: number): string => {
  const a = Math.abs(az)
  if (a <= 20) return 'from the camera side (flat, frontal)'
  if (a >= 160) return 'from behind the subject'
  const side = az > 0 ? 'frame right' : 'frame left'
  return a < 70 ? `from the front, ${side}` : a <= 110 ? `from the side, ${side}` : `from behind, ${side}`
}
const colour = (k: number): string => (k < 3200 ? 'warm tungsten colour' : k < 4800 ? 'warm white colour' : k <= 6000 ? 'neutral daylight colour' : k <= 7000 ? 'cool overcast colour' : 'cool blue colour')

/** The lighting as words for a prompt. */
export function describeLighting(l: LightingRecord): string {
  const parts = [
    `key light ${direction(l.keyAzimuth)}, ${l.keyElevation < 15 ? 'level with the subject' : l.keyElevation < 50 ? 'a little above' : l.keyElevation < 80 ? 'high above' : 'straight overhead'}`,
    `${l.sourceSize === 'large' ? 'a large soft source' : l.sourceSize === 'small' ? 'a small hard source' : 'a medium source'}`,
    `${l.contrast} contrast, shadows falling ${direction(shadowAzimuth(l)).replace('from ', 'toward ')}`,
    l.rim ? 'a rim or back light separating the subject from the background' : '',
    l.practicals ? `visible practicals: ${l.practicals}` : '',
    `${l.ambient} ambient light`,
    `${colour(l.colorTempK)} (about ${l.colorTempK} K)`,
    l.timeOfDay ? l.timeOfDay : '',
    l.exposure === 'under' ? 'a low-key, darker exposure intention' : l.exposure === 'over' ? 'a bright, high-key exposure intention' : '',
  ].filter(Boolean)
  return parts.join('; ')
}

export interface LightingTestItem { presetId: string; label: string; prompt: string }

/**
 * Prompts for a Character Lighting Test: the same character, costume, pose and framing under each lighting condition, with the neutral reference first so
 * identity can be compared. Each is a separate image request; nothing is sent until the person asks.
 */
export function lightingTestPrompts(subject: string, framing: string, presetIds?: string[]): LightingTestItem[] {
  const chosen = (presetIds ? lightingPresets.filter((p) => presetIds.includes(p.id)) : lightingPresets)
  const ordered = [...chosen].sort((a, b) => (a.id === 'neutral-reference' ? -1 : b.id === 'neutral-reference' ? 1 : 0))
  return ordered.map((p) => ({
    presetId: p.id, label: p.label,
    prompt: `Character lighting test. ${subject}. The same character, the same costume, the same pose and the same framing (${framing}) in every picture of this test; only the lighting changes. Lighting: ${describeLighting(p.record)}. Plain background, no text.`,
  }))
}
