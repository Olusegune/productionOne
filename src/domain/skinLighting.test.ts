import { describe, expect, it } from 'vitest'
import { addRevision, approveRevision, emptyVariations, findEntity, type LightingTestSpec, type SkinSpec, type VariationState } from './variations'
import { colourReviewQuestions, expectedColourEffect, lightById, lightJobs, lightingBlocker, lightingRequests, lightingSource, lightingTestPrompt, lightingTestStanding, lightingViews, lightViewKey, readLightingTestSpec, SKIN_LIGHTS, startLightingTest } from './skinLighting'
import { LIGHTING_KEYS } from './lighting'
import { newSkin, recordSkin, withPreset } from './skin'
import { startSkinRefinement } from './skinRefine'
import { staleRevisions, dependentsOf } from './variationGraph'
import { reconcileWithQueue } from './variationSync'
import { readVariations } from './variationMigration'
import { emptyQueue, enqueue, type ImageJob, type QueueState } from './generationQueue'
import { defaultStyleBible } from './visualDevelopment'
import type { ExtractedAsset } from './productionStudio'

const mara = { id: 'CHAR-MARA', name: 'Mara', type: 'character', sceneIds: [], status: 'approved', age: '34' } as ExtractedAsset
const photo = { ...defaultStyleBible, family: 'Realistic 3D', name: 'Photoreal cinematic CG', rendering: 'photographic' }
const job = (over: Partial<ImageJob>): ImageJob => ({ id: 'J', key: 'k', assetId: 'CHAR-MARA', variant: 'Canonical', sheetType: 'Identity', viewKey: 'full-front', label: 'x', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false, outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: true, rejected: false, createdAt: 1, updatedAt: 1, outputPath: 'C:/m/full.jpg', ...over } as ImageJob)
const queue = (jobs: ImageJob[]): QueueState => ({ ...emptyQueue(), perImageUsd: 0.04, jobs })

const baseSkin: SkinSpec = { ...withPreset(newSkin(mara.id), 'natural'), complexion: 'warm olive', undertone: 'golden', marks: [{ what: 'a small scar', where: 'the left eyebrow' }] }
function withSkin(spec: SkinSpec = baseSkin): VariationState {
  const made = recordSkin(emptyVariations(), spec, 'Mara', 'a'); if ('error' in made) throw new Error(made.error)
  return approveRevision(made.state, made.ref)
}

describe('the four lights', () => {
  it('are neutral diffuse, soft side, directional and backlight, as plain lighting records with no grading and no skin fields', () => {
    expect(SKIN_LIGHTS.map((l) => l.label)).toEqual(['Neutral diffuse', 'Soft side light', 'Directional light', 'Backlight'])
    for (const l of SKIN_LIGHTS) { for (const k of Object.keys(l.record)) expect(LIGHTING_KEYS, `${l.id}.${k}`).toContain(k); expect(JSON.stringify(l.record)).not.toMatch(/textureDetail|surfaceFinish|complexion|LUT|grade/) }
    expect(lightById('neutral-diffuse')?.record.sourceSize).toBe('large')
    expect(lightById('directional')?.record.sourceSize).toBe('small')
    expect(lightById('backlight')?.record.rim).toBe(true)
    expect(lightingViews.map((v) => v.key)).toEqual(SKIN_LIGHTS.map((l) => lightViewKey(l.id)))
  })
  it('the backlight keeps the face readable (it is not a silhouette)', () => {
    expect(lightById('backlight')?.record.presetId).toBe('skin-backlight')
    expect(lightById('backlight')?.record.ambient).toBe('normal')
  })
})

describe('what stays the same in every light, and what only changes', () => {
  const spec = baseSkin
  const prompts = SKIN_LIGHTS.map((light, i) => lightingTestPrompt({ style: photo, character: mara, spec, light, view: lightingViews[i], model: 'gpt-image-1' }))
  it('the skin wording, protected features, complexion and marks are word for word the same in all four prompts', () => {
    for (const p of prompts) {
      expect(p).toContain('Complexion (the person\'s own description, keep it): warm olive.')
      expect(p).toContain('keep each exactly where it is: a small scar (the left eyebrow)')
      expect(p).toMatch(/Preserve the facial structure, the complexion, the apparent age, the expression, the hairstyle and the distinctive marks\./)
      expect(p).toMatch(/Do not replace the face, change the apparent age, change the expression or redesign the costume\./)
    }
    const skinOf = (p: string) => p.split('\n').filter((l) => l.startsWith('Skin and surface'))[0]
    expect(new Set(prompts.map(skinOf)).size).toBe(1)
  })
  it('only the lighting sentence differs between the lights', () => {
    const strip = (p: string) => p.split('\n').filter((l) => !/^Lighting:|^Production reference image:|^Head-and-shoulders portrait/.test(l)).join('\n')
    expect(new Set(prompts.map(strip)).size).toBe(1)
    expect(new Set(prompts.map((p) => p.split('\n').find((l) => l.startsWith('Lighting:')))).size).toBe(4)
  })
  it('says it is real light, never a colour filter, a grade or a LUT', () => {
    for (const p of prompts) { expect(p).toMatch(/real light falling on the subject, not a colour filter or tint/); expect(p).not.toMatch(/\bLUT\b|grade|grading/i) }
  })
  it('does not remove a warm cast the person wrote: a golden undertone drops the "no yellow" instruction; a neutral one keeps it', () => {
    const run = (undertone: string, complexion: string) => lightingTestPrompt({ style: photo, character: mara, spec: { ...spec, undertone, complexion }, light: SKIN_LIGHTS[0], view: lightingViews[0], model: 'gpt-image-1' })
    expect(run('neutral', 'olive')).toMatch(/no yellow, sepia or golden tint/)
    expect(run('golden', 'olive')).not.toMatch(/no yellow, sepia or golden tint/)
  })
})

