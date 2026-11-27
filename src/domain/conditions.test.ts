import { describe, expect, it } from 'vitest'
import { emptyQueue, enqueue, type ImageJob } from './generationQueue'
import type { AnalysisResult, ExtractedAsset, ShotRecord } from './productionStudio'
import { defaultStyleBible } from './visualDevelopment'
import { staleRevisions } from './variationGraph'
import { reconcileWithQueue } from './variationSync'
import { addRevision, approveRevision, createEntity, emptyVariations, findRevision, type ConditionRegion, type ConditionSpec, type Ref, type VariationState } from './variations'
import { conditionLineage, conditionPicture, conditionPrompt, conditionRequests, conditionRequirementsText, conditionTree, describeRegion, inheritedRegions, newCondition, pictureSide } from './conditions'
import { checkCondition } from './conditionChecks'
import { assignLook, checkLookAssignments, lookForScene } from './lookAssignments'
import { fitCapability, fitFrontView, fitPrompt, fitRequests, garmentViews } from './wardrobe'
import { garmentAssetId, newGarment, startFit, syncWardrobe } from './wardrobeFlow'

const T = '2026-11-27T00:00:00.000Z'
const style = defaultStyleBible
const jacket = { description: 'A waxed cotton field jacket with a corduroy collar and four patch pockets.' }
const mara: ExtractedAsset = { id: 'CHAR-MARA', name: 'MARA', type: 'character', sceneIds: [], status: 'approved' }

const done = (jobs: ImageJob[], patch: (j: ImageJob, i: number) => Partial<ImageJob>): ImageJob[] => jobs.map((j, i) => ({ ...j, status: 'needs-review' as const, outputPath: `C:/out/${j.id}.jpg`, ...patch(j, i) }))

/** An approved garment (with a picture), ready for conditions. */
function approvedGarment() {
  const g = newGarment(emptyVariations(), [mara], { name: 'Field jacket', spec: jacket, now: T })
  const jobs = done(enqueue(emptyQueue(), [{ assetId: g.assetId, variant: 'GAR-001 r1', sheetType: 'Wardrobe', viewKey: 'garment-front', label: 'Garment front', prompt: 'p', aspect: '3:4', fullBody: false, provider: 'kie', model: 'm', references: [], variation: { id: g.ref.id, revision: 1, role: 'garment-preview' }, outputName: () => 'o' }], 1).state.jobs, () => ({ approved: true }))
  return { variations: reconcileWithQueue(g.variations, jobs), garment: g.ref, jobs }
}

const cuffs: ConditionRegion = { component: 'Cuff', side: 'both', severity: 'moderate', description: 'worn thin to the lining, threads showing' }
const tear: ConditionRegion = { component: 'Sleeve', side: 'character-left', severity: 'moderate', description: 'torn open at the elbow, about a hand wide' }

/** Makes a condition and approves it with a picture, the way the screen and the queue do together. */
function approvedCondition(variations: VariationState, garment: Ref, name: string, kind: string, regions: ConditionRegion[], from?: Ref) {
  const made = newCondition(variations, { name, garment, kind, regions, from, now: T })
  const asset = garmentAssetId(garment.id)
  const reqs = conditionRequests({ style, provider: 'kie', model: 'm', assetId: asset, assetName: 'Field jacket', condition: made.ref, conditionName: name, spec: findRevision(made.variations, made.ref)!.spec as ConditionSpec, garmentName: 'Field jacket', garment: jacket, earlier: [] })
  const jobs = done(enqueue(emptyQueue(), reqs, 1).state.jobs, (_j, i) => ({ approved: i === 0 }))
  return { variations: reconcileWithQueue(made.variations, jobs), ref: made.ref, jobs }
}

