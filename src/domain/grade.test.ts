import { describe, expect, it } from 'vitest'
import {
  LOOKS_FORMAT, addLook, colourScript, contentHash, effectiveLook, emptyLooks, exportLooks, gradeBytes, gradePixel, isNeutral, neutralGrade, normalizeGrade, qaInput, readLooks, removeLook, swatches, updateLook, type Grade,
} from './grade'
import { LIGHTING_KEYS } from './lighting'

const warm: Grade = { technical: { exposureEv: 0.5, temperature: 60, tint: 0 }, tone: { contrast: 25, saturation: 20 }, creative: { shadowTint: '#103060', highlightTint: '#ffcc88', tintAmount: 60 } }
const picture = () => { const a = new Uint8ClampedArray(4 * 64); for (let i = 0; i < 64; i++) { a[i * 4] = i * 4; a[i * 4 + 1] = 255 - i * 3; a[i * 4 + 2] = (i * 37) % 256; a[i * 4 + 3] = 255 - (i % 5) } return a }

describe('a grade never touches the original', () => {
  it('grading returns a new array and the original bytes (and hash) are unchanged', () => {
    const original = picture()
    const before = contentHash(original)
    const copy = Uint8ClampedArray.from(original)
    const graded = gradeBytes(original, warm)
    expect(graded).not.toBe(original)
    expect(Array.from(original)).toEqual(Array.from(copy))
    expect(contentHash(original)).toBe(before)
    expect(contentHash(graded)).not.toBe(before)
  })
  it('keeps the alpha channel', () => {
    const o = picture()
    const g = gradeBytes(o, warm)
    for (let i = 3; i < o.length; i += 4) expect(g[i]).toBe(o[i])
  })
  it('the content hash is stable and sensitive to a single changed byte', () => {
    const a = picture(); const b = picture(); b[10] ^= 1
    expect(contentHash(a)).toBe(contentHash(picture()))
    expect(contentHash(a)).not.toBe(contentHash(b))
    expect(contentHash(a)).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('reset and strength', () => {
  it('a neutral grade (reset) gives back exactly the original', () => {
    const o = picture()
    expect(Array.from(gradeBytes(o, neutralGrade()))).toEqual(Array.from(o))
    expect(isNeutral(neutralGrade())).toBe(true)
    expect(isNeutral(warm)).toBe(false)
  })
  it('strength 0 is the original and strength 100 is the full grade; the middle is in between', () => {
    const px: [number, number, number] = [120, 90, 60]
    expect(gradePixel(px, warm, 0)).toEqual(px)
    const full = gradePixel(px, warm, 100)
    expect(full).toEqual(gradePixel(px, warm))
    expect(full).not.toEqual(px)
    const half = gradePixel(px, warm, 50)
    for (let i = 0; i < 3; i++) expect(Math.abs(half[i] - (px[i] + full[i]) / 2)).toBeLessThanOrEqual(1)
    expect(Array.from(gradeBytes(picture(), warm, 0))).toEqual(Array.from(picture()))
  })
  it('strength outside 0 to 100 is clamped', () => {
    const px: [number, number, number] = [120, 90, 60]
    expect(gradePixel(px, warm, -50)).toEqual(px)
    expect(gradePixel(px, warm, 500)).toEqual(gradePixel(px, warm, 100))
  })
})

describe('re-grading does not compound', () => {
  it('rendering from the original with grade B gives the same picture whatever grade came before', () => {
    const original = picture()
    const other: Grade = { ...neutralGrade(), tone: { contrast: -40, saturation: -60 } }
    const afterA = gradeBytes(original, other)
    expect(Array.from(afterA)).not.toEqual(Array.from(original))
    const direct = gradeBytes(original, warm)
    const regraded = gradeBytes(original, warm) // the app always renders from the original, never from `afterA`
    expect(Array.from(regraded)).toEqual(Array.from(direct))
    // grading an already graded copy would compound: prove the two differ, so the rule matters
    expect(Array.from(gradeBytes(afterA, warm))).not.toEqual(Array.from(direct))
  })
})

describe('the transform behaves like a grade', () => {
  it('exposure +1 stop brightens, -1 darkens, and stays inside 0 to 255', () => {
    const px: [number, number, number] = [100, 100, 100]
    const up = gradePixel(px, { ...neutralGrade(), technical: { exposureEv: 1, temperature: 0, tint: 0 } })
    const down = gradePixel(px, { ...neutralGrade(), technical: { exposureEv: -1, temperature: 0, tint: 0 } })
    expect(up[0]).toBeGreaterThan(100); expect(down[0]).toBeLessThan(100)
    const white = gradePixel([250, 250, 250], { ...neutralGrade(), technical: { exposureEv: 3, temperature: 0, tint: 0 } })
    expect(white).toEqual([255, 255, 255])
    expect(gradePixel([0, 0, 0], { ...neutralGrade(), technical: { exposureEv: -3, temperature: 0, tint: 0 } })).toEqual([0, 0, 0])
  })
  it('exposure +1 stop doubles linear light (a known reference value)', () => {
    // sRGB 128 is 0.2158 linear; double is 0.4316, which is sRGB 0.6853 = 174.7
    const out = gradePixel([128, 128, 128], { ...neutralGrade(), technical: { exposureEv: 1, temperature: 0, tint: 0 } })
    expect(out[0]).toBeGreaterThanOrEqual(173); expect(out[0]).toBeLessThanOrEqual(176)
    expect(out[0]).toBe(out[1]); expect(out[1]).toBe(out[2])
  })
  it('warm temperature raises red and lowers blue; cool does the opposite', () => {
    const w = gradePixel([128, 128, 128], { ...neutralGrade(), technical: { exposureEv: 0, temperature: 80, tint: 0 } })
    const c = gradePixel([128, 128, 128], { ...neutralGrade(), technical: { exposureEv: 0, temperature: -80, tint: 0 } })
    expect(w[0]).toBeGreaterThan(w[2]); expect(c[2]).toBeGreaterThan(c[0])
  })
  it('contrast pulls midtones apart around grey; saturation -100 gives grey', () => {
    const hi = gradePixel([180, 180, 180], { ...neutralGrade(), tone: { contrast: 50, saturation: 0 } })
    const lo = gradePixel([180, 180, 180], { ...neutralGrade(), tone: { contrast: -50, saturation: 0 } })
    expect(hi[0]).toBeGreaterThan(180); expect(lo[0]).toBeLessThan(180)
    const grey = gradePixel([200, 80, 40], { ...neutralGrade(), tone: { contrast: 0, saturation: -100 } })
    expect(Math.max(...grey) - Math.min(...grey)).toBeLessThanOrEqual(1)
  })
  it('creative tints move shadows and highlights differently', () => {
    const g: Grade = { ...neutralGrade(), creative: { shadowTint: '#0000ff', highlightTint: '#ff0000', tintAmount: 100 } }
    const shadow = gradePixel([30, 30, 30], g); const light = gradePixel([225, 225, 225], g)
    expect(shadow[2]).toBeGreaterThan(shadow[0]); expect(light[0]).toBeGreaterThan(light[2])
  })
  it('out-of-range settings are clamped, never produce NaN, and bad tints are dropped', () => {
    const n = normalizeGrade({ technical: { exposureEv: 99, temperature: Number.NaN, tint: -999 }, tone: { contrast: 'x' as unknown as number, saturation: 500 }, creative: { shadowTint: 'red', highlightTint: '#ABCDEF', tintAmount: 400 } })
    expect(n.technical).toEqual({ exposureEv: 3, temperature: 0, tint: -100 })
    expect(n.tone).toEqual({ contrast: 0, saturation: 100 })
    expect(n.creative).toEqual({ shadowTint: '', highlightTint: '#abcdef', tintAmount: 100 })
    for (const v of gradePixel([1, 2, 3], { ...warm, technical: { exposureEv: 99, temperature: 999, tint: 999 } })) expect(Number.isFinite(v)).toBe(true)
  })
})

describe('lighting and grade are separate', () => {
  it('a grade holds no lighting-direction fields, and a lighting record holds no grade fields', () => {
    expect(Object.keys(neutralGrade())).toEqual(['technical', 'tone', 'creative'])
    const gradeLeaves = [...Object.keys(neutralGrade().technical), ...Object.keys(neutralGrade().tone), ...Object.keys(neutralGrade().creative)]
    // `contrast` appears in both on purpose and means different things: in lighting it is the depth of the shadows the light is asked to make (low, medium, high);
    // in a grade it is a curve applied over the pixels. Every other grade field is absent from lighting.
    for (const k of gradeLeaves.filter((x) => x !== 'contrast')) expect(LIGHTING_KEYS as string[]).not.toContain(k)
    for (const k of ['keyAzimuth', 'keyElevation', 'sourceSize', 'rim', 'practicals', 'ambient', 'colorTempK']) expect(gradeLeaves).not.toContain(k)
    expect(LIGHTING_KEYS as string[]).not.toContain('technical')
  })
  it('grading does not change what light was asked for: only colours move, geometry does not', () => {
    // a grade is a per-pixel colour map: the same input colour always gives the same output colour wherever it is in the picture
    const a = new Uint8ClampedArray([200, 100, 50, 255, 0, 0, 0, 255, 200, 100, 50, 255])
    const g = gradeBytes(a, warm)
    expect(Array.from(g.slice(0, 4))).toEqual(Array.from(g.slice(8, 12)))
  })
})

describe('looks, scenes and shots', () => {
  const state = () => {
    let s = emptyLooks()
    const day = addLook(s, 'Warm afternoon', warm); s = day.state
    const night = addLook(s, 'Cold night', { ...neutralGrade(), technical: { exposureEv: -0.7, temperature: -50, tint: 0 } }); s = night.state
    return { s: { ...s, projectLook: day.look.id, sceneLooks: { SC2: night.look.id }, shotLooks: { SH3: day.look.id } }, day: day.look, night: night.look }
  }
  it('a shot look beats a scene look, which beats the project look', () => {
    const { s, day, night } = state()
    expect(effectiveLook(s, 'SC1', 'SH1')).toMatchObject({ source: 'project', look: { id: day.id } })
    expect(effectiveLook(s, 'SC2', 'SH2')).toMatchObject({ source: 'scene', look: { id: night.id } })
    expect(effectiveLook(s, 'SC2', 'SH3')).toMatchObject({ source: 'shot', look: { id: day.id } })
    expect(effectiveLook(emptyLooks(), 'SC1', 'SH1')).toEqual({ look: undefined, source: 'none' })
  })
  it('names are made unique and ids are stable', () => {
    let s = emptyLooks()
    s = addLook(s, 'Dusk').state; s = addLook(s, 'dusk').state; s = addLook(s, '  ').state
    expect(s.looks.map((l) => l.name)).toEqual(['Dusk', 'dusk 2', 'Untitled look'])
    expect(s.looks.map((l) => l.id)).toEqual(['LOOK-001', 'LOOK-002', 'LOOK-003'])
  })
  it('editing a look clamps it; removing it removes where it was used and nothing else', () => {
    const { s, day } = state()
    const edited = updateLook(s, day.id, { grade: { ...warm, technical: { ...warm.technical, exposureEv: 9 } } })
    expect(edited.looks[0].grade.technical.exposureEv).toBe(3)
    const gone = removeLook(s, day.id)
    expect(gone.looks).toHaveLength(1)
    expect(gone.projectLook).toBeUndefined()
    expect(gone.shotLooks).toEqual({})
    expect(gone.sceneLooks).toEqual(s.sceneLooks)
  })
  it('the colour script has one row per scene with its look and swatches, and counts shot overrides', () => {
    const { s } = state()
    const rows = colourScript(s, [{ id: 'SC1', heading: 'INT. KITCHEN - DAY' }, { id: 'SC2', heading: 'EXT. DOCK - NIGHT' }], [{ id: 'SH1', sceneId: 'SC1' }, { id: 'SH2', sceneId: 'SC2' }, { id: 'SH3', sceneId: 'SC2' }])
    expect(rows.map((r) => [r.look, r.source, r.shots, r.overrides])).toEqual([['Warm afternoon', 'project', 1, 0], ['Cold night', 'scene', 2, 1]])
    expect(rows[0].swatches).toHaveLength(6)
    expect(rows[0].swatches.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true)
    expect(swatches(neutralGrade())[0]).toBe('#141414')
    expect(colourScript(emptyLooks(), [{ id: 'S', heading: 'h' }], [])[0].look).toMatch(/original colours/)
  })
  it('reads saved looks safely and drops assignments to looks that no longer exist', () => {
    const { s } = state()
    const saved = JSON.parse(JSON.stringify(s))
    saved.sceneLooks.SC9 = 'LOOK-404'; saved.looks.push({ id: 1 }, 'junk', { id: 'LOOK-009', name: 'Odd', grade: { tone: { contrast: 900 } } })
    const read = readLooks(saved)
    expect(read.looks.map((l) => l.id)).toEqual(['LOOK-001', 'LOOK-002', 'LOOK-009'])
    expect(read.looks[2].grade.tone.contrast).toBe(100)
    expect(read.sceneLooks.SC9).toBeUndefined()
    expect(readLooks(undefined)).toEqual(emptyLooks())
    expect(readLooks({ projectLook: 'x' }).projectLook).toBeUndefined()
  })
})

describe('QA and export', () => {
  it('technical QA always runs on the ungraded original', () => {
    expect(qaInput('C:/out/original.png', 'C:/out/graded.png')).toBe('C:/out/original.png')
  })
  it('exported look metadata says nothing is baked, includes no LUT, and lists originals with hashes', () => {
    const { s } = (() => { const a = addLook(emptyLooks(), 'Warm', warm); return { s: { ...a.state, projectLook: a.look.id } } })()
    const out = exportLooks(s, [{ id: 'J1', path: 'C:/out/a.png', hash: 'abc' }])
    expect(out.format).toBe(LOOKS_FORMAT)
    expect(out.bakedIntoOriginals).toBe(false)
    expect(out.luts).toEqual([])
    expect(JSON.stringify(out)).not.toMatch(/\.3dl/i)
    expect(out.note).toMatch(/never baked/)
    expect(out.looks[0].grade).toEqual(normalizeGrade(warm))
    expect(out.originals).toEqual([{ id: 'J1', path: 'C:/out/a.png', hash: 'abc' }])
    expect(() => JSON.stringify(out)).not.toThrow()
  })
})
