import { describe, expect, it } from 'vitest'
import { committedUsd, emptyQueue, enqueue, markFailed, markGenerating, recover, retry, type ImageJob, type JobRequest, type QueueState } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import { defaultStyleBible } from './visualDevelopment'
import { buildDesignRecords } from './exportRecords'
import { collectPlan, relinkById } from './collectProject'
import { staleRevisions } from './variationGraph'
import { currentPath, variationFiles } from './variationSync'
import { addRevision, approveRevision, emptyVariations, findRevision, latestApproved, type AgeSpec, type ConditionSpec, type LookSpec, type Ref, type VariationState } from './variations'
import { ageRequests } from './age'
import { newAgeVariant } from './ageFlow'
import { conditionRequests, inheritedRegions, newCondition, reviseCondition } from './conditions'
import { fitRequests, garmentRequests } from './wardrobe'
import { garmentAssetId, newGarment, startFit, syncWardrobe } from './wardrobeFlow'
import { newStage } from './transformationFlow'
import { transformationRequests } from './transformation'
import { canApprove, checkComposition, composeLook } from './lookComposer'
import { regenerationPlan, refreshLook } from './regeneration'
import { ageComparison, conditionComparison, transformationComparison, variationManifest } from './variationManifest'
import { parseProjectFile, buildProjectFile } from '../data/projectFile'
import { T, approveVia, cap, hat, mara, robe, scarf, spec65, style, world } from './variationWorld.fixture'
import { demo2DProject, styleByName } from './demo2d'

const tom: ExtractedAsset = { id: 'CHAR-TOM', name: 'TOM', type: 'character', sceneIds: [], status: 'approved', age: '60s' }
const stageSpec = { kind: 'infected', stage: 'Partial transformation', intensity: 3, recognisability: 4, anchors: ['the eyes'], details: { anatomy: 'longer left arm', differences: 'veins spread' } }

describe('assembling a look from an age, an outfit and a condition (scenario 12)', () => {
  it('approves Mara / age 65 / travel robe / rain-soaked, pinned to exactly those revisions', () => {
    const w = world()
    const input = { characterId: mara.id, name: 'Mara at 65, rain-soaked', age: w.ageRef, fit: w.fitAgedWet, condition: w.condRef }
    expect(checkComposition(w.s, input)).toEqual([])
    const made = composeLook(w.s, input, T)
    const look = findRevision(made.variations, made.ref)!
    expect(look.status).toBe('approved')
    expect(look.spec as LookSpec).toMatchObject({ characterId: mara.id, age: w.ageRef, fit: w.fitAgedWet, condition: w.condRef, queueVariant: 'MARA at 65 in Travel robe, Rain-soaked' })
    expect(made.variations.entities.find((e) => e.name === 'Mara at 65, rain-soaked')?.kind).toBe('look')
  })

  it('composing the same look again is a new revision, and the first stays as it was', () => {
    const w = world()
    const input = { characterId: mara.id, name: 'Rain look', fit: w.fitBaseWet, condition: w.condRef }
    const a = composeLook(w.s, input, T)
    const before = JSON.stringify(findRevision(a.variations, a.ref))
    const b = composeLook(a.variations, { ...input, sceneIds: ['SCENE-002'] }, T)
    expect(b.ref).toEqual({ id: a.ref.id, revision: 2 })
    expect(JSON.stringify(findRevision(b.variations, a.ref))).toBe(before)
  })

  it('does not make every combination: only what is chosen becomes a look', () => {
    const w = world()
    const before = w.s.entities.filter((e) => e.kind === 'look').length
    const made = composeLook(w.s, { characterId: mara.id, name: 'One look', fit: w.fitAged, age: w.ageRef }, T)
    expect(made.variations.entities.filter((e) => e.kind === 'look').length).toBe(before + 1)
  })
})

