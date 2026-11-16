import { describe, expect, it } from 'vitest'
import { emptyQueue, MISSING_FILE_ERROR, type ImageJob, type QueueState } from './generationQueue'
import type { AnalysisResult } from './productionStudio'
import { approvedReference, awaitingReview, defaultCompareTarget, deliveryChecklist, keepRevision, otherRevisions, packageKind, revisionsOfView, turnedDown } from './review'

const job = (over: Partial<ImageJob>): ImageJob => ({
  id: 'j', key: 'k', assetId: 'A1', variant: 'base', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: '', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false,
  outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 1, updatedAt: 1, ...over,
})
const queue = (jobs: ImageJob[]): QueueState => ({ ...emptyQueue(), jobs })
const analysis = { scenes: [], assets: [{ id: 'A1', name: 'MARA', type: 'character', sceneIds: [], status: 'planned' }, { id: 'A2', name: 'ARENA', type: 'set', sceneIds: [], status: 'planned' }] } as unknown as AnalysisResult

describe('review queue', () => {
  it('lists pictures waiting for a decision, newest first, and only those with a file', () => {
    const q = queue([job({ id: 'a', status: 'needs-review', outputPath: 'a.png', updatedAt: 1 }), job({ id: 'b', status: 'needs-review', outputPath: 'b.png', updatedAt: 5 }), job({ id: 'c', status: 'needs-review' }), job({ id: 'd', status: 'completed', approved: true, outputPath: 'd.png' })])
    expect(awaitingReview(q).map((j) => j.id)).toEqual(['b', 'a'])
  })
  it('keeps rejected pictures findable', () => {
    expect(turnedDown(queue([job({ id: 'r', rejected: true, outputPath: 'r.png' }), job({ id: 'x' })])).map((j) => j.id)).toEqual(['r'])
  })
  it('compares a new picture with the newest approved front view of the same asset and look', () => {
    const fresh = job({ id: 'new', viewKey: 'profile', status: 'needs-review', outputPath: 'new.png' })
    const q = queue([fresh, job({ id: 'old', approved: true, revision: 1, outputPath: 'old.png' }), job({ id: 'newer', approved: true, revision: 2, outputPath: 'newer.png' }), job({ id: 'other', assetId: 'A2', approved: true, outputPath: 'o.png' }), job({ id: 'look', variant: 'armour', approved: true, outputPath: 'l.png' })])
    expect(approvedReference(q, fresh)?.id).toBe('newer')
  })
  it('returns null when nothing is approved yet', () => {
    const fresh = job({ id: 'new', status: 'needs-review', outputPath: 'n.png' })
    expect(approvedReference(queue([fresh]), fresh)).toBeNull()
  })
})

describe('delivery checklist', () => {
  const base = { analysis, queue: queue([]), missingAssets: [] as string[], incompleteShots: [] as string[], styleLocked: true }
  it('is verified only when nothing is open', () => {
    expect(packageKind(deliveryChecklist(base))).toBe('verified')
    expect(packageKind(deliveryChecklist({ ...base, styleLocked: false }))).toBe('draft')
  })
  it('says where each open item is fixed', () => {
    const items = deliveryChecklist({ ...base, styleLocked: false, missingAssets: ['A1', 'A2'], queue: queue([job({ status: 'needs-review', outputPath: 'x.png' })]) })
    const by = Object.fromEntries(items.map((i) => [i.id, i]))
    expect(by.style.fix?.kind).toBe('style')
    expect(by.sheets.fix).toMatchObject({ kind: 'asset', assetId: 'A1' })
    expect(by.sheets.detail).toMatch(/MARA, ARENA/)
    expect(by.review.fix?.kind).toBe('review')
  })
  it('counts a failed job once, and not at all after a newer revision of it exists', () => {
    const failed = job({ id: 'f', key: 'k', status: 'failed', revision: 1 })
    expect(deliveryChecklist({ ...base, queue: queue([failed]) }).some((i) => i.id === 'failed')).toBe(true)
    expect(deliveryChecklist({ ...base, queue: queue([failed, job({ id: 'g', key: 'k', revision: 2, status: 'queued' })]) }).some((i) => i.id === 'failed')).toBe(false)
  })
  it('asks for a script when there are no assets', () => {
    const items = deliveryChecklist({ ...base, analysis: { scenes: [], assets: [] } as unknown as AnalysisResult })
    expect(items[0]).toMatchObject({ id: 'script', state: 'todo', fix: { kind: 'script' } })
  })
})

