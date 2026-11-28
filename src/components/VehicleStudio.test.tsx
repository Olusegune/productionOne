import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { VehicleStudio } from './VehicleStudio'
import { emptyVariations } from '../domain/variations'
import { approvedVehicle } from '../domain/vehicleLab'
import type { ExtractedAsset } from '../domain/productionStudio'

const car = { id: 'P-CAR', name: 'The car', type: 'prop', sceneIds: [], status: 'planned' } as ExtractedAsset
const notify = vi.fn()
let latest = emptyVariations()

function Harness() {
  const [v, setV] = useState(emptyVariations())
  latest = v
  return <VehicleStudio asset={car} assets={[car]} variations={v} updateVariations={(u) => setV(u)} notify={notify} />
}

describe('the vehicle details form', () => {
  it('a template fills the form without saving; saving records an approved vehicle', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'truck' } })
    expect((screen.getByLabelText('Seats') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('Entrances') as HTMLTextAreaElement).value).toBe('cab door x2 @side')
    expect(screen.getByText(/Vehicle: truck, 7 m long, 2.5 m wide, 3.2 m high, 2 seats\./)).toBeTruthy()
    expect(approvedVehicle(latest, 'P-CAR')).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve' }))
    expect(approvedVehicle(latest, 'P-CAR')?.spec.kind).toBe('truck')
  })
  it('shows a line it cannot read and will not save until fixed; refuses impossible seats', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Features'), { target: { value: 'wheel @under' } })
    expect(screen.getByRole('alert').textContent).toMatch(/"under" is not a view/)
    expect((screen.getByRole('button', { name: 'Save and approve' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Features'), { target: { value: 'wheel @side' } })
    fireEvent.change(screen.getByLabelText('Seats'), { target: { value: '-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve' }))
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/whole number/))
    expect(approvedVehicle(latest, 'P-CAR')).toBeUndefined()
  })
})