describe('conflicts when parts do not go together', () => {
  it('an outfit fitted to the character as approved, with a different body chosen', () => {
    const w = world()
    const c = checkComposition(w.s, { characterId: mara.id, name: 'x', age: w.ageRef, fit: w.fitBase })
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ id: 'fit-body', severity: 'blocks' })
    expect(c[0].message).toMatch(/fitted to the character as approved, not to MARA at 65/)
    expect(c[0].fix).toMatch(/Fit the garment to MARA at 65 in the Wardrobe studio/)
  })

  it('an outfit fitted to an aged body, with no body chosen', () => {
    const w = world()
    const c = checkComposition(w.s, { characterId: mara.id, name: 'x', fit: w.fitAged })
    expect(c.find((x) => x.id === 'fit-body')?.message).toMatch(/fitted to MARA at 65, but no body variant is chosen/)
  })

  it('clothing against a transformed body it was not fitted to: the new anatomy may clash', () => {
    const w = world()
    const st = newStage(w.s, { character: mara, spec: stageSpec, now: T })
    const approved = approveVia(st.variations, transformationRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: st.variant, stage: st.ref, spec: findRevision(st.variations, st.ref)!.spec as never, source: { path: 'C:/mara.jpg', of: 'base' } }))
    const c = checkComposition(approved.state, { characterId: mara.id, name: 'x', transformation: st.ref, fit: w.fitBase })
    expect(c.find((x) => x.id === 'fit-body')?.message).toMatch(/changes the body: the clothes may not fit or may clash with the new anatomy/)
    expect(c.find((x) => x.id === 'fit-body')?.severity).toBe('blocks')
  })

  it('a condition the outfit picture does not show', () => {
    const w = world()
    const c = checkComposition(w.s, { characterId: mara.id, name: 'x', fit: w.fitBase, condition: w.condRef })
    expect(c.find((x) => x.id === 'fit-condition')?.message).toMatch(/shows the garment as new, not “Rain-soaked”/)
    const none = checkComposition(w.s, { characterId: mara.id, name: 'x', fit: w.fitBaseWet })
    expect(none.find((x) => x.id === 'fit-has-condition')?.severity).toBe('blocks')
    expect(checkComposition(w.s, { characterId: mara.id, name: 'x', condition: w.condRef }).find((x) => x.id === 'condition-needs-outfit')).toBeTruthy()
  })

  it('a condition made from a different version of the garment', () => {
    const w = world()
    // The robe gets a newer approved version; the condition and the fit still point at version 1. Pin a condition to version 2 by hand.
    const v2 = approveRevision(addRevision(w.s, w.robeRef.id, { spec: { ...robe, description: 'A long wool travel robe with a hood' }, now: T }).state, { id: w.robeRef.id, revision: 2 })
    const cond2 = newCondition(v2, { name: 'Muddy', garment: { id: w.robeRef.id, revision: 2 }, kind: 'dirt', regions: [], now: T })
    const approvedCond = approveRevision(cond2.variations, cond2.ref)
    const c = checkComposition(approvedCond, { characterId: mara.id, name: 'x', fit: w.fitBaseWet, condition: cond2.ref })
    expect(c.map((x) => x.id)).toEqual(expect.arrayContaining(['fit-condition', 'condition-garment']))
    expect(c.find((x) => x.id === 'condition-garment')?.message).toMatch(/different version of the garment/)
  })

  it('two accessories that go in the same place', () => {
    const w = world()
    const c = checkComposition(w.s, { characterId: mara.id, name: 'x', fit: w.fitBase, accessories: [w.hatRef, w.capRef, w.scarfRef] })
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ id: 'accessory-headwear', severity: 'blocks' })
    expect(c[0].message).toMatch(/Felt hat and Knitted cap both go on the headwear/)
    expect(checkComposition(w.s, { characterId: mara.id, name: 'x', fit: w.fitBase, accessories: [w.hatRef, w.scarfRef] })).toEqual([])
  })

  it('a part that is not approved, is missing, or belongs to someone else', () => {
    const w = world()
    const cand = newAgeVariant(w.s, { character: mara, spec: { ...spec65, targetAge: '80' }, now: T })
    expect(checkComposition(cand.variations, { characterId: mara.id, name: 'x', age: cand.ref })[0]).toMatchObject({ severity: 'blocks', message: expect.stringMatching(/not approved yet/) })
    expect(checkComposition(w.s, { characterId: mara.id, name: 'x', age: { id: 'AGE-099', revision: 1 } })[0].message).toMatch(/not in this project/)
    expect(checkComposition(w.s, { characterId: tom.id, name: 'x', fit: w.fitBase })[0].message).toMatch(/belongs to a different character/)
  })

  it('age and a transformation stage together can only be approved as an acknowledged record', () => {
    const w = world()
    const st = newStage(w.s, { character: mara, spec: stageSpec, now: T })
    const withStage = approveVia(st.variations, transformationRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: st.variant, stage: st.ref, spec: findRevision(st.variations, st.ref)!.spec as never, source: { path: 'C:/mara.jpg', of: 'base' } })).state
    const input = { characterId: mara.id, name: 'Both', age: w.ageRef, transformation: st.ref }
    const c = checkComposition(withStage, input)
    expect(c.map((x) => x.id)).toEqual(['age-and-transformation'])
    expect(c[0].severity).toBe('warns')
    expect(canApprove(c)).toBe(false)
    expect(canApprove(c, ['age-and-transformation'])).toBe(true)
    expect(() => composeLook(withStage, input, T)).toThrow(/cannot be approved yet/)
    const ok = composeLook(withStage, input, T, ['age-and-transformation'])
    expect(findRevision(ok.variations, ok.ref)).toMatchObject({ status: 'approved', note: 'Acknowledged: age-and-transformation' })
    expect((findRevision(ok.variations, ok.ref)?.spec as LookSpec)).toMatchObject({ age: w.ageRef, transformation: st.ref })
  })

  it('refuses to approve while anything blocks, whatever was acknowledged', () => {
    const w = world()
    expect(() => composeLook(w.s, { characterId: mara.id, name: 'Bad', age: w.ageRef, fit: w.fitBase }, T, ['fit-body'])).toThrow(/fitted to the character as approved/)
  })
})

