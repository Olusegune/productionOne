import { describe, expect, it } from 'vitest'
import type { ImageJob } from './generationQueue'
import {
  addSupplied, anchorFor, dropMissing, shouldAnchor, approve, attemptsSent, cancel, classifyError, committedUsd, emptyQueue, enqueue, markFailed, markGenerating, markValidated, markValidating,
  reassignModel, reconsider, recover, wouldEnqueue, reject, retry, spendGate, startable, summarize, type JobRequest, type QueueState,
} from './generationQueue'

const req = (viewKey: string, extra: Partial<JobRequest> = {}): JobRequest => ({
  assetId: 'CHAR-001', variant: 'Canonical', sheetType: 'Turnaround', viewKey, label: viewKey, prompt: 'p', aspect: '3:4', fullBody: true,
  provider: 'google', model: 'gemini-2.5-flash-image', references: [], outputName: (r) => `CHAR-001_${viewKey}_v${r}`, ...extra,
})
const funded = (state: QueueState): QueueState => ({ ...state, guard: true, perImageUsd: 0.05, totalCeilingUsd: 1 })
const seeded = (...keys: string[]) => funded(enqueue(emptyQueue(), keys.map((k) => req(k)), 1000).state)

describe('enqueue', () => {
  it('is idempotent for a live view', () => {
    const first = enqueue(emptyQueue(), [req('front')], 1)
    const again = enqueue(first.state, [req('front')], 2)
    expect(again.added).toBe(0)
    expect(again.skipped).toBe(1)
    expect(again.state.jobs).toHaveLength(1)
  })
  it('adds a new revision after a rejection and keeps the old file record', () => {
    let s = seeded('front')
    const id = s.jobs[0].id
    s = markGenerating(s, id)
    s = markValidating(s, id, { path: 'a.png', width: 1024, height: 1536 })
    s = markValidated(s, id, [])
    s = reject(s, id)
    const next = enqueue(s, [req('front')], 5000)
    expect(next.added).toBe(1)
    expect(next.state.jobs.map((j) => j.revision)).toEqual([1, 2])
    expect(next.state.jobs[0].outputPath).toBe('a.png')
  })
  it('does not regenerate an approved view', () => {
    let s = seeded('front')
    const id = s.jobs[0].id
    s = approve(markValidated(markValidating(markGenerating(s, id), id, { path: 'a.png', width: 1, height: 1 }), id, []), id)
    expect(s.jobs[0].approved).toBe(true)
    expect(enqueue(s, [req('front')]).added).toBe(0)
  })
})

describe('spending gate', () => {
  it('flows without any limit by default', () => {
    const s = enqueue(emptyQueue(), [req('a'), req('b'), req('c')]).state
    expect(spendGate(s).ok).toBe(true)
    expect(startable(s)).toHaveLength(2)
  })
  it('with the guard on, refuses to start without a price and ceiling', () => {
    const s = { ...enqueue(emptyQueue(), [req('front')]).state, guard: true }
    expect(spendGate(s).ok).toBe(false)
    expect(startable(s)).toEqual([])
  })
  it('stops at the ceiling and counts failed attempts as spent', () => {
    let s: QueueState = { ...seeded('a', 'b', 'c', 'd'), totalCeilingUsd: 0.1, concurrency: 10 }
    expect(startable(s)).toHaveLength(2)
    s = markGenerating(markGenerating(s, s.jobs[0].id), s.jobs[1].id)
    s = markFailed(s, s.jobs[0].id, 'x (400): bad') // billed attempt still counts
    expect(attemptsSent(s)).toBe(2)
    expect(committedUsd(s)).toBeCloseTo(0.1)
    expect(startable(s)).toEqual([])
    expect(spendGate(s).ok).toBe(false)
  })
  it('respects concurrency, pause and back-off', () => {
    let s = { ...seeded('a', 'b', 'c'), concurrency: 2 }
    expect(startable(s)).toHaveLength(2)
    expect(startable({ ...s, paused: true })).toEqual([])
    s = markGenerating(s, s.jobs[0].id)
    expect(startable(s)).toHaveLength(1)
    s = markFailed(s, s.jobs[0].id, 'OpenAI image request failed (429): slow down', 10_000)
    expect(s.jobs[0].status).toBe('queued')
    expect(startable({ ...s, jobs: [s.jobs[0]] }, 10_001)).toEqual([])
    expect(startable({ ...s, jobs: [s.jobs[0]] }, 10_000 + 31_000)).toHaveLength(1)
  })
})

