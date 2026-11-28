import { describe, expect, it } from 'vitest'
import { ageDetailLine, newSkin, recordSkin, skinLine } from './skin'
import { skinPromptForAge, skinPromptForVariant } from './skinQa'
import { agePrompt, ageRequests, ageViews } from './age'
import { approveRevision, emptyVariations, findEntity, type AgeSpec, type SkinSpec, type VariationState } from './variations'
import { startSkinRefinement, skinRequests } from './skinRefine'
import { startLightingTest, lightingRequests } from './skinLighting'
import { reconcileWithQueue, variationFiles } from './variationSync'
import { variationManifest } from './variationManifest'
import { readVariations, deriveFromLegacy, variationsOf } from './variationMigration'
import { emptyQueue, enqueue, type ImageJob } from './generationQueue'
import { defaultStyleBible } from './visualDevelopment'
import { recordMachine } from './machineLab'
import type { ExtractedAsset } from './productionStudio'

const mara = { id: 'CHAR-MARA', name: 'Mara', type: 'character', sceneIds: [], status: 'approved', age: '34' } as ExtractedAsset
const photo = { ...defaultStyleBible, family: 'Realistic 3D', name: 'Photoreal cinematic CG', rendering: 'photographic' }
const stylized = { ...defaultStyleBible, family: 'Family 3D', name: 'Family 3D Feature', rendering: 'stylized 3D' }
const spec: SkinSpec = { ...newSkin(mara.id), complexion: 'warm olive', undertone: 'golden', marks: [{ what: 'a small scar', where: 'the left eyebrow' }], makeup: 'none' }
const withSkin = (): VariationState => { const m = recordSkin(emptyVariations(), spec, 'Mara', 'a'); if ('error' in m) throw new Error(); return approveRevision(m.state, m.ref) }

describe('7: age variants keep their relationship to the original identity', () => {
  it('age detail is about the surface at that age, in bands, and is never dirt, damage or heavy weathering', () => {
    expect(ageDetailLine('8')).toMatch(/very smooth, fine skin/)
    expect(ageDetailLine('19')).toMatch(/youthful skin with fine texture/)
    expect(ageDetailLine('34')).toMatch(/natural fine texture, with expression lines only where the face makes them/)
    expect(ageDetailLine('52')).toMatch(/fine lines around the eyes and mouth.*without deep wrinkles unless asked for/)
    expect(ageDetailLine('78')).toMatch(/fine wrinkles and softer elasticity, still natural and not heavily weathered/)
    for (const a of ['8', '19', '34', '52', '78']) { const l = ageDetailLine(a)!; expect(l).toMatch(/is not dirt, damage or heavy weathering, and the same marks and complexion are kept/); expect(l.replace(/Aging shows.*$/, '')).not.toMatch(/dirt|damage|weathered by|scar|grime/i) }
    expect(ageDetailLine('about sixty')).toBeUndefined()
    expect(ageDetailLine('300')).toBeUndefined()
  })
  it('the age prompt keeps "the same person", the approved reference and the skin profile: complexion and marks at every age', () => {
    const state = withSkin()
    for (const age of ['30', '50', '70']) {
      const skin = skinPromptForAge(state, mara.id, photo, age)!
      const ageSpec: Omit<AgeSpec, 'characterId'> = { mode: 'same-person', targetAge: age, anchors: ['the eyes'], keep: ['costume', 'marks'] }
      const p = agePrompt({ style: photo, character: mara, spec: { ...ageSpec, characterId: mara.id }, view: ageViews[1], skin })
      expect(p).toMatch(/Show the SAME person at age/)
      expect(p).toMatch(/Reference image 1 is the approved character/)
      expect(p).toContain('Complexion (the person\'s own description, keep it): warm olive.')
      expect(p).toContain('a small scar (the left eyebrow)')
      expect(p).toContain(`Age-appropriate fine detail for about ${age}`)
      expect(p).toMatch(/the same marks and complexion are kept/)
    }
  })
  it('without an approved photorealistic human profile the age prompt gets no skin wording at all', () => {
    const p = (skin?: string) => agePrompt({ style: photo, character: mara, spec: { characterId: mara.id, mode: 'same-person', targetAge: '60' }, view: ageViews[1], ...(skin ? { skin } : {}) })
    expect(p()).not.toMatch(/Skin and surface|Age-appropriate fine detail/)
    expect(skinPromptForAge(emptyVariations(), mara.id, photo, '60')).toBeUndefined()
    expect(skinPromptForAge(withSkin(), mara.id, stylized, '60')).toBeUndefined()
    const robot = recordMachine(withSkin(), { assetId: mara.id, kind: 'android', joints: [], sensors: [], panels: [], intentional: [], never: [] }, 'A', 'a'); if ('error' in robot) throw new Error()
    expect(skinPromptForAge(approveRevision(robot.state, robot.ref), mara.id, photo, '60')).toBeUndefined()
  })
  it('the age request carries the wording and still has exactly one reference, the approved character', () => {
    const skin = skinPromptForAge(withSkin(), mara.id, photo, '60')
    const reqs = ageRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: 'Mara at 60', age: { id: 'AGE-001', revision: 1 }, spec: { characterId: mara.id, mode: 'same-person', targetAge: '60' }, characterPicture: 'C:/m/front.jpg', skin })
    expect(reqs).toHaveLength(2)
    for (const r of reqs) { expect(r.references).toEqual(['C:/m/front.jpg']); expect(r.prompt).toContain('Age-appropriate fine detail for about 60') }
    const plain = ageRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: 'Mara at 60', age: { id: 'AGE-001', revision: 1 }, spec: { characterId: mara.id, mode: 'same-person', targetAge: '60' }, characterPicture: 'C:/m/front.jpg' })
    expect(plain[0].prompt).not.toContain('Skin and surface')
  })
  it('the profile itself is unchanged by an age: ages never edit the approved skin profile', () => {
    const state = withSkin()
    const before = JSON.stringify(findEntity(state, 'SKN-001'))
    skinPromptForAge(state, mara.id, photo, '70')
    expect(JSON.stringify(findEntity(state, 'SKN-001'))).toBe(before)
    expect(skinLine(spec)).not.toMatch(/Age-appropriate/)
  })
  it('a transformation stage that replaces skin gets no human-skin wording for its look', () => {
    expect(skinPromptForVariant(withSkin(), mara.id, photo, 'Canonical')).toMatch(/^Skin and surface/)
  })
})

