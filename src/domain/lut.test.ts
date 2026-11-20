import { describe, expect, it } from 'vitest'
import { addLut, contentHash, dropUnusedLuts, emptyLooks, exportLooks, gradeBytes, gradePixel, isNeutral, lutFileName, lutLookup, neutralGrade, normalizeGrade, readLooks, addLook, updateLook, type Grade } from './grade'
import { LUT_MAX_SIZE_3D, applyLut, applyLutPixel, lutToCube, packLut, parseCube, unpackLut, type Lut } from './lut'

/** A .cube text for an N-size 3D table made by `f(r, g, b) -> [r', g', b']`, red index fastest. */
const cube3d = (n: number, f: (r: number, g: number, b: number) => [number, number, number], extra = ''): string => {
  const rows: string[] = []
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) rows.push(f(r / (n - 1), g / (n - 1), b / (n - 1)).join(' '))
  return `TITLE "test"\nLUT_3D_SIZE ${n}\n${extra}${rows.join('\n')}\n`
}
const ok = (text: string, name = ''): Lut => { const r = parseCube(text, name); if (!r.ok) throw new Error(r.error); return r.lut }
const near = (a: number[], b: number[], tol = 1e-5) => a.forEach((v, i) => expect(Math.abs(v - b[i]), `${a} vs ${b}`).toBeLessThanOrEqual(tol))

describe('parsing a .cube file', () => {
  it('reads a 3D LUT with comments, blank lines, Windows line ends and a quoted title', () => {
    const text = '# made by hand\r\nTITLE "Warm film"\r\n\r\nLUT_3D_SIZE 2\r\n' + '0 0 0\r\n1 0 0\r\n0 1 0\r\n1 1 0\r\n0 0 1\r\n1 0 1\r\n0 1 1\r\n1 1 1 # last\r\n'
    const lut = ok(text)
    expect(lut).toMatchObject({ kind: '3d', size: 2, title: 'Warm film', outOfRangeValues: 0, suspectedLog: false })
    expect(lut.data).toHaveLength(24)
    expect(lut.hash).toMatch(/^[0-9a-f]{16}$/)
  })
  it('reads a 1D LUT, and a title-less file takes its name from the file', () => {
    const lut = ok('LUT_1D_SIZE 3\n0 0 0\n0.25 0.25 0.25\n1 1 1\n', 'Soft contrast.cube')
    expect(lut).toMatchObject({ kind: '1d', size: 3, title: 'Soft contrast' })
  })
  it('says exactly why it cannot use a file', () => {
    const bad: Array<[string, string, RegExp]> = [
      ['empty', '', /empty/], ['spaces', '   \n', /empty/], ['binary', 'LUT_3D_SIZE 2\u0000\u0001', /binary/],
      ['no size', '0 0 0\n1 1 1\n', /does not say its size/], ['both', 'LUT_1D_SIZE 2\nLUT_3D_SIZE 2\n0 0 0\n1 1 1\n', /both a 1D and a 3D/],
      ['too few rows', 'LUT_3D_SIZE 2\n0 0 0\n1 1 1\n', /size 2 \(8 rows\) but has 2 rows/], ['too many rows', 'LUT_1D_SIZE 2\n0 0 0\n1 1 1\n1 1 1\n', /size 2 \(2 rows\) but has 3 rows/],
      ['bad number', 'LUT_1D_SIZE 2\n0 0 0\n1 x 1\n', /Line 3: a table value is not a number/], ['two columns', 'LUT_1D_SIZE 2\n0 0\n1 1 1\n', /Line 2: a table row needs three numbers/],
      ['unknown key', 'LUT_1D_SIZE 2\nFROBNICATE 4\n0 0 0\n1 1 1\n', /Line 2: "FROBNICATE" is not something/], ['size 1', 'LUT_3D_SIZE 1\n0 0 0\n', /too small/],
      ['huge', `LUT_3D_SIZE ${LUT_MAX_SIZE_3D + 1}\n`, /larger than the 65/], ['fractional size', 'LUT_3D_SIZE 2.5\n', /not a whole number/],
      ['bad domain', 'LUT_1D_SIZE 2\nDOMAIN_MIN 1 1 1\nDOMAIN_MAX 0 0 0\n0 0 0\n1 1 1\n', /DOMAIN_MAX must be larger/], ['domain arity', 'DOMAIN_MIN 0 0\n', /needs three numbers/],
      ['NaN', 'LUT_1D_SIZE 2\n0 0 0\nNaN 1 1\n', /not a number/],
    ]
    for (const [name, text, why] of bad) { const r = parseCube(text); expect(r.ok, name).toBe(false); if (!r.ok) expect(r.error, name).toMatch(why) }
  })
  it('refuses a file that is far too large without reading it', () => {
    const r = parseCube('#'.repeat(13 * 1024 * 1024))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/larger than 12 MB/)
  })
  it('never throws on junk', () => {
    for (const junk of [undefined, null, 42, {}, [], '\n\n\n', 'LUT_3D_SIZE', 'LUT_3D_SIZE abc']) expect(() => parseCube(junk as never)).not.toThrow()
  })
})

