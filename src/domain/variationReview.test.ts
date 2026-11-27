import { describe, expect, it } from 'vitest'
import { emptyQueue, enqueue, type ImageJob, type QueueState } from './generationQueue'
import { conditionRequests, newCondition } from './conditions'
import { planCorrection, queueCorrection, noInpainting } from './correction'
import { ageRequests } from './age'
import { newAgeVariant } from './ageFlow'
import { approveRevision, findRevision, type AgeSpec, type ConditionSpec, type VariationState } from './variations'
import { garmentAssetId } from './wardrobeFlow'
import { parseVisionAnswer, type Finding } from './visualReview'
import { variationDeterministic } from './variationReview'
import { T, approveVia, mara, robe, style, world } from './variationWorld.fixture'

const jobsOf = (jobs: ImageJob[], role: string) => jobs.filter((j) => j.variation?.role === role)
const tear = { component: 'Sleeve', side: 'character-left' as const, severity: 'moderate' as const, description: 'torn open at the elbow' }

describe('what a model\'s open answer may contain', () => {
  const job = () => world().jobs[0]
  const finding = (over: Record<string, unknown>) => ({ category: 'K', severity: 'high', confidence: 0.8, region: { x: 0.6, y: 0.3, w: 0.2, h: 0.2 }, expected: 'tear on the picture right', observed: 'tear on the picture left', rule: 'side', action: 'make it again', ...over })

  it('reads damage placement, and still drops a category that was not asked for', () => {
    const parsed = parseVisionAnswer(JSON.stringify({ unable: false, findings: [finding({}), finding({ category: 'J' })] }), job(), ['K'])
    expect(parsed.findings.map((f) => f.category)).toEqual(['K'])
    expect(parsed.findings[0]).toMatchObject({ source: 'vision', status: 'open', confidence: 0.8 })
  })

  it('never shows "no damage" as a finding: a note that nothing is wrong is not a problem', () => {
    // What the local model really answered for a picture with a clear tear, and for one without.
    const answer = JSON.stringify({ unable: false, findings: [
      finding({ severity: 'info', confidence: 0.5, observed: 'The left sleeve is not torn open at the elbow.' }),
      finding({ severity: 'info', confidence: 0.5, observed: 'no damage' }),
      finding({ severity: 'info', confidence: 0.5, observed: 'No visible damage on the left sleeve' }),
      finding({ severity: 'info', confidence: 0.5, observed: 'There is no tear.' }),
      finding({ severity: 'info', confidence: 0.5, observed: 'Nothing is wrong here.' }),
    ] })
    expect(parseVisionAnswer(answer, job(), ['K']).findings).toEqual([])
  })

  it('keeps an info finding that reports something, and a real problem that happens to start with "not"', () => {
    const answer = JSON.stringify({ unable: false, findings: [
      finding({ severity: 'info', observed: 'The tear is a little smaller than described.' }),
      finding({ severity: 'high', observed: 'No sleeve is torn, but the hem is ripped' }),
    ] })
    expect(parseVisionAnswer(answer, job(), ['K']).findings).toHaveLength(2)
  })
})

describe('findings about the records, kept apart from the picture', () => {
  it('a clean set of records raises nothing', () => {
    const w = world()
    for (const j of w.jobs.filter((x) => x.variation)) expect(variationDeterministic(w.s, j)).toEqual([])
  })

  it('a condition with a change that says nothing is a damage-placement finding with confidence 1', () => {
    const w = world()
    const made = newCondition(w.s, { name: 'Vague', garment: w.robeRef, kind: 'tear', regions: [{ ...tear, description: '' }], now: T })
    const done = approveVia(made.variations, conditionRequests({ style, provider: 'kie', model: 'm', assetId: garmentAssetId(w.robeRef.id), assetName: 'Travel robe', condition: made.ref, conditionName: 'Vague', spec: findRevision(made.variations, made.ref)!.spec as ConditionSpec, garmentName: 'Travel robe', garment: robe, earlier: [] }))
    const f = variationDeterministic(done.state, jobsOf(done.jobs, 'condition-preview')[0])
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ category: 'K', source: 'deterministic', confidence: 1, status: 'open', sourceRule: 'Record check', expected: 'Every change says what happened' })
  })

  it('an age with no named feature, and a picture made without its reference', () => {
    const w = world()
    const made = newAgeVariant(w.s, { character: mara, spec: { mode: 'same-person', targetAge: '80' }, now: T })
    const reqs = ageRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: made.variant, age: made.ref, spec: findRevision(made.variations, made.ref)!.spec as AgeSpec, characterPicture: 'C:/mara.jpg' })
    const done = approveVia(made.variations, reqs)
    const job = jobsOf(done.jobs, 'age-candidate')[0]
    expect(variationDeterministic(done.state, job).map((f) => f.category)).toEqual(['A'])
    const found = variationDeterministic(done.state, { ...job, references: [] })
    expect(found.some((f) => f.category === 'C' && /was sent, so this picture was made without what it should be compared against/.test(f.observed))).toBe(true)
  })

  it('an approved outfit made from something that changed is flagged as out of date', () => {
    const w = world()
    const fitJob = jobsOf(w.jobs, 'fit-candidate')[0]
    const e = w.s.entities.find((x) => x.id === w.robeRef.id)!
    const withNewer: VariationState = { ...w.s, entities: w.s.entities.map((x) => (x.id === e.id ? { ...e, revisions: [...e.revisions, { ...e.revisions[0], n: 2, status: 'candidate' as const, media: [] }] } : x)) }
    const newer = approveRevision(withNewer, { id: w.robeRef.id, revision: 2 })
    expect(variationDeterministic(newer, fitJob).some((f) => /newer approved version/.test(f.observed))).toBe(true)
  })

  it('says nothing for a picture that is not tied to a record', () => {
    const w = world()
    expect(variationDeterministic(w.s, { ...w.jobs[0], variation: undefined })).toEqual([])
  })
})

describe('a correction stays a picture for the same record', () => {
  it('keeps the link and is never approved', () => {
    const w = world()
    const job = jobsOf(w.jobs, 'fit-candidate')[0]
    const finding: Finding = { id: 'F1', targetId: job.assetId, outputJobId: job.id, outputRevision: job.revision, category: 'K', severity: 'high', confidence: 0.8, expected: 'tear on the wearer’s left', observed: 'tear on the wearer’s right', sourceRule: 'side', suggestedAction: 'make it again', source: 'vision', status: 'open' }
    const q: QueueState = { ...emptyQueue(), jobs: [job] }
    const out = queueCorrection(q, finding, job, planCorrection(finding, job, noInpainting))
    const added = out.state.jobs.find((j) => j.id !== job.id)!
    expect(out.added).toBe(true)
    expect(added.variation).toEqual(job.variation)
    expect(added.approved).toBe(false)
    expect(added.prompt).toMatch(/Correct this problem and change nothing else: tear on the wearer’s right/)
    expect(added.provenance?.correctionOf).toMatchObject({ findingId: 'F1', sourceJobId: job.id })
    expect(enqueue(emptyQueue(), [], 1).added).toBe(0)
  })
})
