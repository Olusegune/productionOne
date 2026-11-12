import { describe, expect, it } from 'vitest'
import { latestElevenModel, rankElevenModels, supportsAudioTags, type CloudModel } from './elevenModels'

const m = (id: string): CloudModel => ({ id, name: id, detail: '' })

describe('ElevenLabs model choice', () => {
  const account = [m('eleven_multilingual_v2'), m('eleven_flash_v2_5'), m('eleven_v3'), m('eleven_v4_turbo'), m('eleven_v4')]
  it('picks the newest quality model, not a turbo variant of it', () => {
    expect(latestElevenModel(account)).toBe('eleven_v4')
    expect(rankElevenModels(account).map((x) => x.id).slice(0, 3)).toEqual(['eleven_v4', 'eleven_v4_turbo', 'eleven_v3'])
  })
  it('follows a newer generation automatically', () => {
    expect(latestElevenModel([...account, m('eleven_v5'), m('eleven_v5_turbo')])).toBe('eleven_v5')
  })
  it('falls back when the account list is empty or unreadable', () => {
    expect(latestElevenModel([])).toBe('eleven_v4')
    expect(latestElevenModel([m('something_else')])).toBe('eleven_v4')
  })
  it('knows which generations read audio tags', () => {
    expect(supportsAudioTags('eleven_v4')).toBe(true)
    expect(supportsAudioTags('eleven_v3')).toBe(true)
    expect(supportsAudioTags('eleven_v5_turbo')).toBe(true)
    expect(supportsAudioTags('eleven_multilingual_v2')).toBe(false)
    expect(supportsAudioTags('eleven_flash_v2_5')).toBe(false)
  })
})