describe('failures', () => {
  it('classifies retryable and permanent errors', () => {
    expect(classifyError('x (429): y').retryable).toBe(true)
    expect(classifyError('x (503): y').retryable).toBe(true)
    expect(classifyError('timed out (timeout)').retryable).toBe(true)
    expect(classifyError('x (401): y').retryable).toBe(false)
    expect(classifyError('No google key is saved.').retryable).toBe(false)
  })
  it('gives up after the maximum attempts', () => {
    let s = seeded('a')
    const id = s.jobs[0].id
    for (let i = 0; i < 3; i++) { s = markGenerating(s, id); s = markFailed(s, id, 'x (500): down', 0) }
    expect(s.jobs[0].status).toBe('failed')
    expect(s.jobs[0].attempts).toBe(3)
    s = retry(s, id)
    expect(s.jobs[0].status).toBe('queued')
    expect(s.jobs[0].attempts).toBe(3)
    s = markGenerating(s, id)
    expect(attemptsSent(s)).toBe(4)
  })
})

describe('control and recovery', () => {
  it('cancels waiting jobs only and reassigns unfinished ones', () => {
    let s = seeded('a', 'b')
    s = markGenerating(s, s.jobs[0].id)
    expect(cancel(s, s.jobs[0].id).jobs[0].status).toBe('generating')
    s = cancel(s, s.jobs[1].id)
    expect(s.jobs[1].status).toBe('cancelled')
    s = reassignModel(s, s.jobs.map((j) => j.id), 'openrouter', 'google/x')
    expect(s.jobs[0].provider).toBe('google')
    expect(s.jobs[1].provider).toBe('openrouter')
    expect(s.jobs[1].status).toBe('queued')
  })
  it('recovers an interrupted queue without losing files or the spend count, and pauses it', () => {
    let s = seeded('a', 'b')
    s = markGenerating(markGenerating(s, s.jobs[0].id), s.jobs[1].id)
    s = markValidating(s, s.jobs[1].id, { path: 'b.png', width: 1024, height: 1024 })
    const r = recover(s, 9)
    expect(r.paused).toBe(true)
    expect(r.jobs[0].status).toBe('failed')
    expect(r.jobs[0].submissionState).toBe('ambiguous')
    expect(r.jobs[0].attempts).toBe(1)
    expect(r.jobs[1].status).toBe('needs-review')
    expect(r.jobs[1].outputPath).toBe('b.png')
    expect(summarize(r).needsReview).toBe(1)
  })
})

describe('anchor view', () => {
  const withAnchor = () => {
    const base = funded(enqueue(emptyQueue(), [req('front'), req('side', { useAnchor: true })], 1).state)
    return { ...base, concurrency: 5 }
  }
  it('holds the other views until the front is approved, then they use it as the reference', () => {
    let s = withAnchor()
    expect(startable(s).map((j) => j.viewKey)).toEqual(['front'])
    const front = s.jobs[0].id
    s = approve(markValidated(markValidating(markGenerating(s, front), front, { path: 'front.png', width: 1024, height: 1536 }), front, []), front)
    expect(anchorFor(s, s.jobs[1])).toBe('front.png')
    expect(startable(s).map((j) => j.viewKey)).toEqual(['side'])
  })
  it('does not wait forever on a rejected or absent front', () => {
    let s = withAnchor()
    const front = s.jobs[0].id
    s = reject(markValidated(markValidating(markGenerating(s, front), front, { path: 'f.png', width: 1, height: 1 }), front, []), front)
    expect(startable(s).map((j) => j.viewKey)).toEqual(['side'])
    expect(anchorFor(s, s.jobs[1])).toBeUndefined()
  })
})

