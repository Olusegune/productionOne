import { describe, expect, it } from 'vitest'
import { applyAi, beatPrompt, extractJson, parseBeats } from './aiBeats'
import { characterArcs } from './emotion'
import { sampleStory } from './sampleStory'
import { parseStory } from './story'

const story = parseStory(sampleStory)
const scene = story.scenes[0]
const names = ['AMINA', 'MARCUS']

describe('AI beats: trusted only when the evidence is real', () => {
  it('puts the scene, the allowed names and the exact reply shape in the prompt', () => {
    const p = beatPrompt(scene, names)
    expect(p).toContain('EXT. SAVANNA - DUSK')
    expect(p).toContain('AMINA, MARCUS')
    expect(p).toContain('copied word for word')
    expect(p).toContain('neutral|joy')
  })
  it('reads a clean reply and keeps only beats whose quote is in the scene', () => {
    const reply = JSON.stringify({
      scene_mood: { emotion: 'determination', intensity: 6 },
      beats: [
        { character: 'Marcus', emotion: 'fear', intensity: 8, nuance: 'pain', quote: "I can't feel my leg", subtext: 'He needs help but will not ask.', tell: 'Grips his arm' },
        { character: 'AMINA', emotion: 'joy', intensity: 9, quote: 'She sings with delight' },
        { character: 'ELENA', emotion: 'sadness', intensity: 5, quote: 'We are close.' },
        { character: 'AMINA', emotion: 'sparkly', intensity: 5, quote: 'We are close.' },
      ],
    })
    const r = parseBeats(reply, scene, names, 'gemma3:12b')
    expect(r.beats.map((b) => b.character)).toEqual(['MARCUS'])
    expect(r.dropped).toBe(3)
    expect(r.beats[0]).toMatchObject({ emotion: 'fear', intensity: 8, nuance: 'pain' })
    expect(r.mood).toEqual({ emotion: 'determination', intensity: 6 })
    expect(r.model).toBe('gemma3:12b')
  })
  it('accepts common feeling words and clamps strength, and survives chatter around the JSON', () => {
    const reply = 'Sure! ```json\n{"beats":[{"character":"AMINA","emotion":"Resolute","intensity":14,"quote":"We are not stopping."}]}\n``` Hope this helps.'
    const r = parseBeats(reply, scene, names, 'm')
    expect(r.beats[0]).toMatchObject({ character: 'AMINA', emotion: 'determination', intensity: 10 })
  })
  it('returns nothing, without throwing, for a reply that is not JSON', () => {
    for (const bad of ['', 'I cannot help with that.', '{"beats": "no"}', '{broken']) {
      expect(parseBeats(bad, scene, names, 'm').beats).toEqual([])
    }
    expect(extractJson('no braces')).toBeNull()
  })
  it('feeds the arcs: an AI beat replaces the rule reading for that scene and is marked as AI', () => {
    const reply = JSON.stringify({ beats: [{ character: 'AMINA', emotion: 'love', intensity: 7, nuance: 'tenderness', quote: 'Then I carry you.', subtext: 'She would give up her journey for him.' }] })
    const withAi = applyAi(story, [parseBeats(reply, scene, names, 'm')])
    const before = characterArcs(story).find((a) => a.character === 'AMINA')!.points[0].reading
    const after = characterArcs(withAi).find((a) => a.character === 'AMINA')!.points[0]
    expect(before.source).toBe('rules')
    expect(after.reading).toMatchObject({ emotion: 'love', intensity: 7, source: 'ai', nuance: 'tenderness' })
    expect(after.evidence[0].text).toBe('Then I carry you.')
    // scenes the AI has not read keep the rule reading
    expect(characterArcs(withAi).find((a) => a.character === 'AMINA')!.points.at(-1)!.reading.source).toBe('rules')
  })
})
