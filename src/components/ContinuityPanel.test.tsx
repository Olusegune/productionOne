import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ContinuityPanel } from './ContinuityPanel'
import { addRevision, approveRevision, createEntity, emptyVariations, type LookSpec } from '../domain/variations'
import { assignLook } from '../domain/lookAssignments'
import { snapshotsOf } from '../domain/sceneContinuity'
import type { ExtractedAsset } from '../domain/productionStudio'

const ash = { id: 'CHAR-A', name: 'Ash', type: 'character', sceneIds: [], status: 'planned' } as ExtractedAsset
const notify = vi.fn()
let latest = emptyVariations()
let lookId = ''

function Harness({ assigned = true }: { assigned?: boolean }) {
  const [v, setV] = useState(() => {
    const spec: LookSpec = { characterId: 'CHAR-A', queueVariant: 'Jacket' }
    const made = createEntity(emptyVariations(), 'look', { name: 'Ash in the jacket', characterId: 'CHAR-A', spec, now: '2026-01-01T00:00:00.000Z' })
    lookId = made.ref.id
    const s = approveRevision(made.state, made.ref)
    return assigned ? assignLook(s, made.ref.id, ['SC-1'], '2026-01-02T00:00:00.000Z').variations : s
  })
  latest = v
  return (
    <>
      <button onClick={() => setV((cur) => { const n = addRevision(cur, lookId, { spec: { characterId: 'CHAR-A', queueVariant: 'New jacket' }, now: '2026-02-01T00:00:00.000Z' }); return approveRevision(n.state, n.ref) })}>revise the look</button>
      <ContinuityPanel variations={v} updateVariations={(u) => setV(u)} scenes={[{ id: 'SC-1', heading: 'The VIP room' }]} characters={[ash]} notify={notify} />
    </>
  )
}

describe('Scene continuity panel', () => {
  it('freezes the scene with the exact look version, shows it, and says when a newer one exists without changing it', () => {
    render(<Harness />)
    expect(screen.getByText('Ash wears Ash in the jacket')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Freeze this scene on main/ }))
    const list = screen.getByRole('list', { name: 'Frozen versions' })
    expect(within(list).getByText(/Ash: Ash in the jacket v2/)).toBeTruthy()
    const frozenRef = snapshotsOf(latest, 'SC-1')[0].cast[0].look
    fireEvent.click(screen.getByRole('button', { name: 'revise the look' }))
    expect(within(screen.getByRole('list', { name: 'Frozen versions' })).getByText(/has a newer approved version \(3\); this scene was frozen with version 2/)).toBeTruthy()
    expect(snapshotsOf(latest, 'SC-1')[0].cast[0].look).toEqual(frozenRef)
  })

  it('starts a branch from the frozen scene and switches to it', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Freeze this scene on main/ }))
    fireEvent.change(screen.getByLabelText(/New branch from main/), { target: { value: 'night version' } })
    fireEvent.click(screen.getByRole('button', { name: /Start branch/ }))
    expect((screen.getByLabelText('Branch') as HTMLSelectElement).value).toBe('night version')
    expect(screen.getByText(/from main 1/)).toBeTruthy()
    expect(snapshotsOf(latest, 'SC-1').map((s) => s.branch)).toEqual(['main', 'night version'])
  })

  it('cannot freeze a scene nobody has a look in, and says what to do', () => {
    render(<Harness assigned={false} />)
    expect(screen.getByText(/No one has a look assigned to this scene yet/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Freeze this scene on main/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
