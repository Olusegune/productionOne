// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ProportionPanel } from './ProportionPanel'
import { createProfile, type ProportionProfile } from '../domain/proportions'
import type { ExtractedAsset } from '../domain/productionStudio'

// Any call to a provider or the network fails the test: moving a control must never reach one.
const invoke = vi.fn(async () => { throw new Error('a provider call was made') })
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => (invoke as (...x: unknown[]) => unknown)(...a), convertFileSrc: (p: string) => `asset://${p}` }))

const asset: ExtractedAsset = { id: 'CHAR-1', name: 'MARCUS', type: 'character', sceneIds: [], status: 'planned' }

function Harness({ initial, onGenerate = () => {}, onSave = () => {}, notify = () => {}, assetId = 'CHAR-1' }: { initial?: ProportionProfile; onGenerate?: (a: ExtractedAsset, p: string) => void; onSave?: (p: ProportionProfile | undefined) => void; notify?: (m: string) => void; assetId?: string }) {
  const [profile, setProfile] = useState<ProportionProfile | undefined>(initial)
  return <ProportionPanel asset={{ ...asset, id: assetId }} profile={profile} onChange={(p) => { setProfile(p); onSave(p) }} onGenerate={onGenerate} candidates={[]} approvedViews={0} notify={notify} onSetWorld={() => {}} />
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /Edit proportions|Set proportions/ }))
const num = (label: string) => screen.getByLabelText(`${label} value`) as HTMLInputElement
const type = (label: string, value: string) => { const el = num(label); fireEvent.change(el, { target: { value } }); fireEvent.blur(el) }

