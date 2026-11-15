import { describe, expect, it } from 'vitest'
import { emptyQueue, type ImageJob, type QueueState } from './generationQueue'
import { causeOf, groupFailures } from './failureGroups'

const job = (over: Partial<ImageJob>): ImageJob => ({
  id: 'j', key: 'k', assetId: 'A1', variant: 'base', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: '', aspect: '3:4', fullBody: true, provider: 'kie', model: 'google/nanobanana-2-1', references: [], useAnchor: false,
  outputName: 'o', revision: 1, status: 'failed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 1, updatedAt: 1, error: 'x', ...over,
})
const queue = (jobs: ImageJob[]): QueueState => ({ ...emptyQueue(), jobs })

describe('causeOf', () => {
  it.each([
    ['Kie has not published a readable request schema for this model', 'model-unavailable'],
    ['Kie has no model page called google/x (it may have been renamed). Press Refresh models.', 'model-unavailable'],
    ['Kie.ai request failed (402): Insufficient credits', 'credits'],
    ['OpenAI image request failed (401): Incorrect API key', 'key'],
    ['No kie key is saved. Add it in Tools, Provider Settings.', 'key'],
    ['Google Gemini image request failed (429): quota', 'rate-limit'],
    ['Kie.ai timed out (timeout)', 'network'],
    ['Google Gemini could not be reached: connection refused', 'network'],
    ['Rejected by the safety filter', 'content'],
    ['OpenAI image request failed (503): overloaded', 'server'],
    ['Something strange happened', 'other'],
  ])('%s -> %s', (message, cause) => { expect(causeOf(message)).toBe(cause) })
  it('puts a credits message before a rate limit one, because credits are the real cause', () => {
    expect(causeOf('Kie.ai request failed (429): insufficient credits')).toBe('credits')
  })
})

describe('groupFailures', () => {
  const schema = 'Kie has not published a readable request schema for this model'
  it('collapses repeated failures with one cause into one group, biggest first', () => {
    const q = queue([
      job({ id: 'a', key: 'a', error: schema }), job({ id: 'b', key: 'b', error: schema }), job({ id: 'c', key: 'c', error: schema }),
      job({ id: 'd', key: 'd', error: 'Kie.ai timed out (timeout)' }),
    ])
    const groups = groupFailures(q)
    expect(groups.map((g) => [g.cause, g.jobs.length])).toEqual([['model-unavailable', 3], ['network', 1]])
    expect(groups[0].fixes).toContain('refresh-models')
    expect(groups[0].models).toEqual(['google/nanobanana-2-1'])
  })
  it('keeps every job and its own message available for the details', () => {
    const g = groupFailures(queue([job({ id: 'a', key: 'a', error: schema }), job({ id: 'b', key: 'b', error: schema + ' (second view)' })]))[0]
    expect(g.jobs.map((j) => j.id)).toEqual(['a', 'b'])
    expect(g.jobs[1].error).toMatch(/second view/)
  })
  it('does not count a failure that a newer attempt replaced, or jobs that did not fail', () => {
    const q = queue([job({ id: 'old', key: 'k', revision: 1, error: schema }), job({ id: 'new', key: 'k', revision: 2, status: 'queued', error: undefined }), job({ id: 'ok', key: 'z', status: 'completed', error: undefined })])
    expect(groupFailures(q)).toEqual([])
  })
  it('is empty when nothing failed', () => { expect(groupFailures(queue([]))).toEqual([]) })
})
