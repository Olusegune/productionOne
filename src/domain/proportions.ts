/**
 * Proportion profiles (schema v1). A profile is the *target* body and face proportions for one character. It is guidance for generated images and a
 * deterministic schematic preview; it is not a measurement of any generated picture. Measurement conventions are in docs/design/proportions.md.
 */

export const PROPORTION_SCHEMA_VERSION = 1

export type ControlId =
  | 'heightInHeads' | 'torsoLength' | 'legLength' | 'legBalance' | 'armLength' | 'armBalance' | 'handSize' | 'footSize'
  | 'shoulderWidth' | 'hipWidth' | 'neckLength' | 'eyeSize' | 'eyeSpacing' | 'noseLength' | 'jawChin' | 'facialElongation' | 'shapeLanguage'

export type ControlGroup = 'body' | 'limbs' | 'face' | 'shape'
export type ControlUnit = 'heads' | 'head widths' | 'head heights' | 'percent' | 'face widths' | 'eye widths' | 'ratio' | 'score'

export interface ControlSpec {
  id: ControlId
  label: string
  group: ControlGroup
  unit: ControlUnit
  min: number
  max: number
  /** The Natural preset's value. */
  default: number
  step: number
  /** What the number is measured against, in words. The same text is in docs/design/proportions.md. */
  measure: string
  /** Shown in the main list; the rest sit under "More controls". */
  main: boolean
  /** Value at 100 stylization (the "fully stylized" target). Absent: stylization does not move this control. */
  stylizedTarget?: number
}

export const controlSpecs: ControlSpec[] = [
  { id: 'heightInHeads', label: 'Head size (height in heads)', group: 'body', unit: 'heads', min: 3, max: 10, default: 7.5, step: 0.1, measure: 'Total height divided by head height (chin to crown). A smaller number means a larger head.', main: true, stylizedTarget: 5 },
  { id: 'torsoLength', label: 'Torso length', group: 'body', unit: 'heads', min: 1.5, max: 4.5, default: 3, step: 0.1, measure: 'Shoulder line to crotch, in head heights.', main: false, stylizedTarget: 1.85 },
  { id: 'legLength', label: 'Leg length', group: 'body', unit: 'heads', min: 1.5, max: 6, default: 3.2, step: 0.1, measure: 'Crotch to floor, in head heights.', main: true, stylizedTarget: 2 },
  { id: 'legBalance', label: 'Upper / lower leg balance', group: 'limbs', unit: 'percent', min: 40, max: 60, default: 50, step: 1, measure: 'Thigh length as a share of the whole leg (hip to ankle). 50 is an even split.', main: false },
  { id: 'armLength', label: 'Arm length', group: 'limbs', unit: 'heads', min: 1.8, max: 4.5, default: 3, step: 0.1, measure: 'Shoulder joint to fingertip, in head heights.', main: true, stylizedTarget: 2.2 },
  { id: 'armBalance', label: 'Upper / lower arm balance', group: 'limbs', unit: 'percent', min: 40, max: 60, default: 52, step: 1, measure: 'Upper arm as a share of shoulder-to-wrist length.', main: false },
  { id: 'handSize', label: 'Hand size', group: 'limbs', unit: 'head heights', min: 0.4, max: 1.3, default: 0.75, step: 0.05, measure: 'Wrist to middle fingertip, as a fraction of head height.', main: false, stylizedTarget: 0.95 },
  { id: 'footSize', label: 'Foot size', group: 'limbs', unit: 'head heights', min: 0.5, max: 1.6, default: 1, step: 0.05, measure: 'Heel to toe, as a fraction of head height.', main: false, stylizedTarget: 1.2 },
  { id: 'shoulderWidth', label: 'Shoulder width', group: 'body', unit: 'head widths', min: 1.2, max: 4, default: 2.6, step: 0.1, measure: 'Shoulder to shoulder, in head widths (face width at the cheekbones).', main: true },
  { id: 'hipWidth', label: 'Hip width', group: 'body', unit: 'head widths', min: 1.2, max: 3.8, default: 2, step: 0.1, measure: 'Widest point of the hips, in head widths.', main: false },
  { id: 'neckLength', label: 'Neck length', group: 'body', unit: 'heads', min: 0.05, max: 0.9, default: 0.3, step: 0.05, measure: 'Chin to shoulder line, in head heights.', main: false, stylizedTarget: 0.15 },
  { id: 'eyeSize', label: 'Eye size', group: 'face', unit: 'face widths', min: 0.1, max: 0.4, default: 0.2, step: 0.01, measure: 'Width of one eye as a fraction of face width.', main: true, stylizedTarget: 0.3 },
  { id: 'eyeSpacing', label: 'Eye spacing', group: 'face', unit: 'eye widths', min: 0.5, max: 2.2, default: 1, step: 0.05, measure: 'Gap between the inner corners of the eyes, in eye widths.', main: false },
  { id: 'noseLength', label: 'Nose length', group: 'face', unit: 'head heights', min: 0.1, max: 0.4, default: 0.25, step: 0.01, measure: 'Brow line to base of the nose, as a fraction of head height.', main: false },
  { id: 'jawChin', label: 'Jaw and chin', group: 'face', unit: 'ratio', min: 0.5, max: 1, default: 0.75, step: 0.01, measure: 'Jaw width at the mouth line divided by face width at the cheekbones. Lower is a narrower, more pointed chin.', main: false, stylizedTarget: 0.62 },
  { id: 'facialElongation', label: 'Facial elongation', group: 'face', unit: 'ratio', min: 1, max: 1.9, default: 1.35, step: 0.01, measure: 'Face height (crown to chin) divided by face width. Higher is a longer face.', main: false, stylizedTarget: 1.2 },
  { id: 'shapeLanguage', label: 'Rounded to angular', group: 'shape', unit: 'score', min: -100, max: 100, default: 0, step: 5, measure: 'A style score for the shapes of the body and face: -100 fully rounded, 0 neutral, 100 fully angular.', main: true },
]