describe('left and right', () => {
  it('puts the wearer’s left on the right of a front view and the left of a back view', () => {
    expect(pictureSide('character-left', 'garment-front')).toBe('right')
    expect(pictureSide('character-right', 'garment-front')).toBe('left')
    expect(pictureSide('character-left', 'garment-back')).toBe('left')
    expect(pictureSide('character-right', 'costume-rear')).toBe('right')
  })

  it('says nothing about the picture side where it is not certain', () => {
    expect(pictureSide('character-left', 'garment-detail')).toBeNull()
    expect(pictureSide('both', 'garment-front')).toBeNull()
    expect(pictureSide('centre', 'garment-front')).toBeNull()
  })

  it('writes a region in the wearer’s words, and where it lands when that is certain', () => {
    expect(describeRegion(tear, 'garment-front')).toMatch(/Sleeve on the wearer’s left \(on the right of this picture\), moderate: torn open at the elbow/)
    expect(describeRegion(tear, 'garment-back')).toMatch(/\(on the left of this picture\)/)
    expect(describeRegion(tear, 'garment-detail')).not.toMatch(/of this picture/)
  })

  it('does not copy a mark from the view it was made on to another view', () => {
    const marked = { ...tear, view: 'garment-front' }
    expect(describeRegion(marked, 'garment-front')).not.toMatch(/Marked on/)
    expect(describeRegion(marked, 'garment-back')).toMatch(/Marked on the garment-front view: place it consistently with that view and do not copy its position/)
  })
})

describe('threadbare cuffs, and the rest of the garment stays as it was (scenario 4)', () => {
  it('needs an approved garment', () => {
    const g = newGarment(emptyVariations(), [], { name: 'Coat', spec: jacket, now: T })
    expect(() => newCondition(g.variations, { name: 'Worn', garment: g.ref, kind: 'thin', regions: [cuffs], now: T })).toThrow(/Approve the garment/)
  })

  it('names the change and tells the model to keep everything else exactly as the attached garment picture', () => {
    const { variations, garment } = approvedGarment()
    const made = newCondition(variations, { name: 'Threadbare cuffs', garment, kind: 'thin', regions: [cuffs], keep: ['the collar', 'the pocket layout'], now: T })
    const p = conditionPrompt({ style, garmentName: 'Field jacket', garment: jacket, conditionName: 'Threadbare cuffs', condition: findRevision(made.variations, made.ref)!.spec as ConditionSpec, earlier: [], view: garmentViews[0], source: 'garment' })
    expect(p).toMatch(/attached picture is the approved garment\. Keep its cut, pattern, colours, closures, trim and every part not listed below exactly as it is/)
    expect(p).toMatch(/Condition to show: Thinning and threadbare areas/)
    expect(p).toMatch(/Cuff on both sides, moderate: worn thin to the lining/)
    expect(p).toMatch(/Must remain unchanged: the collar; the pocket layout/)
    expect(p).toMatch(/Show the garment only: no person/)
    expect(p).toMatch(/wearer’s left and right, not the left and right of the picture/)
  })

  it('sends the approved garment picture as the one reference, linked to the garment revision', () => {
    const { variations, garment, jobs } = approvedGarment()
    const made = newCondition(variations, { name: 'Threadbare cuffs', garment, kind: 'thin', regions: [cuffs], now: T })
    const path = jobs[0].outputPath as string
    const reqs = conditionRequests({ style, provider: 'kie', model: 'm', assetId: garmentAssetId(garment.id), assetName: 'Field jacket', condition: made.ref, conditionName: 'Threadbare cuffs', spec: findRevision(made.variations, made.ref)!.spec as ConditionSpec, garmentName: 'Field jacket', garment: jacket, earlier: [], source: { path, of: 'garment', ref: garment } })
    expect(reqs.map((r) => r.viewKey)).toEqual(['garment-front', 'garment-back', 'garment-detail'])
    expect(reqs.every((r) => r.references[0] === path && r.variation?.role === 'condition-preview')).toBe(true)
    expect(reqs[0].variation?.uses?.map((u) => u.role)).toEqual(['garment', 'source-garment-picture'])
    expect(reqs[0].variant).toBe('CND-001 r1')
  })
})

