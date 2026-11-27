import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ConditionStudio, type ConditionStudioProps } from './ConditionStudio'
import { emptyQueue, enqueue, type QueueState } from '../domain/generationQueue'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { emptyVariations, type VariationState } from '../domain/variations'
import { garmentRequests } from '../domain/wardrobe'
import { newGarment } from '../domain/wardrobeFlow'
import { reconcileWithQueue } from '../domain/variationSync'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}`, invoke: vi.fn() }))

const T = '2026-11-27T00:00:00.000Z'

function approved(): VariationState {
  const g = newGarment(emptyVariations(), [], { name: 'Field jacket', spec: { description: 'A waxed cotton jacket' }, now: T })
  const jobs = enqueue(emptyQueue(), garmentRequests({ style: defaultStyleBible, provider: 'kie', model: 'm', assetId: g.assetId, assetName: 'Field jacket', garment: g.ref, garmentName: 'Field jacket', spec: { description: 'A waxed cotton jacket' } }), 1).state.jobs
    .map((j, i) => ({ ...j, status: 'needs-review' as const, outputPath: `C:/out/${j.id}.jpg`, approved: i === 0 }))
  return reconcileWithQueue(g.variations, jobs)
}

function props(over: Partial<ConditionStudioProps> = {}): ConditionStudioProps {
  return {
    garment: { id: 'GAR-001', name: 'Field jacket' }, variations: approved(), updateVariations: vi.fn(), queue: emptyQueue(), setQueue: vi.fn(), style: defaultStyleBible,
    provider: 'kie', modelId: 'google/nanobanana-2-1', providerKey: 'kie', ready: () => true, onApproved: vi.fn(), onUnapproved: vi.fn(), notify: vi.fn(), ...over,
  }
}

describe('the condition screen', () => {
  it('says the garment is pristine until a condition is made, and explains left and right', () => {
    render(<ConditionStudio {...props()} />)
    expect(screen.getByText(/No conditions yet. The garment is pristine/)).toBeTruthy()
    expect(screen.getAllByText(/wearer’s left/i).length).toBeGreaterThan(0)
  })

  it('asks what changed before it makes anything', () => {
    const p = props()
    render(<ConditionStudio {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /Make previews/ }))
    expect(p.notify).toHaveBeenCalledWith(expect.stringMatching(/describe at least one change/))
    expect(p.setQueue).not.toHaveBeenCalled()
    expect(p.updateVariations).not.toHaveBeenCalled()
  })

  it('makes a condition from the garment with the wearer’s side, and queues three pictures starting from the garment’s approved picture', () => {
    const p = props()
    render(<ConditionStudio {...p} />)
    fireEvent.change(screen.getByLabelText('Name of this condition'), { target: { value: 'Left sleeve torn' } })
    fireEvent.change(screen.getByLabelText('Description 1'), { target: { value: 'torn open at the elbow' } })
    fireEvent.click(screen.getByRole('button', { name: /Make previews/ }))
    const update = (p.updateVariations as unknown as { mock: { calls: Array<[(v: VariationState) => VariationState]> } }).mock.calls[0][0]
    const made = update(p.variations)
    const cond = made.entities.find((e) => e.kind === 'condition')!
    expect(cond.name).toBe('Left sleeve torn')
    expect(cond.revisions[0].spec).toMatchObject({ kind: 'tear', garment: { id: 'GAR-001', revision: 1 }, regions: [{ component: 'Sleeve', side: 'character-left', description: 'torn open at the elbow' }] })
    const queue = (p.setQueue as unknown as { mock: { calls: Array<[(q: QueueState) => QueueState]> } }).mock.calls[0][0](emptyQueue())
    expect(queue.jobs).toHaveLength(3)
    expect(queue.jobs.every((j) => j.variation?.role === 'condition-preview' && j.references.length === 1)).toBe(true)
    expect(queue.jobs[0].prompt).toMatch(/Sleeve on the wearer’s left/)
  })

  it('lets the person say which side, with the wearer’s words', () => {
    render(<ConditionStudio {...props()} />)
    const side = screen.getByLabelText('Side 1') as HTMLSelectElement
    expect([...side.options].map((o) => o.textContent)).toEqual(['Wearer’s left', 'Wearer’s right', 'Centre', 'Both sides'])
  })
})