describe('interpolation matches known values', () => {
  it('an identity table gives back the colour, at nodes and between them', () => {
    for (const n of [2, 3, 17, 33]) {
      const lut = ok(cube3d(n, (r, g, b) => [r, g, b]))
      for (const c of [[0, 0, 0], [1, 1, 1], [0.25, 0.5, 0.75], [0.1, 0.9, 0.33], [1, 0, 0.5]]) near(applyLut(lut, c[0], c[1], c[2]), c, 1e-6)
    }
  })
  it('an inverting table gives 1 minus the colour exactly (a linear function interpolates exactly)', () => {
    const lut = ok(cube3d(2, (r, g, b) => [1 - r, 1 - g, 1 - b]))
    near(applyLut(lut, 0.25, 0, 1), [0.75, 1, 0])
    near(applyLut(lut, 0.5, 0.5, 0.5), [0.5, 0.5, 0.5])
    near(applyLut(lut, 0.1, 0.6, 0.9), [0.9, 0.4, 0.1])
  })
  it('a curve is read off between its nodes: gamma 2 on red with nodes 0, 0.25, 1', () => {
    const lut = ok(cube3d(3, (r, g, b) => [r * r, g, b]))
    near(applyLut(lut, 0.25, 0.5, 0.5), [0.125, 0.5, 0.5])
    near(applyLut(lut, 0.5, 0.5, 0.5), [0.25, 0.5, 0.5])
    near(applyLut(lut, 0.75, 0.5, 0.5), [0.625, 0.5, 0.5])
  })
  it('a 1D table works the same way', () => {
    const lut = ok('LUT_1D_SIZE 3\n0 0 0\n0.25 0.25 0.25\n1 1 1\n')
    near(applyLut(lut, 0.25, 0.5, 0.75), [0.125, 0.25, 0.625])
  })
  it('red runs fastest in the file: a table that rotates channels sends pure red to pure green', () => {
    const lut = ok(cube3d(2, (r, g, b) => [b, r, g]))
    near(applyLut(lut, 1, 0, 0), [0, 1, 0])
    near(applyLut(lut, 0, 1, 0), [0, 0, 1])
    near(applyLut(lut, 0, 0, 1), [1, 0, 0])
  })
  it('uses the table\'s own input range, and clamps what falls outside it', () => {
    const lut = ok(cube3d(2, (r, g, b) => [r, g, b], 'DOMAIN_MIN 0 0 0\nDOMAIN_MAX 2 2 2\n'))
    near(applyLut(lut, 1, 1, 1), [0.5, 0.5, 0.5])
    near(applyLut(lut, 5, -3, 2), [1, 0, 1])
    expect(lut.warnings.join(' ')).toMatch(/its own input range/)
  })
  it('handles values outside 0 to 1 in the table explicitly: counted, warned, clamped when applied', () => {
    const lut = ok(cube3d(2, (r, g, b) => [r * 1.5, g, b - 0.2]))
    expect(lut.outOfRangeValues).toBeGreaterThan(0)
    expect(lut.warnings.join(' ')).toMatch(/outside 0 to 1\. They are clamped/)
    near(applyLut(lut, 1, 1, 1), [1, 1, 0.8])
    near(applyLut(lut, 0, 0, 0), [0, 0, 0])
  })
})

