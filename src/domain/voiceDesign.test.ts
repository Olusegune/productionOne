import { describe, expect, it } from 'vitest'
import type { ExtractedAsset } from './productionStudio'
import type { ParsedStory } from '../engine/story'
import { helperPrompt, parseHelperReply, scriptVoiceBrief, DESCRIPTION_MAX, SAMPLE_MIN } from './voiceDesign'

const asset = (over: Partial<ExtractedAsset> = {}): ExtractedAsset => ({ id: 'A1', name: 'AMINA', type: 'character', sceneIds: [], status: 'planned', ...over })
const story = (texts: string[]) => ({ scenes: [{ dialogue: texts.map((text, i) => ({ speaker: 'Amina', text, line: i + 1 })) }], characters: [] }) as unknown as ParsedStory

describe('scriptVoiceBrief', () => {
  it('builds a description from stated fields only', () => {
    const b = scriptVoiceBrief(asset({ age: '42', gender: 'woman', personality: 'cool', role: 'navigator' }))
    expect(b.description).toMatch(/42-year-old woman/)
    expect(b.description).toMatch(/navigator/)
    expect(b.description).toMatch(/unhurried/)
    expect(b.missing).toContain('dialogue in the script')
  })
  it('leaves the description empty rather than guessing when nothing is stated', () => {
    const b = scriptVoiceBrief(asset())
    expect(b.description).toBe('')
    expect(b.missing).toEqual(expect.arrayContaining(['age and gender', 'a personality']))
  })
  it("uses the character's own lines as the sample and tops up short ones", () => {
    const long = 'We are close, and I will not turn back now that the compass has finally started to glow in my hands. '.repeat(2)
    expect(scriptVoiceBrief(asset({ age: '30', gender: 'man' }), story([long])).sample.startsWith('We are close')).toBe(true)
    const short = scriptVoiceBrief(asset({ age: '30', gender: 'man' }), story(['We are close.']))
    expect(short.sample.length).toBeGreaterThanOrEqual(SAMPLE_MIN)
    expect(short.sample.startsWith('We are close.')).toBe(true)
  })
  it("adds the person's own idea", () => {
    expect(scriptVoiceBrief(asset({ gender: 'woman' }), undefined, 'Lagos accent, weathered').description).toMatch(/Lagos accent/)
  })
  it('never exceeds the engine limits', () => {
    expect(scriptVoiceBrief(asset({ gender: 'woman', soundDirection: 'x'.repeat(2000) })).description.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })
})

describe('helper prompt and reply', () => {
  it('sends only confirmed facts and her lines', () => {
    const p = helperPrompt(asset({ age: '42' }), ['We are close.'], 'dry humour')
    expect(p).toMatch(/age: 42/)
    expect(p).toMatch(/dry humour/)
    expect(p).toMatch(/We are close/)
    expect(p).not.toMatch(/gender/)
  })
  it('reads JSON, text and reasoning-wrapped replies', () => {
    const d = 'A woman in her forties with a low, weathered voice and an unhurried pace.'
    expect(parseHelperReply(JSON.stringify({ description: d }))).toBe(d)
    expect(parseHelperReply(`<think>hm</think>${d}`)).toBe(d)
    expect(parseHelperReply('{"description": "short"}')).toBe('')
    expect(parseHelperReply('x'.repeat(3000)).length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })
})
