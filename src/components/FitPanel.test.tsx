// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { FitPanel, type PictureCandidate } from './FitPanel'
import type { FitRule } from '../domain/fit'
import type { ExtractedAsset } from '../domain/productionStudio'
import { createProfile } from '../domain/proportions'

vi.mock('@tauri-apps/api/core', () => ({ invoke: async () => { throw new Error('a provider call was made') }, convertFileSrc: (p: string) => `asset://${p}` }))

const asset: ExtractedAsset = { id: 'CHAR-1', name: 'MARCUS', type: 'character', sceneIds: [], status: 'planned' }
const profile = createProfile('CHAR-1')

function Harness(p: { original?: string; candidates?: PictureCandidate[]; onScale?: (s: string) => void; onRedesign?: () => void; onApprove?: (id: string) => void; stale?: number }) {
  const [rules, setRules] = useState<FitRule[]>([])
  return <FitPanel asset={asset} profile={profile} rules={rules} onRules={setRules} people={[{ name: 'MARCUS', profile }]} onGenerateScaleSheet={p.onScale ?? (() => {})} originalPath={p.original} redesignCandidates={p.candidates ?? []} onGenerateRedesign={p.onRedesign ?? (() => {})} onApproveCandidate={p.onApprove ?? (() => {})} staleViews={p.stale ?? 0} notify={() => {}} />
}
afterEach(cleanup)

describe('FitPanel', () => {
  it('shows proposals as proposals, in three groups, and nothing is approved on its own', () => {
    render(<Harness />)
    expect(screen.getByText('Functional fit')).toBeTruthy()
    expect(screen.getByText('Spatial layout')).toBeTruthy()
    expect(screen.getByText('Visual language')).toBeTruthy()
    expect(screen.getAllByText('proposed').length).toBeGreaterThan(5)
    expect(screen.queryByText('approved')).toBeNull()
  })
  it('a rule is approved, rejected or made intentional only when the person says so', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve Chair seat height' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject Desk or table height' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make Doorway height intentionally cramped' }))
    const list = screen.getAllByRole('list')[0]
    expect(within(list).getByText('approved')).toBeTruthy()
    expect(screen.getByText('rejected')).toBeTruthy()
    expect(screen.getByText(/approved, intentionally cramped/)).toBeTruthy()
  })
  it('labels the Scale and Fit sizes illustrative and only asks for a picture when pressed', () => {
    const scale = vi.fn()
    render(<Harness onScale={scale} />)
    expect(screen.getAllByText('illustrative').length).toBeGreaterThan(3)
    expect(screen.getByText(/not from measured geometry/)).toBeTruthy()
    expect(scale).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Generate Scale and Fit reference/ }))
    expect(scale.mock.calls[0][0]).toMatch(/Scale and fit reference sheet/)
  })
  it('without an imported picture there is no redesign section', () => {
    render(<Harness />)
    expect(screen.queryByText('Redesign the imported picture')).toBeNull()
  })
  it('with an imported picture: landmarks are uncertain, the stretch is labelled, a candidate is compared and approved only on request', () => {
    const redesign = vi.fn()
    const approve = vi.fn()
    const { rerender } = render(<Harness original="C:/imports/marcus.png" onRedesign={redesign} onApprove={approve} />)
    expect(screen.getByText('6 landmark estimates are uncertain.')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Show warp preview'))
    expect(screen.getByRole('note').textContent).toMatch(/Preview only/)
    fireEvent.click(screen.getByRole('button', { name: /Generate redesign candidate/ }))
    expect(redesign).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Approve as a new revision' })).toBeNull()
    rerender(<Harness original="C:/imports/marcus.png" onRedesign={redesign} onApprove={approve} candidates={[{ id: 'J1', path: 'C:/out/c.png', status: 'needs-review', approved: false }]} />)
    expect(screen.getByAltText('Redesign candidate')).toBeTruthy()
    expect(approve).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Approve as a new revision' }))
    expect(approve).toHaveBeenCalledWith('J1')
  })
  it('tells the person when approved views were made with earlier proportions and leaves them alone', () => {
    render(<Harness stale={2} />)
    expect(screen.getByRole('status').textContent).toMatch(/2 approved views were made with earlier proportions/)
  })
})
