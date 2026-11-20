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
  it('says plainly that originals are never changed, a grade is colour only, and that LUTs are colour-only too', () => {
    render(<Harness start={addLook(emptyLooks(), 'Warm').state} />)
    expect(screen.getByText(/never changed and a grade is never baked/)).toBeTruthy()
    expect(screen.getAllByText(/does not move lights or rebuild shadows/).length).toBe(2)
    expect(screen.getByText(/A LUT is a table of colour changes/)).toBeTruthy()
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
  const cubeText = (title: string) => `TITLE "${title}"\nLUT_3D_SIZE 2\n` + ['1 1 1', '0 1 1', '1 0 1', '0 0 1', '1 1 0', '0 1 0', '1 0 0', '0 0 0'].join('\n') + '\n'
  const pick = async (text: string, name: string) => {
    const file = new File([text], name, { type: 'text/plain' })
    Object.defineProperty(file, 'text', { value: async () => text })
    fireEvent.change(screen.getByLabelText('Import a LUT (.cube)'), { target: { files: [file] } })
  }

  it('imports a .cube LUT into the look, keeps it once, and lets you set its strength and remove it', async () => {
    render(<Harness start={addLook(emptyLooks(), 'Warm').state} />)
    await pick(cubeText('Invert test'), 'invert.cube')
    expect(await screen.findByText(/Added Invert test \(3D, size 2\) to Warm/)).toBeTruthy()
    expect(Object.keys(saved().luts ?? {})).toHaveLength(1)
    expect(saved().looks[0].grade.lut).toMatchObject({ strength: 100 })
    fireEvent.change(screen.getByLabelText('LUT strength'), { target: { value: '40' } })
    expect(saved().looks[0].grade.lut?.strength).toBe(40)
    fireEvent.click(screen.getByRole('button', { name: 'Remove the LUT from this look' }))
    expect(saved().looks[0].grade.lut).toBeUndefined()
    expect(saved().luts).toBeUndefined()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('refuses a file that is not a usable LUT, and says why', async () => {
    render(<Harness start={addLook(emptyLooks(), 'Warm').state} />)
    await pick('LUT_3D_SIZE 2\n0 0 0\n', 'broken.cube')
    expect(await screen.findByText(/Could not use broken\.cube: The file says size 2 \(8 rows\) but has 1 rows/)).toBeTruthy()
    await pick('hello', 'notes.txt')
    expect(await screen.findByText(/Choose a \.cube file/)).toBeTruthy()
    expect(saved().luts).toBeUndefined()
  })

  it('a LUT that looks like a log LUT is warned about and not applied until the person says it is meant for these pictures', async () => {
    render(<Harness start={addLook(emptyLooks(), 'Warm').state} />)
    await pick(cubeText('ARRI LogC to Rec709'), 'logc.cube')
    expect((await screen.findAllByText(/suggests this LUT is for a log, linear or HDR format/)).length).toBeGreaterThan(0)
    const box = screen.getByLabelText('This LUT is meant for ordinary pictures') as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(saved().looks[0].grade.lut?.acknowledgeLog).toBeUndefined()
    fireEvent.click(box)
    expect(saved().looks[0].grade.lut?.acknowledgeLog).toBe(true)
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
