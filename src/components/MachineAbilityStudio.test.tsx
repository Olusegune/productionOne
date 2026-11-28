import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { AbilityStudio, MachineStudio } from './MachineAbilityStudio'
import { emptyVariations } from '../domain/variations'
import { approvedMachine } from '../domain/machineLab'
import { approvedAbilities } from '../domain/abilityLab'
import type { ExtractedAsset } from '../domain/productionStudio'

const asset = { id: 'CHAR-R1', name: 'R1', type: 'character', sceneIds: [], status: 'planned' } as ExtractedAsset
const notify = vi.fn()
let latest = emptyVariations()

function Harness({ which }: { which: 'machine' | 'ability' }) {
  const [v, setV] = useState(emptyVariations())
  latest = v
  const p = { asset, variations: v, updateVariations: (u: (x: typeof v) => typeof v) => setV(u), notify }
  return which === 'machine' ? <MachineStudio {...p} /> : <AbilityStudio {...p} />
}

describe('Machine parts', () => {
  it('reads parts typed one per line, shows the sentence for pictures, and saves them approved', () => {
    render(<Harness which="machine" />)
    fireEvent.change(screen.getByLabelText('Joints'), { target: { value: 'elbow x2 @front,side (arms)' } })
    fireEvent.change(screen.getByLabelText('Access panels'), { target: { value: 'chest hatch @front' } })
    expect(screen.getByText(/Machine type: robot\. Joints: 2 elbow \(arms\)\. Access panels: 1 chest hatch\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve' }))
    expect(approvedMachine(latest, 'CHAR-R1')?.spec.joints).toEqual([{ name: 'elbow', count: 2, views: ['front', 'side'], where: 'arms' }])
  })

  it('shows a line it cannot read and will not save until it is fixed', () => {
    render(<Harness which="machine" />)
    fireEvent.change(screen.getByLabelText('Joints'), { target: { value: 'elbow @underneath' } })
    expect(screen.getByRole('alert').textContent).toMatch(/"underneath" is not a view/)
    expect((screen.getByRole('button', { name: 'Save and approve' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Powers', () => {
  it('saves a power with one visual language and shows the ramp of states that are described', () => {
    render(<Harness which="ability" />)
    fireEvent.change(screen.getByLabelText('Name of the power'), { target: { value: 'Venom surge' } })
    fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'acid green' } })
    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'branching veins of light' } })
    fireEvent.change(screen.getByLabelText('peak state'), { target: { value: 'veins cover the whole body' } })
    expect(screen.getByText(/visual language is always acid green, branching veins of light \(never change the colour or the shape/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve' }))
    expect(approvedAbilities(latest, 'CHAR-R1')[0].spec.states.peak).toBe('veins cover the whole body')
  })

  it('refuses a power with no colour in plain words', () => {
    render(<Harness which="ability" />)
    fireEvent.change(screen.getByLabelText('Name of the power'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve' }))
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/colour and its shape/))
    expect(approvedAbilities(latest, 'CHAR-R1')).toHaveLength(0)
  })
})
