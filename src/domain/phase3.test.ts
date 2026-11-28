import { describe, expect, it } from 'vitest'
import { affectedJobs, canAttempt, defaultLimits, noInpainting, planCorrection, queueCorrection, recordAttempt, type Ledgers } from './correction'
import { provenanceFor } from './characterLayers'
import { decide, proposeFitRules } from './fit'
import { approve, emptyQueue, enqueue, type ImageJob, type JobRequest, type QueueState } from './generationQueue'
import { addException, createProfile, setControl } from './proportions'
import { addThing, assignOwner, emptySceneState, moveBetweenShots, placeThing, readSceneStates, screenPlacement, seat, setShotCamera, unexplainedDrift, worldAtShot, worldIssues } from './sceneState'
import {
  allFindings, applyExceptions, categories, categoryLabels, deterministicCategories, deterministicChecks, emptyReviews, outputStatus, parseVisionAnswer, readReviews, recordReview, runVisionReview, setFindingStatus, visionPrompt, type Category, type VisionProvider,
} from './visualReview'

const shots = ['S1', 'S2', 'S3']
function room() {
  let s = emptySceneState('SC-1')
  s = addThing(s, { id: 'CHAIR-A', kind: 'furniture', name: 'Chair A', x: 2, y: 3, facing: 90 })
  s = addThing(s, { id: 'CHAIR-B', kind: 'furniture', name: 'Chair B', x: 4, y: 3, facing: 270 })
  s = addThing(s, { id: 'MARCUS', kind: 'character', name: 'MARCUS', x: 1, y: 1, facing: 0, posture: 'standing' })
  s = addThing(s, { id: 'AMINA', kind: 'character', name: 'AMINA', x: 5, y: 1, facing: 0, posture: 'standing' })
  s = assignOwner(assignOwner(s, 'CHAIR-A', 'MARCUS'), 'CHAIR-B', 'AMINA')
  const a = seat(s, 'MARCUS', 'CHAIR-A'); if (!a.ok) throw new Error(a.error)
  const b = seat(a.state, 'AMINA', 'CHAIR-B'); if (!b.ok) throw new Error(b.error)
  return b.state
}

