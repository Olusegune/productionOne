import { describe, expect, it } from 'vitest'
import { COLOUR_SHIFT, ROUGH_ABOVE, SKIN_CHECKER, SKIN_NOT_CHECKED, SKIN_QA_LABELS, SMOOTH_BELOW, skinCheckApplies, skinPromptForVariant, skinSurfaceReport, stageReplacesSkin, toReviewFindings, type SkinMetrics } from './skinQa'
import { approveRevision, createEntity, emptyVariations, type TransformationSpec, type VariationState } from './variations'
import { newSkin, recordSkin } from './skin'
import { recordMachine } from './machineLab'
import { SKIN_LIGHTS } from './skinLighting'
import type { ImageJob } from './generationQueue'

const photo = { family: 'Realistic 3D', name: 'Photoreal cinematic CG', rendering: 'photographic' }
const stylized = { family: 'Family 3D', name: 'Family 3D Feature', rendering: 'stylized 3D' }
const base: SkinMetrics = { texture: 100, highlight: 0.01, r: 150, g: 120, b: 100, usedHead: true }
const same = { original: base, candidate: { ...base } }
const job = { id: 'J1', assetId: 'C1', revision: 2 } as ImageJob

describe('what the skin surface check can say', () => {
  it('passes only "for the checks performed" and names everything it cannot see', () => {
    const r = skinSurfaceReport({ measurement: same })
    expect(r.state).toBe('passed')
    expect(SKIN_QA_LABELS[r.state]).toBe('Passed for the checks performed')
    expect(r.findings).toEqual([])
    expect(r.checked).toHaveLength(3)
    expect(r.notChecked).toEqual(SKIN_NOT_CHECKED)
    expect(r.notChecked.join(' ')).toMatch(/Identity.*aging.*marks.*Makeup.*views.*halos/i)
    expect(r.checker).toBe(SKIN_CHECKER)
  })
  it('the four honest states have their exact wording', () => {
    expect(Object.values(SKIN_QA_LABELS)).toEqual(['Not checked', 'Needs review', 'Passed for the checks performed', 'Unable to check'])
  })
  it('smoother than the original by enough is flagged, with the measured proportion as evidence and the caveat', () => {
    const r = skinSurfaceReport({ measurement: { original: base, candidate: { ...base, texture: 100 * (SMOOTH_BELOW - 0.1) } } })
    expect(r.state).toBe('needs-review')
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]).toMatchObject({ kind: 'smoothing', severity: 'medium', checker: SKIN_CHECKER })
    expect(r.findings[0].evidence).toBe("Fine-detail energy in the face (found automatically) is 50% of the original's.")
    expect(r.findings[0].uncertainty).toMatch(/Heuristic\. A difference can also come from framing, focus or resolution/)
    expect(r.findings[0].action).toMatch(/higher texture detail/)
  })
  it('just above the threshold is not flagged; much rougher is', () => {
    expect(skinSurfaceReport({ measurement: { original: base, candidate: { ...base, texture: 100 * (SMOOTH_BELOW + 0.05) } } }).findings).toEqual([])
    const rough = skinSurfaceReport({ measurement: { original: base, candidate: { ...base, texture: 100 * (ROUGH_ABOVE + 0.5) } } })
    expect(rough.findings[0].kind).toBe('over-texture')
    expect(rough.findings[0].evidence).toMatch(/230% of the original's/)
  })
  it('more, broader very bright area is flagged as possible uniform shine, with both shares', () => {
    const r = skinSurfaceReport({ measurement: { original: base, candidate: { ...base, highlight: 0.2 } } })
    expect(r.findings.map((f) => f.kind)).toEqual(['shine'])
    expect(r.findings[0].evidence).toBe('20% of the measured area is very bright, against 1% in the original.')
    expect(skinSurfaceReport({ measurement: { original: base, candidate: { ...base, highlight: 0.02 } } }).findings).toEqual([])
  })
  it('a colour shift is flagged against the reference; under a warm light it is only a note that the light may explain it', () => {
    const shifted = { ...base, r: 150 + 30, g: 120 - 10, b: 100 - 20 }
    const plain = skinSurfaceReport({ measurement: { original: base, candidate: shifted } })
    expect(plain.findings[0]).toMatchObject({ kind: 'colour-shift', severity: 'medium', title: 'Possible complexion shift' })
    expect(plain.findings[0].uncertainty).toMatch(/Warm light and natural undertones can be intentional/)
    const warm = skinSurfaceReport({ measurement: { original: base, candidate: shifted }, light: { ...SKIN_LIGHTS[0].record, colorTempK: 3200 } })
    expect(warm.findings[0]).toMatchObject({ severity: 'low', title: 'Average colour differs, which this light may explain' })
    expect(warm.findings[0].uncertainty).toMatch(/A warm light \(about 3200 K\) is expected to warm the skin/)
    expect(Math.abs(150 / 370 - 180 / 370)).toBeGreaterThan(COLOUR_SHIFT)
  })
  it('does not remove or "correct" a cast: the report only describes, it never offers a colour filter', () => {
    const r = skinSurfaceReport({ measurement: { original: base, candidate: { ...base, r: 190 } } })
    expect(JSON.stringify(r)).not.toMatch(/remove yellow|colour filter|\bgrade\b|\bLUT\b|white balance/i)
  })
  it('says when it could not measure, and when the original has no detail to compare', () => {
    const unable = skinSurfaceReport({ measurement: null, error: 'Could not open the image' })
    expect(unable).toMatchObject({ state: 'unable', findings: [], checked: [] })
    expect(unable.note).toBe('The pictures could not be measured: Could not open the image')
    const flat = skinSurfaceReport({ measurement: { original: { ...base, texture: 0.2 }, candidate: { ...base, texture: 80 } } })
    expect(flat.note).toMatch(/almost no fine detail.*texture could not be compared/)
    expect(flat.checked).toHaveLength(2)
    expect(flat.findings.some((f) => f.kind === 'smoothing' || f.kind === 'over-texture')).toBe(false)
  })
  it('says where it measured: the found head, or a fixed middle area when no head was found', () => {
    expect(skinSurfaceReport({ measurement: { original: { ...base, usedHead: false }, candidate: { ...base, texture: 10, usedHead: false } } }).findings[0].region).toMatch(/no head was found, so a fixed area was measured/)
  })
})

