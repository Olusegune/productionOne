import { describe, expect, it } from 'vitest'
import { approve, emptyQueue, enqueue, reconsider, reject, type QueueState } from './generationQueue'
import { detectDecision, undoDecision } from './decisionUndo'

const req = (viewKey: string) => ({ assetId: 'MARCUS', variant: 'Canonical', sheetType: 'Turnaround', viewKey, label: viewKey, prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: (r: number) => `m_${viewKey}_${r}` })

function waiting(): QueueState {
  const q = enqueue(emptyQueue(), [req('front'), req('side')], 1, false).state
  return { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'needs-review' as const, outputPath: `C:/out/${j.outputName}.png` })) }
}
const ctx = { outputs: { MARCUS: 'C:/out/old.png' } as Record<string, string>, assetStatus: () => 'planned' as string | undefined }

describe('undo for a decision', () => {
  it('notices one approval, and undo puts the picture back to waiting', () => {
    const before = waiting()
    const after = approve(before, before.jobs[0].id)
    const snap = detectDecision(before, after, ctx)!
    expect(snap).toMatchObject({ kind: 'approved', assetId: 'MARCUS', prevOutput: 'C:/out/old.png', prevAssetStatus: 'planned' })
    const back = undoDecision(after, snap)
    expect(back.jobs[0]).toMatchObject({ approved: false, rejected: false, status: 'needs-review' })
    expect(back.jobs[1]).toEqual(after.jobs[1])
  })
  it('notices a rejection and a taken-back decision', () => {
    const before = waiting()
    const rej = reject(before, before.jobs[0].id)
    expect(detectDecision(before, rej, ctx)?.kind).toBe('rejected')
    expect(undoDecision(rej, detectDecision(before, rej, ctx)!).jobs[0].rejected).toBe(false)
    const reset = reconsider(rej, rej.jobs[0].id)
    const snap = detectDecision(rej, reset, ctx)!
    expect(snap.kind).toBe('reset')
    expect(undoDecision(reset, snap).jobs[0].rejected).toBe(true)
  })
  it('does not treat the same state, several changes at once, or a picture still being made as a decision', () => {
    const before = waiting()
    expect(detectDecision(before, before, ctx)).toBeNull()
    expect(detectDecision(before, approve(approve(before, before.jobs[0].id), before.jobs[1].id), ctx)).toBeNull()
    const making: QueueState = { ...before, jobs: before.jobs.map((j, i) => (i === 0 ? { ...j, status: 'generating' as const } : j)) }
    const done: QueueState = { ...making, jobs: making.jobs.map((j, i) => (i === 0 ? { ...j, status: 'completed' as const, approved: true } : j)) }
    expect(detectDecision(making, done, ctx)).toBeNull()
  })
  it('does nothing if the picture has moved on since the decision', () => {
    const before = waiting()
    const after = approve(before, before.jobs[0].id)
    const snap = detectDecision(before, after, ctx)!
    const regenerated: QueueState = { ...after, jobs: after.jobs.map((j, i) => (i === 0 ? { ...j, revision: j.revision + 1 } : j)) }
    expect(undoDecision(regenerated, snap)).toBe(regenerated)
    const decidedAgain = reject(after, after.jobs[0].id)
    expect(undoDecision(decidedAgain, snap).jobs[0].rejected).toBe(false)
  })
  it('does not change a file path: only the decision comes back', () => {
    const before = waiting()
    const after = approve(before, before.jobs[0].id)
    const back = undoDecision(after, detectDecision(before, after, ctx)!)
    expect(back.jobs[0].outputPath).toBe(before.jobs[0].outputPath)
  })
})
