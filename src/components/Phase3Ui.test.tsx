// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { BlockingCanvas } from './BlockingCanvas'
import { VisualReviewPanel } from './VisualReviewPanel'
import { emptyQueue, enqueue, type QueueState } from '../domain/generationQueue'
import type { AnalysisResult, ExtractedAsset, ShotRecord } from '../domain/productionStudio'
import { createProfile, setControl, type ProportionProfile } from '../domain/proportions'
import { provenanceFor } from '../domain/characterLayers'
import { addThing, emptySceneState, type SceneState } from '../domain/sceneState'
import { emptyReviews, type Reviews } from '../domain/visualReview'
import type { Ledgers } from '../domain/correction'
import { defaultStyleBible } from '../domain/visualDevelopment'

vi.mock('@tauri-apps/api/core', () => ({ invoke: async () => { throw new Error('a provider call was made') }, convertFileSrc: (p: string) => `asset://${p}` }))

const assets: ExtractedAsset[] = [{ id: 'MARCUS', name: 'MARCUS', type: 'character', sceneIds: [], status: 'planned' }, { id: 'AMINA', name: 'AMINA', type: 'character', sceneIds: [], status: 'planned' }]
const shot = { id: 'S1', sceneId: 'SC-1', order: 1, duration: 4, assetIds: ['MARCUS', 'AMINA'], action: 'x', dialogue: '', speaker: '', emotionalObjective: '', facialActing: '', bodyLanguage: '', microAnimation: '', cameraFraming: '', cameraMovement: '', lighting: '', soundEffects: '', ambience: '', music: '', transition: 'Cut', storyboardStatus: 'planned', size: 'MS', angle: 'eye-level', lens: 40, movement: 'static' } as ShotRecord
afterEach(cleanup)

function Canvas({ start = emptySceneState('SC-1'), notify = () => {} }: { start?: SceneState; notify?: (m: string) => void }) {
  const [scene, setScene] = useState(start)
  return <><BlockingCanvas scene={scene} setScene={setScene} assets={assets} shot={shot} shotOrder={['S1', 'S2']} notify={notify} /><pre data-testid="world">{JSON.stringify(scene.world)}</pre></>
}

describe('BlockingCanvas', () => {
  it('adds people and a chair, seats one, and a second person cannot take the same chair', () => {
    const notify = vi.fn()
    render(<Canvas notify={notify} />)
    const add = screen.getByRole('group', { name: 'Add to the map' })
    fireEvent.click(within(add).getByRole('button', { name: 'MARCUS' }))
    fireEvent.click(within(add).getByRole('button', { name: 'AMINA' }))
    fireEvent.click(within(add).getByRole('button', { name: 'Add a chair' }))
    fireEvent.click(screen.getByRole('button', { name: /^MARCUS, character/ }))
    fireEvent.change(screen.getByLabelText('Sits on'), { target: { value: 'FURN-001' } })
    expect(JSON.parse(screen.getByTestId('world').textContent!).things.find((t: { id: string }) => t.id === 'MARCUS').occupies).toBe('FURN-001')
    fireEvent.click(screen.getByRole('button', { name: /^AMINA, character/ }))
    fireEvent.change(screen.getByLabelText('Sits on'), { target: { value: 'FURN-001' } })
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/already taken by MARCUS/))
    expect(JSON.parse(screen.getByTestId('world').textContent!).things.find((t: { id: string }) => t.id === 'AMINA').occupies).toBeUndefined()
  })
  it('arrow keys move a thing in steps, and moving the camera never moves anyone', () => {
    let s = addThing(emptySceneState('SC-1'), { id: 'MARCUS', kind: 'character', name: 'MARCUS', x: 3, y: 3, facing: 0 })
    s = addThing(s, { id: 'FURN-001', kind: 'furniture', name: 'Chair 1', x: 5, y: 3, facing: 0 })
    render(<Canvas start={s} />)
    const before = screen.getByTestId('world').textContent
    fireEvent.click(screen.getByRole('button', { name: 'Place the camera for this shot' }))
    fireEvent.change(screen.getByLabelText('Camera direction'), { target: { value: '90' } })
    expect(screen.getByTestId('world').textContent).toBe(before)
    fireEvent.keyDown(screen.getByRole('button', { name: /^MARCUS, character/ }), { key: 'ArrowRight' })
    expect(JSON.parse(screen.getByTestId('world').textContent!).things[0].x).toBe(3.25)
    fireEvent.keyDown(screen.getByRole('button', { name: /^MARCUS, character/ }), { key: 'ArrowDown', shiftKey: true })
    expect(JSON.parse(screen.getByTestId('world').textContent!).things[0].y).toBe(4)
  })
  it('a deliberate change between shots needs a reason', () => {
    const notify = vi.fn()
    const s = addThing(emptySceneState('SC-1'), { id: 'MARCUS', kind: 'character', name: 'MARCUS', x: 3, y: 3, facing: 0 })
    render(<Canvas start={s} notify={notify} />)
    fireEvent.click(screen.getByRole('button', { name: /^MARCUS, character/ }))
    fireEvent.click(screen.getByRole('button', { name: /Record this position/ }))
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Say why it moves/))
    fireEvent.change(screen.getByLabelText('Reason for the change'), { target: { value: 'He crosses to the window' } })
    fireEvent.click(screen.getByRole('button', { name: /Record this position/ }))
    expect(notify).toHaveBeenLastCalledWith(expect.stringMatching(/Recorded: MARCUS is different from S1 on/))
  })
  it('lists what the camera sees in screen terms, and layout problems in words', () => {
    let s = addThing(emptySceneState('SC-1'), { id: 'MARCUS', kind: 'character', name: 'MARCUS', x: 3, y: 3, facing: 0, posture: 'seated' })
    s = { ...s }
    render(<Canvas start={s} />)
    expect(screen.getByRole('list', { name: 'Layout problems' }).textContent).toMatch(/MARCUS is seated but has no chair/)
    expect(screen.getByLabelText('What this camera sees').textContent).toMatch(/MARCUS: /)
  })
})

