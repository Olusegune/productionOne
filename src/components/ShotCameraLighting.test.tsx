// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ShotCameraLighting } from './ShotCameraLighting'
import type { ExtractedAsset, ShotRecord } from '../domain/productionStudio'

const base: ShotRecord = { id: 'S1', sceneId: 'SC', order: 1, duration: 4, assetIds: ['C1'], action: 'He waits.', dialogue: '', speaker: '', emotionalObjective: '', facialActing: '', bodyLanguage: '', microAnimation: '', cameraFraming: 'Medium', cameraMovement: 'Static', lighting: 'Daylight', soundEffects: '', ambience: '', music: '', transition: 'Cut', storyboardStatus: 'planned', size: 'MS', angle: 'eye-level', lens: 50, movement: 'static' }
const assets: ExtractedAsset[] = [{ id: 'C1', name: 'MARCUS', type: 'character', sceneIds: [], status: 'planned' }]

function Harness({ flat2D = false, onTest }: { flat2D?: boolean; onTest?: (s: ShotRecord) => void }) {
  const [shot, setShot] = useState<ShotRecord>(base)
  return <ShotCameraLighting shot={shot} sceneShots={[shot]} assets={assets} flat2D={flat2D} styleName="Restrained Cinematic Realism" update={(_id, patch) => setShot((s) => ({ ...s, ...patch }))} onLightingTest={onTest} />
}
afterEach(cleanup)
// Fold may render closed content; open each so its controls exist.
const open = () => { for (const b of screen.queryAllByRole('button', { expanded: false })) fireEvent.click(b) }

describe('ShotCameraLighting', () => {
  it('says the controls guide the picture and do not simulate a physical camera', () => {
    render(<Harness />); open()
    expect(screen.getByText(/do not simulate a physical camera/)).toBeTruthy()
  })
  it('shows the field of view for the lens and sensor, and changes with the sensor', () => {
    render(<Harness />); open()
    expect(screen.getByTestId('fov').textContent).toMatch(/50 mm on an assumed Super 35 sensor: about 28° across/)
    fireEvent.change(screen.getByLabelText('Sensor or format'), { target: { value: 'full-frame' } })
    expect(screen.getByTestId('fov').textContent).toMatch(/Full frame \(35 mm\): about 39.6° across/)
  })
  it('applying a preset sets the shot and every value stays editable', () => {
    render(<Harness />); open()
    fireEvent.change(screen.getByLabelText('Camera preset'), { target: { value: 'restrained-close-up' } })
    expect((screen.getByLabelText('Depth of field') as HTMLSelectElement).value).toBe('shallow')
    expect(screen.getByText(/Restrained dramatic close-up: /)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Depth of field'), { target: { value: 'deep' } })
    expect((screen.getByLabelText('Depth of field') as HTMLSelectElement).value).toBe('deep')
  })
  it('flat 2D styles switch the lens controls off and say why', () => {
    render(<Harness flat2D />); open()
    expect((screen.getByLabelText('Depth of field') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByLabelText('Optical character') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText(/flat 2D: it uses virtual framing/)).toBeTruthy()
    expect(screen.queryByTestId('fov')).toBeNull()
  })
  it('lighting is a separate design: a preset fills it, edits update the words, and clearing returns to the scene lighting', () => {
    render(<Harness />); open()
    expect(screen.getByText(/uses the lighting written for the scene/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Lighting preset'), { target: { value: 'hard-side-light' } })
    expect(screen.getByTestId('lighting-words').textContent).toMatch(/small hard source/)
    fireEvent.change(screen.getByLabelText('Key light direction'), { target: { value: '-90' } })
    expect(screen.getByTestId('lighting-words').textContent).toMatch(/from the side, frame left/)
    expect(screen.getByText(/not relighting of the same picture/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear lighting design' }))
    expect(screen.getByText(/uses the lighting written for the scene/)).toBeTruthy()
  })
  it('the lighting test runs only when the button is pressed', () => {
    const run = vi.fn()
    render(<Harness onTest={run} />); open()
    fireEvent.change(screen.getByLabelText('Lighting preset'), { target: { value: 'moonlight' } })
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Make a lighting test/ }))
    expect(run).toHaveBeenCalledTimes(1)
  })
})