describe('revision compare', () => {
  const view = { assetId: 'A1', variant: 'base', sheetType: 'Turnaround', viewKey: 'front' }
  const q = () => queue([
    job({ id: 'v1', ...view, revision: 1, approved: true, outputPath: 'v1.png' }),
    job({ id: 'v2', ...view, revision: 2, status: 'needs-review', outputPath: 'v2.png' }),
    job({ id: 'v3', ...view, revision: 3, rejected: true, outputPath: 'v3.png' }),
    job({ id: 'bad', ...view, revision: 4, status: 'failed' }),
    job({ id: 'side', ...view, viewKey: 'profile', revision: 1, outputPath: 's.png' }),
    job({ id: 'other', assetId: 'A2', ...{ variant: 'base', sheetType: 'Turnaround', viewKey: 'front' }, revision: 1, outputPath: 'o.png' }),
  ])
  it('lists the other takes of the same view only, newest first, ignoring failed jobs and other views or assets', () => {
    const state = q()
    expect(otherRevisions(state, state.jobs[1]).map((j) => j.id)).toEqual(['v3', 'v1'])
    expect(revisionsOfView(state, state.jobs[0]).map((j) => j.id)).toEqual(['v3', 'v2', 'v1'])
  })
  it('compares against the approved take by default, else the newest other take, else nothing', () => {
    const state = q()
    expect(defaultCompareTarget(state, state.jobs[1])?.id).toBe('v1')
    expect(defaultCompareTarget(queue([job({ id: 'a', revision: 1, status: 'needs-review', outputPath: 'a.png' }), job({ id: 'b', revision: 2, status: 'needs-review', outputPath: 'b.png' })]), job({ id: 'b', revision: 2, outputPath: 'b.png' }))?.id).toBe('a')
    expect(defaultCompareTarget(queue([job({ id: 'solo', outputPath: 's.png' })]), job({ id: 'solo', outputPath: 's.png' }))).toBeNull()
  })
  it('keeping the new take approves it and turns the approved and waiting takes down, deleting nothing', () => {
    const next = keepRevision(q(), 'v2', 50)
    const by = (id: string) => next.jobs.find((j) => j.id === id)!
    expect(by('v2')).toMatchObject({ approved: true, rejected: false, status: 'completed' })
    expect(by('v1')).toMatchObject({ approved: false, rejected: true, outputPath: 'v1.png' })
    expect(next.jobs).toHaveLength(6)
    expect(by('side').approved).toBe(false)
    expect(by('other')).toEqual(q().jobs[5])
  })
  it('keeping the older approved take rejects a waiting newer one, and an earlier turned-down take can be brought back', () => {
    const back = keepRevision(q(), 'v3', 60)
    expect(back.jobs.find((j) => j.id === 'v3')).toMatchObject({ approved: true, rejected: false })
    expect(back.jobs.find((j) => j.id === 'v1')).toMatchObject({ approved: false, rejected: true })
    expect(back.jobs.find((j) => j.id === 'v2')).toMatchObject({ approved: false, rejected: true })
  })
  it('does nothing for a take that has no file or is not finished', () => {
    const state = q()
    expect(keepRevision(state, 'bad')).toBe(state)
    expect(keepRevision(state, 'missing')).toBe(state)
  })
})

describe('checklist advice for takes whose picture is gone', () => {
  const base = { analysis, queue: queue([]), missingAssets: [] as string[], incompleteShots: [] as string[], styleLocked: true }
  it('does not tell a person to retry or change model, and keeps real failures separate', () => {
    const gone = job({ id: 'g', key: 'k1', status: 'failed', error: MISSING_FILE_ERROR })
    const real = job({ id: 'r', key: 'k2', status: 'failed', error: 'Kie.ai request failed (402): Insufficient credits' })
    const only = deliveryChecklist({ ...base, queue: queue([gone]) })
    expect(only.find((i) => i.id === 'failed')).toBeUndefined()
    expect(only.find((i) => i.id === 'gone')).toMatchObject({ state: 'todo', label: '1 picture is not on this computer' })
    expect(only.find((i) => i.id === 'gone')?.detail).not.toMatch(/retry|different model/i)
    const both = deliveryChecklist({ ...base, queue: queue([gone, real]) })
    expect(both.find((i) => i.id === 'failed')?.label).toBe('1 failed job')
    expect(both.find((i) => i.id === 'gone')).toBeDefined()
  })
  it('stops counting once a newer take of the view exists', () => {
    const gone = job({ id: 'g', key: 'k1', status: 'failed', error: MISSING_FILE_ERROR })
    const items = deliveryChecklist({ ...base, queue: queue([gone, job({ id: 'n', key: 'k1', revision: 2, status: 'queued' })]) })
    expect(items.some((i) => i.id === 'gone')).toBe(false)
  })
})