describe('12: a saved or collected project carries every picture the skin records point at', () => {
  const job = (over: Partial<ImageJob>): ImageJob => ({ id: 'J', key: 'k', assetId: mara.id, variant: 'Canonical', sheetType: 'Identity', viewKey: 'full-front', label: 'x', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false, outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: true, rejected: false, createdAt: 1, updatedAt: 1, outputPath: 'C:/app/assets/orig-full.jpg', ...over } as ImageJob)
  it('refined and lighting pictures, their references and their records are all in the project data, and reading it back loses nothing', () => {
    const base = withSkin()
    const ref = startSkinRefinement(base, { character: mara, now: 'n' }); if ('error' in ref) throw new Error()
    const q0 = { ...emptyQueue(), perImageUsd: 0.04, jobs: [job({ id: 'J-FULL' }), job({ id: 'J-PORT', viewKey: 'portrait', outputPath: 'C:/app/assets/orig-portrait.jpg', fullBody: false })] }
    const rreqs = skinRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: ref.variant, skin: ref.ref, spec: ref.spec, sources: { portrait: 'C:/app/assets/orig-portrait.jpg', 'full-front': 'C:/app/assets/orig-full.jpg' } })
    let q = enqueue(q0, rreqs, 1, true).state
    q = { ...q, jobs: q.jobs.map((j) => (j.variation?.role === 'skin-candidate' ? { ...j, status: 'completed', outputPath: `C:/app/assets/refined-${j.viewKey}.jpg`, approved: j.viewKey === 'portrait' } : j)) as ImageJob[] }
    let state = reconcileWithQueue(ref.variations, q.jobs)
    const lt = startLightingTest(state, { character: mara, now: 'n' }); if ('error' in lt) throw new Error()
    const lreqs = lightingRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: lt.variant, test: lt.ref, spec: ref.spec, source: 'C:/app/assets/refined-portrait.jpg' })
    q = enqueue(q, lreqs, 2, true).state
    q = { ...q, jobs: q.jobs.map((j) => (j.variation?.role === 'lighting-candidate' ? { ...j, status: 'completed', outputPath: `C:/app/assets/light-${j.viewKey}.jpg` } : j)) as ImageJob[] }
    state = reconcileWithQueue(lt.variations, q.jobs)

    const files = variationFiles(state, q.jobs).map((f) => f.absolutePath)
    expect(files).toContain('C:/app/assets/refined-portrait.jpg')
    expect(files).toContain('C:/app/assets/refined-full-front.jpg')
    expect(files.filter((p) => p.includes('light-'))).toHaveLength(4)

    // The project data holds every path (the desktop save copies every assets-folder path it finds anywhere in the project).
    const saved = JSON.stringify({ studio: { queue: q, variations: state } })
    for (const p of ['orig-portrait.jpg', 'orig-full.jpg', 'refined-portrait.jpg', 'refined-full-front.jpg', 'light-light-neutral-diffuse.jpg', 'light-light-backlight.jpg']) expect(saved, p).toContain(p)
    const back = readVariations(JSON.parse(saved).studio.variations)!
    expect(back.entities.map((e) => e.kind).sort()).toEqual(['lighting-test', 'skin'])
    expect(back).toEqual(state) // same content; reading may only reorder the keys inside a record
    const manifest = variationManifest(state, q) as { entities: Array<{ kind: string; revisions: Array<{ dependsOn: Array<{ ref: string }>; media: Array<{ file: string }> }> }>; generation: Array<{ role: string }> }
    expect(manifest.entities.map((e) => e.kind).sort()).toEqual(['lighting-test', 'skin'])
    expect(manifest.entities.find((e) => e.kind === 'lighting-test')!.revisions[0].dependsOn[0].ref).toMatch(/^SKN-001@/)
    expect(new Set(manifest.generation.map((g) => g.role))).toEqual(new Set(['skin-candidate', 'lighting-candidate']))
    expect(JSON.stringify(manifest)).not.toMatch(/api[_-]?key|token|password/i)
  })
  it('11: an older project has no skin or lighting records, opens and saves as it did, and gains nothing', () => {
    const legacy = deriveFromLegacy({ analysis: { assets: [mara] } })
    expect(legacy.entities.filter((e) => e.kind === 'skin' || e.kind === 'lighting-test')).toHaveLength(0)
    expect(variationsOf({ analysis: { assets: [mara] } })).toEqual(legacy)
    expect(JSON.parse(JSON.stringify(readVariations(JSON.parse(JSON.stringify(legacy)))))).toEqual(JSON.parse(JSON.stringify(legacy)))
  })
})
