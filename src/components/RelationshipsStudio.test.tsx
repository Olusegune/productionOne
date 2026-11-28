import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { RelationshipsStudio } from './RelationshipsStudio'
import { addThing, emptySceneState } from '../domain/sceneState'
import { addRevision, approveRevision, createEntity, emptyVariations, type AgeSpec, type VariationState } from '../domain/variations'
import type { ExtractedAsset } from '../domain/productionStudio'

const asset = (id: string, name: string, type: ExtractedAsset['type']) => ({ id, name, type, sceneIds: [], status: 'planned' }) as ExtractedAsset
const ASSETS = [asset('CHAR-VEN', 'Venomspur', 'character'), asset('CHAR-RAP', 'The rapper', 'character'), asset('PROP-CHAIR', 'VIP chair', 'prop')]
const notify = vi.fn()

function Harness({ start, scenes, who = 'PROP-CHAIR' }: { start?: VariationState; scenes?: boolean; who?: string }) {
  const [v, setV] = useState(start ?? emptyVariations())
  let sc = emptySceneState('SC-1')
  sc = addThing(sc, { id: 'CHAR-VEN', kind: 'character', name: 'Venomspur', x: 0, y: 0, facing: 0 })
  sc = addThing(sc, { id: 'PROP-CHAIR', kind: 'furniture', name: 'VIP chair', x: 0, y: 0, facing: 0, ownedBy: 'CHAR-VEN' })
  return <RelationshipsStudio asset={ASSETS.find((a) => a.id === who)!} assets={ASSETS} variations={v} updateVariations={(u) => setV(u)} sceneStates={scenes ? { 'SC-1': sc } : undefined} scenes={[{ id: 'SC-1', heading: 'The VIP room' }]} notify={notify} />
}

describe('the Relationships tab', () => {
  it('records "VIP chair belongs to Venomspur" as a candidate, which only counts once approved', () => {
    render(<Harness />)
    expect(screen.getByText(/Nothing recorded yet/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('VIP chair'), { target: { value: 'belongs' } })
    fireEvent.change(screen.getByLabelText('Other thing'), { target: { value: 'CHAR-VEN' } })
    expect(screen.getByText('VIP chair belongs to Venomspur alone')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Record as a candidate' }))
    const list = screen.getByRole('navigation', { name: /Relationships of VIP chair/ })
    expect(within(list).getByText('VIP chair belongs to Venomspur alone')).toBeTruthy()
    expect(list.textContent).toMatch(/Candidate · stated by you · everywhere/)
    fireEvent.click(within(list).getByRole('button', { name: /Approve/ }))
    expect(list.textContent).toMatch(/Approved · stated by you/)
  })

  it('will not record a size without a number, or the same thing twice', () => {
    render(<Harness who="CHAR-VEN" />)
    fireEvent.change(screen.getByLabelText('Venomspur'), { target: { value: 'scale' } })
    fireEvent.change(screen.getByLabelText('Other thing'), { target: { value: 'CHAR-RAP' } })
    fireEvent.change(screen.getByLabelText('Times as tall'), { target: { value: '0' } })
    expect((screen.getByRole('button', { name: 'Record as a candidate' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Times as tall'), { target: { value: '1.4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record as a candidate' }))
    expect(screen.getByText('Venomspur is 1.4 times the height of The rapper')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Other thing'), { target: { value: 'CHAR-RAP' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record as a candidate' }))
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/already exists/))
  })

  it('offers what a scene already says, and keeping it records a candidate', () => {
    render(<Harness scenes />)
    expect(screen.getByText('Already in your scenes')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.queryByText('Already in your scenes')).toBeNull()
    expect(screen.getByText('VIP chair belongs to Venomspur alone')).toBeTruthy()
  })

  it('says in plain words when what a relationship was agreed for has changed, and confirming makes a new version to approve', () => {
    const spec: AgeSpec = { characterId: 'CHAR-VEN', mode: 'same-person', targetAge: '40' }
    const age = createEntity(emptyVariations(), 'age', { name: 'Venomspur at 40', characterId: 'CHAR-VEN', spec, now: 'x' })
    let v = approveRevision(age.state, age.ref)
    const rel = createEntity(v, 'relationship', { name: 'r', spec: { relation: 'scale', a: { asset: 'CHAR-VEN', pin: age.ref }, b: { asset: 'CHAR-RAP' }, ratio: 1.4, basis: 'declared' }, now: 'x' })
    v = approveRevision(rel.state, rel.ref)
    const next = addRevision(v, age.ref.id, { spec: { ...spec, targetAge: '41' }, now: 'y' })
    v = approveRevision(next.state, next.ref)
    render(<Harness start={v} who="CHAR-VEN" />)
    expect(screen.getByText(/Needs a look/)).toBeTruthy()
    expect(screen.getByText(/has a newer approved version \(2\); this was made from version 1/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm it still holds' }))
    expect(screen.getByRole('button', { name: /Approve/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }))
    expect(screen.queryByText(/Needs a look/)).toBeNull()
  })

  it('shows two owners of one thing as a disagreement', () => {
    let v = emptyVariations()
    for (const owner of ['CHAR-VEN', 'CHAR-RAP']) {
      const r = createEntity(v, 'relationship', { name: owner, spec: { relation: 'ownership', a: { asset: owner }, b: { asset: 'PROP-CHAIR' }, exclusive: true, basis: 'declared' }, now: 'x' })
      v = approveRevision(r.state, r.ref)
    }
    render(<Harness start={v} />)
    expect(screen.getByRole('alert').textContent).toMatch(/VIP chair is assigned to Venomspur and The rapper, but only one can own it/)
  })
})