describe('a left sleeve tear, in every view (scenario 5)', () => {
  it('shows the tear on the wearer’s left in the front, back and detail prompts, each in the right place for that view', () => {
    const { variations, garment } = approvedGarment()
    const made = newCondition(variations, { name: 'Left sleeve torn', garment, kind: 'tear', regions: [tear], now: T })
    const spec = findRevision(made.variations, made.ref)!.spec as ConditionSpec
    const text = (viewKey: string) => conditionPrompt({ style, garmentName: 'Field jacket', garment: jacket, conditionName: 'Left sleeve torn', condition: spec, earlier: [], view: garmentViews.find((v) => v.key === viewKey)!, source: 'garment' })
    expect(text('garment-front')).toMatch(/Sleeve on the wearer’s left \(on the right of this picture\)/)
    expect(text('garment-back')).toMatch(/Sleeve on the wearer’s left \(on the left of this picture\)/)
    expect(text('garment-detail')).toMatch(/Sleeve on the wearer’s left, moderate/)
    expect(text('garment-detail')).not.toMatch(/of this picture\)/)
  })
})

describe('wetness keeps the approved tear (scenario 6)', () => {
  function wetOnTear() {
    const base = approvedGarment()
    const torn = approvedCondition(base.variations, base.garment, 'Left sleeve torn', 'tear', [tear])
    const wetMade = newCondition(torn.variations, { name: 'Wet, same tear', garment: base.garment, kind: 'wet', regions: [{ component: 'Whole garment', side: 'both', severity: 'heavy', description: 'soaked through, dark and clinging' }], from: torn.ref, now: T })
    return { ...base, torn, wetMade }
  }

  it('carries the earlier tear into the wet condition as something that must stay', () => {
    const { wetMade, torn } = wetOnTear()
    const { earlier, own } = inheritedRegions(wetMade.variations, wetMade.ref)
    expect(earlier.map((e) => e.region.component)).toEqual(['Sleeve'])
    expect(earlier[0].from).toEqual(torn.ref)
    expect(own.map((e) => e.region.component)).toEqual(['Whole garment'])
  })

  it('puts the tear into the wet prompt as already established and to be kept, and uses the torn garment picture as the source', () => {
    const { wetMade, torn } = wetOnTear()
    const spec = findRevision(wetMade.variations, wetMade.ref)!.spec as ConditionSpec
    const { earlier } = inheritedRegions(wetMade.variations, wetMade.ref)
    const p = conditionPrompt({ style, garmentName: 'Field jacket', garment: jacket, conditionName: 'Wet, same tear', condition: spec, earlier, view: garmentViews[0], source: 'earlier-condition' })
    expect(p).toMatch(/attached picture is the approved earlier condition of this garment/)
    expect(p).toMatch(/Already established by the earlier condition and must stay exactly as in the attached picture:\n- Sleeve on the wearer’s left \(on the right of this picture\)/)
    expect(p).toMatch(/Condition to show: Wetness/)
    expect(conditionPicture(torn.variations, torn.ref.id)?.path).toBeTruthy()
  })

  it('states every requirement in the history in words, oldest first', () => {
    const { wetMade } = wetOnTear()
    const text = conditionRequirementsText(wetMade.variations, wetMade.ref, 'costume-front')
    expect(text.indexOf('Sleeve')).toBeLessThan(text.indexOf('Whole garment'))
  })
})

