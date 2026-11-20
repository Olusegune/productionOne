import { contentHash } from './hash'

/**
 * LUT import (Adobe/Resolve `.cube`, 1D and 3D). A LUT is a colour-to-colour table: it maps each input colour to an output colour. It does not move lights or rebuild
 * shadows (see grading-and-looks.md).
 *
 * Colour-space expectation: this app treats a picture as display-referred sRGB (Rec.709-like) and expects a LUT that goes from that to that. A LUT made for a log or HDR
 * camera format (LogC, S-Log, V-Log, HLG, PQ...) would give wrong colours on such a picture, so a LUT whose title or file name suggests one is refused unless the person
 * says it is meant for this picture.
 *
 * Interpolation is trilinear for 3D and linear for 1D. The cube file's red index runs fastest, then green, then blue.
 */
export const LUT_MAX_BYTES = 12 * 1024 * 1024
export const LUT_MAX_SIZE_3D = 65
export const LUT_MAX_SIZE_1D = 16384
export const LUT_MIN_SIZE = 2

export type Lut = {
  kind: '1d' | '3d'
  title: string
  size: number
  /** Input range that maps to 0..1 on the table. Default 0..1. */
  domainMin: [number, number, number]
  domainMax: [number, number, number]
  /** size (1D) or size^3 (3D) triples, flattened r,g,b. */
  data: Float32Array
  /** Hash of the text it was read from, so the same LUT is recognised. */
  hash: string
  /** Output values outside 0..1 in the table (they are clamped when applied). */
  outOfRangeValues: number
  warnings: string[]
  /** The title or file name suggests a log or HDR LUT. */
  suspectedLog: boolean
}

export type LutParse = { ok: true; lut: Lut } | { ok: false; error: string }

const LOG_HINT = /(?<![a-z])(s-?log\d?|v-?log|log-?c\d?|c-?log\d?|f-?log\d?|n-?log|red-?log|bmd[ _-]?film|arri[ _-]?log|hlg|pq|st[ _-]?2084|rec\.?\s?2020|bt\.?\s?2020|aces|acescc|acescct|linear|scene[ _-]?linear|log)(?![a-z])/i

const num = (s: string) => (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ? Number(s) : Number.NaN)

