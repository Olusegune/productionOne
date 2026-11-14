import { beforeEach, describe, expect, it } from 'vitest'
import { cachedVoices, forgetVoices, rememberVoices } from './voiceCache'

describe('voice list cache', () => {
  beforeEach(() => forgetVoices())
  it('returns nothing until a list is loaded', () => expect(cachedVoices('elevenlabs')).toEqual([]))
  it('keeps a list per provider', () => {
    rememberVoices('elevenlabs', [{ id: 'a' }])
    rememberVoices('voicekiller', [{ id: 'b' }, { id: 'c' }])
    expect(cachedVoices('elevenlabs')).toHaveLength(1)
    expect(cachedVoices('voicekiller')).toHaveLength(2)
  })
  it('can forget one provider or all', () => {
    rememberVoices('elevenlabs', [{ id: 'a' }])
    rememberVoices('voicekiller', [{ id: 'b' }])
    forgetVoices('elevenlabs')
    expect(cachedVoices('elevenlabs')).toEqual([])
    expect(cachedVoices('voicekiller')).toHaveLength(1)
    forgetVoices()
    expect(cachedVoices('voicekiller')).toEqual([])
  })
})
