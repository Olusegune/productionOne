import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MusicMaker } from './MusicMaker'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { ParsedStory } from '../engine/story'

const calls: Array<{ name: string; args: Record<string, unknown> }> = []
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => p,
  invoke: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    if (name === 'credential_status') return true
    if (name === 'local_config_get') return { textProvider: 'ollama', textModel: 'qwen3:8b' }
    if (name === 'local_detect') return { ollama: { url: '', up: true, version: '', models: [] }, lmstudio: { url: '', up: false, version: '', models: [] }, comfyui: [], hardware: { gpu: '', vramGb: 0, vramFreeGb: 0, ramGb: 0 } }
    if (name === 'local_llm') return '{"title":"Dusk Walk","style":"Slow strings with soft percussion, warm and restrained."}'
    if (name === 'make_music') return [{ path: 'C:\\a\\one.mp3', title: 'One', duration: 61.4 }, { path: 'C:\\a\\two.mp3', title: 'Two', duration: 60 }]
    return null
  },
}))

const amina: ExtractedAsset = { id: 'C1', name: 'AMINA', type: 'character', sceneIds: ['S1'], status: 'planned', personality: 'cool' }
const story = { scenes: [{ id: 'S1', number: 1, heading: 'EXT. DUNES - DUSK', setting: 'DUNES', intExt: 'EXT', timeOfDay: 'DUSK', action: [], dialogue: [], body: '', startLine: 1, endLine: 2 }], characters: [], props: [], variants: [], warnings: [], format: 'fountain' } as unknown as ParsedStory

const setup = () => {
  const onClip = vi.fn(); const setError = vi.fn(); const notify = vi.fn()
  const { container } = render(<MusicMaker asset={amina} story={story} desktop providersVersion={0} openProviders={() => {}} onClip={onClip} notify={notify} setError={setError} />)
  ;(container.querySelector('details') as HTMLDetailsElement).open = true
  return { onClip, setError }
}

describe('Suno music maker', () => {
  it('fills a title and style from the script, then makes music and saves both tracks', async () => {
    const { onClip } = setup()
    fireEvent.click(screen.getByText(/Fill from the script/))
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('AMINA theme')
    expect((screen.getByLabelText(/^Style/) as HTMLTextAreaElement).value).toMatch(/minimal and controlled/)
    const button = screen.getByText('Make music') as HTMLButtonElement
    await waitFor(() => expect(button.disabled).toBe(false))
    fireEvent.click(button)
    await waitFor(() => expect(onClip).toHaveBeenCalledTimes(2))
    const sent = calls.find((c) => c.name === 'make_music')?.args.request as Record<string, unknown>
    expect(sent).toMatchObject({ instrumental: true, model: 'V6_MINI', durationSeconds: 45, title: 'AMINA theme' })
    expect(onClip.mock.calls[0][0]).toMatchObject({ path: 'C:\\a\\one.mp3', duration: 61 })
  })
  it('will not make music with no style, and lists the scenes the character is in', () => {
    setup()
    expect((screen.getByText('Make music') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Scene 1: EXT. DUNES - DUSK/)).toBeTruthy()
  })
  it('lets the local helper write the style', async () => {
    setup()
    fireEvent.click(screen.getByText(/Ask the AI helper/))
    await waitFor(() => expect((screen.getByLabelText(/^Style/) as HTMLTextAreaElement).value).toMatch(/Slow strings/))
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('Dusk Walk')
  })
})
