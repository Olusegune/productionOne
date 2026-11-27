import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CandidateVision, regionWords } from './CandidateVision'
import { emptyReviews, type Reviews } from '../domain/visualReview'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { world } from '../domain/variationWorld.fixture'

const assess = vi.fn()
let visionOn = true
vi.mock('../data/localAi', () => ({ useLocalAi: () => ({ config: { textModel: 'qwen2.5vl:7b', textProvider: 'ollama' } }) }))
vi.mock('../data/visionReview', () => ({
  localVision: () => (visionOn ? { ok: true, model: 'qwen2.5vl:7b', provider: { assess: (...a: unknown[]) => assess(...a) } } : { ok: false, why: 'Choose a local model first (Local AI).' }),
}))

/** The model answers each closed question: a different person, and the garment is worn. */
const answers = (q: string) => (q.includes('same_person') ? '{"same_person": false}' : '{"wearing_it": true}')
const button = () => screen.getByRole('button', { name: /Check against what it was made from/ })

function Harness({ none }: { none?: boolean }) {
  const [w] = useState(() => world())
  const jobs = none ? [] : w.jobs.filter((j) => j.variation?.role === 'fit-candidate').slice(0, 1)
  const [reviews, setReviews] = useState<Reviews>(emptyReviews())
  return <CandidateVision jobs={jobs} allJobs={w.jobs} variations={w.s} reviews={reviews} setReviews={setReviews} style={defaultStyleBible} desktop notify={vi.fn()} />
}

describe('checking a candidate against what it was made from', () => {
  it('shows nothing when there is no picture yet', () => {
    const { container } = render(<Harness none />)
    expect(container.textContent).toBe('')
  })

  it('says what it will do before it does it: the records, and simple questions to a model on this computer, free', () => {
    visionOn = true
    render(<Harness />)
    expect(button()).toBeTruthy()
    expect(screen.getByText(/Facts about the records, plus simple questions put to qwen2.5vl:7b on this computer \(which side, same person, worn or not\)\. Free; nothing leaves it/)).toBeTruthy()
    expect(screen.getByText('Not checked')).toBeTruthy()
  })

  it('puts each closed question twice with the right pictures, and shows a different answer as a suggestion with how sure it was', async () => {
    visionOn = true
    assess.mockReset()
    assess.mockImplementation(async (q: string) => answers(q))
    render(<Harness />)
    fireEvent.click(button())
    await waitFor(() => expect(screen.getByText(/Suggestion · 80% sure/)).toBeTruthy())
    const same = (assess.mock.calls as Array<[string, string[]]>).filter(([q]) => q.includes('same_person'))
    expect(same).toHaveLength(2)
    expect(same[0][1]).toHaveLength(2)
    expect(screen.getByText(/The model thinks this is a different person\. \(asked 2 times, same answer\)/)).toBeTruthy()
    expect(screen.getByText(/It should be: The same person as the approved picture it was made from\./)).toBeTruthy()
    expect(screen.getByText('Identity', { selector: 'b' })).toBeTruthy()
    expect(screen.getByText('Needs a look')).toBeTruthy()
    expect(screen.getByText(/Looked at: Identity, Costume continuity\./)).toBeTruthy()
  })

  it('a finding can be dismissed, and the status follows', async () => {
    visionOn = true
    assess.mockReset()
    assess.mockImplementation(async (q: string) => answers(q))
    render(<Harness />)
    fireEvent.click(button())
    await waitFor(() => screen.getByText(/Suggestion/))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/Suggestion/)).toBeNull()
    expect(screen.getByText(/Passed for the checks performed/)).toBeTruthy()
  })

  it('a model that answers in a way that cannot be read, or fails, is "Unable to assess", never a pass', async () => {
    visionOn = true
    for (const behave of [() => Promise.resolve('garbled'), () => Promise.reject(new Error('Ollama could not be reached'))]) {
      assess.mockReset()
      assess.mockImplementation(behave)
      const { unmount } = render(<Harness />)
      fireEvent.click(button())
      await waitFor(() => screen.getByText('Unable to assess'))
      expect(screen.queryByText(/Passed/)).toBeNull()
      unmount()
    }
  })

  it('says why when the model could not answer, in plain words', async () => {
    visionOn = true
    assess.mockReset()
    assess.mockRejectedValue(new Error('Ollama request failed (400): request (4183 tokens) exceeds the available context size (4096 tokens)'))
    render(<Harness />)
    fireEvent.click(button())
    await waitFor(() => screen.getByText(/The local model's memory is too small for this question/))
    expect(screen.queryByText(/4183/)).toBeNull()
  })

  it('two different answers to the same question are "could not tell", not a finding', async () => {
    visionOn = true
    assess.mockReset()
    let n = 0
    assess.mockImplementation(async () => (n++ % 2 ? '{"same_person": false, "wearing_it": false}' : '{"same_person": true, "wearing_it": true}'))
    render(<Harness />)
    fireEvent.click(button())
    await waitFor(() => screen.getByText('Unable to assess'))
    expect(screen.queryByText(/Suggestion/)).toBeNull()
  })

  it('with no vision model it still checks the records and says how to get suggestions', async () => {
    visionOn = false
    assess.mockReset()
    render(<Harness />)
    expect(screen.getByText(/Facts about the records\. For suggestions about the picture itself: Choose a local model first \(Local AI\)\./)).toBeTruthy()
    fireEvent.click(button())
    await waitFor(() => expect(button()).toBeTruthy())
    expect(assess).not.toHaveBeenCalled()
  })

  it('says where a region is in plain words', () => {
    expect(regionWords({ x: 0.65, y: 0.25, w: 0.2, h: 0.2 })).toBe('the upper right of the picture')
    expect(regionWords({ x: 0.05, y: 0.7, w: 0.2, h: 0.2 })).toBe('the lower left of the picture')
    expect(regionWords({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 })).toBe('the middle of the picture')
    expect(regionWords({ x: 0.0, y: 0.45, w: 0.2, h: 0.1 })).toBe('the left of the picture')
    expect(regionWords(undefined)).toBe('')
  })
})
