import { describe, expect, it } from 'vitest'
import { emptyQueue, enqueue, type ImageJob } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import { defaultStyleBible } from './visualDevelopment'
import { styleByName } from './demo2d'
import { staleRevisions } from './variationGraph'
import { reconcileWithQueue } from './variationSync'
import { addRevision, approveRevision, emptyVariations, findRevision, type AgeSpec, type FitSpec, type LookSpec, type VariationState } from './variations'
import { ageCapability, ageDirection, ageNumber, agePrompt, ageRequests, ageViews, checkAgeSpec, defaultAgeKeep } from './age'
import { ageLookName, agePicture, agesOf, newAgeVariant, newRelative } from './ageFlow'
import { fitFrontView, fitPrompt, garmentRequests } from './wardrobe'
import { garmentAssetId, newGarment, startFit, syncWardrobe } from './wardrobeFlow'

const T = '2026-11-27T00:00:00.000Z'
const mara: ExtractedAsset = { id: 'CHAR-MARA', name: 'MARA', type: 'character', sceneIds: [], status: 'approved', age: '30s', gender: 'female', role: 'harbour pilot', never: 'never without the scar', description: 'Mara, 32, in a navy coat with brass buttons.' }
const style3d = defaultStyleBible
const style2d = styleByName('Clean digital cel animation')
const spec65 = { mode: 'same-person' as const, targetAge: '65', keep: defaultAgeKeep, anchors: ['the scar through the left eyebrow', 'the strong jaw'], adjustments: { hair: 'silver at the temples, receding hairline', posture: 'a slight stoop' } }

const done = (jobs: ImageJob[], patch: (j: ImageJob, i: number) => Partial<ImageJob>): ImageJob[] => jobs.map((j, i) => ({ ...j, status: 'needs-review' as const, outputPath: `C:/out/${j.id}.jpg`, ...patch(j, i) }))

function candidate(spec = spec65, character = mara) {
  const v = newAgeVariant(emptyVariations(), { character, spec, now: T })
  const reqs = ageRequests({ style: style3d, provider: 'kie', model: 'google/nanobanana-2-1', character, lookName: v.variant, age: v.ref, spec: findRevision(v.variations, v.ref)!.spec as AgeSpec, characterPicture: 'C:/mara/front.jpg' })
  return { ...v, reqs, jobs: enqueue(emptyQueue(), reqs, 1).state.jobs }
}

describe('reading ages', () => {
  it('finds the number in "40s", "about 65" and "Age 12"', () => {
    expect(ageNumber('40s')).toBe(40)
    expect(ageNumber('about 65')).toBe(65)
    expect(ageNumber('Age 12')).toBe(12)
    expect(ageNumber('elderly')).toBeNull()
    expect(ageNumber(undefined)).toBeNull()
  })
  it('says older, younger or the same, and nothing when it cannot tell', () => {
    expect(ageDirection('30s', '65')).toBe('older')
    expect(ageDirection('40', '12')).toBe('younger')
    expect(ageDirection('30s', '30')).toBe('same')
    expect(ageDirection('elderly', '12')).toBeNull()
  })
})

