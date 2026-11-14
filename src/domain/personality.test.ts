import { describe, expect, it } from 'vitest'
import { carriageLine, isPersonality, personalities, rangeTags } from './personality'
import { castingLine } from './voiceAudition'

describe('personality', () => {
  it('knows its five types and rejects anything else', () => {
    expect(personalities.map((p) => p.value)).toEqual(['timid', 'cool', 'bratty', 'aggressive', 'warm'])
    expect(isPersonality('cool')).toBe(true)
    expect(isPersonality('chaotic')).toBe(false)
    expect(isPersonality(undefined)).toBe(false)
  })
  it('gives every personality seven different, non-empty tags in the same order', () => {
    const neutral = Object.keys(rangeTags())
    expect(neutral).toHaveLength(7)
    for (const p of personalities) {
      const tags = rangeTags(p.value)
      expect(Object.keys(tags)).toEqual(neutral)
      expect(Object.values(tags).every((t) => t.trim().length > 0 && !/[\[\]]/.test(t))).toBe(true)
      expect(tags).not.toEqual(rangeTags())
    }
  })
  it('falls back to the neutral tags for an unknown or empty personality', () => {
    expect(rangeTags('nonsense')).toEqual(rangeTags())
    expect(rangeTags('')).toEqual(rangeTags())
  })
  it('describes carriage only when a personality is set', () => {
    expect(carriageLine()).toBe('')
    expect(carriageLine('cool')).toMatch(/^Carriage and expression: slow, minimal/)
  })
})

describe('casting lines shaped by personality and language', () => {
  it('shapes the tags of the emotional-range line, keeping the words', () => {
    const cool = castingLine('range', true, 'cool')
    expect(cool).toMatch(/^\[cool, measured\] Is that really what you think\?/)
    expect(cool).toMatch(/\[cold disbelief, still controlled\] Get back here right now!/)
    expect(castingLine('range', true, 'bratty')).toMatch(/\[teasing, sing-song\]/)
    expect(castingLine('range', false, 'cool')).toBe(castingLine('range', false, 'warm'))
  })
  it('offers Spanish, French and German letter pangrams, and no tags in them', () => {
    expect(castingLine('pangram-es', true)).toMatch(/murciélago/)
    expect(castingLine('pangram-fr', true)).toMatch(/vieux whisky/)
    expect(castingLine('pangram-de', true)).toMatch(/Zwölf Boxkämpfer/)
    for (const k of ['pangram-es', 'pangram-fr', 'pangram-de'] as const) expect(castingLine(k, true)).not.toMatch(/\[/)
  })
  it('really does use every letter in each letter pangram', () => {
    const letters = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''))
    for (const k of ['pangram-es', 'pangram-fr', 'pangram-de'] as const) expect(letters(castingLine(k, false)).size, k).toBe(26)
  })
})