export const specFor = (id: ControlId): ControlSpec => controlSpecs.find((c) => c.id === id) as ControlSpec
export const controlIds: ControlId[] = controlSpecs.map((c) => c.id)

export type PresetId = 'natural' | 'elongated' | 'compact' | 'large-headed' | 'long-limbed' | 'angular' | 'rounded' | 'custom'

export interface PresetSpec { id: PresetId; label: string; stylization: number; values: Partial<Record<ControlId, number>>; note: string }

/** Starting points, not rules. Each lists only what differs from Natural. */
export const presets: PresetSpec[] = [
  { id: 'natural', label: 'Natural', stylization: 0, values: {}, note: 'Typical adult human proportions, about 7.5 heads tall.' },
  { id: 'elongated', label: 'Elongated', stylization: 20, values: { heightInHeads: 8.7, legLength: 4.3, neckLength: 0.4, armLength: 3.5, facialElongation: 1.5, shoulderWidth: 2.3, hipWidth: 1.8 }, note: 'Tall and slender, a fashion-illustration figure.' },
  { id: 'compact', label: 'Compact', stylization: 25, values: { heightInHeads: 6.25, torsoLength: 2.6, legLength: 2.5, armLength: 2.6, neckLength: 0.15, shoulderWidth: 2.8, hipWidth: 2.2 }, note: 'Short and sturdy.' },
  { id: 'large-headed', label: 'Large-headed', stylization: 60, values: { heightInHeads: 4.9, torsoLength: 1.9, legLength: 1.9, armLength: 2.2, neckLength: 0.1, eyeSize: 0.28, handSize: 0.9, footSize: 1.15 }, note: 'A big head on a small body, common in cartoons and chibi-like designs.' },
  { id: 'long-limbed', label: 'Long-limbed', stylization: 30, values: { heightInHeads: 8.5, legLength: 4.1, armLength: 3.8, handSize: 0.9, footSize: 1.2, neckLength: 0.4 }, note: 'Normal head and torso with extended arms and legs.' },
  { id: 'angular', label: 'Angular', stylization: 40, values: { shapeLanguage: 75, jawChin: 0.6, facialElongation: 1.5, shoulderWidth: 3, hipWidth: 1.7 }, note: 'Sharp planes, strong shoulders, a pointed chin.' },
  { id: 'rounded', label: 'Rounded', stylization: 40, values: { shapeLanguage: -75, jawChin: 0.9, facialElongation: 1.15, shoulderWidth: 2.4, hipWidth: 2.4, eyeSize: 0.24 }, note: 'Soft curves, a round face, full hips.' },
  { id: 'custom', label: 'Custom', stylization: 0, values: {}, note: 'Starts from Natural; set every control yourself.' },
]

