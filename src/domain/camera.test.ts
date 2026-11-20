import { describe, expect, it } from 'vitest'
import { CAMERA_DISCLAIMER, applyCameraPreset, cameraPresets, cameraWords, distanceForFill, fieldOfView, focalForHorizontalFov, frameFill, perspectiveRatio, presetById, sensorFor, sensors } from './camera'
import { adviseShot } from './coverageAdvice'
import { buildShotPrompt, defaultLens } from './direct'
import { describeLighting, LIGHTING_KEYS, lightingPresets, lightingTestPrompts, readLighting, shadowAzimuth } from './lighting'
import type { AnalysisResult, ShotRecord } from './productionStudio'
import { styleByName } from './demo2d'
import { defaultStyleBible } from './visualDevelopment'

const full = sensorFor('full-frame')

describe('field of view', () => {
  it('matches the documented formula 2 x atan(sensor / (2 x focal length))', () => {
    expect(fieldOfView(50, full)).toEqual({ horizontal: 39.6, vertical: 27, diagonal: 46.8 })
    expect(fieldOfView(24, full).horizontal).toBe(73.7)
    expect(fieldOfView(85, full).horizontal).toBe(23.9)
  })
  it('the same lens sees wider on a bigger sensor and narrower on a smaller one', () => {
    const f = 35
    expect(fieldOfView(f, sensorFor('imax-65')).horizontal).toBeGreaterThan(fieldOfView(f, full).horizontal)
    expect(fieldOfView(f, sensorFor('micro-four-thirds')).horizontal).toBeLessThan(fieldOfView(f, full).horizontal)
  })
  it('"not set" assumes Super 35 and says so', () => {
    expect(sensorFor(undefined).assumed).toBe(true)
    expect(sensorFor('unspecified').widthMm).toBe(sensorFor('super-35').widthMm)
    expect(sensors.find((s) => s.id === 'unspecified')!.label).toMatch(/assumes Super 35/)
  })
  it('focal length from a field of view is the inverse', () => {
    for (const f of [18, 35, 50, 85, 135]) expect(focalForHorizontalFov(fieldOfView(f, full).horizontal, full)).toBeCloseTo(f, 0)
  })
})

describe('perspective is set by position, not by focal length', () => {
  it('a different focal length at the same place changes the framing but not the near/far size ratio', () => {
    const near = 3, far = 9
    const ratioA = perspectiveRatio(near, far)
    const fillWide = frameFill(1.8, near, 24, full)
    const fillLong = frameFill(1.8, near, 85, full)
    expect(fillLong).toBeGreaterThan(fillWide)
    expect(perspectiveRatio(near, far)).toBe(ratioA)
    expect(ratioA).toBeCloseTo(1 / 3, 3)
  })
  it('moving the camera changes perspective', () => {
    expect(perspectiveRatio(1.5, 9)).toBeLessThan(perspectiveRatio(6, 9))
  })
  it('refilling the frame with a longer lens means standing farther back, which flattens the perspective', () => {
    const subject = 1.8
    const d24 = distanceForFill(subject, 0.8, 24, full)
    const d85 = distanceForFill(subject, 0.8, 85, full)
    expect(d85).toBeGreaterThan(d24)
    const background = 20
    expect(perspectiveRatio(d85, d85 + background)).toBeGreaterThan(perspectiveRatio(d24, d24 + background))
    expect(frameFill(subject, d24, 24, full)).toBeCloseTo(0.8, 2)
  })
  it('a camera at the subject has no valid perspective', () => {
    expect(perspectiveRatio(0, 5)).toBeNaN()
    expect(frameFill(1.8, 0, 50, full)).toBe(Infinity)
  })
})

describe('camera presets', () => {
  it('lists the eight starter presets, each with a stated purpose', () => {
    expect(cameraPresets.map((p) => p.id)).toEqual(['intimate-dialogue', 'environment-portrait', 'restrained-close-up', 'wide-architectural', 'low-angle-confrontation', 'graphic-tableau', 'miniature-observation', 'handheld-documentary'])
    for (const p of cameraPresets) { expect(p.purpose.length).toBeGreaterThan(20); expect(p.focalMm).toBeGreaterThan(8) }
  })
  it('applying one copies values into the shot and touches nothing else', () => {
    const { fields, camera } = applyCameraPreset(presetById('low-angle-confrontation')!)
    expect(Object.keys(fields).sort()).toEqual(['angle', 'composition', 'lens', 'movement', 'size'])
    expect(camera.presetId).toBe('low-angle-confrontation')
    fields.composition.push('edited')
    expect(presetById('low-angle-confrontation')!.composition).not.toContain('edited')
  })
  it('does not claim to simulate equipment', () => {
    expect(CAMERA_DISCLAIMER).toMatch(/do not simulate a physical camera/)
    for (const p of cameraPresets) expect(`${p.label} ${p.purpose}`).not.toMatch(/b(ARRI|Panavision|Zeiss|Cooke|Canon|Sony|RED)b/)
  })
})

