import { describe, expect, it } from 'vitest'
import { artifactGuidance, isStylised, wantsWarmLook } from './cleanGuidance'
import { defaultStyleBible } from './visualDevelopment'

describe('artifact guidance', () => {
  it('asks a realistic project for natural skin and neutral colour, and tailors the colour line for OpenAI models', () => {
    const g = artifactGuidance(defaultStyleBible, 'gpt-image-1.5')
    expect(g).toMatch(/pores/)
    expect(g).toMatch(/no yellow, sepia or golden tint/)
    expect(artifactGuidance(defaultStyleBible, 'gemini-nano-banana-2.1')).not.toMatch(/sepia/)
  })
  it('never forces photographic texture onto a stylised project', () => {
    const anime = { ...defaultStyleBible, name: 'Soft anime', description: 'Hand-drawn cel shading', rendering: 'flat colour' }
    expect(isStylised(anime)).toBe(true)
    const g = artifactGuidance(anime, 'gpt-image-1')
    expect(g).toMatch(/do not add photographic skin/)
    expect(g).not.toMatch(/pores, not smoothed/)
  })
  it('keeps an intentionally warm look warm', () => {
    const warm = { ...defaultStyleBible, lighting: 'Golden hour, warm amber light' }
    expect(wantsWarmLook(warm)).toBe(true)
    expect(artifactGuidance(warm, 'gpt-image-1')).not.toMatch(/white balance/)
    expect(artifactGuidance(defaultStyleBible, '', 'candlelit room')).not.toMatch(/white balance/)
  })
})
