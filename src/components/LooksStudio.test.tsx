import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { LooksStudio, type LooksStudioProps } from './LooksStudio'
import { emptyQueue } from '../domain/generationQueue'
import { addRevision, approveRevision, emptyVariations, type LookSpec, type VariationState } from '../domain/variations'
import { mara, robe, world } from '../domain/variationWorld.fixture'
import { regenerationPlan } from '../domain/regeneration'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}`, invoke: vi.fn() }))

function props(variations: VariationState, over: Partial<LooksStudioProps> = {}): LooksStudioProps {
  return { character: mara, variations, updateVariations: vi.fn(), queue: emptyQueue(), desktop: false, notify: vi.fn(), scenes: [{ id: 'SCENE-001', heading: 'INT. HARBOUR - DAY' }, { id: 'SCENE-002', heading: 'EXT. QUAY - NIGHT' }], onOpenSection: vi.fn(), onOpenSheets: vi.fn(), ...over }
}
const pick = (label: string, text: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: (Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).find((o) => o.textContent === text) as HTMLOptionElement).value } })

describe('the looks screen', () => {
  it('says plainly that nothing is made for you', () => {
    render(<LooksStudio {...props(emptyVariations())} />)
    expect(screen.getByText(/Nothing is made for you: you pick the parts, clashes are shown, and you approve/)).toBeTruthy()
    expect(screen.getByText(/No looks yet/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Approve this look/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('picking an outfit fills in the body and condition it was made for, so a matching look has nothing to resolve', () => {
    const w = world()
    const p = props(w.s)
    render(<LooksStudio {...p} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mara at 65, rain-soaked' } })
    pick('Outfit', 'MARA at 65 in Travel robe, Rain-soaked')
    expect((screen.getByLabelText('Body') as HTMLSelectElement).selectedOptions[0].textContent).toBe('MARA at 65')
    expect((screen.getByLabelText('Condition') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Rain-soaked')
    expect(screen.queryByRole('list', { name: 'Conflicts' })).toBeNull()
    expect(screen.getByText('Nothing clashes.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Approve this look/ }))
    expect(p.updateVariations).toHaveBeenCalledTimes(1)
    const next = (p.updateVariations as unknown as { mock: { calls: Array<[(v: VariationState) => VariationState]> } }).mock.calls[0][0](w.s)
    const look = next.entities.find((e) => e.name === 'Mara at 65, rain-soaked')!
    expect(look.revisions[0].status).toBe('approved')
    expect(look.revisions[0].spec as LookSpec).toMatchObject({ age: w.ageRef, fit: w.fitAgedWet, condition: w.condRef })
  })

  it('shows what blocks a mismatched combination, with what to do, and will not approve it', () => {
    const w = world()
    const p = props(w.s)
    render(<LooksStudio {...p} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mismatch' } })
    pick('Outfit', 'MARA in Travel robe')
    pick('Body', 'MARA at 65')
    const list = screen.getByRole('list', { name: 'Conflicts' })
    expect(within(list).getByText(/fitted to the character as approved, not to MARA at 65/)).toBeTruthy()
    expect(within(list).getByText(/Fit the garment to MARA at 65 in the Wardrobe studio/)).toBeTruthy()
    expect(within(list).getByText('Cannot be approved')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Approve this look/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Fix what blocks it first.')).toBeTruthy()
  })

  it('names two accessories that go on the same place', () => {
    const w = world()
    render(<LooksStudio {...props(w.s)} />)
    pick('Outfit', 'MARA in Travel robe')
    fireEvent.click(screen.getByLabelText('Felt hat'))
    fireEvent.click(screen.getByLabelText('Knitted cap'))
    expect(screen.getByText(/Felt hat and Knitted cap both go on the headwear: they cannot both be worn/)).toBeTruthy()
  })

  it('lists what needs updating after a garment changes, says how much is untouched, and sends you to the studio that fixes it', () => {
    const w = world()
    const v2 = approveRevision(addRevision(w.s, w.robeRef.id, { spec: { ...robe, description: 'with a hood' }, now: '2026-11-28T00:00:00.000Z' }).state, { id: w.robeRef.id, revision: 2 })
    const p = props(v2)
    render(<LooksStudio {...p} />)
    const region = screen.getByRole('region', { name: 'Needs updating' })
    expect(within(region).getAllByText(/has a newer approved version \(2\); this was made from version 1/).length).toBeGreaterThan(1)
    expect(region.textContent).toMatch(new RegExp(`${regenerationPlan(v2).untouchedApprovals} other approved items? (is|are) untouched`))
    fireEvent.click(within(region).getAllByRole('button', { name: /Open the studio/ })[0])
    expect(p.onOpenSection).toHaveBeenCalled()
  })

  it('shows nothing to update when nothing is out of date', () => {
    render(<LooksStudio {...props(world().s)} />)
    expect(screen.queryByRole('region', { name: 'Needs updating' })).toBeNull()
  })
})