describe('aging a character while keeping who they are and how they are drawn (scenario 8)', () => {
  it('names the reference by role, asks for the same person, and lists what must stay recognisable', () => {
    const p = agePrompt({ style: style3d, character: mara, spec: { ...spec65, characterId: mara.id }, view: ageViews[0] })
    expect(p).toMatch(/Reference image 1 is the approved character at age 30s\. It fixes who this is/)
    expect(p).toMatch(/Show the SAME person at age 65, older than in the reference/)
    expect(p).toMatch(/What must stay recognisable: the scar through the left eyebrow; the strong jaw\./)
    expect(p).toMatch(/- Hair colour, density and hairline: silver at the temples, receding hairline/)
    expect(p).toMatch(/- Posture: a slight stoop/)
  })

  it('leaves out the character’s own age and description, which would contradict the target or describe the clothes', () => {
    const p = agePrompt({ style: style3d, character: mara, spec: { ...spec65, characterId: mara.id }, view: ageViews[0] })
    expect(p).not.toMatch(/32|navy coat|brass buttons/)
    expect(p).toMatch(/never without the scar/)
    expect(p).toMatch(/age 65/)
  })

  it('keeps the costume unless told otherwise, and changes only what age changes', () => {
    const kept = agePrompt({ style: style3d, character: mara, spec: { ...spec65, characterId: mara.id }, view: ageViews[0] })
    expect(kept).toMatch(/Keep exactly the same: the costume: its cut, colours and details; the standing pose; any scars, birthmarks or tattoos\. Change only what age changes/)
    const free = agePrompt({ style: style3d, character: mara, spec: { ...spec65, keep: [], characterId: mara.id }, view: ageViews[0] })
    expect(free).not.toMatch(/Keep exactly the same/)
  })

  it('holds a flat 2D style: age is drawn, not rendered', () => {
    const flat = agePrompt({ style: style2d, character: mara, spec: { ...spec65, characterId: mara.id }, view: ageViews[0] })
    expect(flat).toMatch(/flat 2D drawing\. Show age through drawn line, shape and colour\. Do not introduce photographic or 3D rendering, skin pores, realistic wrinkle texture/)
    expect(flat).toContain(style2d.name)
    const render = agePrompt({ style: style3d, character: mara, spec: { ...spec65, characterId: mara.id }, view: ageViews[0] })
    expect(render).not.toMatch(/flat 2D drawing/)
    expect(render).toMatch(/do not switch to photographic skin/)
  })

  it('a redesign takes more freedom with the face and does not claim to be the same person', () => {
    const p = agePrompt({ style: style3d, character: mara, spec: { mode: 'redesign', targetAge: '12', characterId: mara.id }, view: ageViews[0] })
    expect(p).toMatch(/younger-looking redesign of this character at age 12/)
    expect(p).toMatch(/more freedom with the face/)
    expect(p).not.toMatch(/SAME person/)
  })

  it('does not promise biological prediction: it asks for plausible, recognisable, and leaves the judgement to a person', () => {
    const report = checkAgeSpec(mara, { ...spec65, characterId: mara.id })
    expect(report.checks.find((c) => c.id === 'recognisable')?.result).toBe('not-checked')
    expect(report.summary).toMatch(/Recognisability was not checked/)
  })

  it('sends the approved picture as the only reference, full-body front first and a portrait second', () => {
    const { reqs } = candidate()
    expect(reqs.map((r) => r.viewKey)).toEqual(['full-front', 'portrait'])
    expect(reqs.every((r) => r.references.length === 1 && r.references[0] === 'C:/mara/front.jpg' && r.variation?.role === 'age-candidate' && r.sheetType === 'Identity')).toBe(true)
    expect(reqs[0].variant).toBe('MARA at 65')
    expect(reqs[0].fullBody).toBe(true)
    expect(reqs[1].fullBody).toBe(false)
  })

  it('refuses a model that cannot see pictures, and says why', () => {
    expect(ageCapability(true)).toEqual({ ok: true })
    const no = ageCapability(false)
    expect(!no.ok && no.message).toMatch(/cannot keep this person recognisable/)
  })
})

