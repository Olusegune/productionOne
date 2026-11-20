import { applyLut, packLut, unpackLut, type Lut, type StoredLut } from './lut'
export { contentHash } from './hash'

/**
 * Non-destructive grading. A grade is METADATA applied over an original picture; it is never baked into the original, and grading again never compounds
 * (every render starts from the original). The data model keeps apart: lighting instructions (what light was asked for, see lighting.ts), exposure and white
 * balance (technical), tone (contrast and saturation), and the creative grade (tints). A LUT does not move lights or rebuild shadows, and LUT import is not
 * implemented: no LUT file is read, applied or exported.
 */
export interface TechnicalGrade { /** Exposure change in stops, -3 to 3. */ exposureEv: number; /** Cool (-100) to warm (100). */ temperature: number; /** Green (-100) to magenta (100). */ tint: number }
export interface ToneGrade { /** -100 to 100. 0 leaves the picture alone. */ contrast: number; /** -100 (grey) to 100 (very vivid). */ saturation: number }
export interface CreativeGrade { /** A tint pushed into the shadows, as #rrggbb, or empty for none. */ shadowTint: string; highlightTint: string; /** How strongly the tints apply, 0 to 100. */ tintAmount: number }

/** A LUT applied after the grade. The table itself is kept once in the look state (`luts`); the grade only names it. */
export interface LutUse { id: string; /** 0 to 100: how much of the LUT's effect is used. */ strength: number; /** The person says a LUT that looks like a log or HDR one is meant for this picture. */ acknowledgeLog?: boolean }
export interface Grade { technical: TechnicalGrade; tone: ToneGrade; creative: CreativeGrade; lut?: LutUse }
/** How the grade finds the table for a LUT id. */
export type LutLookup = (id: string) => Lut | undefined

export const neutralGrade = (): Grade => ({ technical: { exposureEv: 0, temperature: 0, tint: 0 }, tone: { contrast: 0, saturation: 0 }, creative: { shadowTint: '', highlightTint: '', tintAmount: 0 } })

export interface Look { id: string; name: string; grade: Grade; note?: string }

export interface LookState {
  looks: Look[]
  /** The look for the whole project, or none. */
  projectLook?: string
  /** Look per scene id and per shot id. A shot look beats a scene look, which beats the project look. */
  sceneLooks: Record<string, string>
  shotLooks: Record<string, string>
  /** LUT tables used by the looks, by id. Each is kept once. */
  luts?: Record<string, StoredLut>
}
export const emptyLooks = (): LookState => ({ looks: [], sceneLooks: {}, shotLooks: {} })

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const HEX = /^#[0-9a-fA-F]{6}$/

export function normalizeGrade(g: Partial<Grade> | undefined): Grade {
  const n = neutralGrade()
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d)
  return {
    technical: { exposureEv: num(g?.technical?.exposureEv, -3, 3, 0), temperature: num(g?.technical?.temperature, -100, 100, 0), tint: num(g?.technical?.tint, -100, 100, 0) },
    tone: { contrast: num(g?.tone?.contrast, -100, 100, 0), saturation: num(g?.tone?.saturation, -100, 100, 0) },
    creative: {
      shadowTint: typeof g?.creative?.shadowTint === 'string' && HEX.test(g.creative.shadowTint) ? g.creative.shadowTint.toLowerCase() : n.creative.shadowTint,
      highlightTint: typeof g?.creative?.highlightTint === 'string' && HEX.test(g.creative.highlightTint) ? g.creative.highlightTint.toLowerCase() : n.creative.highlightTint,
      tintAmount: num(g?.creative?.tintAmount, 0, 100, 0),
    },
    ...(typeof g?.lut?.id === 'string' && g.lut.id && g.lut.id.length <= 60 ? { lut: { id: g.lut.id, strength: num(g.lut.strength, 0, 100, 100), ...(g.lut.acknowledgeLog === true ? { acknowledgeLog: true } : {}) } } : {}),
  }
}

export const isNeutral = (g: Grade): boolean => { const n = normalizeGrade(g); return JSON.stringify({ ...n, lut: undefined }) === JSON.stringify(neutralGrade()) && !(n.lut && n.lut.strength > 0) }

// ----------------------------------------------------------------- the transform

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]

/**
 * Grades one sRGB pixel (0 to 255 per channel). Order: exposure and white balance in linear light, then contrast, saturation and the creative tints in sRGB.
 * `strength` (0 to 100) blends the result with the original pixel: 0 returns the original exactly, 100 the full grade. Out-of-range results are clamped.
 */