describe('findings for the Review screen', () => {
  it('are category L, open, deterministic, never auto-resolved, with about-half confidence, evidence, uncertainty, action and checker version', () => {
    const r = skinSurfaceReport({ measurement: { original: base, candidate: { ...base, texture: 20, highlight: 0.3 } } })
    const f = toReviewFindings(r, job)
    expect(f.map((x) => x.category)).toEqual(['L', 'L'])
    expect(f.every((x) => x.status === 'open' && x.source === 'deterministic' && x.confidence === 0.5 && x.outputJobId === 'J1' && x.outputRevision === 2)).toBe(true)
    expect(f[0].observed).toMatch(/Possible excessive smoothing: Fine-detail energy.*Heuristic/)
    expect(f[0].sourceRule).toMatch(/Skin surface heuristics v1.*Advisory heuristics/)
    expect(f[0].suggestedAction).toBeTruthy()
    expect(new Set(f.map((x) => x.id)).size).toBe(2)
    expect(toReviewFindings(skinSurfaceReport({ measurement: same }), job)).toEqual([])
  })
})

describe('human-skin checks do not apply to robots, stylized styles or skin-replacing stages', () => {
  const withSkin = (): VariationState => { const m = recordSkin(emptyVariations(), newSkin('C1'), 'Mara', 'a'); if ('error' in m) throw new Error(); return approveRevision(m.state, m.ref) }
  const stage = (s: VariationState, spec: Partial<TransformationSpec>) => createEntity(s, 'transformation', { name: 'stage', characterId: 'C1', spec: { characterId: 'C1', stage: 'full form', kind: 'Robotic or cybernetic', intensity: 5, variant: 'Mara, full form', ...spec } as TransformationSpec, now: 'x' }).state
  it('an ordinary photorealistic character is checked, and gets the skin wording', () => {
    const s = withSkin()
    expect(skinCheckApplies({ style: photo, state: s, characterId: 'C1' })).toEqual({ applies: true, reason: '' })
    expect(skinPromptForVariant(s, 'C1', photo, undefined)).toMatch(/^Skin and surface/)
  })
  it('a stylized or 2D style is never checked or pushed toward realism', () => {
    const s = withSkin()
    expect(skinCheckApplies({ style: stylized, state: s, characterId: 'C1' }).applies).toBe(false)
    expect(skinPromptForVariant(s, 'C1', stylized, undefined)).toBeUndefined()
  })
  it('a character declared as a machine is not judged as human skin and gets no skin wording', () => {
    const m = recordMachine(withSkin(), { assetId: 'C1', kind: 'robot', joints: [], sensors: [], panels: [], intentional: [], never: [] }, 'R1', 'a'); if ('error' in m) throw new Error()
    const s = approveRevision(m.state, m.ref)
    expect(skinCheckApplies({ style: photo, state: s, characterId: 'C1' })).toMatchObject({ applies: false, reason: expect.stringMatching(/declared as a machine/) })
    expect(skinPromptForVariant(s, 'C1', photo, undefined)).toBeUndefined()
  })
  it('a transformation stage that replaces skin is excluded for that look only; a mild stage and the base look are still checked', () => {
    const full = stage(withSkin(), {})
    expect(skinCheckApplies({ style: photo, state: full, characterId: 'C1', variant: 'Mara, full form' })).toMatchObject({ applies: false, reason: expect.stringMatching(/replaces human skin/) })
    expect(skinPromptForVariant(full, 'C1', photo, 'Mara, full form')).toBeUndefined()
    expect(skinCheckApplies({ style: photo, state: full, characterId: 'C1' }).applies).toBe(true)
    expect(skinCheckApplies({ style: photo, state: full, characterId: 'C1', variant: 'Canonical' }).applies).toBe(true)
    const mild = stage(withSkin(), { kind: 'Zombie or infected', intensity: 2, stage: 'subtle', variant: 'Mara, subtle' })
    expect(skinCheckApplies({ style: photo, state: mild, characterId: 'C1', variant: 'Mara, subtle' }).applies).toBe(true)
  })
  it('recognises skin-replacing stages by kind and intensity or by what the person wrote about the skin', () => {
    expect(stageReplacesSkin({ kind: 'Robotic or cybernetic', intensity: 5 })).toBe(true)
    expect(stageReplacesSkin({ kind: 'Animal or creature hybrid', intensity: 2, details: { skin: 'covered in grey scales' } })).toBe(true)
    expect(stageReplacesSkin({ kind: 'Zombie or infected', intensity: 2 })).toBe(false)
    expect(stageReplacesSkin({ kind: 'Custom', intensity: 5 })).toBe(false)
    expect(stageReplacesSkin(undefined)).toBe(false)
  })
})
