import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WardrobeStudio, type WardrobeStudioProps } from './WardrobeStudio'
import { emptyQueue, enqueue, type ImageJob, type QueueState } from '../domain/generationQueue'
import type { ExtractedAsset } from '../domain/productionStudio'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { emptyVariations, type VariationState } from '../domain/variations'
import { garmentRequests } from '../domain/wardrobe'
import { newGarment, syncWardrobe } from '../domain/wardrobeFlow'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}`, invoke: vi.fn() }))

const mara: ExtractedAsset = { id: 'CHAR-MARA', name: 'MARA', type: 'character', sceneIds: [], status: 'approved' }

function props(over: Partial<WardrobeStudioProps> = {}): WardrobeStudioProps {
  return {
    character: mara, setAssets: vi.fn(), variations: emptyVariations(), updateVariations: vi.fn(), queue: emptyQueue(), setQueue: vi.fn(),
    style: defaultStyleBible, desktop: false, providersVersion: 0, onApproved: vi.fn(), onUnapproved: vi.fn(), notify: vi.fn(), openProviders: vi.fn(), onOpenSheets: vi.fn(), ...over,
  }
}

describe('the wardrobe screen', () => {
  it('starts with an empty library and a form to design a garment', () => {
    render(<WardrobeStudio {...props()} />)
    expect(screen.getByRole('heading', { name: /Wardrobe/ })).toBeTruthy()
    expect(screen.getByText(/No garments yet/)).toBeTruthy()
    expect(screen.getByLabelText('Describe the garment')).toBeTruthy()
    expect(screen.getByText(/The face and body stay as approved/)).toBeTruthy()
  })

  it('says before anything is made what the previews are, what is left alone and the cost', () => {
    render(<WardrobeStudio {...props({ queue: { ...emptyQueue(), perImageUsd: 0.04 } })} />)
    const card = screen.getByLabelText('Before you press the button')
    expect(card.textContent).toMatch(/3 candidate pictures: the garment, clothing only with no person/)
    expect(card.textContent).toMatch(/New pictures are candidates until you approve them/)
    expect(card.textContent).toMatch(/your written description \(no reference picture\)/)
    expect(card.textContent).toMatch(/\$0\.12/)
  })

  it('asks for a name and a description before it makes anything', () => {
    const p = props()
    render(<WardrobeStudio {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /Make previews/ }))
    expect(p.notify).toHaveBeenCalledWith(expect.stringMatching(/name and describe/))
    expect(p.setQueue).not.toHaveBeenCalled()
    expect(p.updateVariations).not.toHaveBeenCalled()
  })

  it('shows the cost before anything is requested, from the person’s own price', () => {
    render(<WardrobeStudio {...props({ queue: { ...emptyQueue(), perImageUsd: 0.04 } })} />)
    expect(screen.getByRole('button', { name: /Make previews · .*\$0\.12/ })).toBeTruthy()
  })

  it('makes a candidate garment and queues three clothing pictures linked to it', () => {
    const p = props()
    render(<WardrobeStudio {...p} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Field jacket' } })
    fireEvent.change(screen.getByLabelText('Describe the garment'), { target: { value: 'A waxed cotton field jacket' } })
    fireEvent.click(screen.getByRole('button', { name: /Make previews/ }))
    expect(p.updateVariations).toHaveBeenCalledTimes(1)
    const made = (p.updateVariations as unknown as { mock: { calls: Array<[(v: VariationState) => VariationState]> } }).mock.calls[0][0](emptyVariations())
    expect(made.entities[0]).toMatchObject({ kind: 'garment', name: 'Field jacket' })
    expect(made.entities[0].revisions[0].status).toBe('candidate')
    expect(p.setAssets).toHaveBeenCalledTimes(1)
    const next = (p.setQueue as unknown as { mock: { calls: Array<[(q: QueueState) => QueueState]> } }).mock.calls[0][0](emptyQueue())
    expect(next.jobs.map((j) => j.viewKey)).toEqual(['garment-front', 'garment-back', 'garment-detail'])
    expect(next.jobs.every((j) => j.variation?.id === 'GAR-001' && j.variation.role === 'garment-preview')).toBe(true)
  })

  it('does not offer a fit until the garment is approved, and then needs the character’s approved front view', () => {
    const g = newGarment(emptyVariations(), [mara], { name: 'Field jacket', spec: { description: 'A waxed cotton jacket' }, now: '2026-11-27T00:00:00.000Z' })
    const requests = garmentRequests({ style: defaultStyleBible, provider: 'kie', model: 'google/nanobanana-2-1', assetId: g.assetId, assetName: 'Field jacket', garment: g.ref, garmentName: 'Field jacket', spec: { description: 'A waxed cotton jacket' } })
    const jobs: ImageJob[] = enqueue(emptyQueue(), requests, 1).state.jobs.map((j, i) => ({ ...j, status: 'needs-review' as const, outputPath: `C:/out/${j.id}.jpg`, approved: i === 0 }))
    const candidate = syncWardrobe(g.variations, jobs.map((j) => ({ ...j, approved: false })), '2026-11-27T00:00:00.000Z')
    const { unmount } = render(<WardrobeStudio {...props({ variations: candidate, queue: { ...emptyQueue(), jobs } })} />)
    fireEvent.click(screen.getByRole('button', { name: /Field jacket/ }))
    expect(screen.queryByText(/Fit it to MARA/)).toBeNull()
    unmount()

    const approved = syncWardrobe(g.variations, jobs, '2026-11-27T00:00:00.000Z')
    render(<WardrobeStudio {...props({ variations: approved, queue: { ...emptyQueue(), jobs } })} />)
    fireEvent.click(screen.getByRole('button', { name: /Field jacket/ }))
    expect(screen.getByText(/Fit it to MARA/)).toBeTruthy()
    expect(screen.getByText(/Approve MARA's front view first/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Fit it/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
