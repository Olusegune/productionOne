import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { AnatomyStudio } from './AnatomyStudio'
import { emptyVariations } from '../domain/variations'
import { approvedCreature } from '../domain/creatureLab'
import { buildViewPrompt } from '../domain/sheetSpecs'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { anatomyLine } from '../domain/creatureLab'
import type { ExtractedAsset } from '../domain/productionStudio'

const ven = { id: 'CHAR-VEN', name: 'Venomspur', type: 'character', sceneIds: [], status: 'planned' } as ExtractedAsset
const notify = vi.fn()
let latest = emptyVariations()

function Harness() {
  const [v, setV] = useState(emptyVariations())
  latest = v
  return <AnatomyStudio asset={ven} variations={v} updateVariations={(u) => setV(u)} notify={notify} />
}

describe('the Anatomy tab', () => {
  it('declares a serpentine four-armed being, shows the sentence that will be written into pictures, and saves it approved', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Body plan'), { target: { value: 'serpentine' } })
    expect(screen.getByLabelText('Limb 1 name')).toHaveProperty('value', 'tail') // a serpentine body starts with a tail, not legs
    fireEvent.change(screen.getByLabelText('Limb 1 name'), { target: { value: 'arm' } })
    fireEvent.change(screen.getByLabelText('Limb 1 count'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Limb 1 digits'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText(/Intentional/), { target: { value: 'six fingers on each hand' } })
    expect(screen.getByText(/Body plan: serpentine\. 4 arms, each with exactly 6 digits\. Intentional, not a mistake: six fingers on each hand\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve' }))
    expect(approvedCreature(latest, 'CHAR-VEN')?.spec.limbs).toEqual([{ name: 'arm', count: 4, digits: 6 }])
    expect(screen.getByText(/Approved: Body plan: serpentine/)).toBeTruthy()
  })

  it('refuses a contradiction in plain words instead of saving', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText(/Intentional/), { target: { value: 'wings' } })
    fireEvent.change(screen.getByLabelText(/Never/), { target: { value: 'Wings' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve' }))
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/both intentional and never/))
    expect(approvedCreature(latest, 'CHAR-VEN')).toBeUndefined()
  })
})

describe('declared anatomy reaches the picture prompt', () => {
  const base = { style: defaultStyleBible, asset: ven, variant: 'Canonical', sheetType: 'turnaround' as never, view: { key: 'front', label: 'Front', aspect: '3:4', fullBody: true } as never }
  it('is included for a character and says to keep it the same', () => {
    const prompt = buildViewPrompt({ ...base, anatomy: anatomyLine({ assetId: 'CHAR-VEN', bodyPlan: 'serpentine', limbs: [{ name: 'arm', count: 4, digits: 6 }], symmetry: 'symmetric', intentional: [], never: ['wings'] }) } as never)
    expect(prompt).toMatch(/Declared anatomy \(exact, keep it the same in every picture\): Body plan: serpentine\. 4 arms, each with exactly 6 digits\. Never: wings\./)
  })
  it('is absent when nothing was declared', () => {
    expect(buildViewPrompt(base as never)).not.toMatch(/Declared anatomy/)
  })
})

describe('templates fill the form but never save', () => {
  it('choosing "Monster or beast" fills in four legs and claws, saves nothing, and "Custom" leaves the form as it is', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'monster' } })
    expect((screen.getByLabelText('Body plan') as HTMLSelectElement).value).toBe('quadruped')
    expect((screen.getByLabelText('Limb 1 name') as HTMLInputElement).value).toBe('leg')
    expect((screen.getByLabelText('Limb 1 count') as HTMLInputElement).value).toBe('4')
    expect((screen.getByLabelText(/Intentional/) as HTMLTextAreaElement).value).toBe('claws')
    expect(screen.getByText(/Nothing is saved until you press Save and approve/)).toBeTruthy()
    expect(approvedCreature(latest, 'CHAR-VEN')).toBeUndefined()
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'custom' } })
    expect((screen.getByLabelText('Limb 1 name') as HTMLInputElement).value).toBe('leg')
  })
})