beforeEach(() => { invoke.mockClear(); localStorage.clear(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('a network call was made') })) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('ProportionPanel', () => {
  it('starts as an opt-in: a character with no profile is left alone, and the workspace is not even open', () => {
    const save = vi.fn()
    render(<Harness onSave={save} />)
    expect(screen.getByRole('button', { name: /Set proportions/ })).toBeTruthy()
    expect(screen.getByText(/Not set · uses existing design/)).toBeTruthy()
    expect(screen.queryByTestId('schematic')).toBeNull()
    expect(save).not.toHaveBeenCalled()
  })

  it('opening the workspace to set proportions is still only a draft: nothing is saved until Apply proportions', () => {
    const save = vi.fn()
    render(<Harness assetId="OPEN-1" onSave={save} />)
    open()
    expect(screen.getByTestId('schematic')).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByTestId('prop-state').textContent).toMatch(/Draft/)
    fireEvent.click(screen.getByRole('button', { name: 'Apply proportions' }))
    expect(save).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('prop-state').textContent).toBe('Applied')
  })

  it('calls the height control Total height, in head units, not head size', () => {
    render(<Harness assetId="LABEL-1" initial={createProfile('LABEL-1')} />)
    open()
    expect(screen.getByLabelText('Total height')).toBeTruthy()
    expect(screen.queryByText(/Head size/)).toBeNull()
    expect(screen.getAllByText('head units').length).toBeGreaterThan(0)
  })

  it('moving controls redraws the schematic and makes zero provider or network calls', () => {
    render(<Harness assetId="MOVE-1" initial={createProfile('MOVE-1')} />)
    open()
    const before = screen.getByTestId('schematic').innerHTML
    const legs = screen.getByLabelText('Leg length')
    for (const v of [3.6, 4, 4.4, 2.2]) fireEvent.change(legs, { target: { value: String(v) } })
    fireEvent.change(screen.getByLabelText('Stylization'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('Starting profile'), { target: { value: 'angular' } })
    expect(screen.getByTestId('schematic').innerHTML).not.toBe(before)
    expect(invoke).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('edits stay a draft until applied, and Discard changes puts back what was applied', () => {
    const save = vi.fn()
    render(<Harness assetId="DRAFT-1" initial={createProfile('DRAFT-1')} onSave={save} />)
    open()
    expect(screen.getByTestId('prop-state').textContent).toBe('Applied')
    type('Arm length', '4')
    expect(screen.getByTestId('prop-state').textContent).toMatch(/Draft/)
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(num('Arm length').value).toBe('3')
    expect(screen.getByTestId('prop-state').textContent).toBe('Applied')
    type('Arm length', '4')
    fireEvent.click(screen.getByRole('button', { name: 'Apply proportions' }))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0].controls.armLength.value).toBe(4)
  })

  it('numbers can be typed, are kept inside the allowed range, and Escape puts the old value back', () => {
    render(<Harness assetId="NUM-1" initial={createProfile('NUM-1')} />)
    open()
    type('Arm length', '99')
    expect(num('Arm length').value).toBe('4.5')
    type('Arm length', '')
    expect(num('Arm length').value).toBe('4.5')
    fireEvent.change(num('Arm length'), { target: { value: '2' } })
    fireEvent.keyDown(num('Arm length'), { key: 'Escape' })
    expect(num('Arm length').value).toBe('4.5')
  })

  it('linked proportions move the total height with the legs, and turning the link off stops that', () => {
    render(<Harness assetId="LINK-1" initial={createProfile('LINK-1')} />)
    open()
    type('Leg length', '4.2')
    expect(num('Total height').value).toBe('8.5')
    fireEvent.click(screen.getByRole('switch', { name: 'Linked proportions' }))
    type('Leg length', '3.2')
    expect(num('Total height').value).toBe('8.5')
  })

  it('splits the controls into Body, Face and Advanced', () => {
    render(<Harness assetId="TAB-1" initial={createProfile('TAB-1')} />)
    open()
    expect(screen.queryByLabelText('Eye size')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Face' }))
    expect(screen.getByLabelText('Eye size')).toBeTruthy()
    expect(screen.queryByLabelText('Leg length')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    expect(screen.getByLabelText('Rounded to angular')).toBeTruthy()
    expect(screen.getByLabelText('Story height in metres')).toBeTruthy()
  })

  it('Generate design preview is the only thing that asks for a candidate, and only when pressed', () => {
    const gen = vi.fn()
    render(<Harness assetId="GEN-1" initial={createProfile('GEN-1', 'large-headed')} onGenerate={gen} />)
    open()
    fireEvent.click(screen.getByRole('tab', { name: 'Face' }))
    type('Eye size', '0.3')
    expect(gen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Generate design preview/ }))
    expect(gen).toHaveBeenCalledTimes(1)
    expect(gen.mock.calls[0][1]).toMatch(/large head on a small body/)
  })

  it('resets one control, undoes and redoes, and resets all controls', () => {
    render(<Harness assetId="UNDO-1" initial={createProfile('UNDO-1')} />)
    open()
    type('Arm length', '4.5')
    fireEvent.click(screen.getByRole('button', { name: 'Reset Arm length' }))
    expect(num('Arm length').value).toBe('3')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(num('Arm length').value).toBe('4.5')
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(num('Arm length').value).toBe('3')
    type('Arm length', '4')
    fireEvent.click(screen.getByRole('button', { name: /Reset controls/ }))
    expect(num('Arm length').value).toBe('3')
  })

  it('shows Structure balanced, warns about extremes without blocking, and lets a deliberate choice be marked intentional', () => {
    render(<Harness assetId="WARN-1" initial={createProfile('WARN-1')} />)
    open()
    expect(screen.getByText('Structure balanced')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Face' }))
    type('Eye size', '0.4')
    expect(screen.getByRole('list', { name: 'Proportion warnings' }).textContent).toMatch(/Eye size is at the very high end/)
    expect(num('Eye size').value).toBe('0.4')
    fireEvent.click(screen.getAllByRole('button', { name: 'This is intentional' })[0])
    expect(screen.queryByText(/Eye size is at the very high end/)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    expect(screen.getByText(/Intentional:/).textContent).toMatch(/Eye size/)
  })

  it('Compare draws the Natural proportions behind the figure', () => {
    render(<Harness assetId="CMP-1" initial={createProfile('CMP-1', 'elongated')} />)
    open()
    expect(screen.getByTestId('schematic').querySelector('.prop-ghost')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }))
    expect(screen.getByTestId('schematic').querySelector('.prop-ghost')).not.toBeNull()
  })

  it('applying to the project world profile also sets the starting point for new characters', () => {
    const setWorld = vi.fn()
    const notify = vi.fn()
    function World() {
      const [p, setP] = useState<ProportionProfile | undefined>(createProfile('WORLD-1', 'compact'))
      return <ProportionPanel asset={{ ...asset, id: 'WORLD-1' }} profile={p} onChange={setP} onGenerate={() => {}} candidates={[]} approvedViews={0} notify={notify} onSetWorld={setWorld} />
    }
    render(<World />)
    open()
    fireEvent.click(screen.getByRole('radio', { name: /Project world profile/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply proportions' }))
    expect(setWorld).toHaveBeenCalledTimes(1)
    expect(setWorld.mock.calls[0][0].profile).toMatchObject({ preset: 'compact' })
    expect(notify.mock.calls.at(-1)?.[0]).toMatch(/characters that already have proportions are not changed/)
  })

  it('saves a preset by name and offers it under Your presets', () => {
    const notify = vi.fn()
    render(<Harness assetId="PRE-1" initial={createProfile('PRE-1')} notify={notify} />)
    open()
    type('Arm length', '4')
    fireEvent.click(screen.getByRole('button', { name: 'Save preset' }))
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Long arms' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const select = screen.getByLabelText('Starting profile')
    expect(within(select).getByRole('option', { name: 'Long arms' })).toBeTruthy()
    type('Arm length', '3')
    fireEvent.change(select, { target: { value: 'mine:Long arms' } })
    expect(num('Arm length').value).toBe('4')
  })

  it('clearing the proportions hands the character back untouched', () => {
    const save = vi.fn()
    render(<Harness assetId="CLR-1" initial={createProfile('CLR-1')} onSave={save} />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Clear proportions' }))
    expect(save).toHaveBeenLastCalledWith(undefined)
    expect(screen.getByText(/Not set · uses existing design/)).toBeTruthy()
  })
})

describe('ProportionPanel: every control does something you can see', () => {
  it('Hand size redraws the figure, and Rounded to angular (Advanced) does too', () => {
    render(<Harness assetId="SEE-1" initial={createProfile('SEE-1')} />)
    open()
    const before = screen.getByTestId('schematic').innerHTML
    type('Hand size', '1.2')
    const afterHand = screen.getByTestId('schematic').innerHTML
    expect(afterHand).not.toBe(before)
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    fireEvent.change(screen.getByLabelText('Rounded to angular'), { target: { value: '100' } })
    expect(screen.getByTestId('schematic').innerHTML).not.toBe(afterHand)
  })
  it('with the link off, a Total height the parts do not reach is drawn as a target line', () => {
    render(<Harness assetId="SEE-2" initial={createProfile('SEE-2')} />)
    open()
    fireEvent.click(screen.getByRole('switch', { name: 'Linked proportions' }))
    expect(screen.getByTestId('schematic').querySelector('.prop-target-line')).toBeNull()
    type('Total height', '9.5')
    expect(screen.getByTestId('schematic').querySelector('.prop-target-line')).not.toBeNull()
  })
})
