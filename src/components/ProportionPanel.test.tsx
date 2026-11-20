// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ProportionPanel } from './ProportionPanel'
import { createProfile, type ProportionProfile } from '../domain/proportions'
import type { ExtractedAsset } from '../domain/productionStudio'

// Any call to a provider or the network fails the test: moving a slider must never reach one.
const invoke = vi.fn(async () => { throw new Error('a provider call was made') })
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => (invoke as (...x: unknown[]) => unknown)(...a), convertFileSrc: (p: string) => `asset://${p}` }))

const asset: ExtractedAsset = { id: 'CHAR-1', name: 'MARCUS', type: 'character', sceneIds: [], status: 'planned' }

function Harness({ initial, onGenerate = () => {}, onSave = () => {} }: { initial?: ProportionProfile; onGenerate?: (a: ExtractedAsset, p: string) => void; onSave?: (p: ProportionProfile | undefined) => void }) {
  const [profile, setProfile] = useState<ProportionProfile | undefined>(initial)
  return <ProportionPanel asset={asset} profile={profile} onChange={(p) => { setProfile(p); onSave(p) }} onGenerate={onGenerate} candidates={[]} approvedViews={0} notify={() => {}} />
}

beforeEach(() => { invoke.mockClear(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('a network call was made') })) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('ProportionPanel', () => {
  it('starts as an opt-in: a character with no profile is left alone', () => {
    const save = vi.fn()
    render(<Harness onSave={save} />)
    expect(screen.getByRole('button', { name: 'Set target proportions' })).toBeTruthy()
    expect(screen.queryByTestId('schematic')).toBeNull()
    expect(save).not.toHaveBeenCalled()
  })

  it('labels the four things apart: target, schematic, generated interpretation, approved design', () => {
    render(<Harness initial={createProfile('CHAR-1')} />)
    expect(screen.getByText(/1 · Target proportions/)).toBeTruthy()
    expect(screen.getByText(/2 · Schematic preview/)).toBeTruthy()
    expect(screen.getByText(/3 · Generated interpretation/)).toBeTruthy()
    expect(screen.getByText(/4 · Approved design/)).toBeTruthy()
  })

  it('moving sliders redraws the schematic and makes zero provider or network calls', () => {
    render(<Harness initial={createProfile('CHAR-1')} />)
    const before = screen.getByTestId('schematic').innerHTML
    const legs = screen.getByLabelText('Leg length')
    for (const v of [3.6, 4, 4.4, 2.2]) fireEvent.change(legs, { target: { value: String(v) } })
    fireEvent.change(screen.getByLabelText('Stylization'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('Starting profile'), { target: { value: 'angular' } })
    expect(screen.getByTestId('schematic').innerHTML).not.toBe(before)
    expect(invoke).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('Generate preview is the only thing that asks for a candidate, and only when pressed', () => {
    const gen = vi.fn()
    render(<Harness initial={createProfile('CHAR-1', 'large-headed')} onGenerate={gen} />)
    fireEvent.change(screen.getByLabelText('Eye size'), { target: { value: '0.3' } })
    expect(gen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Generate preview/ }))
    expect(gen).toHaveBeenCalledTimes(1)
    expect(gen.mock.calls[0][1]).toMatch(/large head on a small body/)
  })

  it('resets one control, undoes and redoes, and resets the profile', () => {
    render(<Harness initial={createProfile('CHAR-1')} />)
    const legs = screen.getByLabelText('Leg length') as HTMLInputElement
    fireEvent.change(legs, { target: { value: '4.5' } })
    expect(legs.value).toBe('4.5')
    fireEvent.click(screen.getByRole('button', { name: 'Reset Leg length' }))
    expect(legs.value).toBe('3.2')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(legs.value).toBe('4.5')
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(legs.value).toBe('3.2')
    fireEvent.change(legs, { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset profile' }))
    expect(legs.value).toBe('3.2')
  })

  it('warns about conflicting settings without blocking, and lets a deliberate choice be marked intentional', () => {
    render(<Harness initial={createProfile('CHAR-1')} />)
    fireEvent.change(screen.getByLabelText('Eye size'), { target: { value: '0.4' } })
    expect(screen.getByRole('list', { name: 'Proportion warnings' }).textContent).toMatch(/Eye size is at the very high end/)
    expect((screen.getByLabelText('Eye size') as HTMLInputElement).value).toBe('0.4')
    fireEvent.click(screen.getAllByRole('button', { name: 'This is intentional' })[0])
    expect(screen.queryByText(/Eye size is at the very high end/)).toBeNull()
    expect(screen.getByText(/Intentional:/).textContent).toMatch(/Eye size/)
  })

  it('removing the profile hands the character back untouched', () => {
    const save = vi.fn()
    render(<Harness initial={createProfile('CHAR-1')} onSave={save} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(save).toHaveBeenLastCalledWith(undefined)
    expect(screen.getByRole('button', { name: 'Set target proportions' })).toBeTruthy()
  })
})
