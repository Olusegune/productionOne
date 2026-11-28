import { describe, expect, it, vi } from 'vitest'
import { conditionRequests, newCondition } from './conditions'
import { ageRequests } from './age'
import { newAgeVariant } from './ageFlow'
import { newStage } from './transformationFlow'
import { transformationRequests } from './transformation'
import { fitRequests } from './wardrobe'
import { garmentAssetId, startFit } from './wardrobeFlow'
import type { ImageJob } from './generationQueue'
import { findRevision, type AgeSpec, type ConditionSpec, type TransformationSpec, type VariationState } from './variations'
import type { VisionProvider } from './visualReview'
import { probesFor, runProbes } from './visionProbes'
import { T, approveVia, mara, robe, style, world } from './variationWorld.fixture'

const tear = { component: 'Sleeve', side: 'character-left' as const, severity: 'moderate' as const, description: 'torn open at the elbow' }
const role = (jobs: ImageJob[], r: string, view?: string) => jobs.filter((j) => j.variation?.role === r && (!view || j.viewKey === view))

/** A torn condition, an outfit in it, a plain outfit, an age, and stages at two strengths, all with pictures. */
function scene() {
  const w = world()
  const torn = newCondition(w.s, { name: 'Left sleeve torn', garment: w.robeRef, kind: 'tear', regions: [tear, { component: 'Hem', side: 'both', severity: 'light', description: 'frayed' }, { component: 'Cuff', side: 'character-right', severity: 'light', description: '' }], now: T })
  const condDone = approveVia(torn.variations, conditionRequests({ style, provider: 'kie', model: 'm', assetId: garmentAssetId(w.robeRef.id), assetName: 'Travel robe', condition: torn.ref, conditionName: 'Left sleeve torn', spec: findRevision(torn.variations, torn.ref)!.spec as ConditionSpec, garmentName: 'Travel robe', garment: robe, earlier: [], source: { path: 'C:/g.jpg', of: 'garment', ref: w.robeRef } }))
  const fitT = startFit(condDone.state, { character: mara, garment: w.robeRef, garmentName: 'Travel robe', keep: ['face'], now: T, condition: { ref: torn.ref, name: 'Left sleeve torn' } })
  const fitTDone = approveVia(fitT.variations, fitRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: fitT.variant, fit: fitT.ref, garment: w.robeRef, garmentName: 'Travel robe', garmentSpec: robe, keep: ['face'], characterPicture: 'C:/char.jpg', garmentPicture: 'C:/cond.jpg', condition: torn.ref }))
  const age = newAgeVariant(fitTDone.state, { character: mara, spec: { mode: 'same-person', targetAge: '75', anchors: ['the eyes'], keep: ['costume'] }, now: T })
  const ageDone = approveVia(age.variations, ageRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: age.variant, age: age.ref, spec: findRevision(age.variations, age.ref)!.spec as AgeSpec, characterPicture: 'C:/char.jpg' }))
  const stage = (state: VariationState, intensity: number, name: string) => {
    const st = newStage(state, { character: mara, spec: { kind: 'infected', stage: name, intensity, recognisability: 4, anchors: ['the eyes'], details: { anatomy: 'longer arm' } }, now: T })
    return approveVia(st.variations, transformationRequests({ style, provider: 'kie', model: 'm', character: mara, lookName: st.variant, stage: st.ref, spec: findRevision(st.variations, st.ref)!.spec as TransformationSpec, source: { path: 'C:/char.jpg', of: 'base' } }))
  }
  const mild = stage(ageDone.state, 3, 'Partial')
  const strong = stage(mild.state, 5, 'Full form')
  const jobs = [...condDone.jobs, ...fitTDone.jobs, ...ageDone.jobs, ...mild.jobs, ...strong.jobs, ...w.jobs]
  return { state: strong.state, jobs, w }
}