describe('applying to a picture', () => {
  const invert = ok(cube3d(2, (r, g, b) => [1 - r, 1 - g, 1 - b]))
  it('8-bit pixels: invert gives 255 minus the value; strength 0 is the original; 100 the full effect; 50 in between', () => {
    expect(applyLutPixel(invert, [10, 200, 60])).toEqual([245, 55, 195])
    expect(applyLutPixel(invert, [10, 200, 60], 0)).toEqual([10, 200, 60])
    near(applyLutPixel(invert, [10, 200, 60], 50), [128, 128, 128], 1)
    expect(applyLutPixel(invert, [10, 200, 60], 999)).toEqual([245, 55, 195])
  })
  it('a LUT is a colour map: the same input colour gives the same output colour anywhere in the picture', () => {
    const px = new Uint8ClampedArray([10, 200, 60, 255, 0, 0, 0, 255, 10, 200, 60, 255])
    const grade: Grade = { ...neutralGrade(), lut: { id: 'L', strength: 100 } }
    const out = gradeBytes(px, grade, 100, (id) => (id === 'L' ? invert : undefined))
    expect(Array.from(out.slice(0, 4))).toEqual(Array.from(out.slice(8, 12)))
    expect(Array.from(out.slice(0, 3))).toEqual([245, 55, 195])
  })
  it('after a grade: the LUT is applied last, on the graded colour', () => {
    const grade: Grade = { ...neutralGrade(), technical: { exposureEv: 1, temperature: 0, tint: 0 }, lut: { id: 'L', strength: 100 } }
    const lookup = (id: string) => (id === 'L' ? invert : undefined)
    const graded = gradePixel([128, 128, 128], { ...grade, lut: undefined })
    const both = gradePixel([128, 128, 128], grade, 100, lookup)
    expect(both[0]).toBeCloseTo(255 - graded[0], -0.5)
    expect(both[0]).not.toBe(graded[0])
  })
  it('a grade with only a LUT is not neutral; with strength 0 or no LUT it is', () => {
    expect(isNeutral({ ...neutralGrade(), lut: { id: 'L', strength: 100 } })).toBe(false)
    expect(isNeutral({ ...neutralGrade(), lut: { id: 'L', strength: 0 } })).toBe(true)
    expect(isNeutral(neutralGrade())).toBe(true)
    expect(normalizeGrade({ lut: { id: 'L', strength: 900, acknowledgeLog: true } } as never).lut).toEqual({ id: 'L', strength: 100, acknowledgeLog: true })
    expect(normalizeGrade({ lut: { id: '' } } as never).lut).toBeUndefined()
  })
  it('a missing table is ignored, never guessed', () => {
    const grade: Grade = { ...neutralGrade(), lut: { id: 'GONE', strength: 100 } }
    expect(gradePixel([40, 80, 120], grade, 100, () => undefined)).toEqual([40, 80, 120])
    expect(gradePixel([40, 80, 120], grade)).toEqual([40, 80, 120])
  })
  it('the original bytes are never changed and re-grading never compounds', () => {
    const original = new Uint8ClampedArray([10, 200, 60, 255, 90, 90, 90, 255])
    const copy = Uint8ClampedArray.from(original)
    const hash = contentHash(original)
    const grade: Grade = { ...neutralGrade(), lut: { id: 'L', strength: 100 } }
    const lookup = (id: string) => (id === 'L' ? invert : undefined)
    const once = gradeBytes(original, grade, 100, lookup)
    expect(Array.from(original)).toEqual(Array.from(copy))
    expect(contentHash(original)).toBe(hash)
    expect(Array.from(gradeBytes(original, grade, 100, lookup))).toEqual(Array.from(once))
    expect(Array.from(gradeBytes(once, grade, 100, lookup))).toEqual(Array.from(original))
  })
})