/** Reads a `.cube` file. Never throws; says why it cannot use a file. `fileName` is only used to notice log LUTs. */
export function parseCube(text: string, fileName = ''): LutParse {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' }
  if (text.length > LUT_MAX_BYTES) return { ok: false, error: `The file is larger than ${LUT_MAX_BYTES / 1024 / 1024} MB, which is more than a LUT should be.` }
  if (text.includes('\u0000')) return { ok: false, error: 'This looks like a binary file, not a text .cube LUT.' }
  let title = ''
  let size1d = 0, size3d = 0
  let domainMin: [number, number, number] = [0, 0, 0]
  let domainMax: [number, number, number] = [1, 1, 1]
  const values: number[] = []
  let line = 0
  for (const raw of text.split(/\r?\n/)) {
    line++
    const t = raw.replace(/#.*$/, '').trim()
    if (!t) continue
    const parts = t.split(/\s+/)
    const key = parts[0].toUpperCase()
    if (key === 'TITLE') { title = t.slice(5).trim().replace(/^"|"$/g, '').slice(0, 120); continue }
    if (key === 'LUT_1D_SIZE') { size1d = Number(parts[1]); if (!Number.isInteger(size1d)) return { ok: false, error: `Line ${line}: LUT_1D_SIZE is not a whole number.` }; continue }
    if (key === 'LUT_3D_SIZE') { size3d = Number(parts[1]); if (!Number.isInteger(size3d)) return { ok: false, error: `Line ${line}: LUT_3D_SIZE is not a whole number.` }; continue }
    if (key === 'DOMAIN_MIN' || key === 'DOMAIN_MAX') {
      const v = parts.slice(1).map(num)
      if (v.length !== 3 || v.some((x) => !Number.isFinite(x))) return { ok: false, error: `Line ${line}: ${key} needs three numbers.` }
      if (key === 'DOMAIN_MIN') domainMin = v as [number, number, number]; else domainMax = v as [number, number, number]
      continue
    }
    if (key === 'LUT_3D_INPUT_RANGE' || key === 'LUT_1D_INPUT_RANGE') { const v = parts.slice(1).map(num); if (v.length === 2 && v.every(Number.isFinite)) { domainMin = [v[0], v[0], v[0]]; domainMax = [v[1], v[1], v[1]] } continue }
    if (/^[A-Z_]+$/.test(key) && !Number.isFinite(num(parts[0])) && !/^(NAN|INF|INFINITY)$/.test(key)) return { ok: false, error: `Line ${line}: "${parts[0]}" is not something this app understands in a .cube file.` }
    if (parts.length !== 3) return { ok: false, error: `Line ${line}: a table row needs three numbers (red, green, blue).` }
    const v = parts.map(num)
    if (v.some((x) => !Number.isFinite(x))) return { ok: false, error: `Line ${line}: a table value is not a number.` }
    values.push(v[0], v[1], v[2])
    if (values.length / 3 > 65 ** 3 + 16384) return { ok: false, error: 'The table has more rows than any supported size.' }
  }
  if (size1d && size3d) return { ok: false, error: 'This file has both a 1D and a 3D table. Only one kind per file is supported: split it, or export a single 3D LUT.' }
  if (!size1d && !size3d) return { ok: false, error: 'The file does not say its size (LUT_3D_SIZE or LUT_1D_SIZE), so it is not a .cube LUT.' }
  const size = size3d || size1d
  const kind = size3d ? '3d' : '1d'
  if (size < LUT_MIN_SIZE) return { ok: false, error: `The size ${size} is too small to be a LUT.` }
  if (kind === '3d' && size > LUT_MAX_SIZE_3D) return { ok: false, error: `A 3D LUT of size ${size} is larger than the ${LUT_MAX_SIZE_3D} this app accepts.` }
  if (kind === '1d' && size > LUT_MAX_SIZE_1D) return { ok: false, error: `A 1D LUT of size ${size} is larger than the ${LUT_MAX_SIZE_1D} this app accepts.` }
  const expected = kind === '3d' ? size ** 3 : size
  if (values.length / 3 !== expected) return { ok: false, error: `The file says size ${size} (${expected} rows) but has ${values.length / 3} rows.` }
  for (let i = 0; i < 3; i++) if (!(domainMax[i] > domainMin[i])) return { ok: false, error: 'DOMAIN_MAX must be larger than DOMAIN_MIN.' }
  const data = Float32Array.from(values)
  let out = 0
  for (const v of data) if (v < 0 || v > 1) out++
  const warnings: string[] = []
  if (out > 0) warnings.push(`${out} table values are outside 0 to 1. They are clamped to 0 to 1 when applied.`)
  if (domainMin.some((x) => x !== 0) || domainMax.some((x) => x !== 1)) warnings.push('This LUT has its own input range (DOMAIN_MIN/DOMAIN_MAX). Picture values outside that range are clamped to it.')
  const suspectedLog = LOG_HINT.test(`${title} ${fileName}`)
  if (suspectedLog) warnings.push('The title or file name suggests this LUT is for a log, linear or HDR format, not for an ordinary sRGB picture. Using it here will give wrong colours unless you know it is meant for this picture.')
  return { ok: true, lut: { kind, title: title || fileName.replace(/\.cube$/i, '') || 'Untitled LUT', size, domainMin, domainMax, data, hash: contentHash(Array.from(new TextEncoder().encode(text))), outOfRangeValues: out, warnings, suspectedLog } }
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Applies a LUT to one colour (each channel 0..1) and returns 0..1. Inputs outside the LUT's input range are clamped to it; outputs are clamped to 0..1. */
export function applyLut(lut: Lut, r: number, g: number, b: number): [number, number, number] {
  const n = lut.size
  const t = (v: number, i: number) => clamp01((v - lut.domainMin[i]) / (lut.domainMax[i] - lut.domainMin[i]))
  const rr = t(r, 0), gg = t(g, 1), bb = t(b, 2)
  const d = lut.data
  if (lut.kind === '1d') {
    const one = (x: number, c: number) => { const p = x * (n - 1); const i = Math.min(n - 2, Math.floor(p)); const f = p - i; return d[i * 3 + c] * (1 - f) + d[(i + 1) * 3 + c] * f }
    return [clamp01(one(rr, 0)), clamp01(one(gg, 1)), clamp01(one(bb, 2))]
  }
  const pr = rr * (n - 1), pg = gg * (n - 1), pb = bb * (n - 1)
  const r0 = Math.min(n - 2, Math.floor(pr)), g0 = Math.min(n - 2, Math.floor(pg)), b0 = Math.min(n - 2, Math.floor(pb))
  const fr = pr - r0, fg = pg - g0, fb = pb - b0
  const at = (ri: number, gi: number, bi: number, c: number) => d[((bi * n + gi) * n + ri) * 3 + c]
  const out: [number, number, number] = [0, 0, 0]
  for (let c = 0; c < 3; c++) {
    const c00 = at(r0, g0, b0, c) * (1 - fr) + at(r0 + 1, g0, b0, c) * fr
    const c10 = at(r0, g0 + 1, b0, c) * (1 - fr) + at(r0 + 1, g0 + 1, b0, c) * fr
    const c01 = at(r0, g0, b0 + 1, c) * (1 - fr) + at(r0 + 1, g0, b0 + 1, c) * fr
    const c11 = at(r0, g0 + 1, b0 + 1, c) * (1 - fr) + at(r0 + 1, g0 + 1, b0 + 1, c) * fr
    out[c] = clamp01((c00 * (1 - fg) + c10 * fg) * (1 - fb) + (c01 * (1 - fg) + c11 * fg) * fb)
  }
  return out
}

/** Applies a LUT to an 8-bit sRGB pixel. `strength` (0 to 100) blends with the original pixel: 0 returns it exactly. */
export function applyLutPixel(lut: Lut, rgb: readonly [number, number, number], strength = 100): [number, number, number] {
  const s = Math.min(100, Math.max(0, strength)) / 100
  if (s === 0) return [rgb[0], rgb[1], rgb[2]]
  const o = applyLut(lut, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
  return [0, 1, 2].map((i) => Math.round(Math.min(255, Math.max(0, rgb[i] + (o[i] * 255 - rgb[i]) * s)))) as [number, number, number]
}

/** Writes a LUT back out as `.cube` text (what gets exported). Reading that text gives the same table. */
export function lutToCube(lut: Lut): string {
  const f = (v: number) => (Math.round(v * 1e6) / 1e6).toString()
  const rows = Array.from({ length: lut.data.length / 3 }, (_, i) => `${f(lut.data[i * 3])} ${f(lut.data[i * 3 + 1])} ${f(lut.data[i * 3 + 2])}`)
  const head = [`TITLE "${lut.title.replace(/"/g, "'")}"`, lut.kind === '3d' ? `LUT_3D_SIZE ${lut.size}` : `LUT_1D_SIZE ${lut.size}`]
  if (lut.domainMin.some((x) => x !== 0) || lut.domainMax.some((x) => x !== 1)) head.push(`DOMAIN_MIN ${lut.domainMin.join(' ')}`, `DOMAIN_MAX ${lut.domainMax.join(' ')}`)
  return [...head, ...rows].join('\n') + '\n'
}

/** A compact way to keep a table inside the project file: 16-bit values, base64. Precision is 1/65535 of the range, far finer than 8-bit pictures. */
export function packLut(lut: Lut): StoredLut {
  const bytes = new Uint8Array(lut.data.length * 2)
  const view = new DataView(bytes.buffer)
  lut.data.forEach((v, i) => view.setUint16(i * 2, Math.round(clamp01(v) * 65535), true))
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { kind: lut.kind, title: lut.title, size: lut.size, domainMin: lut.domainMin, domainMax: lut.domainMax, hash: lut.hash, suspectedLog: lut.suspectedLog, warnings: lut.warnings, outOfRangeValues: lut.outOfRangeValues, dataB64: btoa(bin) }
}

export interface StoredLut { kind: '1d' | '3d'; title: string; size: number; domainMin: [number, number, number]; domainMax: [number, number, number]; hash: string; suspectedLog: boolean; warnings: string[]; outOfRangeValues: number; dataB64: string }

/** Reads a stored table back. Anything that does not add up (wrong length, bad numbers) is refused rather than guessed. */
export function unpackLut(s: StoredLut): Lut | undefined {
  try {
    const bin = atob(s.dataB64)
    const rows = s.kind === '3d' ? s.size ** 3 : s.size
    if (!Number.isInteger(s.size) || s.size < LUT_MIN_SIZE || (s.kind === '3d' ? s.size > LUT_MAX_SIZE_3D : s.size > LUT_MAX_SIZE_1D) || bin.length !== rows * 3 * 2) return undefined
    const view = new DataView(Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer)
    const data = new Float32Array(rows * 3)
    for (let i = 0; i < data.length; i++) data[i] = view.getUint16(i * 2, true) / 65535
    return { kind: s.kind, title: s.title, size: s.size, domainMin: s.domainMin, domainMax: s.domainMax, data, hash: s.hash, outOfRangeValues: s.outOfRangeValues, warnings: s.warnings, suspectedLog: s.suspectedLog }
  } catch { return undefined }
}