describe('a repaired branch leaves the original history alone (scenario 7)', () => {
  it('builds both branches from the garment and changes neither', () => {
    const base = approvedGarment()
    const dusty = approvedCondition(base.variations, base.garment, 'Dusty', 'dirt', [{ component: 'Whole garment', side: 'both', severity: 'light', description: 'a film of dust' }])
    const torn = approvedCondition(dusty.variations, base.garment, 'Torn (dusty)', 'tear', [tear], dusty.ref)
    const wet = approvedCondition(torn.variations, base.garment, 'Wet', 'wet', [], torn.ref)
    const before = JSON.stringify([dusty.ref, torn.ref, wet.ref].map((r) => findRevision(wet.variations, r)))
    const repaired = approvedCondition(wet.variations, base.garment, 'Repaired', 'repair', [{ component: 'Sleeve', side: 'character-left', severity: 'light', description: 'a neat leather patch' }])
    const faded = approvedCondition(repaired.variations, base.garment, 'Repaired, then faded', 'fade', [], repaired.ref)
    expect(JSON.stringify([dusty.ref, torn.ref, wet.ref].map((r) => findRevision(faded.variations, r)))).toBe(before)
    expect(conditionLineage(faded.variations, wet.ref).map((r) => r.id)).toEqual([dusty.ref.id, torn.ref.id, wet.ref.id])
    expect(conditionLineage(faded.variations, faded.ref).map((r) => r.id)).toEqual([repaired.ref.id, faded.ref.id])
    expect(inheritedRegions(faded.variations, faded.ref).earlier.map((e) => e.region.description)).toEqual(['a neat leather patch'])
    expect(staleRevisions(faded.variations)).toEqual([])
  })

  it('shows the conditions as a tree of branches', () => {
    const base = approvedGarment()
    const dusty = approvedCondition(base.variations, base.garment, 'Dusty', 'dirt', [])
    const torn = approvedCondition(dusty.variations, base.garment, 'Torn', 'tear', [tear], dusty.ref)
    const repaired = approvedCondition(torn.variations, base.garment, 'Repaired', 'repair', [])
    const tree = conditionTree(repaired.variations, base.garment.id)
    expect(tree.map((n) => n.name)).toEqual(['Dusty', 'Repaired'])
    expect(tree[0].children.map((n) => n.name)).toEqual(['Torn'])
    expect(tree[0].children[0].depth).toBe(1)
  })

  it('only continues from an approved condition of the same garment', () => {
    const base = approvedGarment()
    const other = newGarment(base.variations, [], { name: 'Robe', spec: { description: 'A robe' }, now: T })
    const otherApproved = reconcileWithQueue(other.variations, done(enqueue(emptyQueue(), [{ assetId: other.assetId, variant: 'v', sheetType: 'Wardrobe', viewKey: 'garment-front', label: 'f', prompt: 'p', aspect: '3:4', fullBody: false, provider: 'kie', model: 'm', references: [], variation: { id: other.ref.id, revision: 1, role: 'garment-preview' }, outputName: () => 'o' }], 1).state.jobs, () => ({ approved: true })))
    const dusty = approvedCondition(otherApproved, other.ref, 'Dusty robe', 'dirt', [])
    expect(() => newCondition(dusty.variations, { name: 'x', garment: base.garment, kind: 'tear', regions: [], from: dusty.ref, now: T })).toThrow(/same garment/)
    const candidate = newCondition(base.variations, { name: 'Dusty', garment: base.garment, kind: 'dirt', regions: [], now: T })
    expect(() => newCondition(candidate.variations, { name: 'y', garment: base.garment, kind: 'tear', regions: [], from: candidate.ref, now: T })).toThrow(/approved condition/)
  })
})

