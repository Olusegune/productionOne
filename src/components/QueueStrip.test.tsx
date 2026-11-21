import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueueDock } from './shell'
import { stripItems } from '../domain/queueStrip'
import { emptyQueue, enqueue, type JobRequest, type QueueState } from '../domain/generationQueue'

const request = (viewKey: string, assetId = 'CHAR-1'): JobRequest => ({
  assetId, variant: 'Canonical', sheetType: 'Turnaround', viewKey, label: viewKey, prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: (r) => `${assetId}_${viewKey}_${r}`,
})
const build = (statuses: Array<[string, ImageStatus]>): QueueState => {
  const q = enqueue(emptyQueue(), statuses.map(([k]) => request(k)), 1, false).state
  return { ...q, jobs: q.jobs.map((j, i) => ({ ...j, status: statuses[i][1], outputPath: statuses[i][1] === 'needs-review' ? `C:/out/${j.viewKey}.png` : undefined })) }
}
type ImageStatus = QueueState['jobs'][number]['status']

describe('what the queue strip shows', () => {
  it('puts work in progress first, then waiting, failed and the pictures that need you', () => {
    const q = build([['a', 'needs-review'], ['b', 'queued'], ['c', 'generating'], ['d', 'failed'], ['e', 'validating']])
    expect(stripItems(q).shown.map((i) => `${i.job.viewKey}:${i.kind}`)).toEqual(['c:running', 'e:running', 'b:queued', 'd:failed', 'a:review'])
  })
  it('shows at most five and counts the rest', () => {
    const q = build(Array.from({ length: 8 }, (_, i) => [`v${i}`, 'queued'] as [string, ImageStatus]))
    const r = stripItems(q)
    expect(r.shown).toHaveLength(5)
    expect(r.more).toBe(3)
  })
  it('does not show finished or cancelled work, and an empty queue shows nothing', () => {
    expect(stripItems(emptyQueue())).toEqual({ shown: [], more: 0 })
    expect(stripItems(build([['a', 'completed'], ['b', 'cancelled']])).shown).toEqual([])
  })
})

describe('the queue strip on screen', () => {
  it('names each item by the asset, says what it is doing, and opens Review for a picture that needs you', () => {
    const onReview = vi.fn()
    const q = build([['front', 'generating'], ['side', 'queued'], ['back', 'needs-review']])
    render(<QueueDock queue={q} setQueue={() => {}} onOpen={() => {}} onReview={onReview} nameOf={() => 'AMINA'} />)
    const strip = screen.getByRole('list', { name: 'Queue' })
    expect(within(strip).getByText('Running')).toBeTruthy()
    expect(within(strip).getByText('Queued')).toBeTruthy()
    expect(within(strip).getAllByText(/AMINA · /).length).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: /AMINA · back is waiting for your decision/ }))
    expect(onReview).toHaveBeenCalledTimes(1)
  })
  it('counts what does not fit and opens the full list', () => {
    const q = build(Array.from({ length: 7 }, (_, i) => [`v${i}`, 'queued'] as [string, ImageStatus]))
    render(<QueueDock queue={q} setQueue={() => {}} onOpen={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /2 more in the queue/ }))
    expect(screen.getAllByText('queued').length).toBeGreaterThan(5)
  })
  it('shows no strip when the queue is empty', () => {
    render(<QueueDock queue={emptyQueue()} setQueue={() => {}} onOpen={() => {}} />)
    expect(screen.queryByRole('list', { name: 'Queue' })).toBeNull()
    expect(screen.getByText('Queue is empty')).toBeTruthy()
  })
})

describe('the strip does not repeat itself', () => {
  it('shows only the newest failed take of a view, and not pictures whose file is missing', async () => {
    const { MISSING_FILE_ERROR } = await import('../domain/generationQueue')
    const q = enqueue(emptyQueue(), [request('front')], 1, false).state
    const base = q.jobs[0]
    const failed = (rev: number, error?: string) => ({ ...base, id: `j${rev}`, key: `${base.key}-r${rev}`, revision: rev, status: 'failed' as const, error })
    const queue = { ...q, jobs: [failed(1, 'The provider said no'), failed(2, 'The provider said no'), failed(3, MISSING_FILE_ERROR)] }
    expect(stripItems(queue).shown).toEqual([])
    expect(stripItems({ ...q, jobs: queue.jobs.slice(0, 2) }).shown.map((i) => i.job.revision)).toEqual([2])
  })
})