const provider = (answer: (question: string, images: string[], call: number) => string): VisionProvider & { calls: Array<{ q: string; images: string[] }> } => {
  const calls: Array<{ q: string; images: string[] }> = []
  return { calls, assess: async (q, images) => { calls.push({ q, images }); return answer(q, images, calls.length) } }
}

describe('which closed questions are asked about a picture', () => {
  it('a condition: where the tear is, as the side of the picture for this view', () => {
    const { state, jobs } = scene()
    const front = probesFor(state, role(jobs, 'condition-preview', 'garment-front')[0])
    const back = probesFor(state, role(jobs, 'condition-preview', 'garment-back')[0])
    expect(front.map((p) => p.kind)).toEqual(['side'])
    expect(front[0]).toMatchObject({ category: 'K', expect: 'right', answerKey: 'side_of_picture' })
    expect(front[0].question).toMatch(/Sleeve: torn open at the elbow/)
    expect(front[0].question).toMatch(/LEFT side of the picture, the RIGHT side of the picture, on BOTH sides, or NOT visible/)
    expect(front[0].expected).toBe("The sleeve: torn open at the elbow should be on the right of the picture (the wearer's left).")
    expect(back[0].expect).toBe('left')
  })

  it('asks nothing it cannot expect: a detail view, a change on both sides, a change that says nothing', () => {
    const { state, jobs } = scene()
    expect(probesFor(state, role(jobs, 'condition-preview', 'garment-detail')[0])).toEqual([])
    const front = probesFor(state, role(jobs, 'condition-preview', 'garment-front')[0])
    expect(front).toHaveLength(1)
  })

  it('an outfit in a condition: the tear side, the same person, and the garment worn; a plain outfit: no tear question', () => {
    const { state, jobs } = scene()
    const torn = role(jobs, 'fit-candidate').find((j) => j.variant.includes('Left sleeve torn'))!
    const plain = role(jobs, 'fit-candidate').find((j) => !j.variant.includes('Left sleeve torn'))!
    const t = probesFor(state, torn)
    expect(t.map((p) => p.kind).sort()).toEqual(['same-person', 'side', 'wearing'])
    expect(t.find((p) => p.kind === 'side')!.expect).toBe('right')
    const same = t.find((p) => p.kind === 'same-person')!
    expect(same.images).toEqual([torn.outputPath, 'C:/char.jpg'])
    expect(same.expect).toBe(true)
    expect(t.find((p) => p.kind === 'wearing')!.question).toMatch(/Are they wearing this: A long wool travel robe/)
    expect(probesFor(state, plain).map((p) => p.kind).sort()).toEqual(['same-person', 'wearing'])
  })

  it('an age: the same person; a stage: the same person only while the change is not extreme', () => {
    const { state, jobs } = scene()
    expect(probesFor(state, role(jobs, 'age-candidate', 'full-front')[0]).map((p) => p.kind)).toEqual(['same-person'])
    const mild = role(jobs, 'transformation-candidate', 'full-front').find((j) => j.variant.includes('partial'))!
    const strong = role(jobs, 'transformation-candidate', 'full-front').find((j) => j.variant.includes('full form'))!
    expect(probesFor(state, mild).map((p) => p.kind)).toEqual(['same-person'])
    expect(probesFor(state, strong)).toEqual([])
  })

  it('asks nothing about a picture that is not tied to a record or has no file', () => {
    const { state, jobs } = scene()
    expect(probesFor(state, { ...jobs[0], variation: undefined })).toEqual([])
    expect(probesFor(state, { ...jobs[0], outputPath: undefined })).toEqual([])
  })
})