describe('changing the base garment: only what depends on it is remade, in order (scenario 13)', () => {
  function afterChange() {
    const w = world()
    const look = composeLook(w.s, { characterId: mara.id, name: 'Rain look', fit: w.fitBaseWet, condition: w.condRef }, T)
    const v2 = approveRevision(addRevision(look.variations, w.robeRef.id, { spec: { ...robe, description: 'A long wool travel robe with a hood' }, now: T }).state, { id: w.robeRef.id, revision: 2 })
    return { w, look, v2 }
  }

  it('lists the condition, the fits and the looks built on the old version, remade from the bottom up, and leaves the rest', () => {
    const { w, v2 } = afterChange()
    const plan = regenerationPlan(v2)
    const names = plan.steps.map((s) => s.name)
    expect(names).toEqual(expect.arrayContaining(['Rain-soaked', 'MARA in Travel robe', 'Rain look']))
    for (const unrelated of ['Felt hat', 'Knitted cap', 'Scarf', 'MARA at 65']) expect(names).not.toContain(unrelated)
    const order = (name: string) => plan.steps.find((s) => s.name === name)!.order
    expect(order('Rain-soaked')).toBeLessThan(order('MARA in Travel robe, Rain-soaked'))
    expect(order('MARA in Travel robe, Rain-soaked')).toBeLessThan(order('Rain look'))
    expect(plan.untouchedApprovals).toBeGreaterThan(0)
    expect(plan.steps.find((s) => s.name === 'Rain-soaked')?.because[0]).toMatch(/Travel robe \(garment\) has a newer approved version \(2\); this was made from version 1/)
    void w
  })

  it('every unrelated approval is still approved, and nothing was changed to get here', () => {
    const { look, v2 } = afterChange()
    const staleIds = new Set(staleRevisions(v2).map((s) => s.ref.id))
    for (const e of v2.entities) for (const r of e.revisions) if (!staleIds.has(e.id) && r.status === 'approved') expect(findRevision(v2, { id: e.id, revision: r.n })?.status).toBe('approved')
    expect(JSON.stringify(findRevision(v2, look.ref))).toBe(JSON.stringify(findRevision(look.variations, look.ref)))
  })

  it('brings a look up to date only once its parts are remade, and keeps the earlier revision', () => {
    const { w, look, v2 } = afterChange()
    expect(() => refreshLook(v2, look.ref.id, T)).toThrow(/cannot be brought up to date yet/)
    const g2: Ref = { id: w.robeRef.id, revision: 2 }
    // Remake the condition from the new garment version, then the fit in it.
    const condMade = reviseCondition(v2, w.condRef.id, { ...(findRevision(v2, w.condRef)!.spec as ConditionSpec), garment: g2 }, T)
    const condApproved = approveVia(condMade.variations, conditionRequests({ style, provider: 'kie', model: 'm', assetId: garmentAssetId(w.robeRef.id), assetName: 'Travel robe', condition: condMade.ref, conditionName: 'Rain-soaked', spec: findRevision(condMade.variations, condMade.ref)!.spec as ConditionSpec, garmentName: 'Travel robe', garment: robe, earlier: [] }))
    const fitMade = startFit(condApproved.state, { character: mara, garment: g2, garmentName: 'Travel robe', keep: ['face'], now: T, condition: { ref: condMade.ref, name: 'Rain-soaked' } })
    expect(fitMade.ref).toEqual({ id: w.fitBaseWet.id, revision: 2 })
    const fitApproved = approveVia(fitMade.variations, fitRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: fitMade.variant, fit: fitMade.ref, garment: g2, garmentName: 'Travel robe', garmentSpec: robe, keep: ['face'], characterPicture: 'C:/mara.jpg', garmentPicture: 'C:/robe2.jpg', condition: condMade.ref }))
    const before = JSON.stringify(findRevision(fitApproved.state, look.ref))
    const refreshed = refreshLook(fitApproved.state, look.ref.id, T)
    expect(refreshed.ref).toEqual({ id: look.ref.id, revision: 2 })
    expect(findRevision(refreshed.variations, refreshed.ref)).toMatchObject({ status: 'approved', note: 'Brought up to date', parent: look.ref })
    expect(findRevision(refreshed.variations, refreshed.ref)?.spec as LookSpec).toMatchObject({ fit: fitMade.ref, condition: condMade.ref })
    expect(JSON.stringify(findRevision(refreshed.variations, look.ref))).toBe(before)
    // The old versions that were replaced are history: nothing is left to remake for this chain.
    expect(regenerationPlan(refreshed.variations).steps.map((x) => x.name)).not.toEqual(expect.arrayContaining(['Rain look', 'Rain-soaked']))
    expect(inheritedRegions(refreshed.variations, condMade.ref).own.length).toBe(1)
  })

  it('does not list a replaced older version as something to remake', () => {
    const { v2 } = afterChange()
    const ids = regenerationPlan(v2).steps.map((x) => x.ref.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('the export manifest names the revisions and keeps the generation record', () => {
  function manifestOf() {
    const w = world()
    const queue: QueueState = { ...emptyQueue(), perImageUsd: 0.04, jobs: w.jobs.map((j) => ({ ...j, attempts: 2, providerTaskId: 'task-1' })) }
    return { w, queue, manifest: variationManifest(w.s, queue) }
  }

  it('lists every record with its revision ids, status, what it depends on, and its pictures by file name', () => {
    const { manifest } = manifestOf()
    expect(manifest.format).toBe('production-one-variations')
    const fit = manifest.entities.find((e) => e.name === 'MARA at 65 in Travel robe, Rain-soaked')!
    expect(fit.kind).toBe('fit')
    expect(fit.revisions[0].ref).toMatch(/^FIT-\d+@1$/)
    expect(fit.revisions[0].dependsOn.map((d) => d.role).sort()).toEqual(['body variant', 'condition', 'garment'])
    expect(fit.revisions[0].media.length).toBeGreaterThan(0)
    expect(fit.revisions[0].media.every((m) => !/[\\/]/.test(m.file))).toBe(true)
    expect(manifest.entities.map((e) => e.kind)).toEqual(expect.arrayContaining(['garment', 'fit', 'condition', 'age', 'look']))
  })

  it('records for each picture the provider, model, attempts, cost, prompt and which reference played which part', () => {
    const { manifest } = manifestOf()
    const g = manifest.generation.find((x) => x.role === 'fit-candidate' && x.variant.includes('Rain-soaked') && x.variant.includes('at 65'))!
    expect(g).toMatchObject({ provider: 'kie', model: 'm', attempts: 2, estimatedCostUsd: 0.08, providerTaskId: 'task-1' })
    expect(g.prompt).toMatch(/Reference image 1 is the approved character/)
    expect(g.uses.map((u) => u.role)).toEqual(expect.arrayContaining(['reference-1-character', 'reference-2-garment-in-condition', 'body-variant']))
    expect(g.revisionLink).toMatch(/^FIT-\d+@1$/)
  })

  it('has no price when none was entered, and never a directory or a key', () => {
    const w = world()
    const m = variationManifest(w.s, { ...emptyQueue(), jobs: w.jobs })
    expect(m.generation.every((x) => x.estimatedCostUsd === null)).toBe(true)
    const text = JSON.stringify(m)
    expect(text).not.toMatch(/C:[\\/]|C:\\\\|api[_-]?key|secret|token/i)
  })

  it('says which approvals are out of date, with what to do', () => {
    const w = world()
    const v2 = approveRevision(addRevision(w.s, w.robeRef.id, { spec: { ...robe, description: 'changed' }, now: T }).state, { id: w.robeRef.id, revision: 2 })
    const m = variationManifest(v2, { ...emptyQueue(), jobs: w.jobs })
    expect(m.outOfDate.length).toBeGreaterThan(0)
    expect(m.outOfDate[0]).toMatchObject({ because: [expect.stringMatching(/newer approved version/)] })
    expect(m.entities.flatMap((e) => e.revisions).some((r) => r.stale)).toBe(true)
  })

  it('goes into the design records only when variations exist, and traces each approved picture to its revision', () => {
    const { w, queue } = manifestOf()
    const base = demo2DProject(styleByName('Clean digital cel animation')).studio
    const plain = buildDesignRecords({ ...base, queue })
    expect('variations' in plain).toBe(false)
    expect(plain.approvedRevisions.some((r) => 'variation' in r)).toBe(true)
    const withVar = buildDesignRecords({ ...base, queue, variations: w.s })
    expect((withVar as { variations?: { entities: unknown[] } }).variations?.entities.length).toBe(w.s.entities.length)
    const tied = withVar.approvedRevisions.find((r) => 'variation' in r) as { variation: { ref: string; role: string } }
    expect(tied.variation.ref).toMatch(/^[A-Z]+-\d+@\d+$/)
  })
})

describe('assembled comparison sheets carry the revision ids', () => {
  it('age: the base character, then each approved age youngest to oldest', () => {
    const w = world()
    const sheet = ageComparison(w.s, 'MARA', mara.id, 'C:/mara.jpg', w.jobs)
    expect(sheet.title).toBe('MARA age comparison')
    expect(sheet.cells.map((c) => c.label)).toEqual(['MARA, as approved', expect.stringMatching(/^MARA at 65 \(AGE-\d+ v1\)$/)])
    expect(sheet.cells[1].path).toMatch(/^C:\/out\//)
  })

  it('conditions: the garment as designed, then each approved condition', () => {
    const w = world()
    const sheet = conditionComparison(w.s, w.robeRef.id, w.jobs)
    expect(sheet.cells.map((c) => c.label)).toEqual([expect.stringMatching(/^Travel robe, as designed \(GAR-\d+ v1\)$/), expect.stringMatching(/^Rain-soaked \(CND-\d+ v1\)$/)])
  })

  it('transformation: the base, then the stages in order', () => {
    const w = world()
    const s1 = newStage(w.s, { character: mara, spec: { ...stageSpec, stage: 'Subtle symptoms', intensity: 1 }, now: T })
    const a1 = approveVia(s1.variations, transformationRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: s1.variant, stage: s1.ref, spec: findRevision(s1.variations, s1.ref)!.spec as never, source: { path: 'C:/mara.jpg', of: 'base' } }))
    const s2 = newStage(a1.state, { character: mara, spec: stageSpec, from: s1.ref, now: T })
    const a2 = approveVia(s2.variations, transformationRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: s2.variant, stage: s2.ref, spec: findRevision(s2.variations, s2.ref)!.spec as never, source: { path: 'C:/out/a.jpg', of: { stage: 'Subtle symptoms' }, ref: s1.ref } }))
    const sheet = transformationComparison(a2.state, 'MARA', mara.id, 'infected', 'C:/mara.jpg', [...w.jobs, ...a1.jobs, ...a2.jobs])
    expect(sheet.cells.map((c) => c.label)).toEqual(['MARA, as approved', expect.stringMatching(/^Subtle symptoms \(TRN-\d+ v1\)$/), expect.stringMatching(/^Partial transformation \(TRN-\d+ v1\)$/)])
  })
})