describe('scene state: world space is separate from the camera', () => {
  it('a camera change for a shot leaves chair ownership, character location and furniture layout exactly as they were', () => {
    const before = room()
    const worldBefore = JSON.stringify(before.world)
    let s = before
    for (const [i, cam] of [{ x: 3, y: 8, facing: 0, fov: 40 }, { x: 0, y: 3, facing: 90, fov: 25 }, { x: 6, y: 0, facing: 200, fov: 70 }].entries()) s = setShotCamera(s, `S${i + 1}`, cam)
    expect(JSON.stringify(s.world)).toBe(worldBefore)
    expect(s.world).toBe(before.world)
    expect(Object.keys(s.cameras)).toEqual(['S1', 'S2', 'S3'])
    expect(worldIssues(s.world)).toEqual([])
    const chairA = s.world.things.find((t) => t.id === 'CHAIR-A')!
    expect(chairA.ownedBy).toBe('MARCUS')
    expect(s.world.things.find((t) => t.id === 'MARCUS')!.occupies).toBe('CHAIR-A')
  })
  it('screen placement is derived from the world and one camera, and changes with the camera', () => {
    const s = room()
    const front = screenPlacement(s.world, { x: 3, y: 9, facing: 0, fov: 60 }, 'MARCUS')!
    const reverse = screenPlacement(s.world, { x: 3, y: -4, facing: 180, fov: 60 }, 'MARCUS')!
    expect(front.lateral).toMatch(/left/)
    expect(reverse.lateral).toMatch(/right/)
    expect(screenPlacement(s.world, { x: 3, y: 9, facing: 0, fov: 60 }, 'nobody')).toBeUndefined()
    expect(screenPlacement(s.world, { x: 3, y: 9, facing: 180, fov: 60 }, 'MARCUS')!.lateral).toBe('behind-camera')
    expect(screenPlacement(s.world, { x: 3, y: 4.2, facing: 0, fov: 20 }, 'MARCUS')!.lateral).toBe('out-of-frame')
  })
  it('movement between shots is an explicit change with a reason, and later shots see it while earlier ones do not', () => {
    const s = room()
    const refused = moveBetweenShots(s, { shotId: 'S2', thingId: 'MARCUS', patch: { x: 9 }, reason: '  ' })
    expect(refused.ok).toBe(false)
    const moved = moveBetweenShots(s, { shotId: 'S2', thingId: 'MARCUS', patch: { x: 1, y: 1, posture: 'standing', occupies: undefined }, reason: 'Marcus gets up to leave' })
    if (!moved.ok) throw new Error(moved.error)
    expect(worldAtShot(moved.state, 'S1', shots).things.find((t) => t.id === 'MARCUS')!.posture).toBe('seated')
    expect(worldAtShot(moved.state, 'S2', shots).things.find((t) => t.id === 'MARCUS')!.posture).toBe('standing')
    expect(worldAtShot(moved.state, 'S3', shots).things.find((t) => t.id === 'MARCUS')!.posture).toBe('standing')
    expect(moved.state.world).toBe(s.world)
    expect(moveBetweenShots(s, { shotId: 'S2', thingId: 'GHOST', patch: {}, reason: 'x' }).ok).toBe(false)
  })
  it('catches two people on one chair, someone in a chair assigned to another, and a chair left behind', () => {
    const s = room()
    const bad = seat(s, 'AMINA', 'CHAIR-A')
    expect(bad.ok).toBe(false)
    expect((bad as { error: string }).error).toMatch(/already taken by MARCUS/)
    const swapped = { ...s.world, things: s.world.things.map((t) => (t.id === 'AMINA' ? { ...t, occupies: 'CHAIR-A', x: 2, y: 3 } : t)) }
    const kinds = worldIssues(swapped).map((i) => i.kind)
    expect(kinds).toContain('chair-taken')
    expect(kinds).toContain('chair-not-owned')
    expect(worldIssues({ ...s.world, things: s.world.things.map((t) => (t.id === 'MARCUS' ? { ...t, x: 8 } : t)) }).map((i) => i.kind)).toContain('chair-moved')
    expect(worldIssues({ ...s.world, things: s.world.things.map((t) => (t.id === 'MARCUS' ? { ...t, occupies: undefined } : t)) }).map((i) => i.kind)).toContain('seated-without-chair')
  })
  it('notices drift that no change explains', () => {
    const s = room()
    const moved = placeThing(s, 'CHAIR-A', { x: 6 })
    expect(unexplainedDrift(s.world, moved.world, new Set()).some((d) => /Chair A moved/.test(d.what))).toBe(true)
    expect(unexplainedDrift(s.world, moved.world, new Set(['CHAIR-A']))).toEqual([])
  })
  it('reads saved states safely and drops damage', () => {
    const good = JSON.parse(JSON.stringify({ 'SC-1': room() }))
    expect(readSceneStates(good)['SC-1'].world.things).toHaveLength(4)
    const read = readSceneStates({ X: { world: { things: [{ id: 'a', name: 'A', kind: 'weird' }, { id: 'b', name: 'B', kind: 'prop', x: 'no' }] }, cameras: { S1: { fov: 999 } } }, Y: 'junk' })
    expect(read.X.world.things).toHaveLength(1)
    expect(read.X.world.things[0]).toMatchObject({ id: 'b', x: 0, scale: 1 })
    expect(read.X.cameras.S1.fov).toBe(170)
    expect(read.Y).toBeUndefined()
    expect(readSceneStates(undefined)).toEqual({})
  })
})