describe('log and HDR LUTs are not applied to an ordinary picture by default', () => {
  it('notices them by title or file name, and warns', () => {
    for (const [title, name] of [['ARRI LogC to Rec709', ''], ['Look', 'SLog3_to_709.cube'], ['V-Log to V-709', ''], ['x', 'HLG_to_SDR.cube'], ['Log', ''], ['ACEScct film', '']]) expect(ok(cube3d(2, (r, g, b) => [r, g, b]).replace('"test"', `"${title}"`), name).suspectedLog, `${title} ${name}`).toBe(true)
    for (const title of ['Warm film', 'Catalog colours', 'Prologue teal', 'Dialog tint', 'Blue hour']) expect(ok(cube3d(2, (r, g, b) => [r, g, b]).replace('"test"', `"${title}"`)).suspectedLog, title).toBe(false)
    expect(ok(cube3d(2, (r, g, b) => [r, g, b]).replace('"test"', '"ARRI LogC"')).warnings.join(' ')).toMatch(/log, linear or HDR format/)
  })
  it('does not apply one unless the person says it is meant for this picture', () => {
    const log = ok(cube3d(2, (r, g, b) => [1 - r, 1 - g, 1 - b]).replace('"test"', '"Camera LogC to 709"'))
    const lookup = (id: string) => (id === 'L' ? log : undefined)
    expect(gradePixel([10, 200, 60], { ...neutralGrade(), lut: { id: 'L', strength: 100 } }, 100, lookup)).toEqual([10, 200, 60])
    expect(gradePixel([10, 200, 60], { ...neutralGrade(), lut: { id: 'L', strength: 100, acknowledgeLog: true } }, 100, lookup)).toEqual([245, 55, 195])
  })
})

describe('writing and keeping a LUT', () => {
  it('writes .cube text that reads back to the same table', () => {
    const lut = ok(cube3d(5, (r, g, b) => [Math.pow(r, 1.3), g * 0.9, 1 - b * 0.5], 'DOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n'))
    const back = ok(lutToCube(lut))
    expect(back).toMatchObject({ kind: '3d', size: 5, title: 'test' })
    near(Array.from(back.data), Array.from(lut.data), 2e-6)
    const withDomain = ok(lutToCube(ok(cube3d(2, (r, g, b) => [r, g, b], 'DOMAIN_MIN -1 -1 -1\nDOMAIN_MAX 3 3 3\n'))))
    expect(withDomain.domainMin).toEqual([-1, -1, -1])
    expect(lutToCube(lut)).not.toMatch(/DOMAIN/)
  })
  it('packs into the project at 16-bit precision and unpacks to the same table, and refuses a damaged one', () => {
    const lut = ok(cube3d(9, (r, g, b) => [r * r, Math.sqrt(g), b]))
    const stored = packLut(lut)
    const back = unpackLut(stored)!
    near(Array.from(back.data), Array.from(lut.data), 1 / 65535 + 1e-7)
    expect(back.hash).toBe(lut.hash)
    expect(unpackLut({ ...stored, size: 10 })).toBeUndefined()
    expect(unpackLut({ ...stored, dataB64: stored.dataB64.slice(0, -8) })).toBeUndefined()
    expect(unpackLut({ ...stored, dataB64: '!!!' })).toBeUndefined()
    expect(unpackLut({ ...stored, size: 1 })).toBeUndefined()
    expect(stored.dataB64.length).toBeLessThan(9 ** 3 * 3 * 2 * 1.4)
  })
})