describe('retrying a failed generation keeps the cost and does not duplicate it (scenario 14)', () => {
  const request: JobRequest = { assetId: 'CHAR-MARA', variant: 'MARA at 65', sheetType: 'Identity', viewKey: 'full-front', label: 'Full body front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: ['C:/mara.jpg'], variation: { id: 'AGE-001', revision: 1, role: 'age-candidate' }, outputName: () => 'o' }

  it('a failed request keeps its attempts and its variation link when it is retried', () => {
    let q: QueueState = { ...emptyQueue(), perImageUsd: 0.04 }
    q = enqueue(q, [request], 1).state
    const id = q.jobs[0].id
    q = markGenerating(q, id, 2)
    q = markFailed(q, id, 'Kie.ai request failed (402): Insufficient credits', 3)
    expect(q.jobs[0].status).toBe('failed')
    expect(q.jobs[0].attempts).toBe(1)
    expect(committedUsd(q)).toBe(0.04)
    q = retry(q, id, 4)
    expect(q.jobs[0]).toMatchObject({ status: 'queued', attempts: 1, variation: { id: 'AGE-001', revision: 1, role: 'age-candidate' } })
    q = markGenerating(q, id, 5)
    expect(q.jobs[0].attempts).toBe(2)
    expect(committedUsd(q)).toBe(0.08)
  })

  it('asking for the same picture again while it is queued, running or failed does not make a second request', () => {
    let q = enqueue(emptyQueue(), [request], 1).state
    expect(enqueue(q, [request], 2).added).toBe(0)
    q = markGenerating(q, q.jobs[0].id, 3)
    expect(enqueue(q, [request], 4).added).toBe(0)
    expect(q.jobs).toHaveLength(1)
  })

  it('a request that was running when the app closed is marked for reconciling with the provider, with its cost kept, rather than sent again', () => {
    let q = enqueue({ ...emptyQueue(), perImageUsd: 0.04 }, [request], 1).state
    q = markGenerating(q, q.jobs[0].id, 2)
    const back = recover(q, 3)
    expect(back.jobs[0]).toMatchObject({ status: 'failed', submissionState: 'ambiguous', attempts: 1 })
    expect(back.jobs[0].recoveryNote).toMatch(/Reconcile the provider task/)
    expect(back.paused).toBe(true)
    expect(committedUsd(back)).toBe(0.04)
  })
})

describe('saving a project and reopening it on another computer (scenario 15)', () => {
  it('lists every picture the records point at, so none is silently left out, and follows a relinked file', () => {
    const w = world()
    const files = variationFiles(w.s, w.jobs)
    const expected = w.s.entities.reduce((n, e) => n + e.revisions.reduce((m, r) => m + r.media.length, 0), 0)
    expect(files.length).toBe(expected)
    expect(files.length).toBeGreaterThan(10)
    const moved = w.jobs.map((j) => ({ ...j, outputPath: j.outputPath!.replace('C:/out', 'D:/newpc/media') }))
    expect(variationFiles(w.s, moved).every((f) => f.absolutePath.startsWith('D:/newpc/media/'))).toBe(true)
    const media = w.s.entities[0].revisions[0].media[0]
    expect(currentPath(media, moved)).toMatch(/^D:\/newpc\/media\//)
  })

  it('collects them under media/ with portable paths, and relinking by id points them at the new place', () => {
    const w = world()
    const refs = variationFiles(w.s, w.jobs).map((f) => ({ id: f.id, absolutePath: f.absolutePath }))
    const plan = collectPlan('C:/out', refs)
    expect(plan.every((p) => p.targetPath.startsWith('media/') && !p.targetPath.includes('..'))).toBe(true)
    const swapped = relinkById(refs, { [refs[0].id]: 'E:/elsewhere/a.jpg' })
    expect(swapped[0].absolutePath).toBe('E:/elsewhere/a.jpg')
    expect(swapped[1].absolutePath).toBe(refs[1].absolutePath)
  })

  it('the saved project file carries the records and reads back the same, with the garment, fits, conditions, ages and looks intact', () => {
    const w = world()
    const base = demo2DProject(styleByName('Clean digital cel animation'))
    const text = JSON.stringify(buildProjectFile('Trip', base.graph, { ...base.studio, variations: w.s, queue: { ...emptyQueue(), jobs: w.jobs } }, T))
    const back = parseProjectFile(text)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.file.studio.variations).toEqual(w.s)
    expect(back.file.studio.queue?.jobs.length).toBe(w.jobs.length)
    expect(latestApproved(back.file.studio.variations!.entities.find((e) => e.kind === 'age')!)?.n).toBe(1)
  })
})