describe('a garment worn in a condition, on a character', () => {
  function torn() {
    const base = approvedGarment()
    const c = approvedCondition(base.variations, base.garment, 'Left sleeve torn', 'tear', [tear])
    return { ...base, c }
  }

  it('is a separate fit from the pristine one, with its own look name, and needs an approved condition', () => {
    const { c, garment } = torn()
    const pristine = startFit(c.variations, { character: mara, garment, garmentName: 'Field jacket', keep: ['face'], now: T })
    const worn = startFit(pristine.variations, { character: mara, garment, garmentName: 'Field jacket', keep: ['face'], now: T, condition: { ref: c.ref, name: 'Left sleeve torn' } })
    expect(worn.ref.id).not.toBe(pristine.ref.id)
    expect(worn.variant).toBe('MARA in Field jacket, Left sleeve torn')
    const unapproved = newCondition(pristine.variations, { name: 'Wet', garment, kind: 'wet', regions: [], now: T })
    expect(() => startFit(unapproved.variations, { character: mara, garment, garmentName: 'Field jacket', keep: [], now: T, condition: { ref: unapproved.ref, name: 'Wet' } })).toThrow(/Approve the condition/)
  })

  it('puts the condition’s requirements into the fit prompt and the conditioned picture as reference 2', () => {
    const { c, garment } = torn()
    const worn = startFit(c.variations, { character: mara, garment, garmentName: 'Field jacket', keep: ['face', 'body'], now: T, condition: { ref: c.ref, name: 'Left sleeve torn' } })
    const conditionText = conditionRequirementsText(worn.variations, c.ref, fitFrontView.key)
    const [req] = fitRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: worn.variant, fit: worn.ref, garment, garmentName: 'Field jacket', garmentSpec: jacket, keep: ['face', 'body'], characterPicture: 'C:/mara.jpg', garmentPicture: 'C:/torn.jpg', condition: c.ref, conditionText })
    expect(req.references).toEqual(['C:/mara.jpg', 'C:/torn.jpg'])
    expect(req.prompt).toMatch(/Show it exactly as it appears in reference image 2, with these requirements kept in place: Sleeve on the wearer’s left \(on the right of this picture\)/)
    expect(req.prompt).toMatch(/Do not repair, clean or add to them/)
    expect(req.variation?.uses?.map((u) => u.role)).toEqual(['reference-1-character', 'reference-2-garment-in-condition', 'garment'])
    expect(fitPrompt({ style, character: mara, garmentName: 'Field jacket', garment: jacket, keep: [], view: fitFrontView })).not.toMatch(/Do not repair/)
    expect(fitCapability(true).ok).toBe(true)
  })

  it('makes a look with the fit and the condition, and changing the garment marks the condition, fit and look stale', () => {
    const { c, garment } = torn()
    const worn = startFit(c.variations, { character: mara, garment, garmentName: 'Field jacket', keep: ['face'], now: T, condition: { ref: c.ref, name: 'Left sleeve torn' } })
    const [req] = fitRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: worn.variant, fit: worn.ref, garment, garmentName: 'Field jacket', garmentSpec: jacket, keep: ['face'], characterPicture: 'C:/m.jpg', garmentPicture: 'C:/t.jpg', condition: c.ref })
    const jobs = done(enqueue(emptyQueue(), [req], 1).state.jobs, () => ({ approved: true }))
    const synced = syncWardrobe(worn.variations, jobs, T)
    const look = synced.entities.find((e) => e.kind === 'look')!
    expect(look.revisions[0].spec).toMatchObject({ condition: c.ref, queueVariant: 'MARA in Field jacket, Left sleeve torn' })
    expect(staleRevisions(synced)).toEqual([])
  })
})