describe('images the person supplies', () => {
  const supplied = { assetId: 'CHAR-001', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', aspect: '3:4', fullBody: true, path: 'C:/mine.png', width: 2000, height: 3000 }
  it('arrives approved as a new revision, byte-for-byte path kept, and cancels waiting generation for that view', () => {
    const s = seeded('front')
    const { state, job } = addSupplied(s, supplied, 5000)
    expect(job).toMatchObject({ source: 'supplied', approved: true, status: 'completed', revision: 2, provider: 'you', outputPath: 'C:/mine.png' })
    expect(state.jobs[0].status).toBe('cancelled')
    expect(startable(state)).toEqual([])
  })
  it('becomes the anchor for the other views, and keeps the earlier approved file in history', () => {
    let s = funded(enqueue(emptyQueue(), [req('front'), req('side', { useAnchor: true })], 1).state)
    const front = s.jobs[0].id
    s = approve(markValidated(markValidating(markGenerating(s, front), front, { path: 'gen.png', width: 1, height: 1 }), front, []), front)
    expect(anchorFor(s, s.jobs[1])).toBe('gen.png')
    s = addSupplied(s, supplied, 9000).state
    expect(anchorFor(s, s.jobs[1])).toBe('C:/mine.png')
    expect(s.jobs.filter((j) => j.viewKey === 'front' && j.approved).map((j) => j.outputPath)).toEqual(['gen.png', 'C:/mine.png'])
  })
})

describe('legacy saved caps', () => {
  it('never turns the guard on from an old saved ceiling', () => {
    const old = { ...emptyQueue(), perImageUsd: 0.5, totalCeilingUsd: 2 } as Partial<QueueState> as QueueState
    delete (old as Partial<QueueState>).guard
    expect(recover(old).guard).toBe(false)
  })
})

describe('regenerate and cost preview', () => {
  const base = { id: 'j', key: 'k', assetId: 'a', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: '', aspect: '1:1', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false, outputName: 'o', revision: 1, attempts: 0, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, submissionState: 'not-submitted', createdAt: 0, updatedAt: 0 } as unknown as ImageJob
  it('adds new views, skips ones with an image or in the queue', async () => {
    const { wouldEnqueue } = await import('./generationQueue')
    expect(wouldEnqueue(undefined)).toBe(true)
    expect(wouldEnqueue({ ...base, status: 'queued' })).toBe(false)
    expect(wouldEnqueue({ ...base, status: 'needs-review' })).toBe(false)
    expect(wouldEnqueue({ ...base, status: 'completed' })).toBe(false)
    expect(wouldEnqueue({ ...base, status: 'completed', rejected: true })).toBe(true)
  })
  it('force makes a new version of a finished view but never of one still in the queue', async () => {
    const { wouldEnqueue } = await import('./generationQueue')
    expect(wouldEnqueue({ ...base, status: 'needs-review' }, true)).toBe(true)
    expect(wouldEnqueue({ ...base, status: 'completed' }, true)).toBe(true)
    expect(wouldEnqueue({ ...base, status: 'generating' }, true)).toBe(false)
  })
  it('states cost from the person\'s own price and never invents one', async () => {
    const { costPreview } = await import('./generationQueue')
    expect(costPreview(5, 0.04).label).toBe('5 images · about $0.20 at your $0.04 each')
    expect(costPreview(1, null).usd).toBeNull()
    expect(costPreview(3, null).label).toContain('cost unknown')
    expect(costPreview(0, 0.04).label).toBe('Nothing new to generate')
  })
})

describe('Kie "no model page" refusals and stale failures', () => {
  const message = 'Kie has no model page called google/nanobanana-2-1 (it may have been renamed). Press Refresh models.'
  it('treats a no-model-page refusal as retryable, with a pause', () => {
    const kind = classifyError(message)
    expect(kind.retryable).toBe(true)
    expect(kind.delayMs).toBeGreaterThan(0)
  })
  it('requeues it once, and fails it for good after the attempt limit', () => {
    let q = enqueue(emptyQueue(), [req('front')], 1).state
    const id = q.jobs[0].id
    q = markGenerating(q, id, 2)
    q = markFailed(q, id, message, 3)
    expect(q.jobs[0].status).toBe('queued')
    expect(q.jobs[0].notBefore).toBeGreaterThan(3)
    const exhausted = { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'generating' as const, attempts: j.maxAttempts })) }
    expect(markFailed(exhausted, id, message, 4).jobs[0].status).toBe('failed')
  })
  it('does not report a failed view as failed once a newer revision exists', () => {
    let q = enqueue(emptyQueue(), [req('front'), req('side')], 1).state
    q = { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'failed' as const, attempts: 1 })) }
    expect(summarize(q).failed).toBe(2)
    q = enqueue(q, [req('front')], 5).state
    expect(summarize(q).failed).toBe(1)
    expect(attemptsSent(q)).toBe(2)
  })
})

