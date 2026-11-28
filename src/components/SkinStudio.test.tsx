import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { SkinStudio } from './SkinStudio'
import { emptyVariations } from '../domain/variations'
import { approvedSkin } from '../domain/skin'
import type { ExtractedAsset } from '../domain/productionStudio'

const mara = { id: 'C1', name: 'Mara', type: 'character', sceneIds: [], status: 'approved' } as ExtractedAsset
const notify = vi.fn()
let latest = emptyVariations()
let updates = 0
const photo = { family: 'Realistic 3D', name: 'Photoreal cinematic CG' }

function Harness({ style = photo }: { style?: { family?: string; name?: string } }) {
  const [v, setV] = useState(emptyVariations())
  latest = v
  return <SkinStudio character={mara} variations={v} updateVariations={(u) => { updates++; setV(u) }} style={style} notify={notify} />
}

describe('the Skin & Surface section', () => {
  it('Natural is the starting preset; the other presets fill the controls; changes show as differences from the preset', () => {
    render(<Harness />)
    expect(screen.getByRole('radio', { name: /^Natural/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: /Weathered/ }))
    expect((screen.getByLabelText('Texture detail') as HTMLSelectElement).value).toBe('pronounced')
    expect((screen.getByLabelText('Surface finish') as HTMLSelectElement).value).toBe('matte')
    fireEvent.change(screen.getByLabelText('Retouching'), { target: { value: 'light' } })
    expect(screen.getByText(/Changed from Weathered: retouching none to light\./)).toBeTruthy()
  })

  it('changing controls and presets saves nothing and makes no request: only the explicit save does', () => {
    updates = 0
    render(<Harness />)
    fireEvent.click(screen.getByRole('radio', { name: /Clean portrait/ }))
    fireEvent.change(screen.getByLabelText('Texture detail'), { target: { value: 'subtle' } })
    fireEvent.change(screen.getByLabelText('Complexion (your words)'), { target: { value: 'warm olive' } })
    expect(updates).toBe(0)
    expect(approvedSkin(latest, 'C1')).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve the profile' }))
    expect(updates).toBe(1)
    expect(approvedSkin(latest, 'C1')?.spec).toMatchObject({ preset: 'clean-portrait', textureDetail: 'subtle', complexion: 'warm olive' })
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/written into new pictures/))
  })

  it('a mark needs where it is, and listed marks stay protected, in plain words', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Add a mark/ }))
    fireEvent.change(screen.getByLabelText('Mark 1 what'), { target: { value: 'a small scar' } })
    expect(screen.getByRole('alert').textContent).toMatch(/needs both what it is and where it is/)
    expect((screen.getByRole('button', { name: 'Save and approve the profile' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Mark 1 where'), { target: { value: 'the left eyebrow' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(/a small scar \(the left eyebrow\)/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Distinctive marks'))
    expect(screen.getByRole('alert').textContent).toMatch(/did not protect them/)
  })

  it('regional controls stay hidden until asked for, and say that models cannot isolate a region', () => {
    render(<Harness />)
    expect(screen.queryByLabelText('forehead texture')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show regional controls/ }))
    fireEvent.change(screen.getByLabelText('forehead texture'), { target: { value: 'subtle' } })
    expect(screen.getByText(/By region: forehead: fine, soft skin texture\./)).toBeTruthy()
    expect(screen.getByText(/cannot reliably limit a change to one region/)).toBeTruthy()
  })

  it('on a stylized style it says so, and the profile is saved but is not written into pictures', () => {
    render(<Harness style={{ family: 'Family 3D', name: 'Family 3D Feature' }} />)
    expect(screen.getByRole('note').textContent).toMatch(/not photorealistic.*never pushed toward realism/)
    fireEvent.click(screen.getByRole('button', { name: 'Save and approve the profile' }))
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/not photorealistic, so it is not written into pictures/))
  })

  it('temporary conditions are kept apart and never change the profile wording', () => {
    render(<Harness />)
    const before = screen.getByText(/^Skin and surface/).textContent
    fireEvent.change(screen.getByLabelText(/Temporary conditions/), { target: { value: 'sweat\nmud' } })
    expect(screen.getByText(/^Skin and surface/).textContent).toBe(before)
  })
})