export const presetFor = (id: PresetId): PresetSpec => presets.find((p) => p.id === id) as PresetSpec

export interface ControlValue { value: number; unit: ControlUnit; source: 'default' | 'override' }
export interface ProportionException { control: ControlId; note: string }

export interface ProportionProfile {
  id: string
  schemaVersion: typeof PROPORTION_SCHEMA_VERSION
  preset: PresetId
  /** 0 (natural) to 100 (fully stylized). Moves the controls that have a stylized target, except those you have overridden. */
  stylization: number
  controls: Record<ControlId, ControlValue>
  /** Deliberate departures for this character. A warning for one of these is not shown, and no check treats it as an error. */
  exceptions: ProportionException[]
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits

/** The value a control takes from a preset and a stylization amount, before any override. */
export function derivedValue(id: ControlId, preset: PresetId, stylization: number): number {
  const spec = specFor(id)
  const base = presetFor(preset).values[id] ?? spec.default
  if (spec.stylizedTarget === undefined) return base
  return round(clamp(base + (spec.stylizedTarget - base) * (clamp(stylization, 0, 100) / 100), spec.min, spec.max))
}

/** A profile with every control derived (no overrides). `id` should be stable for the character (use the asset id). */
export function createProfile(id: string, preset: PresetId = 'natural', stylization?: number): ProportionProfile {
  const s = clamp(stylization ?? presetFor(preset).stylization, 0, 100)
  const controls = {} as Record<ControlId, ControlValue>
  for (const spec of controlSpecs) controls[spec.id] = { value: derivedValue(spec.id, preset, s), unit: spec.unit, source: 'default' }
  return { id, schemaVersion: PROPORTION_SCHEMA_VERSION, preset, stylization: s, controls, exceptions: [] }
}

/** Recomputes every control that is not an override from the preset and stylization. */
function rederive(p: ProportionProfile): ProportionProfile {
  const controls = { ...p.controls }
  for (const spec of controlSpecs) if (controls[spec.id].source === 'default') controls[spec.id] = { value: derivedValue(spec.id, p.preset, p.stylization), unit: spec.unit, source: 'default' }
  return { ...p, controls }
}

/** Choosing a preset keeps your overrides; the other controls take the preset's values. Choosing a preset also sets its usual stylization. */
export function setPreset(p: ProportionProfile, preset: PresetId): ProportionProfile {
  return rederive({ ...p, preset, stylization: presetFor(preset).stylization })
}

export function setStylization(p: ProportionProfile, stylization: number): ProportionProfile {
  return rederive({ ...p, stylization: clamp(Math.round(stylization), 0, 100) })
}

export function setControl(p: ProportionProfile, id: ControlId, value: number): ProportionProfile {
  const spec = specFor(id)
  if (!Number.isFinite(value)) return p
  return { ...p, controls: { ...p.controls, [id]: { value: round(clamp(value, spec.min, spec.max)), unit: spec.unit, source: 'override' } } }
}

export function resetControl(p: ProportionProfile, id: ControlId): ProportionProfile {
  return { ...p, controls: { ...p.controls, [id]: { value: derivedValue(id, p.preset, p.stylization), unit: specFor(id).unit, source: 'default' } } }
}

/** Back to the chosen preset and its stylization: every override and exception is removed. */
export function resetProfile(p: ProportionProfile): ProportionProfile {
  return createProfile(p.id, p.preset)
}

export function addException(p: ProportionProfile, control: ControlId, note: string): ProportionProfile {
  const rest = p.exceptions.filter((e) => e.control !== control)
  return { ...p, exceptions: [...rest, { control, note: note.trim().slice(0, 300) }] }
}
export const removeException = (p: ProportionProfile, control: ControlId): ProportionProfile => ({ ...p, exceptions: p.exceptions.filter((e) => e.control !== control) })

export const overrideCount = (p: ProportionProfile) => controlIds.filter((id) => p.controls[id].source === 'override').length
export const valueOf = (p: ProportionProfile, id: ControlId) => p.controls[id].value

// ---------------------------------------------------------------- ratios

export interface Ratios {
  /** Neck + torso + legs + one head, in head heights. Compared with the height control by the warnings. */
  stackedHeight: number
  armSpanInHeads: number
  legToTorso: number
  /** Fingertip reach relative to the legs: below 1 the fingertips stay above the knee. */
  fingertipDrop: number
  shoulderToHip: number
  /** Face height ÷ face width, from the elongation control. */
  faceRatio: number
  /** Width of both eyes plus the gap between them, as a fraction of face width. */
  eyesAcrossFace: number
}

export function ratios(p: ProportionProfile): Ratios {
  const v = (id: ControlId) => p.controls[id].value
  const stackedHeight = 1 + v('neckLength') + v('torsoLength') + v('legLength')
  const eyesAcrossFace = 2 * v('eyeSize') + v('eyeSpacing') * v('eyeSize')
  return {
    stackedHeight: round(stackedHeight),
    armSpanInHeads: round(v('armLength') * 2 + v('shoulderWidth') * 0.65),
    legToTorso: round(v('legLength') / v('torsoLength')),
    fingertipDrop: round((v('armLength') - v('neckLength') - 0.0) / (v('torsoLength') + v('legLength') * 0.5)),
    shoulderToHip: round(v('shoulderWidth') / v('hipWidth')),
    faceRatio: round(v('facialElongation')),
    eyesAcrossFace: round(eyesAcrossFace),
  }
}

// ---------------------------------------------------------------- warnings

export interface ProportionWarning { id: string; controls: ControlId[]; level: 'extreme' | 'conflict'; message: string }

const EDGE = 0.05

/** Warns about extreme or conflicting settings. It never blocks: a deliberate departure can be recorded as an exception, which hides that warning. */
export function warnings(p: ProportionProfile): ProportionWarning[] {
  const out: ProportionWarning[] = []
  const excused = new Set(p.exceptions.map((e) => e.control))
  for (const spec of controlSpecs) {
    const v = p.controls[spec.id].value
    const span = spec.max - spec.min
    if (v <= spec.min + span * EDGE || v >= spec.max - span * EDGE) out.push({ id: `extreme-${spec.id}`, controls: [spec.id], level: 'extreme', message: `${spec.label} is at the very ${v <= spec.min + span * EDGE ? 'low' : 'high'} end (${v} ${spec.unit}). Generated pictures may not hold it.` })
  }
  const r = ratios(p)
  const v = (id: ControlId) => p.controls[id].value
  if (Math.abs(r.stackedHeight - v('heightInHeads')) > 0.75) out.push({ id: 'conflict-height', controls: ['heightInHeads', 'torsoLength', 'legLength', 'neckLength'], level: 'conflict', message: `Head, neck, torso and legs add up to ${r.stackedHeight} heads, but the height is set to ${v('heightInHeads')}. Adjust one of them.` })
  if (r.eyesAcrossFace > 0.95) out.push({ id: 'conflict-eyes', controls: ['eyeSize', 'eyeSpacing'], level: 'conflict', message: `Two eyes of this size with this spacing take up ${Math.round(r.eyesAcrossFace * 100)}% of the face width; they will not fit.` })
  if (r.fingertipDrop < 0.55) out.push({ id: 'conflict-reach', controls: ['armLength', 'torsoLength', 'legLength'], level: 'conflict', message: 'The arms are short for this torso and legs: the hands will sit near the hips and may be hard to pose.' })
  if (v('handSize') > 1 && v('armLength') < 2.1) out.push({ id: 'conflict-hands', controls: ['handSize', 'armLength'], level: 'conflict', message: 'Large hands on short arms often look pasted on; check the hands in the generated views.' })
  if (v('shapeLanguage') > 60 && v('jawChin') > 0.9) out.push({ id: 'conflict-shape', controls: ['shapeLanguage', 'jawChin'], level: 'conflict', message: 'An angular shape language with a very wide, soft jaw pulls two ways.' })
  return out.filter((w) => !w.controls.every((c) => excused.has(c)))
}

// ---------------------------------------------------------------- history (undo / redo)

export interface History<T> { past: T[]; present: T; future: T[] }
export const HISTORY_LIMIT = 100
export const newHistory = <T,>(present: T): History<T> => ({ past: [], present, future: [] })
export function commit<T>(h: History<T>, next: T): History<T> {
  if (Object.is(next, h.present)) return h
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] }
}
export function undo<T>(h: History<T>): History<T> { const prev = h.past[h.past.length - 1]; return h.past.length ? { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] } : h }
export function redo<T>(h: History<T>): History<T> { const [next, ...rest] = h.future; return h.future.length ? { past: [...h.past, h.present], present: next, future: rest } : h }

