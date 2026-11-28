import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { RelationshipsStudio } from './RelationshipsStudio'
import { approveRevision, createEntity, emptyVariations } from '../domain/variations'
import { recordPropSize } from '../domain/propFit'
import { bodyMetres } from '../domain/fit'
import { createProfile } from '../domain/proportions'
import type { ExtractedAsset } from '../domain/productionStudio'

const asset = (id: string, name: string, type: ExtractedAsset['type']) => ({ id, name, type, sceneIds: [], status: 'planned' }) as ExtractedAsset
const ASSETS = [asset('CHAR-MARA', 'Mara', 'character'), asset('PROP-STAFF', 'The staff', 'prop')]
const body = bodyMetres({ ...createProfile('CHAR-MARA', 'natural'), heightM: 1.7 } as never)
const notify = vi.fn()

function Harness({ who, start }: { who: string; start?: ReturnType<typeof emptyVariations> }) {
  const [v, setV] = useState(start ?? emptyVariations())
  return <RelationshipsStudio asset={ASSETS.find((a) => a.id === who)!} assets={ASSETS} variations={v} updateVariations={(u) => setV(u)} notify={notify} bodyOf={(id) => (id === 'CHAR-MARA' ? body : undefined)} />
}

describe('prop size in the Relationships tab', () => {
  it('only props get a size form, and saving records an approved size', () => {
    const { unmount } = render(<Harness who="CHAR-MARA" />)
    expect(screen.queryByText(/Size of/)).toBeNull()
    unmount()
    render(<Harness who="PROP-STAFF" />)
    expect(screen.getByText(/No size recorded/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save this size' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Length (m)'), { target: { value: '1.2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save this size' }))
    expect(screen.getByText(/Approved: 1.2 m long/)).toBeTruthy()
  })

  it('says whether a held prop suits the holder, and gives its size against their hand', () => {
    const sized = recordPropSize(emptyVariations(), { assetId: 'PROP-STAFF', lengthM: 3, gripM: 0.04, grip: 'one-hand' }, 'The staff', 'a')
    if ('error' in sized) throw new Error()
    let v = approveRevision(sized.state, sized.ref)
    const rel = createEntity(v, 'relationship', { name: 'r', spec: { relation: 'interaction', a: { asset: 'CHAR-MARA' }, b: { asset: 'PROP-STAFF' }, verb: 'hold', basis: 'declared' }, now: 'a' })
    v = approveRevision(rel.state, rel.ref)
    render(<Harness who="CHAR-MARA" start={v} />)
    expect(screen.getByText(/Check: Too long to hold in one hand: 3 m/)).toBeTruthy()
    expect(screen.getByText(/The staff is 3 m long, about .* hand-lengths of Mara's hand/)).toBeTruthy()
  })
})