export function gradePixel(rgb: readonly [number, number, number], grade: Grade, strength = 100, luts?: LutLookup): [number, number, number] {
  const g = normalizeGrade(grade)
  const s = clamp(strength, 0, 100) / 100
  if (s === 0 || isNeutral(g)) return [rgb[0], rgb[1], rgb[2]]
  let [r, gg, b] = rgb.map((v) => toLinear(clamp(v, 0, 255) / 255)) as [number, number, number]
  const gain = 2 ** g.technical.exposureEv
  const t = g.technical.temperature / 100
  const tint = g.technical.tint / 100
  r *= gain * (1 + 0.25 * t); b *= gain * (1 - 0.25 * t); gg *= gain * (1 - 0.15 * tint)
  r *= 1 + 0.08 * tint; b *= 1 + 0.08 * tint
  let out = [toSrgb(clamp(r, 0, 1)), toSrgb(clamp(gg, 0, 1)), toSrgb(clamp(b, 0, 1))]
  const c = 1 + g.tone.contrast / 100
  out = out.map((v) => clamp((v - 0.5) * c + 0.5, 0, 1))
  const l = luma(out[0], out[1], out[2])
  const sat = 1 + g.tone.saturation / 100
  out = out.map((v) => clamp(l + (v - l) * sat, 0, 1))
  if (g.creative.tintAmount > 0 && (g.creative.shadowTint || g.creative.highlightTint)) {
    const amt = g.creative.tintAmount / 100
    const ll = luma(out[0], out[1], out[2])
    const sh = g.creative.shadowTint ? hexRgb(g.creative.shadowTint) : null
    const hi = g.creative.highlightTint ? hexRgb(g.creative.highlightTint) : null
    out = out.map((v, i) => {
      let x = v
      if (sh) x += (sh[i] - 0.5) * 0.3 * amt * (1 - ll) * (1 - ll)
      if (hi) x += (hi[i] - 0.5) * 0.3 * amt * ll * ll
      return clamp(x, 0, 1)
    })
  }
  // The LUT comes last, on the graded colour. A LUT that looks like a log or HDR one is not applied unless the person said it is meant for this picture.
  const lut = g.lut && luts ? luts(g.lut.id) : undefined
  if (lut && g.lut && (!lut.suspectedLog || g.lut.acknowledgeLog)) {
    const l = applyLut(lut, out[0], out[1], out[2])
    const k = g.lut.strength / 100
    out = out.map((v, i) => v + (l[i] - v) * k)
  }
  const graded = out.map((v) => v * 255)
  return [0, 1, 2].map((i) => Math.round(clamp(rgb[i] + (graded[i] - rgb[i]) * s, 0, 255))) as [number, number, number]
}

/** Grades RGBA bytes into a NEW array. The input (the original) is never changed. Alpha is kept. */
export function gradeBytes(original: Uint8ClampedArray | Uint8Array, grade: Grade, strength = 100, luts?: LutLookup): Uint8ClampedArray {
  const out = new Uint8ClampedArray(original.length)
  const g = normalizeGrade(grade)
  const cache = new Map<number, [number, number, number]>()
  for (let i = 0; i + 3 < original.length; i += 4) {
    const key = (original[i] << 16) | (original[i + 1] << 8) | original[i + 2]
    let px = cache.get(key)
    if (!px) { px = gradePixel([original[i], original[i + 1], original[i + 2]], g, strength, luts); if (cache.size < 70000) cache.set(key, px) }
    out[i] = px[0]; out[i + 1] = px[1]; out[i + 2] = px[2]; out[i + 3] = original[i + 3]
  }
  return out
}

// ----------------------------------------------------------------- looks, scenes and shots

export type LookSource = 'shot' | 'scene' | 'project' | 'none'

/** Which look applies to a shot: its own, else its scene's, else the project's. */
export function effectiveLook(state: LookState, sceneId: string, shotId: string): { look: Look | undefined; source: LookSource } {
  const find = (id: string | undefined) => state.looks.find((l) => l.id === id)
  const shot = find(state.shotLooks[shotId])
  if (shot) return { look: shot, source: 'shot' }
  const scene = find(state.sceneLooks[sceneId])
  if (scene) return { look: scene, source: 'scene' }
  const project = find(state.projectLook)
  return project ? { look: project, source: 'project' } : { look: undefined, source: 'none' }
}