describe('LUTs in the looks', () => {
  const idLut = ok(cube3d(3, (r, g, b) => [r, g, b]))
  const other = ok(cube3d(3, (r, g, b) => [1 - r, g, b]))
  it('adds a LUT once (the same table is recognised), up to a small limit', () => {
    let s = emptyLooks()
    const a = addLut(s, idLut); if (!a.ok) throw new Error(a.error); s = a.state
    const again = addLut(s, idLut); expect(again.ok && again.id).toBe(a.id)
    expect(Object.keys(s.luts!)).toHaveLength(1)
    for (let i = 0; i < 7; i++) { const r = addLut(s, ok(cube3d(2, (x, y, z) => [x, y, z * (i + 1) / 8]).replace('"test"', `"t${i}"`))); if (!r.ok) throw new Error(r.error); s = r.state }
    expect(Object.keys(s.luts!)).toHaveLength(8)
    const full = addLut(s, other)
    expect(full.ok).toBe(false)
    if (!full.ok) expect(full.error).toMatch(/hold 8 LUTs/)
  })
  it('looks up a table by id, drops tables no look uses, and keeps one that is used', () => {
    let s = emptyLooks()
    const a = addLut(s, idLut); if (!a.ok) throw new Error(a.error); s = a.state
    const l = addLook(s, 'With LUT'); s = updateLook(l.state, l.look.id, { grade: { ...neutralGrade(), lut: { id: a.id, strength: 70 } } })
    expect(lutLookup(s)(a.id)?.size).toBe(3)
    expect(lutLookup(s)('nope')).toBeUndefined()
    expect(dropUnusedLuts(s).luts).toBeTruthy()
    const unused = updateLook(s, l.look.id, { grade: neutralGrade() })
    expect(dropUnusedLuts(unused).luts).toBeUndefined()
  })
  it('reading saved looks keeps good tables, drops broken ones and the references to them', () => {
    let s = emptyLooks()
    const a = addLut(s, idLut); if (!a.ok) throw new Error(a.error); s = a.state
    const l = addLook(s, 'X'); s = updateLook(l.state, l.look.id, { grade: { ...neutralGrade(), lut: { id: a.id, strength: 60 } } })
    const saved = JSON.parse(JSON.stringify(s))
    expect(readLooks(saved)).toEqual(s)
    saved.luts[a.id].dataB64 = 'AAAA'
    saved.luts.JUNK = 'x'
    const read = readLooks(saved)
    expect(read.luts).toBeUndefined()
    expect(read.looks[0].grade.lut).toBeUndefined()
    expect(readLooks({ looks: [], luts: 5 })).toEqual(emptyLooks())
  })
  it('exports each LUT with its file name (no folders from this machine), colour spaces and log flag, and says nothing is baked in', () => {
    let s = emptyLooks()
    const a = addLut(s, ok(cube3d(2, (r, g, b) => [r, g, b]).replace('"test"', '"C:\\\\Users\\\\me\\\\Warm: film?"'))); if (!a.ok) throw new Error(a.error); s = a.state
    const out = exportLooks(s)
    expect(out.bakedIntoOriginals).toBe(false)
    expect(out.luts).toHaveLength(1)
    expect(out.luts[0]).toMatchObject({ id: a.id, kind: '3d', size: 2, inputSpace: expect.stringMatching(/sRGB/), outputSpace: expect.stringMatching(/sRGB/), suspectedLog: false })
    expect(out.luts[0].file).toMatch(/^Looks\/[A-Za-z0-9._ -]+ \(LUT-[0-9a-f]{8}\)\.cube$/)
    expect(out.luts[0].file).not.toMatch(/Users|C:|\?|:/)
    expect(lutFileName('LUT-1', '')).toBe('Looks/LUT-1 (LUT-1).cube')
  })
})