describe('checks on a condition’s record', () => {
  it('passes the record checks and says plainly that picture placement was not checked', () => {
    const base = approvedGarment()
    const c = approvedCondition(base.variations, base.garment, 'Left sleeve torn', 'tear', [tear])
    const report = checkCondition(c.variations, c.ref)
    expect(report.state).toBe('passed-for-checks-performed')
    expect(report.summary).toMatch(/Picture placement was not checked/)
    expect(report.checks.find((x) => x.id === 'placement')?.result).toBe('not-checked')
    expect(report.checks.filter((x) => x.result === 'fail')).toEqual([])
  })

  it('asks for review when a change has no description or part, or the garment moved on', () => {
    const base = approvedGarment()
    const c = approvedCondition(base.variations, base.garment, 'Torn', 'tear', [{ ...tear, description: '' }, { ...tear, component: ' ' }])
    const report = checkCondition(c.variations, c.ref)
    expect(report.state).toBe('needs-review')
    expect(report.checks.find((x) => x.id === 'regions-described')?.result).toBe('fail')
    expect(report.checks.find((x) => x.id === 'regions-named')?.result).toBe('fail')
  })

  it('notices when the garment has a newer approved version', () => {
    const base = approvedGarment()
    const c = approvedCondition(base.variations, base.garment, 'Torn', 'tear', [tear])
    const second = approveRevision(addRevision(c.variations, base.garment.id, { spec: { description: 'A changed jacket' }, now: T }).state, { id: base.garment.id, revision: 2 })
    const report = checkCondition(second, c.ref)
    expect(report.state).toBe('needs-review')
    expect(report.checks.find((x) => x.id === 'garment-current')).toMatchObject({ result: 'fail', detail: expect.stringMatching(/now has version 2; this condition was made from version 1/) })
  })

  it('is unable to check a condition that is not in the project', () => {
    expect(checkCondition(emptyVariations(), { id: 'CND-099', revision: 1 }).state).toBe('unable-to-check')
  })
})

describe('using a look in scenes', () => {
  function lookInScene() {
    const base = approvedGarment()
    const fit = startFit(base.variations, { character: mara, garment: base.garment, garmentName: 'Field jacket', keep: ['face'], now: T })
    const [req] = fitRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: fit.variant, fit: fit.ref, garment: base.garment, garmentName: 'Field jacket', garmentSpec: jacket, keep: ['face'], characterPicture: 'C:/m.jpg', garmentPicture: 'C:/g.jpg' })
    const synced = syncWardrobe(fit.variations, done(enqueue(emptyQueue(), [req], 1).state.jobs, () => ({ approved: true })), T)
    const lookId = synced.entities.find((e) => e.kind === 'look')!.id
    return { synced, lookId, variant: fit.variant }
  }

  it('assigns scenes as a new approved revision and keeps the earlier one', () => {
    const { synced, lookId, variant } = lookInScene()
    const a = assignLook(synced, lookId, ['SCENE-003', 'SCENE-002', 'SCENE-003'], '2026-11-28T00:00:00.000Z')
    expect(a.ref).toEqual({ id: lookId, revision: 2 })
    expect(findRevision(a.variations, a.ref)?.status).toBe('approved')
    expect(findRevision(a.variations, { id: lookId, revision: 1 })?.spec).toMatchObject({ queueVariant: variant })
    expect(lookForScene(a.variations, 'CHAR-MARA', 'SCENE-002')?.queueVariant).toBe(variant)
    expect(lookForScene(a.variations, 'CHAR-MARA', 'SCENE-009')).toBeUndefined()
    expect(lookForScene(a.variations, 'CHAR-TOM', 'SCENE-002')).toBeUndefined()
  })

  it('refuses an unapproved look', () => {
    const base = approvedGarment()
    const made = createEntity(base.variations, 'look', { name: 'x', characterId: 'CHAR-MARA', spec: { characterId: 'CHAR-MARA' }, now: T })
    expect(() => assignLook(made.state, made.ref.id, ['SCENE-001'], T)).toThrow(/approved look/)
  })

  it('warns when a shot uses a different look from the one assigned to its scene, and stays quiet when they match', () => {
    const { synced, lookId, variant } = lookInScene()
    const a = assignLook(synced, lookId, ['SCENE-002'], '2026-11-28T00:00:00.000Z').variations
    const analysis = { scenes: [], assets: [mara] } as unknown as AnalysisResult
    const shot = (id: string, look: string) => ({ id, sceneId: 'SCENE-002', looks: { 'CHAR-MARA': look } }) as unknown as ShotRecord
    const found = checkLookAssignments([shot('SHOT-001', 'Canonical'), shot('SHOT-002', variant)], a, analysis)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ level: 'warn', shotId: 'SHOT-001' })
    expect(found[0].message).toMatch(new RegExp(`assigned to this scene`))
  })
})