// ---------------------------------------------------------------- reading saved data

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isPreset = (v: unknown): v is PresetId => presets.some((p) => p.id === v)
const isControl = (v: unknown): v is ControlId => controlIds.includes(v as ControlId)

/** Reads one saved profile of any earlier shape. Missing or invalid fields take the documented defaults; values are clamped to their range. Never throws. */
export function readProfile(raw: unknown, id: string): ProportionProfile {
  if (!isObject(raw)) return createProfile(id)
  const preset = isPreset(raw.preset) ? raw.preset : 'natural'
  const stylization = typeof raw.stylization === 'number' && Number.isFinite(raw.stylization) ? clamp(raw.stylization, 0, 100) : presetFor(preset).stylization
  let p = createProfile(typeof raw.id === 'string' && raw.id ? raw.id : id, preset, stylization)
  if (isObject(raw.controls)) {
    for (const cid of controlIds) {
      const c = raw.controls[cid]
      if (isObject(c) && c.source === 'override' && typeof c.value === 'number') p = setControl(p, cid, c.value)
    }
  }
  if (Array.isArray(raw.exceptions)) for (const e of raw.exceptions) if (isObject(e) && isControl(e.control)) p = addException(p, e.control, typeof e.note === 'string' ? e.note : '')
  return p
}

