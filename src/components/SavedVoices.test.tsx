import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BatchAudio } from './BatchAudio'
import { VoiceAudition } from './VoiceAudition'
import { forgetVoices } from '../domain/voiceCache'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { DemoClip } from '../domain/demoClips'
import type { ParsedStory } from '../engine/story'

const calls: Array<{ name: string; args: Record<string, unknown> }> = []
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => p,
  invoke: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    if (name === 'local_voices') return [{ name: 'Zira', gender: 'Female', age: 'Adult', culture: 'en-US' }, { name: 'David', gender: 'Male', age: 'Adult', culture: 'en-US' }]
    if (name === 'speak_local') return `C:\\a\\${args.outputName}.mp3`
    return null
  },
}))

const base = (over: Partial<ExtractedAsset>): ExtractedAsset => ({ id: 'A1', name: 'MARA', type: 'character', sceneIds: ['S1'], status: 'planned', ...over } as ExtractedAsset)
const story = { scenes: [{ id: 'S1', number: 1, heading: 'INT. KITCHEN - DAY', setting: 'KITCHEN', intExt: 'INT', timeOfDay: 'DAY', action: [], dialogue: [{ speaker: 'MARA', text: 'It needs more salt.', line: 4 }, { speaker: 'TOM', text: 'Then add some.', line: 5 }] }] } as unknown as ParsedStory

function BatchHarness({ initial }: { initial: ExtractedAsset[] }) {
  const [assets, setAssets] = useState(initial)
  const [clips, setClips] = useState<DemoClip[]>([])
  return <>
    <BatchAudio assets={assets} story={story} clips={clips} setClips={(u) => setClips(u)} desktop notify={() => {}} providersVersion={0} openProviders={() => {}} onAssetChange={(a) => setAssets((l) => l.map((x) => (x.id === a.id ? a : x)))} />
    <output data-testid="voices">{assets.map((a) => `${a.name}:${a.castVoice?.voice ?? '-'}`).join('|')}</output>
  </>
}
const openIt = (c: HTMLElement) => { (c.querySelector('details') as HTMLDetailsElement).open = true }

beforeEach(() => { forgetVoices(); calls.length = 0; try { localStorage.clear() } catch { /* none */ } })

describe('batch with saved voices', () => {
  it('fills in each character\'s saved voice, ticks them on request, and makes the lines with those voices', async () => {
    const { container } = render(<BatchHarness initial={[base({ id: 'A1', name: 'MARA', castVoice: { provider: 'windows', voice: 'Zira' } }), base({ id: 'A2', name: 'TOM', castVoice: { provider: 'windows', voice: 'David' } })]} />)
    openIt(container)
    await waitFor(() => expect(calls.some((c) => c.name === 'local_voices')).toBe(true))
    expect(await screen.findByText(/2 characters have a saved voice for this engine/)).toBeTruthy()
    expect((screen.getByLabelText('Voice for MARA') as HTMLSelectElement).value).toBe('Zira')
    fireEvent.click(screen.getByRole('button', { name: 'Tick them' }))
    fireEvent.click(screen.getByRole('button', { name: /Review and make 2/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Make 2$/ }))
    await waitFor(() => expect(calls.filter((c) => c.name === 'speak_local')).toHaveLength(2))
    expect(calls.filter((c) => c.name === 'speak_local').map((c) => c.args.voice)).toEqual(['Zira', 'David'])
  })

  it('does not offer a Windows voice to a cloud engine', async () => {
    const { container } = render(<BatchHarness initial={[base({ castVoice: { provider: 'windows', voice: 'Zira' } })]} />)
    openIt(container)
    fireEvent.change(screen.getByLabelText(/Voice engine/), { target: { value: 'elevenlabs' } })
    expect(screen.queryByText(/have a saved voice|has a saved voice/)).toBeNull()
  })

  it('remembers the chosen voices on the characters', async () => {
    const { container } = render(<BatchHarness initial={[base({ id: 'A1', name: 'MARA' }), base({ id: 'A2', name: 'TOM' })]} />)
    openIt(container)
    await waitFor(() => expect(calls.some((c) => c.name === 'local_voices')).toBe(true))
    fireEvent.click(screen.getByLabelText('Make a line for MARA'))
    fireEvent.change(await screen.findByLabelText('Voice for MARA'), { target: { value: 'Zira' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remember the chosen voices' }))
    expect(screen.getByTestId('voices').textContent).toBe('MARA:Zira|TOM:-')
  })
})

describe('single audition with a saved voice', () => {
  function Single({ initial }: { initial: ExtractedAsset }) {
    const [asset, setAsset] = useState(initial)
    const [clips, setClips] = useState<DemoClip[]>([])
    return <>
      <VoiceAudition asset={asset} story={story} clips={clips} setClips={(u) => setClips(u)} desktop notify={() => {}} providersVersion={0} openProviders={() => {}} onChange={setAsset} />
      <output data-testid="saved">{asset.castVoice ? `${asset.castVoice.provider}:${asset.castVoice.voice}` : 'none'}</output>
    </>
  }
  it('opens with the saved Windows voice chosen, can save another, and can clear it', async () => {
    render(<Single initial={base({ castVoice: { provider: 'windows', voice: 'David' } })} />)
    expect(await screen.findByText(/Saved voice:/)).toBeTruthy()
    expect(screen.getByTestId('saved').textContent).toBe('windows:David')
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByTestId('saved').textContent).toBe('none')
    expect(screen.queryByText(/Saved voice:/)).toBeNull()
  })
  it('saves the voice that is currently chosen', async () => {
    render(<Single initial={base({})} />)
    await waitFor(() => expect(calls.some((c) => c.name === 'local_voices')).toBe(true))
    const save = await screen.findByRole('button', { name: /Save as this character's voice/ })
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(save)
    expect(screen.getByTestId('saved').textContent).toMatch(/^windows:/)
  })
})
