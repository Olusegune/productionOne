import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReviewView } from './ReviewView'
import { emptyQueue, type ImageJob, type QueueState } from '../domain/generationQueue'
import type { AnalysisResult } from '../domain/productionStudio'

const job = (over: Partial<ImageJob>): ImageJob => ({
  id: 'j', key: 'k', assetId: 'A1', variant: 'base', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'a prompt', aspect: '3:4', fullBody: true, provider: 'kie', model: 'nano', references: [], useAnchor: false,
  outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 1, updatedAt: 1, ...over,
})
const analysis = { scenes: [], assets: [{ id: 'A1', name: 'MARA', type: 'character', sceneIds: [], status: 'planned' }] } as unknown as AnalysisResult
const start = (jobs: ImageJob[]): QueueState => ({ ...emptyQueue(), jobs })

function Harness({ initial, spies }: { initial: QueueState; spies: { onApproved: () => void; onUnapproved: () => void; openAsset: (id: string, sheet: string) => void; notify: () => void } }) {
  const [queue, setQueue] = useState(initial)
  return <>
    <ReviewView analysis={analysis} queue={queue} setQueue={(u) => setQueue(u)} onApproved={spies.onApproved} onUnapproved={spies.onUnapproved} openAsset={spies.openAsset} openDesign={() => {}} notify={spies.notify} />
    <output data-testid="states">{queue.jobs.map((j) => `${j.id}:${j.approved ? 'approved' : j.rejected ? 'rejected' : j.status}`).join(',')}</output>
  </>
}
const spies = () => ({ onApproved: vi.fn(), onUnapproved: vi.fn(), openAsset: vi.fn(), notify: vi.fn() })
const states = () => screen.getByTestId('states').textContent

describe('Review workspace', () => {
  const waiting = [job({ id: 'ref', approved: true, outputPath: 'ref.png', revision: 1 }), job({ id: 'new', viewKey: 'profile', label: 'Profile', status: 'needs-review', outputPath: 'new.png', revision: 3, qaNotes: ['Right sleeve is shorter than the reference'], updatedAt: 9 })]

  it('shows the new picture beside the approved reference, with technical checks apart from the decision', () => {
    render(<Harness initial={start(waiting)} spies={spies()} />)
    expect(screen.getByText('Approved reference')).toBeTruthy()
    expect(screen.getByText(/New · revision 3/)).toBeTruthy()
    expect(screen.getByText('Technical checks')).toBeTruthy()
    expect(screen.getByText(/Right sleeve is shorter/)).toBeTruthy()
  })
  it('approving records the approval, tells the app, and moves on', () => {
    const s = spies()
    render(<Harness initial={start(waiting)} spies={s} />)
    fireEvent.click(screen.getByRole('button', { name: /^Approve$/ }))
    expect(states()).toMatch(/new:approved/)
    expect(s.onApproved).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/All caught up/)).toBeTruthy()
  })
  it('request changes turns the picture down and opens its sheet without generating anything', () => {
    const s = spies()
    render(<Harness initial={start(waiting)} spies={s} />)
    fireEvent.click(screen.getByRole('button', { name: /Request changes/ }))
    expect(states()).toMatch(/new:rejected/)
    expect(s.openAsset).toHaveBeenCalledWith('A1', 'Turnaround')
    expect(s.onApproved).not.toHaveBeenCalled()
  })
  it('reject keeps the file, stays in Review, and the picture can be found under Turned down', () => {
    render(<Harness initial={start(waiting)} spies={spies()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Reject/ }))
    expect(states()).toMatch(/new:rejected/)
    fireEvent.click(screen.getByRole('button', { name: /Turned down \(1\)/ }))
    expect(screen.getByText(/Turned down · revision 3/)).toBeTruthy()
  })
  it('says there is nothing to compare when no reference is approved yet', () => {
    render(<Harness initial={start([waiting[1]])} spies={spies()} />)
    expect(screen.queryByText('Approved reference')).toBeNull()
    expect(screen.getByText(/nothing to compare against/)).toBeTruthy()
  })
  it('is calm when nothing is waiting', () => {
    render(<Harness initial={start([])} spies={spies()} />)
    expect(screen.getByText(/All caught up/)).toBeTruthy()
  })
})