/** Reads the whole saved map (asset id to profile). A project saved before profiles existed has none, and gets none. */
export function readProfiles(raw: unknown): Record<string, ProportionProfile> {
  if (!isObject(raw)) return {}
  const out: Record<string, ProportionProfile> = {}
  for (const [assetId, value] of Object.entries(raw)) out[assetId] = readProfile(value, assetId)
  return out
}

// ---------------------------------------------------------------- schematic preview

export interface SchematicShape { id: string; kind: 'ellipse' | 'rect' | 'line'; x: number; y: number; w?: number; h?: number; x2?: number; y2?: number; label?: string }
export interface Schematic { width: number; height: number; unitPx: number; shapes: SchematicShape[] }

/**
 * A deterministic front-view mannequin drawn only from the profile: same profile, same shapes. One head height is `unitPx` pixels. It is a diagram of
 * the target proportions, not a picture of the character.
 */
export function schematic(p: ProportionProfile): Schematic {
  const v = (id: ControlId) => p.controls[id].value
  const u = 36
  const headH = u
  const headW = headH / v('facialElongation')
  const cx = 150
  const top = 14
  const neckH = v('neckLength') * u
  const torsoH = v('torsoLength') * u
  const legH = v('legLength') * u
  const shoulderW = v('shoulderWidth') * headW
  const hipW = v('hipWidth') * headW
  const armLen = v('armLength') * u
  const upperArm = armLen * (v('armBalance') / 100) * 0.85
  const foreArm = armLen * 0.85 - upperArm
  const handLen = armLen * 0.15
  const thigh = legH * (v('legBalance') / 100)
  const shoulderY = top + headH + neckH
  const hipY = shoulderY + torsoH
  const floorY = hipY + legH
  const eyeW = v('eyeSize') * headW
  const eyeGap = v('eyeSpacing') * eyeW
  const eyeY = top + headH * 0.5
  const footL = v('footSize') * u
  const shapes: SchematicShape[] = [
    { id: 'head', kind: 'ellipse', x: cx - headW / 2, y: top, w: headW, h: headH, label: 'head' },
    { id: 'eye-l', kind: 'ellipse', x: cx - eyeGap / 2 - eyeW, y: eyeY, w: eyeW, h: eyeW * 0.5 },
    { id: 'eye-r', kind: 'ellipse', x: cx + eyeGap / 2, y: eyeY, w: eyeW, h: eyeW * 0.5 },
    { id: 'neck', kind: 'rect', x: cx - headW * 0.15, y: top + headH, w: headW * 0.3, h: neckH },
    { id: 'torso', kind: 'rect', x: cx - shoulderW / 2, y: shoulderY, w: shoulderW, h: torsoH, label: 'torso' },
    { id: 'hips', kind: 'rect', x: cx - hipW / 2, y: hipY - torsoH * 0.18, w: hipW, h: torsoH * 0.18 },
    { id: 'arm-l-upper', kind: 'line', x: cx - shoulderW / 2, y: shoulderY, x2: cx - shoulderW / 2 - 4, y2: shoulderY + upperArm },
    { id: 'arm-l-fore', kind: 'line', x: cx - shoulderW / 2 - 4, y: shoulderY + upperArm, x2: cx - shoulderW / 2 - 6, y2: shoulderY + upperArm + foreArm },
    { id: 'hand-l', kind: 'line', x: cx - shoulderW / 2 - 6, y: shoulderY + upperArm + foreArm, x2: cx - shoulderW / 2 - 6, y2: shoulderY + upperArm + foreArm + handLen },
    { id: 'arm-r-upper', kind: 'line', x: cx + shoulderW / 2, y: shoulderY, x2: cx + shoulderW / 2 + 4, y2: shoulderY + upperArm },
    { id: 'arm-r-fore', kind: 'line', x: cx + shoulderW / 2 + 4, y: shoulderY + upperArm, x2: cx + shoulderW / 2 + 6, y2: shoulderY + upperArm + foreArm },
    { id: 'hand-r', kind: 'line', x: cx + shoulderW / 2 + 6, y: shoulderY + upperArm + foreArm, x2: cx + shoulderW / 2 + 6, y2: shoulderY + upperArm + foreArm + handLen },
    { id: 'leg-l-upper', kind: 'line', x: cx - hipW / 4, y: hipY, x2: cx - hipW / 4, y2: hipY + thigh },
    { id: 'leg-l-lower', kind: 'line', x: cx - hipW / 4, y: hipY + thigh, x2: cx - hipW / 4, y2: floorY },
    { id: 'foot-l', kind: 'line', x: cx - hipW / 4, y: floorY, x2: cx - hipW / 4 - footL, y2: floorY },
    { id: 'leg-r-upper', kind: 'line', x: cx + hipW / 4, y: hipY, x2: cx + hipW / 4, y2: hipY + thigh },
    { id: 'leg-r-lower', kind: 'line', x: cx + hipW / 4, y: hipY + thigh, x2: cx + hipW / 4, y2: floorY },
    { id: 'foot-r', kind: 'line', x: cx + hipW / 4, y: floorY, x2: cx + hipW / 4 + footL, y2: floorY },
    { id: 'floor', kind: 'line', x: 20, y: floorY, x2: 280, y2: floorY },
  ]
  const r = (n: number) => round(n, 2)
  return { width: 300, height: r(floorY + 20), unitPx: u, shapes: shapes.map((s) => ({ ...s, x: r(s.x), y: r(s.y), w: s.w === undefined ? undefined : r(s.w), h: s.h === undefined ? undefined : r(s.h), x2: s.x2 === undefined ? undefined : r(s.x2), y2: s.y2 === undefined ? undefined : r(s.y2) })) }
}