describe('age variants are variants, relatives are not', () => {
  it('makes a candidate variant and leaves the character itself alone', () => {
    const before = JSON.stringify(mara)
    const v = newAgeVariant(emptyVariations(), { character: mara, spec: spec65, now: T })
    expect(v.ref).toEqual({ id: 'AGE-001', revision: 1 })
    expect(v.variations.entities[0]).toMatchObject({ kind: 'age', name: 'MARA at 65', characterId: 'CHAR-MARA' })
    expect(findRevision(v.variations, v.ref)?.status).toBe('candidate')
    expect(JSON.stringify(mara)).toBe(before)
  })

  it('a second try at the same age is a new revision; another age is another variant', () => {
    const a = newAgeVariant(emptyVariations(), { character: mara, spec: spec65, now: T })
    const again = newAgeVariant(a.variations, { character: mara, spec: { ...spec65, adjustments: { posture: 'upright' } }, now: T })
    expect(again.ref).toEqual({ id: a.ref.id, revision: 2 })
    const young = newAgeVariant(again.variations, { character: mara, spec: { mode: 'same-person', targetAge: '12', anchors: ['the scar'] }, now: T })
    expect(young.ref.id).toBe('AGE-002')
    expect(agesOf(young.variations, 'CHAR-MARA').map((e) => e.name)).toEqual(['MARA at 65', 'MARA at 12'])
    expect(ageLookName('MARA', ' 65 ')).toBe('MARA at 65')
  })

  it('a relative is a new, separate character linked to the first, and no age record is made', () => {
    const { assets, asset } = newRelative([mara], mara, { name: 'Elsie', relation: 'daughter' })
    expect(assets).toHaveLength(2)
    expect(asset).toMatchObject({ id: 'CHAR-REL-ELSIE', name: 'ELSIE', type: 'character', status: 'planned', relativeOf: { assetId: 'CHAR-MARA', relation: 'daughter' } })
    expect(asset.description).toMatch(/Mara's daughter|MARA's daughter/)
    expect(assets[0]).toBe(mara)
    expect(newRelative(assets, mara, { name: 'Elsie', relation: 'daughter' }).asset.id).toBe('CHAR-REL-ELSIE-2')
  })
})

describe('approving an age variant', () => {
  it('approving one picture approves the variant and makes a look of the character at that age, once', () => {
    const { variations, jobs, ref } = candidate()
    const approved = syncWardrobe(variations, done(jobs, (_j, i) => ({ approved: i === 0 })), T)
    expect(findRevision(approved, ref)?.status).toBe('approved')
    expect(agePicture(approved, ref.id)?.path).toBe(`C:/out/${jobs[0].id}.jpg`)
    const looks = approved.entities.filter((e) => e.kind === 'look')
    expect(looks).toHaveLength(1)
    expect(looks[0]).toMatchObject({ name: 'MARA at 65', characterId: 'CHAR-MARA' })
    expect(looks[0].revisions[0].spec as LookSpec).toMatchObject({ age: ref, queueVariant: 'MARA at 65' })
    expect(syncWardrobe(approved, done(jobs, (_j, i) => ({ approved: i === 0 })), T)).toBe(approved)
  })

  it('makes no look while it is only a candidate', () => {
    const { variations, jobs } = candidate()
    expect(syncWardrobe(variations, done(jobs, () => ({})), T).entities.filter((e) => e.kind === 'look')).toHaveLength(0)
  })
})