const job = (over: Partial<ImageJob> = {}): ImageJob => ({ id: 'J1', key: 'k', assetId: 'S2', variant: 'Storyboard', sheetType: 'Storyboard', viewKey: 'frame', label: 'Frame', prompt: 'p', aspect: '16:9', fullBody: false, provider: 'kie', model: 'm', references: ['C:/refs/a.png'], useAnchor: false, outputName: 'o', revision: 2, status: 'needs-review', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 1, updatedAt: 1, outputPath: 'C:/out/o.png', ...over } as ImageJob)

describe('deterministic checks', () => {
  const profile = createProfile('MARCUS', 'large-headed')
  it('only the categories that can be checked from records are listed as checkable', () => {
    expect(deterministicCategories).toEqual(['B', 'E', 'F', 'I'])
    expect(categories).toHaveLength(11) // A to J, and K: damage and wear placement
    expect(categories).toContain('K')
    for (const c of categories) expect(categoryLabels[c].length).toBeGreaterThan(3)
  })
  it('flags output made with earlier proportions, with the control that changed', () => {
    const j = job({ provenance: provenanceFor(profile, []) })
    const now = setControl(profile, 'eyeSize', 0.1)
    const r = deterministicChecks({ job: j, profile: now })
    expect(r.checked).toContain('B')
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]).toMatchObject({ category: 'B', source: 'deterministic', status: 'open', confidence: 1, outputJobId: 'J1', outputRevision: 2, control: 'eyeSize' })
    for (const k of ['expected', 'observed', 'sourceRule', 'suggestedAction'] as const) expect(r.findings[0][k].length).toBeGreaterThan(5)
    expect(deterministicChecks({ job: j, profile }).findings).toEqual([])
  })
  it('flags a picture made in an earlier style', () => {
    const r = deterministicChecks({ job: job({ styleFp: 'a', styleName: 'Flat vector' }), currentStyleFp: 'b' })
    expect(r.findings.map((f) => f.category)).toEqual(['I'])
    expect(deterministicChecks({ job: job({ styleFp: 'a' }), currentStyleFp: 'a' }).findings).toEqual([])
  })
  it('checks placement for a shot: a wrong chair assignment and unexplained drift are found', () => {
    const s = room()
    const wrong = { ...s, world: { ...s.world, things: s.world.things.map((t) => (t.id === 'AMINA' ? { ...t, occupies: 'CHAIR-A', x: 2, y: 3 } : t)) } }
    const r = deterministicChecks({ job: job({ assetId: 'S1' }), scene: wrong, shotOrder: shots })
    expect(r.checked).toContain('E')
    expect(r.findings.some((f) => f.category === 'E' && /both on Chair A/.test(f.observed))).toBe(true)
    const drift = deterministicChecks({ job: job({ assetId: 'S2' }), scene: { ...s, changes: [] }, shotOrder: shots })
    expect(drift.findings.filter((f) => f.category === 'E')).toEqual([])
    const clean = deterministicChecks({ job: job({ assetId: 'S1' }), scene: s, shotOrder: shots })
    expect(clean.findings).toEqual([])
    expect(clean.checked).toEqual(['E'])
  })
  it('checks seat height against an approved fit rule, and skips when the rule is intentional or not approved', () => {
    const p = createProfile('MARCUS')
    const rule = decide(proposeFitRules(p).find((r) => r.key === 'seat-height')!, 'approved')
    const bad = deterministicChecks({ job: job(), profile: p, fitRules: [rule], seatHeightsM: { 'CHAIR-A': rule.valueM! * 1.6 } })
    expect(bad.findings.map((f) => f.category)).toEqual(['F'])
    expect(deterministicChecks({ job: job(), profile: p, fitRules: [{ ...rule, intent: 'oversized' }], seatHeightsM: { 'CHAIR-A': rule.valueM! * 1.6 } }).findings).toEqual([])
    expect(deterministicChecks({ job: job(), profile: p, fitRules: [{ ...rule, status: 'proposed' }], seatHeightsM: { 'CHAIR-A': 2 } }).checked).not.toContain('F')
  })
  it('an intentional exaggeration is set aside with a visible reason, not deleted, and can be reopened', () => {
    const j = job({ provenance: provenanceFor(profile, []) })
    const now = addException(setControl(profile, 'eyeSize', 0.4), 'eyeSize', 'Huge eyes are the design')
    const found = deterministicChecks({ job: j, profile: now }).findings
    expect(found[0].control).toBe('eyeSize')
    const after = applyExceptions(found, now)
    expect(after[0]).toMatchObject({ status: 'intentional-exception' })
    expect(after[0].reason).toMatch(/Eye size is marked intentional/)
    expect(applyExceptions(found, profile)[0].status).toBe('open')
    const reviews = recordReview(emptyReviews(), 'J1', 'deterministic', after, ['B'])
    expect(setFindingStatus(reviews, after[0].id, 'open').deterministic[0].status).toBe('open')
  })
})