function Review({ initialReviews = emptyReviews(), profile, queue: q0 }: { initialReviews?: Reviews; profile?: ProportionProfile; queue?: QueueState }) {
  const [queue, setQueue] = useState<QueueState>(q0 ?? done())
  const [reviews, setReviews] = useState(initialReviews)
  const [ledgers, setLedgers] = useState<Ledgers>({})
  const [profiles, setProfiles] = useState<Record<string, ProportionProfile>>(profile ? { MARCUS: profile } : {})
  const analysis: AnalysisResult = { scenes: [], assets }
  return <><VisualReviewPanel analysis={analysis} shots={[]} queue={queue} setQueue={setQueue} style={defaultStyleBible} reviews={reviews} setReviews={setReviews} ledgers={ledgers} setLedgers={setLedgers} proportions={profiles} setProportions={setProfiles} fitRules={{}} sceneStates={{}} vision={{ ok: false, why: 'Choose a local model first (Local AI).' }} notify={() => {}} /><pre data-testid="profiles">{JSON.stringify(profiles)}</pre><pre data-testid="queue">{JSON.stringify(queue.jobs.map((j) => ({ v: j.viewKey, r: j.revision, a: j.approved })))}</pre></>
}
function done(prov?: ReturnType<typeof provenanceFor>): QueueState {
  const q = enqueue(emptyQueue(), [{ assetId: 'MARCUS', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], provenance: prov, outputName: (r) => `front_v${r}` }, { assetId: 'MARCUS', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'side', label: 'Side', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: (r) => `side_v${r}` }], 1, false).state
  return { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'needs-review', outputPath: `C:/out/${j.viewKey}.png` })) }
}

describe('VisualReviewPanel', () => {
  it('shows every output as "Not checked" until a check is run, and never calls that a pass', () => {
    render(<Review />)
    expect(screen.getAllByText('Not checked').length).toBe(2)
    expect(screen.getAllByText(/this is not a pass/).length).toBe(2)
    expect(screen.queryByText('Passed')).toBeNull()
  })
  it('running checks names which categories were checked; an output with nothing to compare stays not checked', () => {
    const profile = createProfile('MARCUS', 'large-headed')
    render(<Review profile={profile} queue={done(provenanceFor(profile, []))} />)
    fireEvent.click(screen.getByRole('button', { name: /Run checks on 2 pictures/ }))
    expect(screen.getAllByText('Passed').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/checked: Proportions and silhouette/).length).toBeGreaterThan(0)
  })
  it('a proportion change since generation is a finding with evidence, and "mark intentional" records an exception on the character', () => {
    const profile = createProfile('MARCUS', 'large-headed')
    const now = setControl(profile, 'eyeSize', 0.4)
    render(<Review profile={now} queue={done(provenanceFor(profile, []))} />)
    fireEvent.click(screen.getByRole('button', { name: /Run checks/ }))
    expect(screen.getAllByText('Needs review').length).toBe(1)
    expect(screen.getByText(/Made with earlier proportions/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'View evidence' }))
    expect(within(screen.getByRole('group', { name: 'Evidence' })).getByText(/Made with the current target proportions/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mark intentional' }))
    expect(JSON.parse(screen.getByTestId('profiles').textContent!).MARCUS.exceptions[0].control).toBe('eyeSize')
    expect(screen.getByText(/intentional-exception/)).toBeTruthy()
    expect(screen.queryByText('Needs review')).toBeNull()
  })
  it('a correction is a new revision of that view only, waits for approval, and stops after three tries', () => {
    const profile = createProfile('MARCUS', 'large-headed')
    const now = setControl(profile, 'eyeSize', 0.4)
    render(<Review profile={now} queue={done(provenanceFor(profile, []))} />)
    fireEvent.click(screen.getByRole('button', { name: /Run checks/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate this view with a fix' }))
    const q = JSON.parse(screen.getByTestId('queue').textContent!)
    expect(q).toEqual([{ v: 'front', r: 1, a: false }, { v: 'side', r: 1, a: false }, { v: 'front', r: 2, a: false }])
    expect(screen.getByText(/waits for your approval/)).toBeTruthy()
    expect(screen.getByText(/1 correction attempt, about \$0.00 spent/)).toBeTruthy()
  })
  it('says plainly that the vision check is unavailable and does not call a model', async () => {
    render(<Review />)
    expect((screen.getByRole('button', { name: /Check with a vision model/ }) as HTMLButtonElement).title).toMatch(/Choose a local model first/)
    fireEvent.click(screen.getByRole('button', { name: /Check with a vision model/ }))
    await waitFor(() => expect(screen.getAllByText('Not checked').length).toBe(2))
  })
})