describe('updating the clothing fit for an age variant (scenario 9)', () => {
  const jacket = { description: 'A waxed cotton field jacket' }
  function worn() {
    const age = candidate()
    const ageApproved = syncWardrobe(age.variations, done(age.jobs, (_j, i) => ({ approved: i === 0 })), T)
    const g = newGarment(ageApproved, [mara], { name: 'Field jacket', spec: jacket, now: T })
    const gj = done(enqueue(emptyQueue(), garmentRequests({ style: style3d, provider: 'kie', model: 'm', assetId: garmentAssetId(g.ref.id), assetName: 'Field jacket', garment: g.ref, garmentName: 'Field jacket', spec: jacket }), 2).state.jobs, (_j, i) => ({ approved: i === 0 }))
    const withGarment = reconcileWithQueue(g.variations, gj)
    return { age, ageApproved, withGarment, garment: g.ref }
  }

  it('needs an approved age variant, and files the fit under the age so it is a separate fit and look', () => {
    const { age, withGarment, garment } = worn()
    const unapproved = startFit(withGarment, { character: mara, garment, garmentName: 'Field jacket', keep: ['face'], now: T })
    expect(() => startFit(unapproved.variations, { character: mara, garment, garmentName: 'Field jacket', keep: [], now: T, body: { ref: { id: 'AGE-099', revision: 1 }, name: 'MARA at 99' } })).toThrow(/Approve the age variant/)
    const at65 = startFit(unapproved.variations, { character: mara, garment, garmentName: 'Field jacket', keep: ['face'], now: T, body: { ref: { id: age.ref.id, revision: 1 }, name: 'MARA at 65' } })
    expect(at65.ref.id).not.toBe(unapproved.ref.id)
    expect(at65.variant).toBe('MARA at 65 in Field jacket')
    expect((findRevision(at65.variations, at65.ref)?.spec as FitSpec).body).toEqual({ id: age.ref.id, revision: 1 })
  })

  it('tells the model to fit the garment to the aged body, not the base one', () => {
    const p = fitPrompt({ style: style3d, character: mara, garmentName: 'Field jacket', garment: jacket, keep: ['face'], view: fitFrontView, bodyText: 'at age 65' })
    expect(p).toMatch(/Reference image 1 is the approved character at age 65\. It fixes who this is and the body the garment must be fitted to: cut, drape and size the garment for this body/)
  })

  it('marks the fit and the looks pinned to the older age stale when the age variant gets a newer approved version, and not the garment', () => {
    const { age, withGarment, garment } = worn()
    const fit = startFit(withGarment, { character: mara, garment, garmentName: 'Field jacket', keep: ['face'], now: T, body: { ref: { id: age.ref.id, revision: 1 }, name: 'MARA at 65' } })
    const fj = done(enqueue(emptyQueue(), [{ assetId: mara.id, variant: fit.variant, sheetType: 'Wardrobe', viewKey: 'costume-front', label: 'Costume front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], variation: { id: fit.ref.id, revision: 1, role: 'fit-candidate' }, outputName: () => 'o' }], 3).state.jobs, () => ({ approved: true }))
    const synced = syncWardrobe(fit.variations, fj, T)
    expect(staleRevisions(synced)).toEqual([])
    const next = approveRevision(addRevision(synced, age.ref.id, { spec: { ...(findRevision(synced, age.ref)!.spec as AgeSpec), adjustments: { posture: 'upright' } }, now: T }).state, { id: age.ref.id, revision: 2 })
    // The fit, the look made from it, and the plain age look are all pinned to the earlier age version. The garment and its picture are not.
    const looks = synced.entities.filter((e) => e.kind === 'look').map((l) => l.id)
    expect(staleRevisions(next).map((x) => x.ref.id).sort()).toEqual([fit.ref.id, ...looks].sort())
    expect(staleRevisions(next).some((x) => x.ref.id === garment.id)).toBe(false)
  })
})

describe('checks on the age settings', () => {
  it('passes the setting checks when the age, the anchors and the costume are set, and says recognisability was not checked', () => {
    const r = checkAgeSpec(mara, { ...spec65, characterId: mara.id })
    expect(r.state).toBe('passed-for-checks-performed')
    expect(r.checks.filter((c) => c.result === 'fail')).toEqual([])
  })

  it('asks for review for an unreadable age, the same age, or no anchors on a same-person variant', () => {
    expect(checkAgeSpec(mara, { mode: 'same-person', targetAge: 'old', characterId: mara.id, anchors: ['x'] }).checks.find((c) => c.id === 'target-age')?.result).toBe('fail')
    expect(checkAgeSpec({ age: '65' }, { mode: 'same-person', targetAge: '65', characterId: 'x', anchors: ['x'] }).checks.find((c) => c.id === 'changes-age')?.result).toBe('fail')
    const none = checkAgeSpec(mara, { mode: 'same-person', targetAge: '65', characterId: mara.id })
    expect(none.state).toBe('needs-review')
    expect(none.checks.find((c) => c.id === 'anchors')?.result).toBe('fail')
    expect(checkAgeSpec(mara, { mode: 'redesign', targetAge: '65', characterId: mara.id }).checks.find((c) => c.id === 'anchors')?.result).toBe('not-checked')
  })

  it('warns when the costume is not marked to be kept', () => {
    const r = checkAgeSpec(mara, { mode: 'redesign', targetAge: '65', characterId: mara.id, keep: [] })
    expect(r.checks.find((c) => c.id === 'costume-kept')?.detail).toMatch(/may change the clothing/)
  })
})

describe('a VariationState helper stays pure', () => {
  it('does not mutate the state it is given', () => {
    const s: VariationState = emptyVariations()
    const before = JSON.stringify(s)
    newAgeVariant(s, { character: mara, spec: spec65, now: T })
    expect(JSON.stringify(s)).toBe(before)
  })
})