describe('colour is judged against the reference and the light, by a person', () => {
  it('states what a warm, neutral and cool light is expected to do, and asks identity, complexion and surface separately', () => {
    const l = SKIN_LIGHTS[0].record
    expect(expectedColourEffect({ ...l, colorTempK: 3200 })).toMatch(/warm light.*expected to warm the skin\. That can be intentional/)
    expect(expectedColourEffect({ ...l, colorTempK: 7500 })).toMatch(/cool light.*expected to cool the skin/)
    expect(expectedColourEffect({ ...l, colorTempK: 5600 })).toMatch(/near-neutral.*stay close to the approved reference/)
    const q = colourReviewQuestions(l, baseSkin)
    expect(q).toHaveLength(3)
    expect(q[0]).toMatch(/same person.*age, expression and marks/)
    expect(q[1]).toMatch(/complexion \("warm olive"\).*allowing for this light/)
    expect(q[2]).toMatch(/not smoothed to plastic/)
  })
})

describe('the starting picture and the reasons a test cannot start', () => {
  const originals = [job({ id: 'J-FULL' }), job({ id: 'J-PORT', viewKey: 'portrait', outputPath: 'C:/m/portrait.jpg', fullBody: false })]
  it('prefers the approved refined picture, falls back to the approved original, and never uses an unapproved one', () => {
    const state = withSkin()
    const started = startSkinRefinement(state, { character: mara, now: 'n' }); if ('error' in started) throw new Error()
    const refined = job({ id: 'R1', variant: started.variant, viewKey: 'portrait', outputPath: 'C:/m/refined-portrait.jpg', approved: true, fullBody: false })
    const approvedState = approveRevision(started.variations, started.ref)
    expect(lightingSource(queue([...originals, refined]), approvedState, mara)).toEqual({ path: 'C:/m/refined-portrait.jpg', kind: 'refined' })
    expect(lightingSource(queue([...originals, { ...refined, approved: false }]), approvedState, mara)).toEqual({ path: 'C:/m/portrait.jpg', kind: 'original' })
    expect(lightingSource(queue([job({ id: 'J-FULL' })]), state, mara)).toEqual({ path: 'C:/m/full.jpg', kind: 'original' })
    expect(lightingSource(queue([]), state, mara)).toBeUndefined()
  })
  it('names the first missing thing and starts nothing', () => {
    const base = { style: photo, state: withSkin(), character: mara, source: 'C:/m/p.jpg', takesReferences: true }
    expect(lightingBlocker(base)).toBeUndefined()
    expect(lightingBlocker({ ...base, style: { family: '2D', name: 'Ink', rendering: 'flat 2D' } })).toMatch(/not photorealistic/)
    expect(lightingBlocker({ ...base, state: emptyVariations() })).toMatch(/Save and approve the skin profile first/)
    expect(lightingBlocker({ ...base, source: undefined })).toMatch(/Approve Mara's front view first/)
    expect(lightingBlocker({ ...base, takesReferences: false })).toMatch(/cannot take the approved picture as a reference/)
    expect('error' in startLightingTest(emptyVariations(), { character: mara, now: 'n' })).toBe(true)
  })
})

describe('lighting is its own record, pinned to the skin profile it was made with', () => {
  it('stores the four setups apart from the skin profile, which gains no lighting fields', () => {
    const state = withSkin()
    const t = startLightingTest(state, { character: mara, now: 'n' }); if ('error' in t) throw new Error()
    const test = findEntity(t.variations, t.ref.id)!
    const spec = test.revisions[0].spec as LightingTestSpec
    expect(spec.skin).toEqual({ id: 'SKN-001', revision: 1 })
    expect(spec.setups.map((s) => s.id)).toEqual(['neutral-diffuse', 'soft-side', 'directional', 'backlight'])
    expect(JSON.stringify(spec)).not.toMatch(/textureDetail|complexion|marks/)
    expect(JSON.stringify(findEntity(t.variations, 'SKN-001'))).not.toMatch(/keyAzimuth|colorTempK|setups/)
    expect(test.revisions[0].status).toBe('candidate')
    expect(t.variant).toBe('Mara, lighting test')
  })
  it('a repeat is a new revision of the same record; history is kept', () => {
    const t1 = startLightingTest(withSkin(), { character: mara, now: 'a' }); if ('error' in t1) throw new Error()
    const t2 = startLightingTest(t1.variations, { character: mara, now: 'b' }); if ('error' in t2) throw new Error()
    expect(t2.ref).toEqual({ id: t1.ref.id, revision: 2 })
    expect(findEntity(t2.variations, t1.ref.id)!.revisions).toHaveLength(2)
  })
  it('a newer approved skin profile marks the approved test out of date, and only that', () => {
    const t = startLightingTest(withSkin(), { character: mara, now: 'n' }); if ('error' in t) throw new Error()
    let s = approveRevision(t.variations, t.ref)
    expect(staleRevisions(s)).toEqual([])
    expect(lightingTestStanding(s, mara.id)?.outOfDate).toBe(false)
    expect(dependentsOf(s, { id: 'SKN-001', revision: 1 })).toEqual([t.ref])
    const next = addRevision(s, 'SKN-001', { spec: { ...baseSkin, preset: 'weathered', textureDetail: 'pronounced' }, now: 'x' })
    s = approveRevision(next.state, next.ref)
    expect(staleRevisions(s).map((x) => x.ref.id)).toEqual([t.ref.id])
    expect(lightingTestStanding(s, mara.id)?.outOfDate).toBe(true)
    expect(approveRevision).toBeTypeOf('function')
  })
})

describe('requests, approval and reading back', () => {
  const started = startLightingTest(withSkin(), { character: mara, now: 'n' })
  if ('error' in started) throw new Error()
  const reqs = lightingRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: started.variant, test: started.ref, spec: baseSkin, source: 'C:/m/refined.jpg' })
  it('builds one request per light with exactly one reference; only enqueue queues them, and nothing is approved automatically', () => {
    expect(reqs.map((r) => r.viewKey)).toEqual(SKIN_LIGHTS.map((l) => lightViewKey(l.id)))
    for (const r of reqs) { expect(r.references).toEqual(['C:/m/refined.jpg']); expect(r.useAnchor).toBe(false); expect(r.variation?.role).toBe('lighting-candidate') }
    const q = enqueue(queue([]), reqs, 1, true)
    expect(q.added).toBe(4)
    expect(q.state.jobs.every((j) => !j.approved)).toBe(true)
    expect(Object.values(lightJobs(q.state, started.ref)).filter(Boolean)).toHaveLength(4)
  })
  it('approving one light approves the test record with that picture; turning all down rejects it; the skin profile is untouched', () => {
    const q = enqueue(queue([]), reqs, 1, true).state
    const done = q.jobs.filter((j) => j.variation).map((j) => ({ ...j, status: 'completed' as const, outputPath: `C:/m/${j.viewKey}.jpg` }))
    const keep = reconcileWithQueue(started.variations, done.map((j) => (j.viewKey === 'light-backlight' ? { ...j, approved: true } : j)))
    const test = findEntity(keep, started.ref.id)!
    expect(test.revisions[0].status).toBe('approved')
    expect(test.revisions[0].media.find((m) => m.role === 'approved')?.view).toBe('light-backlight')
    expect(findEntity(keep, 'SKN-001')!.revisions).toHaveLength(1)
    const gone = reconcileWithQueue(started.variations, done.map((j) => ({ ...j, rejected: true })))
    expect(findEntity(gone, started.ref.id)!.revisions[0].status).toBe('rejected')
  })
  it('survives a save and reload, and drops unreadable settings', () => {
    const approved = approveRevision(started.variations, started.ref)
    const back = readVariations(JSON.parse(JSON.stringify(approved)))!
    expect(findEntity(back, started.ref.id)!.revisions[0].spec).toEqual(findEntity(approved, started.ref.id)!.revisions[0].spec)
    expect(readLightingTestSpec({ characterId: 'C', skin: { id: 'SKN-001', revision: 0 }, setups: [{ id: 'a', label: 'A', record: {} }] })).toBeUndefined()
    expect(readLightingTestSpec({ characterId: 'C', skin: { id: 'SKN-001', revision: 1 }, setups: [] })).toBeUndefined()
    expect(readLightingTestSpec({ characterId: 'C', skin: { id: 'SKN-001', revision: 1 }, setups: [{ id: 'a', label: 'A', record: { keyAzimuth: 999, colorTempK: 'hot' } }, 5] })?.setups).toHaveLength(1)
    expect(readLightingTestSpec('x')).toBeUndefined()
  })
})
