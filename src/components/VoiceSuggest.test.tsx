import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VoiceAudition } from './VoiceAudition'
import type { ExtractedAsset } from '../domain/productionStudio'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => p,
  invoke: async (name: string) => (name === 'local_voices' ? [
    { name: 'Microsoft David Desktop', gender: 'Male', age: 'Adult', culture: 'en-US' },
    { name: 'Microsoft Zira Desktop', gender: 'Female', age: 'Adult', culture: 'en-US' },
  ] : []),
}))

const man: ExtractedAsset = { id: 'C1', name: 'DOMINIC', type: 'character', sceneIds: [], status: 'planned', gender: 'male' }
const woman: ExtractedAsset = { id: 'C2', name: 'MARA', type: 'character', sceneIds: [], status: 'planned', gender: 'female' }
const view = (asset: ExtractedAsset) => <VoiceAudition asset={asset} clips={[]} setClips={() => {}} desktop notify={() => {}} providersVersion={0} openProviders={() => {}} onChange={() => {}} />

describe('the Windows voice follows the character', () => {
  it('suggests a voice for each character from its gender, and does not carry the last one over', async () => {
    const { rerender } = render(view(man))
    await waitFor(() => expect((screen.getByLabelText('Windows voice') as HTMLInputElement).value).toMatch(/David/))
    rerender(view(woman))
    await waitFor(() => expect((screen.getByLabelText('Windows voice') as HTMLInputElement).value).toMatch(/Zira/))
    rerender(view(man))
    await waitFor(() => expect((screen.getByLabelText('Windows voice') as HTMLInputElement).value).toMatch(/David/))
  })
})