describe('the answer is compared by the app, never judged by the model', () => {
  const front = () => { const s = scene(); const job = role(s.jobs, 'condition-preview', 'garment-front')[0]; return { job, probes: probesFor(s.state, job) } }

  it('a matching answer, given twice, is no finding, and the category is listed as checked', async () => {
    const { job, probes } = front()
    const p = provider(() => '{"side_of_picture": "right"}')
    const r = await runProbes(p, job, probes)
    expect(r.findings).toEqual([])
    expect(r.checked).toEqual(['K'])
    expect(r.unable).toBe(false)
    expect(p.calls).toHaveLength(2)
    expect(p.calls[0]).toEqual(p.calls[1])
    expect(p.calls[0].images).toEqual([job.outputPath])
  })

  it('the other side is a finding that says what was expected and what was seen, with how many times it was asked', async () => {
    const { job, probes } = front()
    const r = await runProbes(provider(() => '{"side_of_picture": "left"}'), job, probes)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]).toMatchObject({ category: 'K', severity: 'high', confidence: 0.8, source: 'vision', status: 'open', outputJobId: job.id })
    expect(r.findings[0].expected).toMatch(/should be on the right of the picture \(the wearer's left\)/)
    expect(r.findings[0].observed).toBe('The model sees it on the left of the picture. (asked 2 times, same answer)')
    expect(r.findings[0].sourceRule).toMatch(/compared by the app/)
  })

  it('"not visible" is a weaker finding, because a small model can miss a small tear', async () => {
    const { job, probes } = front()
    const r = await runProbes(provider(() => '{"side_of_picture": "none"}'), job, probes)
    expect(r.findings[0].confidence).toBe(0.5)
    expect(r.findings[0].observed).toMatch(/could not see it at all/)
  })

  it('two different answers are "could not tell", never a finding', async () => {
    const { job, probes } = front()
    const r = await runProbes(provider((_q, _i, n) => (n % 2 ? '{"side_of_picture": "left"}' : '{"side_of_picture": "right"}')), job, probes)
    expect(r.findings).toEqual([])
    expect(r.checked).toEqual([])
    expect(r.unable).toBe(true)
  })

  it('an answer that is not the expected form, or a model that fails, is "could not tell"', async () => {
    const { job, probes } = front()
    for (const answer of ['I think it is on the left', '{"side_of_picture": 7}', '{}', 'not json']) {
      const r = await runProbes(provider(() => answer), job, probes)
      expect(r.findings).toEqual([])
      expect(r.unable).toBe(true)
    }
    const broken: VisionProvider = { assess: vi.fn().mockRejectedValue(new Error('Ollama could not be reached')) }
    const r = await runProbes(broken, job, probes)
    expect(r.unable).toBe(true)
    expect(r.findings).toEqual([])
  })

  it('a different person, and a garment that is not worn, are findings in the right categories', async () => {
    const { state, jobs } = scene()
    const job = role(jobs, 'fit-candidate').find((j) => !j.variant.includes('Left sleeve torn'))!
    const r = await runProbes(provider((q) => (q.includes('same_person') ? '{"same_person": false}' : '{"wearing_it": false}')), job, probesFor(state, job))
    expect(r.findings.map((f) => f.category).sort()).toEqual(['A', 'C'])
    expect(r.findings.find((f) => f.category === 'A')!.observed).toMatch(/thinks this is a different person/)
    expect(r.findings.find((f) => f.category === 'C')!.observed).toMatch(/does not see the garment being worn/)
    expect(r.checked.sort()).toEqual(['A', 'C'])
  })

  it('only the questions that were answered count as checked', async () => {
    const { state, jobs } = scene()
    const job = role(jobs, 'fit-candidate').find((j) => !j.variant.includes('Left sleeve torn'))!
    const r = await runProbes(provider((q) => (q.includes('same_person') ? '{"same_person": true}' : 'garbled')), job, probesFor(state, job))
    expect(r.checked).toEqual(['A'])
    expect(r.unable).toBe(false)
    expect(r.findings).toEqual([])
  })

  it('with nothing to ask, there is nothing checked and nothing unable', async () => {
    const { job } = front()
    expect(await runProbes(provider(() => ''), job, [])).toMatchObject({ findings: [], checked: [], unable: false })
  })
})
