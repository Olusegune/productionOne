import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueueDock } from './shell'
import { addSupplied, emptyQueue, enqueue, type JobRequest, type QueueState } from '../domain/generationQueue'

const request = (viewKey: string, useAnchor: boolean): JobRequest => ({
  assetId: 'PROP-1', variant: 'Canonical', sheetType: 'Multi-view', viewKey, label: viewKey, prompt: 'p', aspect: '4:3', fullBody: false, provider: 'kie', model: 'm', references: [], useAnchor, outputName: (r) => `x_${viewKey}_${r}`,
})

describe('the queue bar explains a queue that is waiting for you', () => {
  it('says how many views wait for an approved front view, and offers the sheets', () => {
    const queued = enqueue(emptyQueue(), [request('front', false), request('side', true), request('back', true)], 1).state
    // the front is made and waits for review: it is not approved, so the others cannot start
    const waiting: QueueState = { ...queued, jobs: queued.jobs.map((j) => (j.viewKey === 'front' ? { ...j, status: 'needs-review' as const, outputPath: 'C:/a/front.png' } : j)) }
    const onOpen = vi.fn()
    render(<QueueDock queue={waiting} setQueue={() => {}} onOpen={onOpen} />)
    expect(screen.getByRole('status').textContent).toMatch(/2 waiting for you to approve a front view/)
    fireEvent.click(screen.getByRole('button', { name: 'Open sheets' }))
    expect(onOpen).toHaveBeenCalled()
  })
  it('stays quiet once the front view is approved, and when nothing waits', () => {
    const queued = enqueue(emptyQueue(), [request('side', true)], 1).state
    const approved = addSupplied(queued, { assetId: 'PROP-1', variant: 'Canonical', sheetType: 'Multi-view', viewKey: 'front', label: 'front', aspect: '4:3', fullBody: false, path: 'C:/a/front.png', width: 800, height: 600 }, 2).state
    render(<QueueDock queue={approved} setQueue={() => {}} onOpen={() => {}} />)
    expect(screen.queryByText(/waiting for you to approve/)).toBeNull()
  })
})