describe('camera words for a prompt', () => {
  it('adds nothing without a camera record', () => { expect(cameraWords(undefined, 50, false)).toBe('') })
  it('gives photographic styles a field of view, depth of field and optical character', () => {
    const text = cameraWords({ height: 'low', dof: 'shallow', sensor: 'full-frame', optical: 'clean', distanceM: 2.5 }, 50, false)
    expect(text).toMatch(/field of view of about 39.6 degrees/)
    expect(text).toMatch(/shallow depth of field/)
    expect(text).toMatch(/2.5 m from the subject/)
    expect(text).toMatch(/a guide, not a simulation/)
  })
  it('gives flat 2D styles virtual framing only: no blur, distortion or lens artefacts requested', () => {
    const text = cameraWords({ height: 'eye', dof: 'shallow', sensor: 'full-frame', optical: 'soft-vintage' }, 50, true)
    expect(text).toMatch(/virtual framing/)
    expect(text).toMatch(/no photographic blur, lens distortion or lens flare/)
    expect(text).not.toMatch(/degrees|shallow depth|vintage/)
  })
})

const shot = (over: Partial<ShotRecord> = {}): ShotRecord => ({ id: 'SHOT-001', sceneId: 'SC-1', order: 1, duration: 4, assetIds: [], action: 'He waits.', dialogue: '', speaker: '', emotionalObjective: '', facialActing: '', bodyLanguage: '', microAnimation: '', cameraFraming: '', cameraMovement: '', lighting: 'Bright natural daylight', soundEffects: '', ambience: '', music: '', transition: 'Cut', storyboardStatus: 'planned', size: 'MS', angle: 'eye-level', lens: 40, movement: 'static', ...over })
const analysis: AnalysisResult = { scenes: [{ id: 'SC-1', heading: 'INT. KITCHEN - DAY', setting: 'KITCHEN', timeOfDay: 'DAY', summary: '', assetIds: [], startLine: 1, endLine: 2 } as never], assets: [] }

describe('the shot prompt', () => {
  it('is unchanged for a shot with no camera or lighting record', () => {
    const text = buildShotPrompt(shot(), analysis, defaultStyleBible, [])
    expect(text).not.toMatch(/Camera direction/)
    expect(text).toMatch(/Lighting: Bright natural daylight\./)
  })
  it('adds the camera direction line and uses the lighting record instead of the text, in a photographic style', () => {
    const text = buildShotPrompt(shot({ camera: { dof: 'shallow', sensor: 'super-35' }, lightingRecord: lightingPresets.find((p) => p.id === 'moonlight')!.record }), analysis, defaultStyleBible, [])
    expect(text).toMatch(/Camera direction/)
    expect(text).toMatch(/Lighting: key light from behind/)
    expect(text).not.toMatch(/Bright natural daylight/)
  })
  it('in a flat 2D style never asks for lens effects', () => {
    const text = buildShotPrompt(shot({ camera: { dof: 'shallow', optical: 'anamorphic-feel' } }), analysis, styleByName('Flat vector'), [])
    expect(text).toMatch(/virtual framing/)
    expect(text).not.toMatch(/anamorphic|shallow depth/)
  })
  it('lens stays tied to shot size by default (existing behaviour kept)', () => { expect(defaultLens.CU).toBe(85) })
})

describe('lighting records', () => {
  it('hold no grading fields: lighting and grade are separate records', () => {
    for (const k of LIGHTING_KEYS) expect(k).not.toMatch(/grade|lut|saturation|curve|whitebalance|tint|gamma|lift|gain/i)
    for (const p of lightingPresets) expect(Object.keys(p.record).every((k) => (LIGHTING_KEYS as string[]).includes(k))).toBe(true)
  })
  it('lists the eight presets, each within range', () => {
    expect(lightingPresets.map((p) => p.id)).toEqual(['neutral-reference', 'soft-daylight', 'overcast-exterior', 'warm-practical-interior', 'moonlight', 'backlight-silhouette', 'hard-side-light', 'miniature-stage'])
    for (const { record: r } of lightingPresets) { expect(r.keyAzimuth).toBeGreaterThanOrEqual(-180); expect(r.keyAzimuth).toBeLessThanOrEqual(180); expect(r.keyElevation).toBeGreaterThanOrEqual(0); expect(r.keyElevation).toBeLessThanOrEqual(90) }
  })
  it('the shadows fall opposite the key light', () => {
    expect(shadowAzimuth({ ...lightingPresets[0].record, keyAzimuth: 90 })).toBe(-90)
    expect(shadowAzimuth({ ...lightingPresets[0].record, keyAzimuth: -45 })).toBe(135)
    expect(shadowAzimuth({ ...lightingPresets[0].record, keyAzimuth: 0 })).toBe(180)
  })
  it('describes direction, source, contrast, colour and intention in words', () => {
    const text = describeLighting(lightingPresets.find((p) => p.id === 'hard-side-light')!.record)
    expect(text).toMatch(/from the side, frame right/)
    expect(text).toMatch(/small hard source/)
    expect(text).toMatch(/high contrast/)
    expect(text).toMatch(/warm white colour \(about 4500 K\)/)
  })
  it('reads damaged saved data into valid values, and ignores non-objects', () => {
    expect(readLighting('x')).toBeUndefined()
    const r = readLighting({ keyAzimuth: 900, keyElevation: -5, sourceSize: 'huge', colorTempK: 'hot', rim: 'yes', exposure: 'over', extra: 1, grade: { lut: 'a.cube' } })!
    expect(r).toMatchObject({ keyAzimuth: 180, keyElevation: 0, sourceSize: 'medium', colorTempK: 5500, rim: false, exposure: 'over' })
    expect(Object.keys(r)).not.toContain('grade')
    expect(Object.keys(r).every((k) => (LIGHTING_KEYS as string[]).includes(k))).toBe(true)
  })
})

