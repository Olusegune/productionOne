// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { LookPanel } from './LookPanel'
import { addLook, emptyLooks, neutralGrade, type LookState } from '../domain/grade'

const invoke = vi.fn(async () => { throw new Error('a file or provider call was made') })
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => (invoke as (...x: unknown[]) => unknown)(...a), convertFileSrc: (p: string) => `asset://${p}` }))

const scenes = [{ id: 'SC1', heading: 'INT. KITCHEN - DAY' }, { id: 'SC2', heading: 'EXT. DOCK - NIGHT' }]
const shots = [{ id: 'S1', sceneId: 'SC1', title: 'Wide' }, { id: 'S2', sceneId: 'SC2', title: 'Close' }]
const frames = [{ id: 'S1', label: 'Wide', path: 'C:/out/wide.png' }]

function Harness({ start = emptyLooks(), frs = frames }: { start?: LookState; frs?: typeof frames }) {
  const [state, setState] = useState(start)
  return <><LookPanel state={state} setState={setState} scenes={scenes} shots={shots} frames={frs} notify={() => {}} /><pre data-testid="state">{JSON.stringify(state)}</pre></>
}
const saved = () => JSON.parse(screen.getByTestId('state').textContent!) as LookState

beforeEach(() => { invoke.mockClear() })
afterEach(cleanup)

describe('LookPanel', () => {
  it('says plainly that originals are never changed, a grade is colour only, and LUTs are not available', () => {
    render(<Harness />)
    expect(screen.getByText(/never changed and a grade is never baked/)).toBeTruthy()
    expect(screen.getByText(/does not move lights or rebuild shadows/)).toBeTruthy()
    expect(screen.getByText(/LUT import is not available yet/)).toBeTruthy()
  })
  it('adds a look, edits its grade (clamped), and resets it', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Add a look' }))
    expect(saved().looks).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Exposure (stops)'), { target: { value: '0.7' } })
    fireEvent.change(screen.getByLabelText('Contrast'), { target: { value: '30' } })
    expect(saved().looks[0].grade.technical.exposureEv).toBe(0.7)
    expect(saved().looks[0].grade.tone.contrast).toBe(30)
    fireEvent.click(screen.getByRole('button', { name: /Reset this look/ }))
    expect(saved().looks[0].grade).toEqual(neutralGrade())
    expect((screen.getByRole('button', { name: /Reset this look/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('assigns a look to the project, a scene and one shot, and the colour script shows which applies', () => {
    const a = addLook(emptyLooks(), 'Warm'); const b = addLook(a.state, 'Cold')
    render(<Harness start={b.state} />)
    fireEvent.change(screen.getByLabelText('Project look'), { target: { value: a.look.id } })
    fireEvent.change(screen.getByLabelText('Look for EXT. DOCK - NIGHT'), { target: { value: b.look.id } })
    const table = screen.getByRole('table', { name: 'Colour script' })
    expect(within(table).getByText(/Warm \(project\)/)).toBeTruthy()
    expect(within(table).getByText(/Cold \(scene\)/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Look for shot Close'), { target: { value: a.look.id } })
    expect(saved().shotLooks).toEqual({ S2: a.look.id })
    expect(within(table).getByText(/1 \(1 with their own look\)/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Look for shot Close'), { target: { value: '' } })
    expect(saved().shotLooks).toEqual({})
  })
  it('previews on a picture without writing anything: no file or provider call, the original stays on offer, and strength and original toggle are available', () => {
    const a = addLook(emptyLooks(), 'Warm')
    render(<Harness start={a.state} />)
    expect(screen.getByLabelText('Grade strength')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Show the original'))
    expect(screen.getByAltText('Original')).toBeTruthy()
    expect(screen.getByText('Original (unchanged)')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Grade strength'), { target: { value: '40' } })
    expect(invoke).not.toHaveBeenCalled()
  })
  it('with no frame yet it says so instead of faking a preview', () => {
    render(<Harness start={addLook(emptyLooks(), 'Warm').state} frs={[]} />)
    expect(screen.getByText(/Make a storyboard frame to preview a look on it/)).toBeTruthy()
  })
  it('removing a look removes where it was used and says no picture was changed', () => {
    const a = addLook(emptyLooks(), 'Warm')
    render(<Harness start={{ ...a.state, projectLook: a.look.id, sceneLooks: { SC1: a.look.id } }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove this look' }))
    expect(saved()).toEqual({ looks: [], sceneLooks: {}, shotLooks: {} })
  })
})
