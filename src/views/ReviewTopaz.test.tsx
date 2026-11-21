// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ReviewView } from './ReviewView'
import { emptyQueue, type ImageJob, type QueueState } from '../domain/generationQueue'
import type { AnalysisResult } from '../domain/productionStudio'

const api = vi.hoisted(() => ({ hasKey: vi.fn(), balance: vi.fn(), enhance: vi.fn() }))
vi.mock('../data/topaz', () => ({ topazHasKey: api.hasKey, topazBalance: api.balance, enhanceWithTopaz: api.enhance }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => { throw new Error('not in this test') }), convertFileSrc: (p: string) => p }))

const job: ImageJob = {
  id: 'j', key: 'k', assetId: 'A1', variant: 'base', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false,
  outputName: 'o', revision: 1, status: 'needs-review', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 1, updatedAt: 1, outputPath: 'C:/assets/o.png', width: 1024, height: 1536,
} as ImageJob
const analysis = { scenes: [], assets: [{ id: 'A1', name: 'MARA', type: 'character', sceneIds: [], status: 'planned' }] } as unknown as AnalysisResult

function Harness({ onKey = () => {} }: { onKey?: () => void }) {
  const [queue, setQueue] = useState<QueueState>({ ...emptyQueue(), jobs: [job] })
  return <><ReviewView analysis={analysis} queue={queue} setQueue={(u) => setQueue(u)} onApproved={() => {}} onUnapproved={() => {}} openAsset={() => {}} openDesign={() => {}} notify={() => {}} openTopazKey={onKey} />
    <output data-testid="jobs">{queue.jobs.map((j) => `${j.revision}:${j.source ?? 'generated'}:${j.approved ? 'approved' : j.status}`).join(',')}</output></>
}

beforeEach(() => { api.hasKey.mockResolvedValue(true); api.balance.mockResolvedValue({ available: 10, reserved: 0, total: 10 }); api.enhance.mockReset(); ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {} })
afterEach(() => { cleanup(); delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ })

describe('Review: Enhance with Topaz', () => {
  it('is offered for a picture that has a file, in the desktop app only', async () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Enhance with Topaz…' })).toBeTruthy()
    cleanup()
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Enhance with Topaz…' })).toBeNull()
  })
  it('opens the window without sending anything', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Enhance with Topaz…' }))
    expect(await screen.findByRole('dialog', { name: /Enhance MARA · Front/ })).toBeTruthy()
    expect(api.enhance).not.toHaveBeenCalled()
  })
  it('a finished enhancement becomes a new revision that waits for a decision, beside the original', async () => {
    api.enhance.mockResolvedValue({ path: 'C:/assets/o_topaz.png', width: 2048, height: 3072, credits: 1 })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Enhance with Topaz…' }))
    fireEvent.click(await screen.findByRole('button', { name: /Enhance \(uses Topaz credits\)/ }))
    await screen.findByText(/Done: 2048 by 3072/)
    expect(screen.getByTestId('jobs').textContent).toBe('1:generated:needs-review,2:enhanced:needs-review')
  })
})