describe('character lighting test', () => {
  it('makes one prompt per condition with the neutral reference first, and only the lighting changes', () => {
    const items = lightingTestPrompts('MARCUS, a weathered fisherman in a wool coat', 'medium close-up, front view')
    expect(items).toHaveLength(8)
    expect(items[0].presetId).toBe('neutral-reference')
    for (const i of items) expect(i.prompt).toContain('MARCUS, a weathered fisherman in a wool coat')
    for (const i of items) expect(i.prompt).toContain('medium close-up, front view')
    expect(new Set(items.map((i) => i.prompt)).size).toBe(8)
    expect(lightingTestPrompts('x', 'y', ['moonlight'])).toHaveLength(1)
  })
})

describe('coverage advice', () => {
  const base = shot({ id: 'SHOT-002', coverage: 'single', emotion: 'sadness', emotionIntensity: 8 })
  it('gives a short reason and honest limits, and never changes the plan', () => {
    const plan = [shot(), base]
    const before = JSON.stringify(plan)
    const advice = adviseShot(base, { sceneShots: plan, styleName: 'Restrained Cinematic Realism', hasSet: true, characters: 1 })
    expect(JSON.stringify(plan)).toBe(before)
    expect(advice.length).toBeGreaterThan(0)
    for (const a of advice) { expect(a.rationale.length).toBeGreaterThan(10); expect(a.limits).toMatch(/cannot judge/); expect(['low', 'medium']).toContain(a.confidence) }
    expect(advice.map((a) => a.preset.id)).toContain('restrained-close-up')
  })
  it('asks for a wide frame only when the scene has none', () => {
    const withWide = [shot({ coverage: 'establishing', size: 'WS' }), base]
    expect(adviseShot(base, { sceneShots: withWide, styleName: '', hasSet: true, characters: 1 }).map((a) => a.preset.id)).not.toContain('wide-architectural')
    expect(adviseShot(base, { sceneShots: [base], styleName: '', hasSet: true, characters: 1 }).map((a) => a.preset.id)).toContain('wide-architectural')
  })
  it('suggests a dialogue frame for two people speaking, and a low angle for anger', () => {
    const talk = shot({ id: 'S3', dialogue: 'Where were you?', coverage: 'single', size: 'WS' })
    expect(adviseShot(talk, { sceneShots: [talk], styleName: '', hasSet: false, characters: 2 }).map((a) => a.preset.id)).toContain('intimate-dialogue')
    const angry = shot({ id: 'S4', emotion: 'anger', emotionIntensity: 6 })
    expect(adviseShot(angry, { sceneShots: [angry], styleName: '', hasSet: false, characters: 1 }).map((a) => a.preset.id)).toContain('low-angle-confrontation')
  })
  it('does not suggest what the shot already is, and reads the style', () => {
    const already = shot({ id: 'S5', size: 'MCU', angle: 'eye-level', movement: 'static', dialogue: 'Hi', coverage: 'single' })
    expect(adviseShot(already, { sceneShots: [already], styleName: '', hasSet: false, characters: 2 }).map((a) => a.preset.id)).not.toContain('intimate-dialogue')
    expect(adviseShot(shot(), { sceneShots: [shot()], styleName: 'Documentary Naturalism', hasSet: false, characters: 1 }).map((a) => a.preset.id)).toContain('handheld-documentary')
    expect(adviseShot(shot(), { sceneShots: [shot()], styleName: 'Flat vector', hasSet: false, characters: 1 }).map((a) => a.preset.id)).toContain('graphic-tableau')
  })
})

describe("camera and lighting documentation matches the code", () => {
  it("lists every sensor, camera preset and lighting preset with its numbers", async () => {
    const { readFileSync } = await import("node:fs")
    const doc = readFileSync("docs/design/camera-lighting.md", "utf8")
    for (const s of sensors) expect(doc).toContain(`| ${s.label} | ${s.widthMm} | ${s.heightMm} |`)
    for (const p of cameraPresets) expect(doc).toContain(`| ${p.label} | ${p.size} | ${p.angle} | ${p.focalMm} |`)
    for (const p of lightingPresets) expect(doc).toContain(`| ${p.label} | ${p.record.keyAzimuth} | ${p.record.keyElevation} |`)
  })
})