export function addLook(state: LookState, name: string, grade: Grade = neutralGrade()): { state: LookState; look: Look } {
  const base = name.trim().slice(0, 60) || 'Untitled look'
  const taken = new Set(state.looks.map((l) => l.name.toLowerCase()))
  let nameFree = base, n = 2
  while (taken.has(nameFree.toLowerCase())) nameFree = `${base} ${n++}`
  const id = `LOOK-${String(state.looks.length + 1).padStart(3, '0')}`
  const look: Look = { id, name: nameFree, grade: normalizeGrade(grade) }
  return { state: { ...state, looks: [...state.looks, look] }, look }
}

export const updateLook = (state: LookState, id: string, patch: Partial<Pick<Look, 'name' | 'grade' | 'note'>>): LookState => ({ ...state, looks: state.looks.map((l) => (l.id === id ? { ...l, ...patch, grade: patch.grade ? normalizeGrade(patch.grade) : l.grade } : l)) })

/** Removing a look removes where it was used; no picture is touched (grades are never baked into pictures). */
export function removeLook(state: LookState, id: string): LookState {
  const strip = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== id))
  return dropUnusedLuts({ ...state, looks: state.looks.filter((l) => l.id !== id), projectLook: state.projectLook === id ? undefined : state.projectLook, sceneLooks: strip(state.sceneLooks), shotLooks: strip(state.shotLooks) })
}

