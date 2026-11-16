import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BatchAudio } from './BatchAudio'
import { forgetVoices } from '../domain/voiceCache'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { DemoClip } from '../domain/demoClips'
import type { ParsedStory } from '../engine/story'

const calls: Array<{ name: string; args: Record<string, unknown> }> = []
let failWith: string | null = null
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => p,
  invoke: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    if (name === 'local_voices') return [{ name: 'Zira', gender: 'Female', age: 'Adult', culture: 'en-US' }, { name: 'David', gender: 'Male', age: 'Adult', culture: 'en-US' }]
    if (name === 'elevenlabs_voices') return [{ id: 'v-1', name: 'Rachel', detail: '' }]
    if (name === 'elevenlabs_models') return [{ id: 'eleven_v4', name: 'v4', detail: '' }]
    if (failWith && (name === 'speak_elevenlabs' || name === 'speak_local')) throw new Error(failWith)
    if (name === 'speak_local' || name === 'speak_elevenlabs') return `C:\\a\\${args.outputName}.mp3`
    if (name === 'make_music') return [{ path: 'C:\\a\\m.mp3', title: 'T', duration: 50 }]
    return null
  },
}))

const asset = (over: Partial<ExtractedAsset>): ExtractedAsset => ({ id: 'A1', name: 'MARA', type: 'character', sceneIds: ['S1'], status: 'planned', ...over } as ExtractedAsset)
const assets = [asset({ id: 'A1', name: 'MARA', personality: 'warm' }), asset({ id: 'A2', name: 'TOM' })]
const story = { scenes: [{ id: 'S1', number: 1, heading: 'INT. KITCHEN - DAY', setting: 'KITCHEN', intExt: 'INT', timeOfDay: 'DAY', action: [], dialogue: [{ speaker: 'MARA', text: 'It needs more salt.', line: 4 }, { speaker: 'TOM', text: 'Then add some.', line: 5 }] }] } as unknown as ParsedStory

function Harness({ notify = () => {} }: { notify?: (m: string) => void }) {
  const [clips, setClips] = useState<DemoClip[]>([])
  return <>
    <BatchAudio assets={assets} story={story} clips={clips} setClips={(u) => setClips(u)} desktop notify={notify} providersVersion={0} openProviders={() => {}} />
    <output data-testid="clips">{clips.map((c) => `${c.assetName}:${c.line}`).join('|')}</output>
  </>
}
const open = (c: HTMLElement) => { (c.querySelector('details') as HTMLDetailsElement).open = true }
const summary = () => document.querySelector('.batch-summary')?.textContent ?? ''
const spoke = (name: string) => calls.filter((c) => c.name === name)

beforeEach(() => { forgetVoices(); calls.length = 0; failWith = null; try { localStorage.clear() } catch { /* none */ } })