describe('which views are made from the approved image', () => {
  const approvedFront = (assetId: string, sheetType: string, viewKey: string, variant = 'Canonical'): QueueState => {
    const q = addSupplied(emptyQueue(), { assetId, variant, sheetType, viewKey, label: viewKey, aspect: '3:4', fullBody: true, path: 'C:/a/front.png', width: 800, height: 1200 }, 1)
    return q.state
  }
  const subject = (viewKey: string, sheetType = 'Turnaround', assetId = 'CHAR-001') => ({ assetId, variant: 'Canonical', sheetType, viewKey })
  it('always anchors a non-primary view', () => expect(shouldAnchor(emptyQueue(), subject('side'))).toBe(true))
  it('does not anchor the very first primary view, which makes the identity', () => expect(shouldAnchor(emptyQueue(), subject('front'))).toBe(false))
  it('anchors the Wardrobe costume front to the approved Turnaround front, so it cannot invent another person', () => {
    const q = approvedFront('CHAR-001', 'Turnaround', 'front')
    expect(shouldAnchor(q, subject('costume-front', 'Wardrobe'))).toBe(true)
  })
  it('does not anchor a view to itself when it is regenerated', () => {
    const q = approvedFront('CHAR-001', 'Turnaround', 'front')
    expect(shouldAnchor(q, subject('front', 'Turnaround'))).toBe(false)
  })
  it('never borrows the image of another character or another look', () => {
    const q = approvedFront('CHAR-002', 'Turnaround', 'front')
    expect(shouldAnchor(q, subject('costume-front', 'Wardrobe', 'CHAR-001'))).toBe(false)
    const other = approvedFront('CHAR-001', 'Turnaround', 'front', 'Dust-worn jacket')
    expect(shouldAnchor(other, subject('costume-front', 'Wardrobe'))).toBe(false)
  })
})

