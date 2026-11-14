import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VoiceAudition } from './VoiceAudition'
import type { ExtractedAsset } from '../domain/productionStudio'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (p: string) => p, invoke: async () => [] }))

const asset: ExtractedAsset = { id: 'C1', name: 'MARA', type: 'character', sceneIds: [], status: 'planned' }
const setup = () => render(<VoiceAudition asset={asset} clips={[]} setClips={() => {}} desktop={false} notify={() => {}} providersVersion={0} openProviders={() => {}} onChange={() => {}} />)

describe('casting line picker', () => {
  it('fills the line box with the pangram, tag-free', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Casting line'), { target: { value: 'pangram' } })
    expect((screen.getByPlaceholderText('Type a line to hear') as HTMLInputElement).value).toMatch(/beige hue on the waters/)
  })
  it('gives the emotional-range line without tags on a voice engine that would read them aloud', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Casting line'), { target: { value: 'range' } })
    const value = (screen.getByPlaceholderText('Type a line to hear') as HTMLInputElement).value
    expect(value).toMatch(/Is that really what you think\?/)
    expect(value).not.toMatch(/\[/)
  })
})
