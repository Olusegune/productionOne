import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { FailureGroups } from './FailureGroups'
import { emptyQueue, type ImageJob, type QueueState } from '../domain/generationQueue'

vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }))
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => p,
  invoke: async (name: string) => {
    if (name === 'credential_status') return true
    if (name === 'model_catalog') return {}
    if (name === 'kie_models') return { kie: { fetchedAt: Date.now() / 1000, models: [] } }
    return undefined
  },
}))

const schema = 'Kie has not published a readable request schema for this model'
const job = (over: Partial<ImageJob>): ImageJob => ({
  id: 'j', key: 'k', assetId: 'A1', variant: 'base', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: '', aspect: '3:4', fullBody: true, provider: 'kie', model: 'google/old-model', references: [], useAnchor: false,
  outputName: 'o', revision: 1, status: 'failed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 1, updatedAt: 1, error: schema, ...over,
})
let latest: QueueState = emptyQueue()
interface Spies { openProviders: () => void; openDesign: () => void; notify: (m: string) => void }
function Harness({ jobs, spies }: { jobs: ImageJob[]; spies: Spies }) {
  const [queue, setQueue] = useState<QueueState>({ ...emptyQueue(), jobs })
  latest = queue
  return <FailureGroups queue={queue} setQueue={(u) => setQueue(u)} desktop assetName={(id) => (id === 'A1' ? 'MARA' : id)} openProviders={spies.openProviders} openDesign={spies.openDesign} notify={spies.notify} />
}
const spies = (): Spies => ({ openProviders: vi.fn(), openDesign: vi.fn(), notify: vi.fn() })
const many = (n: number, error = schema) => Array.from({ length: n }, (_, i) => job({ id: `f${i}`, key: `f${i}`, viewKey: `v${i}`, label: `View ${i}`, error }))

describe('failed views by cause', () => {
  it('shows ten views that failed for one reason as one problem, with the per-view messages under Details', () => {
    render(<Harness jobs={many(10)} spies={spies()} />)
    expect(screen.getAllByRole('region', { name: /views$/ }).length).toBe(1)
    expect(screen.getByText('The model is not available')).toBeTruthy()
    expect(screen.getByText(/^10 views/)).toBeTruthy()
    const details = document.querySelector('.fg-details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(within(details).getAllByRole('listitem')).toHaveLength(10)
  })
  it('offers Refresh models and Choose a model for an unavailable model, and retries every affected view at once', () => {
    const s = spies()
    render(<Harness jobs={many(3)} spies={s} />)
    expect(screen.getByRole('button', { name: /Refresh models/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Choose a model/ }))
    expect(s.openDesign).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Retry all 3/ }))
    expect(latest.jobs.every((j) => j.status === 'queued')).toBe(true)
    expect(s.notify).toHaveBeenCalledWith(expect.stringMatching(/Retrying 3 views/))
  })
  it('keeps different causes apart, and sends a key problem to Provider Settings', () => {
    const s = spies()
    render(<Harness jobs={[...many(2), job({ id: 'k1', key: 'k1', viewKey: 'k1', error: 'No kie key is saved. Add it in Tools, Provider Settings.' })]} spies={s} />)
    expect(screen.getAllByRole('region', { name: /views?$/ }).length).toBe(2)
    const keyGroup = screen.getByRole('region', { name: /The key was missing or rejected/ })
    fireEvent.click(within(keyGroup).getByRole('button', { name: /Provider Settings/ }))
    expect(s.openProviders).toHaveBeenCalled()
    expect(within(keyGroup).queryByRole('button', { name: /Refresh models/ })).toBeNull()
  })
  it('retries a single view from the details without touching the rest', () => {
    render(<Harness jobs={many(3)} spies={spies()} />)
    const details = document.querySelector('.fg-details') as HTMLElement
    fireEvent.click(within(details).getAllByRole('button', { name: 'Retry' })[0])
    expect(latest.jobs.filter((j) => j.status === 'queued')).toHaveLength(1)
    expect(latest.jobs.filter((j) => j.status === 'failed')).toHaveLength(2)
  })
  it('renders nothing when nothing failed', () => {
    const { container } = render(<Harness jobs={[]} spies={spies()} />)
    expect(container.firstChild).toBeNull()
  })
})
