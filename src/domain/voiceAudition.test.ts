import { describe, expect, it } from 'vitest'
import { parseStory } from '../engine/story'
import { sampleLines, soundBrief, suggestVoice, voiceBrief } from './voiceAudition'
import { motionKeysFor, presetFor, buildMotionPrompt } from './demoClips'
import type { ExtractedAsset } from './productionStudio'

const asset = (p: Partial<ExtractedAsset>): ExtractedAsset => ({ id: 'A', name: 'MARA', type: 'character', sceneIds: [], status: 'planned', ...p })
const style = { name: 'Painterly', rendering: 'soft light' } as never
describe('voice and motion auditions', () => {
  it('pulls only real dialogue for the character', () => {
    const story = parseStory('INT. KITCHEN - DAY\n\nMARA\nDinner is ready.\n\nDEV\nI know.\n')
    expect(sampleLines(story, 'Mara').map((l) => l.text)).toEqual(['Dinner is ready.'])
    expect(sampleLines(undefined, 'MARA')).toEqual([])
  })
  const voices = [{ name: 'David', gender: 'Male', age: 'Adult', culture: 'en-US' }, { name: 'Zira', gender: 'Female', age: 'Adult', culture: 'en-US' }]
  it('matches stated gender and does not guess when unknown', () => {
    expect(suggestVoice(voices, { gender: 'woman', age: '34' })?.name).toBe('Zira')
    expect(suggestVoice(voices, {})?.name).toBe('David')
    expect(suggestVoice([], {})).toBeUndefined()
  })
  it('builds briefs from confirmed fields', () => {
    expect(voiceBrief(asset({ age: '34', gender: 'female' }), 'Hello')).toContain('age 34, female')
    expect(voiceBrief(asset({}))).toContain('not set')
    expect(soundBrief(asset({ name: 'Red Car', type: 'prop' }))).toContain('engine')
    expect(soundBrief(asset({ name: 'Lantern', type: 'prop' }))).toContain('handling')
  })
  it('offers sensible motions per asset type', () => {
    expect(motionKeysFor('character')).toContain('speak')
    expect(motionKeysFor('prop', 'Red Car')).toContain('drive')
    expect(motionKeysFor('prop', 'Red Car')).not.toContain('walk')
    expect(motionKeysFor('prop', 'Lantern')).toContain('handle')
  })
  it('every preset keeps the identity rule', () => {
    for (const k of ['speak', 'drive', 'walk'] as const) expect(buildMotionPrompt(k, '', 'X', style)).toMatch(/stay exactly the same/)
    expect(presetFor('drive').label).toBe('Drive past')
  })
})

import { buildViewPrompt, identityFacts, aspectRatios } from './sheetSpecs'
describe('identity runs through every output', () => {
  const view = { key: 'front', label: 'Front', instruction: 'Full body front.', fullBody: true, aspect: '3:4' }
  const base = { style: style, variant: 'Canonical', sheetType: 'Turnaround' as const, view }
  it('puts confirmed identity fields in the image prompt', () => {
    const p = buildViewPrompt({ ...base, asset: { id: 'A', name: 'MARA', type: 'character', age: '34', gender: 'female', ethnicity: 'Yoruba' } })
    expect(p).toContain('age 34, female, Yoruba')
  })
  it('adds nothing when unknown and nothing for props', () => {
    expect(identityFacts({ type: 'character' })).toBe('')
    expect(identityFacts({ type: 'prop', age: '5' })).toBe('')
  })
  it('puts identity in the motion prompt too', () => {
    expect(buildMotionPrompt('speak', '', 'MARA', style, identityFacts({ type: 'character', age: '34' }))).toContain('age 34')
  })
  it('still offers cinema aspect ratios', () => { expect(aspectRatios).toContain('21:9'); expect(aspectRatios).toContain('2.39:1') })
})
