import { describe, expect, it } from 'vitest'
import {
  approve, attemptsSent, cancel, cancelAllWaiting, emptyQueue, enqueue, markFailed, markGenerating, markValidated, markValidating, recover, reject, retry, startable, summarize, unresolvedFailures,
  type ImageJobStatus, type JobRequest, type QueueState,
} from './generationQueue'
import { buildProjectFile, parseProjectFile } from '../data/projectFile'
import { filterOptions } from './searchSelect'
import { backdropChoices, buildViewPrompt, outputName, sheetTypesFor, shapeChoices, viewsFor } from './sheetSpecs'
import { defaultStyleBible } from './visualDevelopment'
import type { ExtractedAsset } from './productionStudio'

const request = (assetId: string, viewKey: string, extra: Partial<JobRequest> = {}): JobRequest => ({
  assetId, variant: 'Canonical', sheetType: 'Turnaround', viewKey, label: viewKey, prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'nano-banana',
  references: [], outputName: (r) => `${assetId}_${viewKey}_v${r}`, ...extra,
})

/** A small seeded generator, so a failing fuzz run can be replayed exactly. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}

const validStatuses: ImageJobStatus[] = ['pending', 'queued', 'generating', 'validating', 'completed', 'needs-review', 'failed', 'cancelled']

describe('the queue at scale', () => {
  const ASSETS = 300
  const VIEWS = ['front', 'three-quarter-front', 'side', 'three-quarter-rear', 'rear', 'a-pose', 'walking', 'running', 'sitting', 'gesture']
  const big = () => {
    const requests = Array.from({ length: ASSETS }, (_, a) => VIEWS.map((v) => request(`CHAR-${a}`, v))).flat()
    return enqueue(emptyQueue(), requests, 1000)
  }

  it('queues 3,000 views once each, quickly, and ignores an identical second press', () => {
    const t0 = performance.now()
    const first = big()
    expect(first.added).toBe(ASSETS * VIEWS.length)
    const again = enqueue(first.state, first.state.jobs.map((j) => request(j.assetId, j.viewKey)), 2000)
    expect(again.added).toBe(0)
    expect(again.skipped).toBe(first.added)
    expect(performance.now() - t0).toBeLessThan(8000)
  })

  it('answers "what may start" and the summary for 3,000 jobs without slowing down', () => {
    const { state } = big()
    const t0 = performance.now()
    for (let i = 0; i < 200; i++) { startable(state, 5000); summarize(state) }
    expect(performance.now() - t0).toBeLessThan(5000)
    expect(startable(state, 5000)).toHaveLength(2) // concurrency of two
    expect(summarize(state).total).toBe(ASSETS * VIEWS.length)
  })

  it('recovers a crash in the middle of a big run: running jobs become ambiguous, nothing is lost or restarted silently', () => {
    let { state } = big()
    const running = state.jobs.slice(0, 50).map((j) => j.id)
    for (const id of running) state = markGenerating(state, id, 3000)
    const after = recover(state, 4000)
    expect(after.jobs).toHaveLength(state.jobs.length)
    expect(after.jobs.filter((j) => j.status === 'generating')).toHaveLength(0)
    for (const id of running) {
      const job = after.jobs.find((j) => j.id === id)!
      expect(job.status).toBe('failed')
      expect(job.submissionState).toBe('ambiguous')
      expect(job.attempts).toBe(1)
    }
    expect(attemptsSent(after)).toBe(50)
  })

  it('saves and reopens a project holding 3,000 jobs intact', () => {
    const { state } = big()
    const studio = { script: 'x', analysis: { scenes: [], assets: [] }, shots: [], jobs: [], storyboardsEnabled: false, model: 'Seedance 2.0', assetOutputs: {}, styleBible: defaultStyleBible, title: 't', queue: state, clips: [], assetRefs: {}, sheetNotes: {}, sheetSettings: {} }
    const t0 = performance.now()
    const text = JSON.stringify(buildProjectFile('Big', { schemaVersion: 1, nodes: [], edges: [] }, studio as never))
    const parsed = parseProjectFile(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect((parsed.file.studio as unknown as { queue: QueueState }).queue.jobs).toHaveLength(ASSETS * VIEWS.length)
    expect(performance.now() - t0).toBeLessThan(5000)
    expect(text.length).toBeLessThan(40 * 1024 * 1024)
  })

  it('filters a 5,000-voice list as you type', () => {
    const options = Array.from({ length: 5000 }, (_, i) => ({ value: `v${i}`, label: `Voice ${i} · ${i % 2 ? 'female' : 'male'} · ${['en', 'yo', 'ig', 'ha'][i % 4]}` }))
    const t0 = performance.now()
    for (const q of ['v', 'voice 4', 'female yo', 'zzz', '']) filterOptions(options, q)
    expect(performance.now() - t0).toBeLessThan(1000)
    expect(filterOptions(options, 'voice 4999')).toHaveLength(1)
  })
})

describe('the queue under random pressure (fuzz, seeded so a failure can be replayed)', () => {
  const seen = new Set<string>()
  const run = (seed: number) => {
    const rand = rng(seed)
    let state: QueueState = emptyQueue()
    const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)]
    const views = ['front', 'side', 'rear', 'costume-front', 'fabric']
    let clock = 1000
    let previousAttempts = 0
    for (let step = 0; step < 400; step++) {
      clock += 1 + Math.floor(rand() * 50)
      const ids = state.jobs.map((j) => j.id)
      const id = ids.length ? pick(ids) : ''
      switch (Math.floor(rand() * 11)) {
        case 0: case 1: state = enqueue(state, [request(pick(['A', 'B', 'C']), pick(views))], clock, rand() < 0.3).state; break
        case 2: for (const j of startable(state, clock)) state = markGenerating(state, j.id, clock); break
        case 3: if (id) state = markValidating(state, id, { path: 'C:/a/x.png', width: 800, height: 1000 }, clock); break
        case 4: if (id) state = markValidated(state, id, rand() < 0.5 ? [] : ['note'], clock); break
        case 5: if (id) state = markFailed(state, id, pick(['Kie has no model page called x', 'timed out', 'request failed (401)', 'boom (429)', 'whatever']), clock); break
        case 6: if (id) state = approve(state, id, clock); break
        case 7: if (id) state = reject(state, id, clock); break
        case 8: if (id) state = cancel(state, id, clock); break
        case 9: if (id) state = retry(state, id, clock); break
        default: state = rand() < 0.15 ? recover(state, clock) : cancelAllWaiting(state, clock)
      }
      // Invariants that must hold after every single operation.
      const attempts = attemptsSent(state)
      expect(attempts, `attempts never go down (seed ${seed}, step ${step})`).toBeGreaterThanOrEqual(previousAttempts)
      previousAttempts = attempts
      for (const j of state.jobs) {
        seen.add(j.status)
        expect(validStatuses, `valid status ${j.status}`).toContain(j.status)
        expect(j.attempts).toBeGreaterThanOrEqual(0)
        expect(j.attempts).toBeLessThanOrEqual(j.maxAttempts)
        if (j.approved) expect(j.status, 'approved only when completed').toBe('completed')
      }
      const keys = new Set(state.jobs.map((j) => j.key))
      expect(keys.size, `one job per view and revision (seed ${seed}, step ${step})`).toBe(state.jobs.length)
      const s = summarize(state)
      const counted = s.pending + s.queued + s.generating + s.validating + s.completed + s.needsReview + s.cancelled + state.jobs.filter((j) => j.status === 'failed').length
      expect(counted, 'every job is counted exactly once').toBe(state.jobs.length)
      expect(s.failed).toBe(unresolvedFailures(state).length)
      expect(s.failed).toBeLessThanOrEqual(state.jobs.filter((j) => j.status === 'failed').length)
    }
    return state
  }
  for (const seed of [1, 2, 3, 7, 11, 42, 99, 123, 2026, 31337]) {
    it(`seed ${seed}: 400 random operations keep every invariant`, () => { expect(run(seed).jobs.length).toBeGreaterThan(0) })
  }
  it('really reached every kind of job state, so the invariants are not vacuous', () => {
    for (const status of ['queued', 'generating', 'validating', 'needs-review', 'completed', 'failed', 'cancelled'] as const) expect([...seen], status).toContain(status)
  })
})

describe('every sheet of every asset type is well formed', () => {
  const types: ExtractedAsset['type'][] = ['character', 'costume', 'prop', 'set', 'environment']
  const allowedShapes = new Set<string>(shapeChoices.map((s) => s.value))
  const asset = (type: ExtractedAsset['type']): ExtractedAsset => ({ id: `${type.toUpperCase()}-001`, name: 'Test thing', type, sceneIds: ['S1'], status: 'planned', age: '30', gender: 'female', never: 'never a smile showing teeth', personality: 'cool' })

  for (const type of types) {
    it(`${type}: every view has a unique key, a label, a shape every provider accepts, and a clean prompt`, () => {
      const sheets = sheetTypesFor(type)
      expect(sheets.length).toBeGreaterThan(0)
      for (const sheet of sheets) {
        const views = viewsFor(type, sheet)
        expect(views.length, `${type}/${sheet} has views`).toBeGreaterThan(0)
        expect(new Set(views.map((v) => v.key)).size, `${type}/${sheet} keys unique`).toBe(views.length)
        for (const view of views) {
          expect(view.label.trim().length).toBeGreaterThan(0)
          expect(allowedShapes.has(view.aspect), `${type}/${sheet}/${view.key} shape ${view.aspect}`).toBe(true)
          for (const backdrop of backdropChoices.map((b) => b.value)) for (const anchored of [false, true]) {
            const prompt = buildViewPrompt({ style: defaultStyleBible, asset: asset(type), variant: 'Canonical', sheetType: sheet, view, backdrop, anchored })
            expect(prompt).not.toMatch(/undefined|NaN|\[object/)
            expect(prompt.length).toBeGreaterThan(200)
            expect(prompt.length).toBeLessThan(6000)
          }
          expect(outputName(asset(type), 'Canonical', sheet, view, 1)).toMatch(/^[A-Za-z0-9_.-]+$/)
        }
      }
    })
  }
})
