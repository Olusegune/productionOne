import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ageFromWords, parseStory } from './story'

const renewal = () => parseStory(readFileSync('samples/the-renewal.fountain', 'utf8').replace(/\r/g, ''))

describe('THE RENEWAL (the Bureau of Infernal Affairs sample)', () => {
  it('reads eight scenes and the three characters who speak, with the scenes each is in', () => {
    const s = renewal()
    expect(s.scenes).toHaveLength(8)
    expect(s.characters.map((c) => c.name).sort()).toEqual(['AURUM', 'KID LANTERN', 'VENOMSPUR'])
    expect(s.characters.find((c) => c.name === 'VENOMSPUR')?.sceneIds).toContain('SCENE-001')
    expect(s.characters.find((c) => c.name === 'AURUM')?.dialogueCount).toBeGreaterThanOrEqual(5)
  })
  it('finds the props the story depends on, with their condition, and no junk phrases', () => {
    const props = renewal().props
    const named = (word: string) => props.find((p) => p.name.endsWith(word))
    expect(named('stamp')).toMatchObject({ condition: 'chipped' })
    expect(named('umbrella')).toBeTruthy()
    expect(named('folio')?.name).toBe('leather folio')
    expect(named('microphone')?.name).toBe('microphone')
    expect(props.some((p) => /out of habit|single/.test(p.name))).toBe(false)
  })
  it('reads wardrobe looks, including plain clothes, and the written-out age', () => {
    const s = renewal()
    const looks = (who: string) => s.variants.filter((v) => v.character === who && v.kind === 'wardrobe').map((v) => v.value)
    expect(looks('AURUM')).toEqual(expect.arrayContaining(['Red Puffer Jacket', 'Plain Clothes']))
    expect(looks('VENOMSPUR')).toContain('Rain-Soaked Black Coat')
    expect(s.variants.find((v) => v.character === 'KID LANTERN' && v.kind === 'age')?.value).toBe('Age 19')
  })
})

describe('ages written as words', () => {
  it('reads nineteen and twenty-three, and nothing else', () => {
    expect(ageFromWords('nineteen')).toBe(19)
    expect(ageFromWords('Twenty-three')).toBe(23)
    expect(ageFromWords('sixty')).toBe(60)
    expect(ageFromWords('thin')).toBeUndefined()
    expect(ageFromWords('twenty ten')).toBeUndefined()
  })
  it('does not turn an ordinary appositive into an age', () => {
    const s = parseStory('INT. ROOM - DAY\n\nMARA, tall, enters.\n\nMARA\nHello.\n')
    expect(s.variants.some((v) => v.kind === 'age')).toBe(false)
  })
})

describe('objects without a verb', () => {
  const story = (action: string) => parseStory(`INT. ROOM - DAY\n\n${action}\n\nTOM\nHi.\n`)
  it('finds an object by name and notes damage from the next sentence', () => {
    const s = story('Tom stamps a form with a brass stamp. The stamp is chipped on one corner.')
    expect(s.props.find((p) => p.name === 'brass stamp')).toMatchObject({ condition: 'chipped' })
  })
  it('does not invent props from common phrases', () => {
    const s = story('Tom smiles with a warm look. He walks into the room.')
    expect(s.props).toEqual([])
  })
  it('keeps a held prop once, with its longer name', () => {
    const s = story('Tom holds a silver pen. The pen is cracked.')
    expect(s.props.filter((p) => p.name.endsWith('pen'))).toHaveLength(1)
    expect(s.props[0]).toMatchObject({ name: 'silver pen', condition: 'cracked' })
  })
})