// ---------------------------------------------------------------- words for prompts

/**
 * The proportions as words, only where they differ from Natural, so a character without a profile (or with Natural) adds nothing to a prompt.
 * Image models follow words better than numbers; the numbers are given once for the models that can use them.
 */
export function describe(p: ProportionProfile | undefined): string {
  if (!p) return ''
  const v = (id: ControlId) => p.controls[id].value
  const parts: string[] = []
  const d = (id: ControlId) => v(id) - specFor(id).default
  if (v('heightInHeads') < 7) parts.push(`${v('heightInHeads') <= 5 ? 'a large head on a small body' : 'a compact build'} (about ${v('heightInHeads')} heads tall)`)
  else if (v('heightInHeads') > 8.2) parts.push(`a tall, slender build (about ${v('heightInHeads')} heads tall)`)
  if (d('legLength') > 0.6) parts.push('long legs'); else if (d('legLength') < -0.6) parts.push('short legs')
  if (d('armLength') > 0.4) parts.push('long arms'); else if (d('armLength') < -0.4) parts.push('short arms')
  if (d('handSize') > 0.15) parts.push('large hands'); else if (d('handSize') < -0.15) parts.push('small hands')
  if (d('footSize') > 0.15) parts.push('large feet'); else if (d('footSize') < -0.15) parts.push('small feet')
  if (d('shoulderWidth') > 0.3) parts.push('broad shoulders'); else if (d('shoulderWidth') < -0.3) parts.push('narrow shoulders')
  if (d('hipWidth') > 0.3) parts.push('wide hips'); else if (d('hipWidth') < -0.3) parts.push('narrow hips')
  if (d('neckLength') > 0.15) parts.push('a long neck'); else if (d('neckLength') < -0.15) parts.push('a very short neck')
  if (d('eyeSize') > 0.03) parts.push('large eyes'); else if (d('eyeSize') < -0.03) parts.push('small eyes')
  if (d('eyeSpacing') > 0.25) parts.push('wide-set eyes'); else if (d('eyeSpacing') < -0.25) parts.push('close-set eyes')
  if (d('noseLength') > 0.04) parts.push('a long nose'); else if (d('noseLength') < -0.04) parts.push('a short nose')
  if (d('jawChin') < -0.08) parts.push('a narrow, pointed chin'); else if (d('jawChin') > 0.08) parts.push('a broad jaw')
  if (d('facialElongation') > 0.12) parts.push('a long face'); else if (d('facialElongation') < -0.12) parts.push('a short, round face')
  if (v('shapeLanguage') >= 40) parts.push('angular, sharp-edged shapes'); else if (v('shapeLanguage') <= -40) parts.push('soft, rounded shapes')
  if (!parts.length) return ''
  return `Body and face proportions (target, keep the same in every view): ${parts.join(', ')}.`
}
