import { describe, expect, it } from 'vitest'
import { emptyQueue, type ImageJob, type QueueState } from './generationQueue'
import type { AnalysisResult } from './productionStudio'
import { approvedReference, awaitingReview, deliveryChecklist, packageKind, turnedDown } from './review'

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
