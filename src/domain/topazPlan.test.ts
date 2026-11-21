import { describe, expect, it } from 'vitest'
import { costSentence, topazModels, topazPlan } from './topazPlan'

describe('planning a Topaz enhancement', () => {
  it('works out the result size and an estimate of the credits', () => {
    const p = topazPlan(1024, 1536, 2)
    expect(p).toMatchObject({ ok: true, width: 2048, height: 3072, megapixels: 6.3, credits: 1 })
    const big = topazPlan(3000, 4000, 2)
    expect(big).toMatchObject({ ok: true, width: 6000, height: 8000, megapixels: 48, credits: 2 })
  })
  it('refuses a result that is too large, and says what to do', () => {
    expect(topazPlan(3000, 4000, 4)).toMatchObject({ ok: false })
    expect((topazPlan(9000, 200, 4) as { reason: string }).reason).toMatch(/pixel limit/)
    expect((topazPlan(4000, 4000, 4) as { reason: string }).reason).toMatch(/Choose 2x/)
  })
  it('refuses what it cannot size or that is too small, or an unknown scale', () => {
    expect(topazPlan(undefined, 100, 2)).toMatchObject({ ok: false })
    expect(topazPlan(8, 8, 2)).toMatchObject({ ok: false })
    expect(topazPlan(1000, 1000, 3)).toMatchObject({ ok: false })
  })
  it('says the cost is an estimate from Topaz\'s example rate, not a quote', () => {
    const text = costSentence(topazPlan(1024, 1536, 2) as Extract<ReturnType<typeof topazPlan>, { ok: true }>)
    expect(text).toMatch(/example rate of 24 megapixels per credit/)
    expect(text).toMatch(/reports the exact number/)
    expect(text).toMatch(/Topaz bills your account/)
  })
  it('offers only models that enlarge and sharpen, with a plain note for each', () => {
    expect(topazModels.map((m) => m.id)).toEqual(['Standard V2', 'High Fidelity V2', 'Low Resolution V2', 'CGI', 'Text Refine'])
    expect(topazModels.every((m) => m.note.length > 20)).toBe(true)
  })
})

describe('the enhanced picture in the queue', () => {
  it('is a new revision that waits for a decision, and the original is kept', async () => {
    const { addEnhanced, emptyQueue, enqueue } = await import('./generationQueue')
    const q = enqueue(emptyQueue(), [{ assetId: 'A1', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: (r) => `a_front_${r}` }], 1, false).state
    const done = { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'completed' as const, approved: true, outputPath: 'C:/a.png', width: 1024, height: 1536 })) }
    const out = addEnhanced(done, done.jobs[0], { path: 'C:/a_topaz.png', width: 2048, height: 3072 }, 5)
    expect(out.state.jobs).toHaveLength(2)
    expect(out.state.jobs[0]).toEqual(done.jobs[0])
    expect(out.job).toMatchObject({ revision: 2, status: 'needs-review', approved: false, rejected: false, source: 'enhanced', outputPath: 'C:/a_topaz.png', width: 2048, outputName: 'a_front_1_topaz' })
  })
})

describe('Topaz credits in the spending counter', () => {
  it('sums the credits of enhanced pictures and counts them, apart from image requests', async () => {
    const { addEnhanced, emptyQueue, enqueue, summarize, topazUse } = await import('./generationQueue')
    const q = enqueue(emptyQueue(), [{ assetId: 'A1', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: (r) => `a_front_${r}` }], 1, false).state
    const done = { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'completed' as const, outputPath: 'C:/a.png', width: 1024, height: 1536, attempts: 1 })) }
    expect(topazUse(done)).toEqual({ credits: 0, pictures: 0 })
    const one = addEnhanced(done, done.jobs[0], { path: 'C:/a_topaz.png', width: 2048, height: 3072, credits: 2 }, 5)
    const two = addEnhanced(one.state, one.job, { path: 'C:/a_topaz2.png', width: 4096, height: 6144, credits: 3 }, 6)
    const none = addEnhanced(two.state, two.job, { path: 'C:/a_topaz3.png', width: 4096, height: 6144, credits: null }, 7)
    expect(topazUse(none.state)).toEqual({ credits: 5, pictures: 3 })
    expect(summarize(none.state).requests).toBe(summarize(done).requests)
  })
})