/** A swatch strip for the colour script: the grade applied to black, three greys and white, plus a skin-like and a sky-like colour. */
export function swatches(grade: Grade): string[] {
  const probes: Array<[number, number, number]> = [[20, 20, 20], [90, 90, 90], [150, 150, 150], [235, 235, 235], [198, 134, 108], [110, 150, 200]]
  return probes.map((p) => { const [r, g, b] = gradePixel(p, grade); return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}` })
}

export interface ColourScriptRow { sceneId: string; heading: string; look: string; source: LookSource; swatches: string[]; shots: number; overrides: number }

/** One row per scene, in order: which look it ends up with and the colours it gives. */
export function colourScript(state: LookState, scenes: Array<{ id: string; heading: string }>, shots: Array<{ id: string; sceneId: string }>): ColourScriptRow[] {
  return scenes.map((s) => {
    const mine = shots.filter((x) => x.sceneId === s.id)
    const base = effectiveLook(state, s.id, '')
    return { sceneId: s.id, heading: s.heading, look: base.look?.name ?? 'No look (original colours)', source: base.source, swatches: swatches(base.look?.grade ?? neutralGrade()), shots: mine.length, overrides: mine.filter((x) => state.shotLooks[x.id]).length }
  })
}

// ----------------------------------------------------------------- QA and export

/** Technical QA is always run on the ungraded original. A graded copy is never an input to a check. */
export const qaInput = (original: string, _graded?: string): string => original

export const LOOKS_FORMAT = 'production-one-looks'

/**
 * Look metadata for export: the grades and where they apply. It is metadata only: no picture is baked, and no LUT file is exported (a LUT is not implemented, and
 * a colour description in words is not a LUT).
 */
/** The name a LUT is exported under (no folders, no odd characters). */
export const lutFileName = (id: string, title: string): string => `Looks/${(title.split(/[\\/]/).pop()!.replace(/[^A-Za-z0-9._ -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || id)} (${id}).cube`

const MAX_LUTS = 8
const MAX_LUT_B64 = 3_000_000

/** Adds a parsed LUT to the looks (kept once: the same table is recognised by its hash). Refuses past a small limit so the project file stays light. */
export function addLut(state: LookState, lut: Lut): { ok: true; state: LookState; id: string } | { ok: false; error: string } {
  const id = `LUT-${lut.hash.slice(0, 8)}`
  const luts = state.luts ?? {}
  if (luts[id]) return { ok: true, state, id }
  if (Object.keys(luts).length >= MAX_LUTS) return { ok: false, error: `A project can hold ${MAX_LUTS} LUTs. Remove one you no longer use first.` }
  const packed = packLut(lut)
  const total = Object.values(luts).reduce((n, l) => n + l.dataB64.length, 0) + packed.dataB64.length
  if (total > MAX_LUT_B64) return { ok: false, error: 'The LUTs in this project would be too large to keep in the project file. Use a smaller LUT size (33 is plenty) or remove one.' }
  return { ok: true, state: { ...state, luts: { ...luts, [id]: packed } }, id }
}

/** A lookup for the grade: unpacks each table once. */
export function lutLookup(state: LookState): LutLookup {
  const cache = new Map<string, Lut | undefined>()
  return (id) => { if (!cache.has(id)) cache.set(id, state.luts?.[id] ? unpackLut(state.luts[id]) : undefined); return cache.get(id) }
}

/** Removes tables that no look uses any more. */
export function dropUnusedLuts(state: LookState): LookState {
  const used = new Set(state.looks.map((l) => l.grade.lut?.id).filter(Boolean) as string[])
  const luts = Object.fromEntries(Object.entries(state.luts ?? {}).filter(([id]) => used.has(id)))
  const { luts: _old, ...rest } = state
  return Object.keys(luts).length ? { ...rest, luts } : rest
}

export function exportLooks(state: LookState, outputs: Array<{ id: string; path: string; hash?: string }> = []) {
  return {
    format: LOOKS_FORMAT, version: 1, bakedIntoOriginals: false,
    note: 'Grades are applied over the original pictures and are never baked into them. A grade or a LUT does not move lights or rebuild shadows. Each LUT is listed with the file it is exported as.',
    luts: Object.entries(state.luts ?? {}).map(([id, l]) => ({ id, title: l.title, kind: l.kind, size: l.size, hash: l.hash, file: lutFileName(id, l.title), inputSpace: 'display-referred sRGB (Rec.709-like)', outputSpace: 'display-referred sRGB (Rec.709-like)', suspectedLog: l.suspectedLog })),
    looks: state.looks, projectLook: state.projectLook ?? null, sceneLooks: state.sceneLooks, shotLooks: state.shotLooks,
    originals: outputs.map((o) => ({ id: o.id, path: o.path, ...(o.hash ? { hash: o.hash } : {}) })),
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Reads saved looks. Damaged looks are dropped; grades are clamped; assignments to a look that is gone are dropped. Never throws. */
export function readLooks(raw: unknown): LookState {
  if (!isObject(raw)) return emptyLooks()
  const looks: Look[] = (Array.isArray(raw.looks) ? raw.looks : []).filter(isObject).filter((l) => typeof l.id === 'string' && typeof l.name === 'string').map((l) => ({ id: l.id as string, name: (l.name as string).slice(0, 60), grade: normalizeGrade(l.grade as Partial<Grade>), ...(typeof l.note === 'string' ? { note: l.note.slice(0, 300) } : {}) }))
  const ids = new Set(looks.map((l) => l.id))
  const assign = (v: unknown) => (isObject(v) ? Object.fromEntries(Object.entries(v).filter(([, id]) => typeof id === 'string' && ids.has(id))) as Record<string, string> : {})
  const luts: Record<string, StoredLut> = {}
  if (isObject(raw.luts)) {
    for (const [id, v] of Object.entries(raw.luts)) {
      if (Object.keys(luts).length >= MAX_LUTS || !isObject(v) || typeof v.dataB64 !== 'string' || (v.kind !== '1d' && v.kind !== '3d')) continue
      const dom = (x: unknown): [number, number, number] | undefined => (Array.isArray(x) && x.length === 3 && x.every((n) => typeof n === 'number' && Number.isFinite(n)) ? [x[0], x[1], x[2]] : undefined)
      const stored: StoredLut = { kind: v.kind, title: typeof v.title === 'string' ? v.title.slice(0, 120) : 'LUT', size: Number(v.size), domainMin: dom(v.domainMin) ?? [0, 0, 0], domainMax: dom(v.domainMax) ?? [1, 1, 1], hash: typeof v.hash === 'string' ? v.hash.slice(0, 32) : '', suspectedLog: v.suspectedLog === true, warnings: Array.isArray(v.warnings) ? v.warnings.filter((w): w is string => typeof w === 'string').slice(0, 6) : [], outOfRangeValues: Number.isFinite(Number(v.outOfRangeValues)) ? Number(v.outOfRangeValues) : 0, dataB64: v.dataB64 }
      if (unpackLut(stored)) luts[id.slice(0, 40)] = stored
    }
  }
  // A look that names a LUT that is not there loses that reference rather than pointing at nothing.
  const cleaned = looks.map((l) => (l.grade.lut && !luts[l.grade.lut.id] ? { ...l, grade: (({ lut: _x, ...g }) => g)(l.grade) as Grade } : l))
  return { looks: cleaned, ...(typeof raw.projectLook === 'string' && ids.has(raw.projectLook) ? { projectLook: raw.projectLook } : {}), sceneLooks: assign(raw.sceneLooks), shotLooks: assign(raw.shotLooks), ...(Object.keys(luts).length ? { luts } : {}) }
}