describe('output status never calls an unchecked output clean', () => {
  it('not checked, passed (with which categories), needs review, unable to assess', () => {
    let r = emptyReviews()
    expect(outputStatus(r, 'J1')).toEqual({ status: 'not-checked', checkedCategories: [] })
    r = recordReview(r, 'J1', 'deterministic', [], ['B', 'I'])
    expect(outputStatus(r, 'J1')).toEqual({ status: 'passed', checkedCategories: ['B', 'I'] })
    const f = deterministicChecks({ job: job({ styleFp: 'a' }), currentStyleFp: 'b' }).findings
    r = recordReview(r, 'J1', 'deterministic', f, ['I'])
    expect(outputStatus(r, 'J1').status).toBe('needs-review')
    r = setFindingStatus(r, f[0].id, 'dismissed')
    expect(outputStatus(r, 'J1').status).toBe('passed')
    const u = recordReview(emptyReviews(), 'J9', 'vision', [], [], true)
    expect(outputStatus(u, 'J9').status).toBe('unable-to-assess')
  })
  it('deterministic and vision results are kept in separate lists', () => {
    const det = deterministicChecks({ job: job({ styleFp: 'a' }), currentStyleFp: 'b' }).findings
    let r = recordReview(emptyReviews(), 'J1', 'deterministic', det, ['I'])
    const v = parseVisionAnswer('{"unable": false, "findings": [{"category":"G","severity":"high","confidence":0.7,"expected":"five fingers","observed":"six fingers","rule":"hands","action":"redraw"}]}', job(), ['G'])
    r = recordReview(r, 'J1', 'vision', v.findings, ['G'])
    expect(r.deterministic.every((f) => f.source === 'deterministic')).toBe(true)
    expect(r.vision.every((f) => f.source === 'vision')).toBe(true)
    expect(allFindings(r)).toHaveLength(2)
    expect(outputStatus(r, 'J1').checkedCategories).toEqual(['G', 'I'])
  })
  it('re-running a check replaces its open findings but keeps decided ones', () => {
    const f = deterministicChecks({ job: job({ styleFp: 'a' }), currentStyleFp: 'b' }).findings
    let r = recordReview(emptyReviews(), 'J1', 'deterministic', f, ['I'])
    r = setFindingStatus(r, f[0].id, 'accepted')
    r = recordReview(r, 'J1', 'deterministic', deterministicChecks({ job: job({ styleFp: 'a' }), currentStyleFp: 'b' }).findings, ['I'])
    expect(r.deterministic.filter((x) => x.status === 'accepted')).toHaveLength(1)
    expect(r.deterministic.filter((x) => x.status === 'open')).toHaveLength(1)
  })
})

