import { describe, expect, it } from 'vitest'
import {
  anchorFor, approve, attemptsSent, cancel, classifyError, committedUsd, emptyQueue, enqueue, markFailed, markGenerating, markValidated, markValidating,
  reassignModel, recover, reject, retry, spendGate, startable, summarize, type JobRequest, type QueueState,
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
    expect(s.jobs[0].attempts).toBe(0)
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
    expect(r.jobs[0].status).toBe('queued')
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
