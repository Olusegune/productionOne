import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SkinSurfaceCheck } from './SkinSurfaceCheck'
import { emptyReviews, type Reviews } from '../domain/visualReview'
import type { ImageJob } from '../domain/generationQueue'
import type { SkinMeasurement } from '../domain/skinQa'

const measure = vi.fn()
vi.mock('../data/skinMetrics', () => ({ measureSkin: (...a: unknown[]) => measure(...a) }))

const base = { texture: 100, highlight: 0.01, r: 150, g: 120, b: 100, usedHead: true }
const job = { id: 'J9', assetId: 'C1', revision: 3, outputPath: 'C:/m/cand.jpg' } as ImageJob
const yes = { applies: true, reason: '' }
const notify = vi.fn()
let latest: Reviews = emptyReviews()

function Harness({ candidate = job, applicability = yes, original = 'C:/m/orig.jpg' }: { candidate?: ImageJob; applicability?: { applies: boolean; reason: string }; original?: string }) {
  const [reviews, setReviews] = useState(emptyReviews())
  latest = reviews
  return <SkinSurfaceCheck original={original} candidate={candidate} applicability={applicability} reviews={reviews} setReviews={(u) => setReviews(u)} notify={notify} />
}
const result = (candidate: Partial<SkinMeasurement['candidate']>) => ({ measurement: { original: base, candidate: { ...base, ...candidate } } })

describe('the skin surface check', () => {
  it('starts as "Not checked" and measures only when asked', () => {
    measure.mockReset()
    render(<Harness />)
    expect(screen.getByText('Not checked')).toBeTruthy()
    expect(measure).not.toHaveBeenCalled()
  })
  it('shows each finding with its evidence, uncertainty, action and checker, and sends it to Review as an open item', async () => {
    measure.mockReset(); measure.mockResolvedValue(result({ texture: 40 }))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Check skin surface/ }))
    await waitFor(() => expect(screen.getByText('Needs review')).toBeTruthy())
    expect(measure).toHaveBeenCalledWith('C:/m/orig.jpg', 'C:/m/cand.jpg')
    expect(screen.getByText('Possible excessive smoothing')).toBeTruthy()
    expect(screen.getByText(/Evidence: Fine-detail energy in the face \(found automatically\) is 40% of the original's\./)).toBeTruthy()
    expect(screen.getByText(/Heuristic\. A difference can also come from framing, focus or resolution/)).toBeTruthy()
    expect(screen.getByText(/What to do:/)).toBeTruthy()
    expect(screen.getByText('Checker: Skin surface heuristics v1')).toBeTruthy()
    expect(latest.deterministic).toHaveLength(1)
    expect(latest.deterministic[0]).toMatchObject({ category: 'L', status: 'open', outputJobId: 'J9' })
    expect(latest.checked['J9'].deterministic).toEqual(['L'])
  })
  it('"Passed for the checks performed" says it does not mean the picture is right, and lists what it cannot see', async () => {
    measure.mockReset(); measure.mockResolvedValue(result({}))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Check skin surface/ }))
    await waitFor(() => expect(screen.getAllByText('Passed for the checks performed').length).toBeGreaterThan(0))
    expect(screen.getByText(/This does not mean the picture is right/)).toBeTruthy()
    fireEvent.click(screen.getByText(/What this check cannot see \(6\)/))
    expect(screen.getByText('Identity: is it still the same person: needs your review')).toBeTruthy()
    expect(latest.deterministic).toHaveLength(0)
  })
  it('"Unable to check" gives the reason and records nothing, never a pass', async () => {
    measure.mockReset(); measure.mockResolvedValue({ measurement: null, error: 'Measuring pictures needs the desktop app.' })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Check skin surface/ }))
    await waitFor(() => expect(screen.getByText('Unable to check')).toBeTruthy())
    expect(screen.getByText(/The pictures could not be measured: Measuring pictures needs the desktop app\./)).toBeTruthy()
    expect(screen.queryByText(/Passed/)).toBeNull()
    expect(latest.checked['J9']).toBeUndefined()
  })
  it('is not applicable to robots, stylized styles or skin-replacing stages, and says why', () => {
    render(<Harness applicability={{ applies: false, reason: 'This character is declared as a machine, so human-skin checks do not apply.' }} />)
    expect(screen.getByRole('note').textContent).toMatch(/not applicable\. This character is declared as a machine/)
    expect(screen.queryByRole('button', { name: /Check skin surface/ })).toBeNull()
  })
  it('cannot run without a finished candidate and an approved original', () => {
    render(<Harness candidate={{ ...job, outputPath: undefined }} />)
    expect((screen.getByRole('button', { name: /Check skin surface/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/no finished candidate and approved original to compare yet/)).toBeTruthy()
  })
})