describe('Review: changing your mind', () => {
  const decided = [
    job({ id: 'ok', viewKey: 'front', approved: true, outputPath: 'ok.png', updatedAt: 5 }),
    job({ id: 'no', viewKey: 'profile', label: 'Profile', rejected: true, outputPath: 'no.png', updatedAt: 6 }),
  ]
  it('a picture turned down by mistake can be approved straight from Turned down', () => {
    const s = spies()
    render(<Harness initial={start(decided)} spies={s} />)
    fireEvent.click(screen.getByRole('button', { name: /Turned down \(1\)/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Approve$/ }))
    expect(states()).toMatch(/no:approved/)
    expect(s.onApproved).toHaveBeenCalledTimes(1)
  })
  it('a rejection can be taken back: the picture returns to Waiting, undecided', () => {
    render(<Harness initial={start(decided)} spies={spies()} />)
    fireEvent.click(screen.getByRole('button', { name: /Turned down \(1\)/ }))
    fireEvent.click(screen.getByRole('button', { name: /Not decided/ }))
    expect(states()).toMatch(/no:needs-review/)
    expect(screen.getByRole('button', { name: /Waiting \(1\)/ })).toBeTruthy()
  })
  it('lists approved pictures and takes an approval back, telling the app so the asset can lose its Approved label', () => {
    const s = spies()
    render(<Harness initial={start(decided)} spies={s} />)
    fireEvent.click(screen.getByRole('button', { name: /^Approved \(1\)/ }))
    expect(screen.getByText(/Approved · revision 1/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Take back approval/ }))
    expect(states()).toMatch(/ok:needs-review/)
    expect(s.onUnapproved).toHaveBeenCalledTimes(1)
  })
  it('rejecting an approved picture also tells the app the approval is gone', () => {
    const s = spies()
    render(<Harness initial={start(decided)} spies={s} />)
    fireEvent.click(screen.getByRole('button', { name: /^Approved \(1\)/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Reject/ }))
    expect(states()).toMatch(/ok:rejected/)
    expect(s.onUnapproved).toHaveBeenCalledTimes(1)
  })
})

describe('Review: compare revisions of one view', () => {
  const takes = [
    job({ id: 'p1', viewKey: 'profile', label: 'Profile', approved: true, outputPath: 'p1.png', revision: 1 }),
    job({ id: 'p2', viewKey: 'profile', label: 'Profile', status: 'needs-review', outputPath: 'p2.png', revision: 2, updatedAt: 9 }),
  ]
  it('offers other takes only when the view has more than one', () => {
    render(<Harness initial={start([takes[1]])} spies={spies()} />)
    expect(screen.queryByRole('button', { name: /Other takes/ })).toBeNull()
  })
  it('keeping the new take approves it, turns the old approved take down and moves on', () => {
    const s = spies()
    render(<Harness initial={start(takes)} spies={s} />)
    fireEvent.click(screen.getByRole('button', { name: /Other takes \(1\)/ }))
    expect(screen.getByText(/Approved · revision 1/)).toBeTruthy()
    expect(screen.getByText(/New · revision 2/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Keep revision 2/ }))
    expect(states()).toBe('p1:rejected,p2:approved')
    expect(s.onApproved).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/All caught up/)).toBeTruthy()
  })
  it('keeping the old take rejects the waiting one and keeps both files', () => {
    render(<Harness initial={start(takes)} spies={spies()} />)
    fireEvent.click(screen.getByRole('button', { name: /Other takes/ }))
    fireEvent.click(screen.getByRole('button', { name: /Keep revision 1/ }))
    expect(states()).toBe('p1:approved,p2:rejected')
  })
})