describe('vision review (mock provider only)', () => {
  const req = { job: job(), categories: ['A', 'G'] as Category[], rules: ['Eyes are deliberately large.'], imagePaths: ['C:/out/o.png', 'C:/refs/a.png'] }
  const answer = JSON.stringify({ unable: false, findings: [
    { category: 'G', severity: 'high', confidence: 2, region: { x: 0.2, y: 0.4, w: 0.1, h: 0.1 }, expected: 'five fingers', observed: 'six fingers', rule: 'Hands', action: 'Regenerate' },
    { category: 'D', severity: 'low', confidence: 0.5, expected: 'x', observed: 'y' },
    { category: 'A', severity: 'weird', confidence: 'high', expected: 'face', observed: 'different face' },
  ] })
  it('the prompt carries the exaggeration and occlusion rules and the categories asked for', () => {
    const p = visionPrompt(req)
    expect(p).toMatch(/Intentional exaggeration is not a defect/)
    expect(p).toMatch(/occlusion, foreshortening and perspective/)
    expect(p).toMatch(/A Identity; G Hands and anatomy/)
    expect(p).toContain('Eyes are deliberately large.')
  })
  it('keeps only findings in the categories asked for, clamps values and records region and confidence', async () => {
    const provider: VisionProvider = { assess: async () => answer }
    const r = await runVisionReview(provider, req)
    expect(r.unable).toBe(false)
    expect(r.findings.map((f) => f.category)).toEqual(['G', 'A'])
    expect(r.findings[0]).toMatchObject({ confidence: 1, region: { x: 0.2, y: 0.4, w: 0.1, h: 0.1 }, source: 'vision', status: 'open' })
    expect(r.findings[1]).toMatchObject({ severity: 'low', confidence: 0.3 })
    expect(r.checked).toEqual(['A', 'G'])
  })
  it('a model that cannot tell, answers badly or fails is "unable to assess", never a pass', async () => {
    for (const bad of ['no json at all', '{"findings": "nope"}', '{"unable": true}', '{ broken']) {
      const r = await runVisionReview({ assess: async () => bad }, req)
      expect(r.unable).toBe(true)
      expect(r.checked).toEqual([])
    }
    const thrown = await runVisionReview({ assess: async () => { throw new Error('model offline') } }, req)
    expect(thrown).toMatchObject({ unable: true, checked: [] })
    expect(thrown.error).toMatch(/model offline/)
    const reviews = recordReview(emptyReviews(), 'J1', 'vision', thrown.findings, thrown.checked, thrown.unable)
    expect(outputStatus(reviews, 'J1').status).toBe('unable-to-assess')
  })
  it('an empty findings list means those categories were checked and nothing was found', async () => {
    const r = await runVisionReview({ assess: async () => '{"unable": false, "findings": []}' }, req)
    expect(r).toMatchObject({ unable: false, findings: [], checked: ['A', 'G'] })
  })
})

describe('reading saved reviews', () => {
  it('drops damaged findings, never hides one by an unknown status, and tolerates nothing', () => {
    const f = deterministicChecks({ job: job({ styleFp: 'a' }), currentStyleFp: 'b' }).findings
    const saved = JSON.parse(JSON.stringify(recordReview(emptyReviews(), 'J1', 'deterministic', f, ['I'])))
    saved.deterministic.push({ id: 'bad' }, { id: 'x', outputJobId: 'J2', category: 'Z' }, { id: 'weird', outputJobId: 'J3', category: 'B', status: 'vanished' })
    const read = readReviews(saved)
    expect(read.deterministic.map((x) => x.id)).toContain('weird')
    expect(read.deterministic.find((x) => x.id === 'weird')!.status).toBe('open')
    expect(read.deterministic.find((x) => x.id === 'bad')).toBeUndefined()
    expect(read.checked.J1.deterministic).toEqual(['I'])
    expect(readReviews(undefined)).toEqual(emptyReviews())
  })
})

const request = (viewKey: string): JobRequest => ({ assetId: 'CHAR-1', variant: 'Canonical', sheetType: 'Turnaround', viewKey, label: viewKey, prompt: `draw ${viewKey}`, aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: ['C:/refs/front.png'], outputName: (r) => `${viewKey}_v${r}` })

