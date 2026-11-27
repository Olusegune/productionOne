import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AgeStudio, type AgeStudioProps } from './AgeStudio'
import { emptyQueue, type ImageJob, type QueueState } from '../domain/generationQueue'
import type { ExtractedAsset } from '../domain/productionStudio'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { emptyVariations, type VariationState } from '../domain/variations'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}`, invoke: vi.fn() }))

const mara: ExtractedAsset = { id: 'CHAR-MARA', name: 'MARA', type: 'character', sceneIds: [], status: 'approved', age: '30s' }

const front = (): ImageJob => ({
  id: 'F1', key: 'k', assetId: 'CHAR-MARA', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false,
  outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: true, rejected: false, createdAt: 1, updatedAt: 1, outputPath: 'C:/mara/front.jpg',
})

function props(over: Partial<AgeStudioProps> = {}): AgeStudioProps {
  return {
    character: mara, assets: [mara], setAssets: vi.fn(), onOpenAsset: vi.fn(), variations: emptyVariations(), updateVariations: vi.fn(),
    queue: { ...emptyQueue(), jobs: [front()] }, setQueue: vi.fn(), style: defaultStyleBible, desktop: false, providersVersion: 0,
    onApproved: vi.fn(), onUnapproved: vi.fn(), notify: vi.fn(), openProviders: vi.fn(), onOpenSheets: vi.fn(), ...over,
  }
}

describe('the age screen', () => {
  it('offers the three different things and explains each', () => {
    render(<AgeStudio {...props()} />)
    expect(screen.getByLabelText('The same person at another age')).toBeTruthy()
    expect(screen.getByLabelText('A younger- or older-looking redesign')).toBeTruthy()
    expect(screen.getByLabelText('A relative (a new character)')).toBeTruthy()
    expect(screen.getByText(/Recognisably them, a different age/)).toBeTruthy()
  })

  it('moving the slider changes only the settings here: no record, no request, no cost', () => {
    const p = props()
    render(<AgeStudio {...p} />)
    const slider = screen.getByLabelText('Target age slider')
    for (const age of ['40', '55', '70', '82']) fireEvent.change(slider, { target: { value: age } })
    expect((screen.getByLabelText('Target age') as HTMLInputElement).value).toBe('82')
    expect(screen.getByText(/Settings changed here only. Nothing is made until you press the button/)).toBeTruthy()
    expect(p.updateVariations).not.toHaveBeenCalled()
    expect(p.setQueue).not.toHaveBeenCalled()
    expect(p.notify).not.toHaveBeenCalled()
  })

  it('warns that a named side may be put on the wrong side, only when a side is named', () => {
    render(<AgeStudio {...props()} />)
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.change(screen.getByPlaceholderText(/the scar through the left eyebrow/), { target: { value: 'the scar through the left eyebrow' } })
    expect(screen.getByRole('note').textContent).toMatch(/image models often put it on the wrong side/)
    fireEvent.change(screen.getByPlaceholderText(/the scar through the left eyebrow/), { target: { value: 'the strong jaw' } })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('says whether the target is older or younger than now', () => {
    render(<AgeStudio {...props()} />)
    fireEvent.change(screen.getByLabelText('Target age'), { target: { value: '65' } })
    expect(screen.getByText(/Older than now \(30s\)/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Target age'), { target: { value: '12' } })
    expect(screen.getByText(/Younger than now \(30s\)/)).toBeTruthy()
  })

  it('shows the cost before anything is requested and makes nothing without a named recognisable feature', () => {
    const p = props({ queue: { ...emptyQueue(), perImageUsd: 0.04, jobs: [front()] } })
    render(<AgeStudio {...p} />)
    const button = screen.getByRole('button', { name: /Make candidates/ })
    expect(button.textContent).toMatch(/\$0\.08/)
    fireEvent.click(button)
    expect(p.notify).toHaveBeenCalledWith(expect.stringMatching(/You named what must stay recognisable/))
    expect(p.updateVariations).not.toHaveBeenCalled()
    expect(p.setQueue).not.toHaveBeenCalled()
  })

  it('needs the character’s approved front view', () => {
    render(<AgeStudio {...props({ queue: emptyQueue() })} />)
    expect(screen.getByText(/Approve MARA's front view first/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Make candidates/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('makes an age variant and two requests linked to it, with the approved picture as the only reference', () => {
    const p = props()
    render(<AgeStudio {...p} />)
    fireEvent.change(screen.getByLabelText('Target age'), { target: { value: '65' } })
    fireEvent.change(screen.getByPlaceholderText(/the scar through the left eyebrow/), { target: { value: 'the scar; the strong jaw' } })
    fireEvent.click(screen.getByRole('button', { name: /Make candidates/ }))
    const made = (p.updateVariations as unknown as { mock: { calls: Array<[(v: VariationState) => VariationState]> } }).mock.calls[0][0](emptyVariations())
    expect(made.entities[0]).toMatchObject({ kind: 'age', name: 'MARA at 65', characterId: 'CHAR-MARA' })
    expect(made.entities[0].revisions[0].spec).toMatchObject({ mode: 'same-person', targetAge: '65', anchors: ['the scar', 'the strong jaw'], variant: 'MARA at 65' })
    const queue = (p.setQueue as unknown as { mock: { calls: Array<[(q: QueueState) => QueueState]> } }).mock.calls[0][0](emptyQueue())
    const made2 = queue.jobs.filter((j) => j.variation)
    expect(made2.map((j) => j.viewKey)).toEqual(['full-front', 'portrait'])
    expect(made2.every((j) => j.references.length === 1 && j.references[0] === 'C:/mara/front.jpg' && j.variation?.role === 'age-candidate')).toBe(true)
  })

  it('a relative is a new linked character, and no age record or request is made', () => {
    const p = props()
    render(<AgeStudio {...p} />)
    fireEvent.click(screen.getByLabelText('A relative (a new character)'))
    fireEvent.change(screen.getByPlaceholderText('for example Elsie'), { target: { value: 'Elsie' } })
    fireEvent.click(screen.getByRole('button', { name: /Make a new character/ }))
    const assets = (p.setAssets as unknown as { mock: { calls: Array<[(a: ExtractedAsset[]) => ExtractedAsset[]]> } }).mock.calls[0][0]([mara])
    expect(assets[1]).toMatchObject({ name: 'ELSIE', relativeOf: { assetId: 'CHAR-MARA', relation: 'daughter' } })
    expect(p.updateVariations).not.toHaveBeenCalled()
    expect(p.setQueue).not.toHaveBeenCalled()
    expect(p.onOpenAsset).toHaveBeenCalled()
  })
})
