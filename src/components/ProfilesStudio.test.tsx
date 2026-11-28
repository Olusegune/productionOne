import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ProfilesStudio } from './ProfilesStudio'
import { approveRevision, emptyVariations } from '../domain/variations'
import { approvedCreature, recordCreature } from '../domain/creatureLab'
import { approvedProfiles } from '../domain/profiles'
import type { ExtractedAsset } from '../domain/productionStudio'

const asset = { id: 'CHAR-A', name: 'Ash', type: 'character', sceneIds: [], status: 'planned' } as ExtractedAsset
const notify = vi.fn()
let latest = emptyVariations()

function Harness() {
  const made = recordCreature(emptyVariations(), { assetId: 'CHAR-A', bodyPlan: 'humanoid', limbs: [{ name: 'arm', count: 2 }], symmetry: 'symmetric', intentional: [], never: [] }, 'Ash', 'a')
  if ('error' in made) throw new Error()
  const [v, setV] = useState(() => approveRevision(made.state, made.ref))
  latest = v
  return <ProfilesStudio asset={asset} variations={v} updateVariations={(u) => setV(u)} notify={notify} />
}

describe('Species and factions', () => {
  it('starting a species with a different body plan lists a proposal and leaves the approved anatomy alone; "Keep mine" removes the proposal', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Venari' } })
    fireEvent.change(screen.getByLabelText('Body plan'), { target: { value: 'serpentine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(approvedProfiles(latest)[0].spec.members).toEqual(['CHAR-A'])
    expect(screen.getByText('species Venari has a serpentine body; this being is recorded as humanoid.')).toBeTruthy()
    expect(approvedCreature(latest, 'CHAR-A')?.spec.bodyPlan).toBe('humanoid')
    expect(screen.getByText(/bodyPlan/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    expect(screen.queryByText(/has a serpentine body/)).toBeNull()
    expect(approvedCreature(latest, 'CHAR-A')?.spec.bodyPlan).toBe('humanoid')
  })

  it('accepting makes a candidate for approval and does not change the approved record', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Venari' } })
    fireEvent.change(screen.getByLabelText('Body plan'), { target: { value: 'serpentine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(approvedCreature(latest, 'CHAR-A')?.spec.bodyPlan).toBe('humanoid')
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Approve it in Anatomy/))
  })

  it('can leave a species', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Venari' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(approvedProfiles(latest)[0].spec.members).toEqual([])
    expect(screen.getByText('No species or faction yet.')).toBeTruthy()
  })
})