describe('correction workflow', () => {
  const finding = deterministicChecks({ job: job({ styleFp: 'a', styleName: 'Old' }), currentStyleFp: 'b' }).findings[0]
  it('without inpainting it regenerates only the affected view, with the right references, and says so', () => {
    const plan = planCorrection(finding, job(), noInpainting, ['C:/refs/set.png'])
    expect(plan.mode).toBe('regenerate')
    expect(plan.affected).toEqual({ assetId: 'S2', variant: 'Storyboard', sheetType: 'Storyboard', viewKey: 'frame' })
    expect(plan.references).toEqual(['C:/refs/a.png', 'C:/refs/set.png'])
    expect(plan.note).toMatch(/cannot edit part of a picture/)
    expect(plan.promptAddition).toMatch(/change nothing else/)
  })
  it('a targeted edit is offered only where the provider supports it and the finding has a region', () => {
    const withRegion = { ...finding, region: { x: 0, y: 0, w: 0.2, h: 0.2 } }
    expect(planCorrection(withRegion, job(), { inpainting: true }).mode).toBe('edit')
    expect(planCorrection(finding, job(), { inpainting: true }).mode).toBe('regenerate')
    expect(planCorrection(withRegion, job(), noInpainting).mode).toBe('regenerate')
  })
  it('queues a new revision of that one view, keeps the source record, and never approves it', () => {
    let q: QueueState = enqueue(emptyQueue(), [request('front'), request('side')], 1, false).state
    q = { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'needs-review', outputPath: `C:/out/${j.viewKey}.png` })) }
    q = approve(q, q.jobs[0].id)
    const source = q.jobs[0]
    const f = { ...finding, outputJobId: source.id, outputRevision: source.revision }
    const plan = planCorrection(f, source, noInpainting)
    const out = queueCorrection(q, f, source, plan, 5)
    expect(out.added).toBe(true)
    expect(out.state.jobs).toHaveLength(3)
    const fix = out.state.jobs[2]
    expect(fix).toMatchObject({ viewKey: 'front', revision: 2, approved: false, rejected: false, status: 'queued' })
    expect(fix.provenance?.correctionOf).toEqual({ findingId: f.id, sourceJobId: source.id, sourceRevision: 1 })
    expect(fix.outputName).toMatch(/_fix_v02$/)
    expect(out.state.jobs[0]).toEqual(source)
    expect(out.state.jobs[1]).toEqual(q.jobs[1])
    expect(out.state.jobs[0].approved).toBe(true)
    expect(affectedJobs(q, f).map((j) => j.id)).toEqual([source.id])
  })
  it('stops after the attempt limit or the spend limit with an explanation', () => {
    let l: Ledgers = {}
    expect(canAttempt(l, 'F1', 0.1).ok).toBe(true)
    for (let i = 0; i < defaultLimits.maxAttempts; i++) { expect(canAttempt(l, 'F1', 0.1).ok).toBe(true); l = recordAttempt(l, 'F1', 0.1, 'still wrong') }
    const stop = canAttempt(l, 'F1', 0.1)
    expect(stop.ok).toBe(false)
    expect((stop as { reason: string }).reason).toMatch(/3 correction attempts/)
    expect((stop as { reason: string }).reason).toMatch(/still wrong/)
    expect(canAttempt(l, 'OTHER', 0.1).ok).toBe(true)
    let m: Ledgers = {}
    m = recordAttempt(m, 'F2', 0.9)
    const money = canAttempt(m, 'F2', 0.2)
    expect(money.ok).toBe(false)
    expect((money as { reason: string }).reason).toMatch(/past \$1.00/)
    expect(canAttempt(m, 'F2', null).ok).toBe(true)
    expect(canAttempt(m, 'F2', 0.1).ok).toBe(true)
  })
})
