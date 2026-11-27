import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TransformStudio, type TransformStudioProps } from './TransformStudio'
import { emptyQueue, enqueue, type ImageJob, type QueueState } from '../domain/generationQueue'
import type { ExtractedAsset } from '../domain/productionStudio'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { emptyVariations, findRevision, type TransformationSpec, type VariationState } from '../domain/variations'
import { newStage } from '../domain/transformationFlow'
import { transformationRequests } from '../domain/transformation'
import { syncWardrobe } from '../domain/wardrobeFlow'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}`, invoke: vi.fn() }))

const T = '2026-11-27T00:00:00.000Z'
const kael: ExtractedAsset = { id: 'CHAR-KAEL', name: 'KAEL', type: 'character', sceneIds: [], status: 'approved', age: '40-45' }
const front = (): ImageJob => ({
  id: 'F1', key: 'k', assetId: 'CHAR-KAEL', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false,
  outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: true, rejected: false, createdAt: 1, updatedAt: 1, outputPath: 'C:/kael/front.jpg',
})

function props(over: Partial<TransformStudioProps> = {}): TransformStudioProps {
  return {
    character: kael, variations: emptyVariations(), updateVariations: vi.fn(), queue: { ...emptyQueue(), jobs: [front()] }, setQueue: vi.fn(), style: defaultStyleBible, desktop: false, providersVersion: 0,
    onApproved: vi.fn(), onUnapproved: vi.fn(), notify: vi.fn(), openProviders: vi.fn(), onOpenSheets: vi.fn(), ...over,
  }
}

/** One approved first stage, as the screen and the queue leave it. */
function withApprovedFirstStage(): { variations: VariationState; jobs: ImageJob[] } {
  const spec = { kind: 'Zombie or infected', stage: 'Subtle symptoms', intensity: 1, recognisability: 5, anchors: ['the kind eyes'], details: { surface: 'faint veins' } }
  const made = newStage(emptyVariations(), { character: kael, spec, now: T })
  const saved = findRevision(made.variations, made.ref)!.spec as TransformationSpec
  const reqs = transformationRequests({ style: defaultStyleBible, provider: 'kie', model: 'm', character: kael, lookName: made.variant, stage: made.ref, spec: saved, source: { path: 'C:/kael/front.jpg', of: 'base' } })
  const jobs = enqueue(emptyQueue(), reqs, 1).state.jobs.map((j, i) => ({ ...j, status: 'needs-review' as const, outputPath: `C:/out/${j.id}.jpg`, approved: i === 0 }))
  return { variations: syncWardrobe(made.variations, jobs, T), jobs }
}

const fill = () => {
  fireEvent.change(screen.getByPlaceholderText(/the tired kind eyes/), { target: { value: 'the tired kind eyes; the lean build' } })
  fireEvent.change(screen.getByPlaceholderText(/the veins spread to the neck/), { target: { value: 'the veins reach the neck' } })
}

describe('the transformations screen', () => {
  it('offers the kinds and explains that a preset only fills the boxes', () => {
    render(<TransformStudio {...props()} />)
    const kind = screen.getByLabelText('Kind of transformation') as HTMLSelectElement
    expect([...kind.options].map((o) => o.textContent)).toEqual(['Zombie or infected', 'Monster', 'Supernatural form', 'Robotic or cybernetic', 'Animal or creature hybrid', 'Elemental form', 'Custom'])
    expect(screen.getByText(/The preset only fills the boxes below; change anything/)).toBeTruthy()
  })

  it('a preset fills the boxes and they stay editable; Custom empties them', () => {
    render(<TransformStudio {...props()} />)
    const anatomy = screen.getByPlaceholderText(/broader shoulders/) as HTMLInputElement
    expect(anatomy.value).toMatch(/hunched/)
    fireEvent.change(screen.getByLabelText('Kind of transformation'), { target: { value: 'monster' } })
    expect(anatomy.value).toMatch(/broader and taller/)
    fireEvent.change(anatomy, { target: { value: 'my own anatomy' } })
    expect(anatomy.value).toBe('my own anatomy')
    fireEvent.change(screen.getByLabelText('Kind of transformation'), { target: { value: 'custom' } })
    expect(anatomy.value).toBe('')
  })

  it('moving the sliders changes only the settings here: no record, no request, no cost', () => {
    const p = props()
    render(<TransformStudio {...p} />)
    for (const v of ['2', '4', '5']) fireEvent.change(screen.getByLabelText('Intensity'), { target: { value: v } })
    fireEvent.change(screen.getByLabelText('Recognisability target'), { target: { value: '2' } })
    expect(screen.getByText(/Intensity: complete/)).toBeTruthy()
    expect(screen.getByText(/Aim to stay: faintly recognisable/)).toBeTruthy()
    expect(screen.getByText(/Settings changed here only/)).toBeTruthy()
    expect(p.updateVariations).not.toHaveBeenCalled()
    expect(p.setQueue).not.toHaveBeenCalled()
  })

  it('says the recognisability slider is a target, not a score', () => {
    render(<TransformStudio {...props()} />)
    expect(screen.getByText(/creative target that you judge by eye. It is not a score/)).toBeTruthy()
  })

  it('makes nothing without a named recognisable feature, and says why', () => {
    const p = props()
    render(<TransformStudio {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /Make candidates/ }))
    expect(p.notify).toHaveBeenCalledWith(expect.stringMatching(/You named what must stay recognisable/))
    expect(p.updateVariations).not.toHaveBeenCalled()
    expect(p.setQueue).not.toHaveBeenCalled()
  })

  it('needs the character’s approved front view', () => {
    render(<TransformStudio {...props({ queue: emptyQueue() })} />)
    expect(screen.getByText(/Approve KAEL's front view first/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Make candidates/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('makes a first stage from the approved picture, with the anchors and the declared anatomy in both prompts', () => {
    const p = props()
    render(<TransformStudio {...p} />)
    fill()
    fireEvent.change(screen.getByPlaceholderText(/fingers: six on each hand/), { target: { value: 'fingers: six on each hand' } })
    fireEvent.click(screen.getByRole('button', { name: /Make candidates/ }))
    const made = (p.updateVariations as unknown as { mock: { calls: Array<[(v: VariationState) => VariationState]> } }).mock.calls[0][0](emptyVariations())
    expect(made.entities[0]).toMatchObject({ kind: 'transformation', name: 'KAEL · Zombie or infected · subtle symptoms', characterId: 'CHAR-KAEL' })
    expect(made.entities[0].revisions[0].spec).toMatchObject({ anchors: ['the tired kind eyes', 'the lean build'], expectedAnatomy: ['fingers: six on each hand'], intensity: 1 })
    const queue = (p.setQueue as unknown as { mock: { calls: Array<[(q: QueueState) => QueueState]> } }).mock.calls[0][0](emptyQueue())
    const mine = queue.jobs.filter((j) => j.variation)
    expect(mine.map((j) => j.viewKey)).toEqual(['full-front', 'portrait'])
    expect(mine.every((j) => j.references[0] === 'C:/kael/front.jpg' && j.variation?.role === 'transformation-candidate')).toBe(true)
    expect(mine.every((j) => /What must stay recognisable: the tired kind eyes; the lean build/.test(j.prompt) && /fingers: six on each hand/.test(j.prompt))).toBe(true)
  })

  it('continues the next stage from the approved stage before it', () => {
    const { variations, jobs } = withApprovedFirstStage()
    const p = props({ variations, queue: { ...emptyQueue(), jobs: [front(), ...jobs] } })
    render(<TransformStudio {...p} />)
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'Partial transformation' } })
    expect(screen.getByText(/Starts from:/).textContent).toMatch(/Subtle symptoms \(approved\)/)
    fill()
    fireEvent.click(screen.getByRole('button', { name: /Make candidates/ }))
    const made = (p.updateVariations as unknown as { mock: { calls: Array<[(v: VariationState) => VariationState]> } }).mock.calls[0][0](variations)
    const second = made.entities.find((e) => e.name.endsWith('partial transformation'))!
    expect((second.revisions[0].spec as TransformationSpec).from).toEqual({ id: 'TRN-001', revision: 1 })
    const queue = (p.setQueue as unknown as { mock: { calls: Array<[(q: QueueState) => QueueState]> } }).mock.calls[0][0](emptyQueue())
    const mine = queue.jobs.filter((j) => j.variation?.id === second.id)
    expect(mine[0].references[0]).toBe(`C:/out/${jobs[0].id}.jpg`)
    expect(mine[0].prompt).toMatch(/Reference image 1 is the approved earlier stage \(Subtle symptoms\)/)
  })
})
