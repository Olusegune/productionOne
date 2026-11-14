import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VoiceBriefTools } from './VoiceBriefTools'
import type { ExtractedAsset } from '../domain/productionStudio'

const calls: Array<{ name: string; args: Record<string, unknown> }> = []
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => p,
  invoke: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    if (name === 'local_config_get') return { textProvider: 'ollama', textModel: 'qwen3:8b' }
    if (name === 'local_detect') return { ollama: { url: '', up: true, version: '', models: [] }, lmstudio: { url: '', up: false, version: '', models: [] }, comfyui: [], hardware: { gpu: '', vramGb: 0, vramFreeGb: 0, ramGb: 0 } }
    if (name === 'local_llm') return '{"description": "A woman in her forties with a low, weathered voice and an unhurried pace."}'
    return null
  },
}))

const amina: ExtractedAsset = { id: 'C1', name: 'AMINA', type: 'character', sceneIds: [], status: 'planned', age: '42', gender: 'woman', personality: 'cool' }
const setup = () => {
  const onBrief = vi.fn(); const setError = vi.fn(); const notify = vi.fn()
  render(<VoiceBriefTools asset={amina} desktop onBrief={onBrief} setError={setError} notify={notify} />)
  return { onBrief, setError, notify }
}

describe('voice brief tools', () => {
  it('fills the description from the confirmed fields and says where it came from', () => {
    const { onBrief } = setup()
    fireEvent.click(screen.getByText(/Fill from the script/))
    expect(onBrief).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/42-year-old woman/) }))
    expect(screen.getByText(/Built from: Stated: 42-year-old woman/)).toBeTruthy()
  })
  it('asks the local model only with her facts and reports an unusable reply', async () => {
    const { onBrief } = setup()
    fireEvent.change(screen.getByPlaceholderText(/weathered/), { target: { value: 'dry humour' } })
    fireEvent.click(screen.getByText(/Ask the AI helper/))
    await waitFor(() => expect(onBrief).toHaveBeenCalled())
    expect(onBrief.mock.calls[0][0].description).toMatch(/weathered/)
    const sent = calls.find((c) => c.name === 'local_llm')
    expect(String(sent?.args.prompt)).toMatch(/dry humour/)
    expect(String(sent?.args.prompt)).not.toMatch(/race|ethnicity/)
  })
})