describe('Batch voices', () => {
  it('free engine: shows the plan, sends nothing until confirmed, then makes each ticked character and saves the clips', async () => {
    const { container } = render(<Harness />)
    open(container)
    await waitFor(() => expect(spoke('local_voices')).toHaveLength(1))
    fireEvent.click(screen.getByLabelText('Make a line for MARA'))
    fireEvent.click(screen.getByLabelText('Make a line for TOM'))
    fireEvent.change(await screen.findByLabelText('Voice for MARA'), { target: { value: 'Zira' } })
    fireEvent.change(screen.getByLabelText('Voice for TOM'), { target: { value: 'David' } })
    expect(summary()).toMatch(/spends no credits/)
    fireEvent.click(screen.getByRole('button', { name: /Review and make 2/ }))
    expect(screen.getByRole('dialog', { name: /Confirm the batch/ })).toBeTruthy()
    expect(spoke('speak_local')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /^Make 2$/ }))
    await waitFor(() => expect(spoke('speak_local')).toHaveLength(2))
    expect(spoke('speak_local')[0].args).toMatchObject({ text: 'It needs more salt.', voice: 'Zira' })
    expect(spoke('speak_local')[1].args).toMatchObject({ text: 'Then add some.', voice: 'David' })
    await waitFor(() => expect(screen.getByTestId('clips').textContent).toBe('MARA:It needs more salt.|TOM:Then add some.'))
  })

  it('cloud engine: shows characters and the typed price, says it spends credits, and the confirm button says so', async () => {
    const { container } = render(<Harness />)
    open(container)
    fireEvent.change(screen.getByLabelText(/Voice engine/), { target: { value: 'elevenlabs' } })
    fireEvent.click(await screen.findByRole('button', { name: /Load my ElevenLabs voices/ }))
    fireEvent.click(screen.getByLabelText('Make a line for MARA'))
    fireEvent.change(await screen.findByLabelText('Voice for MARA'), { target: { value: 'v-1' } })
    expect(summary()).toMatch(/19 characters in all.*does not know the price/)
    fireEvent.change(screen.getByLabelText('Price per 1,000 characters'), { target: { value: '0.30' } })
    expect(summary()).toMatch(/about \$0\.006/)
    fireEvent.click(screen.getByRole('button', { name: /Review and make 1/ }))
    expect(spoke('speak_elevenlabs')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /Spend credits and make 1/ }))
    await waitFor(() => expect(spoke('speak_elevenlabs')).toHaveLength(1))
    expect(spoke('speak_elevenlabs')[0].args).toMatchObject({ voiceId: 'v-1', modelId: 'eleven_v4', text: 'It needs more salt.' })
  })

  it('stops the rest of the batch after a key problem instead of repeating the failing request', async () => {
    failWith = 'ElevenLabs returned 401 Unauthorized'
    const notes: string[] = []
    const { container } = render(<Harness notify={(m) => notes.push(m)} />)
    open(container)
    fireEvent.change(screen.getByLabelText(/Voice engine/), { target: { value: 'elevenlabs' } })
    fireEvent.click(await screen.findByRole('button', { name: /Load my ElevenLabs voices/ }))
    for (const n of ['MARA', 'TOM']) { fireEvent.click(screen.getByLabelText(`Make a line for ${n}`)); fireEvent.change(await screen.findByLabelText(`Voice for ${n}`), { target: { value: 'v-1' } }) }
    fireEvent.click(screen.getByRole('button', { name: /Review and make 2/ }))
    fireEvent.click(screen.getByRole('button', { name: /Spend credits and make 2/ }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(spoke('speak_elevenlabs')).toHaveLength(1)
    expect(screen.getByText('Stopped')).toBeTruthy()
    expect(screen.getByTestId('clips').textContent).toBe('')
  })

  it('lists a character with nothing to say as skipped and does not count it', async () => {
    const { container } = render(<Harness />)
    open(container)
    fireEvent.click(screen.getByLabelText('Make a line for TOM'))
    expect(screen.getByRole('list', { name: 'Skipped' }).textContent).toMatch(/No voice chosen/)
    expect((screen.getByRole('button', { name: /Review and make/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Batch music', () => {
  it('builds a theme and a scene score from the script, confirms first, and makes one request per item', async () => {
    const { container } = render(<Harness />)
    open(container)
    fireEvent.click(screen.getByRole('tab', { name: /Music/ }))
    fireEvent.click(screen.getByLabelText('MARA'))
    fireEvent.click(screen.getByLabelText(/Scene 1: KITCHEN/))
    expect(summary()).toMatch(/2 music requests.*about 4 tracks/)
    fireEvent.click(screen.getByRole('button', { name: /Review and make 2/ }))
    expect(spoke('make_music')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /Spend credits and make 2/ }))
    await waitFor(() => expect(spoke('make_music')).toHaveLength(2))
    const first = spoke('make_music')[0].args.request as Record<string, unknown>
    expect(first).toMatchObject({ model: 'V6_MINI', instrumental: true, title: 'MARA theme' })
    expect(String(first.style)).toMatch(/warm/)
    await waitFor(() => expect(screen.getByTestId('clips').textContent).toMatch(/MARA:/))
  })
})