describe('pictures that are no longer on this computer', () => {
  const supplied = { assetId: 'CHAR-001', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', aspect: '3:4', fullBody: true, path: 'C:/gone/mine.png', width: 2000, height: 3000 }
  it('turns an approved take whose file is gone into a failed one that says why, and stops using it as the anchor', () => {
    let s = funded(enqueue(emptyQueue(), [req('side', { useAnchor: true })], 1).state)
    s = addSupplied(s, supplied, 5000).state
    const side = s.jobs.find((j) => j.viewKey === 'side')!
    expect(anchorFor(s, side)).toBe('C:/gone/mine.png')
    const out = dropMissing(s, ['C:/gone/mine.png'], 6000)
    expect(out.dropped).toBe(1)
    const front = out.state.jobs.find((j) => j.viewKey === 'front')!
    expect(front).toMatchObject({ status: 'failed', approved: false, outputPath: undefined })
    expect(front.error).toMatch(/no longer on this computer/)
    expect(anchorFor(out.state, side)).toBeUndefined()
  })
  it('lets Generate remake the view, because a failed take counts as needing a picture', () => {
    const s = addSupplied(funded(emptyQueue()), supplied, 5000).state
    const out = dropMissing(s, ['C:/gone/mine.png']).state
    const again = enqueue(out, [req('front')], 7000)
    expect(again.added).toBe(1)
  })
  it('leaves files that exist, and takes still in the queue, alone', () => {
    const s = addSupplied(funded(emptyQueue()), supplied, 5000).state
    const same = dropMissing(s, ['C:/other.png'])
    expect(same.dropped).toBe(0)
    expect(same.state).toBe(s)
    expect(dropMissing(s, []).dropped).toBe(0)
  })
})

describe('switching a view to another engine', () => {
  const failedFor = (extra: Partial<JobRequest>) => {
    const s = funded(enqueue(emptyQueue(), [req('side', extra)], 1).state)
    return { ...s, jobs: s.jobs.map((j) => ({ ...j, status: 'failed' as const })) }
  }
  it('keeps the reference when the engine takes references', () => {
    const failed = failedFor({ useAnchor: true, references: ['C:/ref.png'] })
    const out = reassignModel(failed, [failed.jobs[0].id], 'kie', 'seedream/5-pro-image-to-image', 5, true).jobs[0]
    expect(out).toMatchObject({ provider: 'kie', model: 'seedream/5-pro-image-to-image', status: 'queued', useAnchor: true, references: ['C:/ref.png'] })
  })
  it('drops the reference and the anchor when it does not, so the request is not refused', () => {
    const failed = failedFor({ useAnchor: true, references: ['C:/ref.png'] })
    const out = reassignModel(failed, [failed.jobs[0].id], 'openai', 'gpt-image-1.5', 5, false).jobs[0]
    expect(out).toMatchObject({ provider: 'openai', status: 'queued', useAnchor: false, references: [] })
  })
})

describe('changing your mind about a picture', () => {
  const done = (): { s: QueueState; id: string } => {
    let s = enqueue(emptyQueue(), [{ assetId: 'a', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: () => 'o' } as unknown as JobRequest], 1).state
    const id = s.jobs[0].id
    s = markValidated(markValidating(markGenerating(s, id), id, { path: 'a.png', width: 1, height: 1 }), id, [])
    return { s, id }
  }
  it('a rejected picture can be approved directly', () => {
    let { s, id } = done()
    s = reject(s, id)
    expect(s.jobs[0]).toMatchObject({ rejected: true, approved: false })
    s = approve(s, id)
    expect(s.jobs[0]).toMatchObject({ rejected: false, approved: true, status: 'completed' })
  })
  it('an approved picture can be rejected, which takes the approval back', () => {
    let { s, id } = done()
    s = approve(s, id)
    s = reject(s, id)
    expect(s.jobs[0]).toMatchObject({ rejected: true, approved: false })
  })
  it('reconsider puts an approved or rejected picture back to waiting, keeping the file, and leaves other pictures alone', () => {
    let { s, id } = done()
    s = reconsider(s, id) // waiting already: unchanged
    expect(s.jobs[0].status).toBe('needs-review')
    s = approve(s, id)
    s = reconsider(s, id)
    expect(s.jobs[0]).toMatchObject({ status: 'needs-review', approved: false, rejected: false, outputPath: 'a.png' })
    s = reject(s, id)
    s = reconsider(s, id)
    expect(s.jobs[0]).toMatchObject({ status: 'needs-review', approved: false, rejected: false })
  })
  it('a picture whose file is gone cannot be approved', () => {
    let { s, id } = done()
    s = { ...s, jobs: s.jobs.map((j) => ({ ...j, outputPath: undefined })) }
    s = approve(s, id)
    expect(s.jobs[0].approved).toBe(false)
  })
  it('a view whose approval was taken back is generated again like any other undecided view only after rejection, never silently', () => {
    let { s, id } = done()
    s = approve(s, id)
    s = reconsider(s, id)
    expect(wouldEnqueue(s.jobs[0])).toBe(false)
  })
})
