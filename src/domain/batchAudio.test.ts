import { describe, expect, it } from 'vitest'
import { billingFor, estimateMusic, estimateVoice, failureText, isStopper, MAX_PAID_ITEMS, planMusicBatch, planVoiceBatch } from './batchAudio'
import type { ExtractedAsset } from './productionStudio'
import type { ParsedStory } from '../engine/story'

const asset = (over: Partial<ExtractedAsset>): ExtractedAsset => ({ id: 'A1', name: 'MARA', type: 'character', sceneIds: ['S1'], status: 'planned', ...over } as ExtractedAsset)
const story = {
  scenes: [
    { id: 'S1', number: 1, heading: 'INT. KITCHEN - DAY', setting: 'KITCHEN', intExt: 'INT', timeOfDay: 'DAY', action: [], dialogue: [{ speaker: 'MARA', text: 'It needs more salt.', line: 4 }, { speaker: 'MARA', text: 'Taste it.', line: 6 }] },
    { id: 'S2', number: 2, heading: 'EXT. YARD - NIGHT', setting: 'YARD', intExt: 'EXT', timeOfDay: 'NIGHT', action: [], dialogue: [] },
  ],
} as unknown as ParsedStory
const assets = [
  asset({ id: 'A1', name: 'MARA', personality: 'warm' }),
  asset({ id: 'A2', name: 'TOM', sceneIds: ['S1'] }),
  asset({ id: 'A3', name: 'LANTERN', type: 'prop' }),
]

describe('batch voice plan', () => {
  it('takes the first scripted line of each ticked character, and only characters', () => {
    const items = planVoiceBatch({ assets, story, providerId: 'elevenlabs', choices: { A1: { include: true, voice: 'v-mara' }, A3: { include: true, voice: 'x' }, A2: { include: false, voice: 'v-tom' } } })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ assetId: 'A1', line: 'It needs more salt.', voice: 'v-mara', characters: 19 })
    expect(items[0].skip).toBeUndefined()
  })
  it('skips, with a reason, a character with no line or no voice instead of guessing', () => {
    const items = planVoiceBatch({ assets, story, providerId: 'elevenlabs', choices: { A1: { include: true, voice: '' }, A2: { include: true, voice: 'v-tom' } } })
    expect(items.find((i) => i.assetId === 'A1')?.skip).toMatch(/No voice chosen/)
    expect(items.find((i) => i.assetId === 'A2')?.skip).toMatch(/no dialogue/)
  })
  it('lets a typed line override the script, and a local server may use its default voice', () => {
    const items = planVoiceBatch({ assets, story, providerId: 'chatterbox', choices: { A2: { include: true, voice: '', line: '  Hello there.  ' } } })
    expect(items[0]).toMatchObject({ line: 'Hello there.', voice: '', characters: 12 })
    expect(items[0].skip).toBeUndefined()
  })
})

describe('batch music plan', () => {
  it('builds a theme from the personality and a scene score from the heading, and skips what is not stated', () => {
    const items = planMusicBatch({ assets, story, targets: [{ kind: 'theme', assetId: 'A1' }, { kind: 'theme', assetId: 'A2' }, { kind: 'scene', sceneId: 'S1' }, { kind: 'scene', sceneId: 'S2' }] })
    expect(items.map((i) => i.id)).toEqual(['MB-theme-A1', 'MB-theme-A2', 'MB-scene-S1', 'MB-scene-S2'])
    expect(items[0].style).toMatch(/warm/)
    expect(items[1].skip).toMatch(/Not enough stated/)
    expect(items[2]).toMatchObject({ assetName: 'MARA', label: 'Score for scene 1: KITCHEN', fileTag: 'scene-1' })
    expect(items[0].fileTag).toBe('theme')
    expect(items[2].style).toMatch(/kitchen/i)
    expect(items[3].skip).toMatch(/No character is placed/)
  })
})

describe('cost estimate', () => {
  const run = planVoiceBatch({ assets, story, providerId: 'elevenlabs', choices: { A1: { include: true, voice: 'v' }, A2: { include: true, voice: 'v', line: 'x'.repeat(981) } } })
  it('counts characters for a cloud voice and shows dollars only from the person\'s own price', () => {
    const none = estimateVoice(run, 'elevenlabs', {})
    expect(none).toMatchObject({ count: 2, units: 1000, billing: 'characters', usd: null })
    expect(none.summary).toMatch(/does not know the price/)
    const priced = estimateVoice(run, 'elevenlabs', { perThousandCharacters: 0.3 })
    expect(priced.usd).toBeCloseTo(0.3)
    expect(priced.summary).toMatch(/about \$0\.300/)
  })
  it('says a Windows or local-server batch is free and never shows dollars', () => {
    const e = estimateVoice(run, 'windows', { perThousandCharacters: 5 })
    expect(e).toMatchObject({ billing: 'free', usd: null, overCap: false })
    expect(e.summary).toMatch(/spends no credits/)
    expect(billingFor('chatterbox')).toBe('free')
    expect(billingFor('voicekiller')).toBe('characters')
    expect(billingFor('suno')).toBe('requests')
  })
  it('does not count skipped items, and says when there is nothing to make', () => {
    const e = estimateVoice(planVoiceBatch({ assets, story, providerId: 'elevenlabs', choices: { A2: { include: true, voice: 'v' } } }), 'elevenlabs', {})
    expect(e).toMatchObject({ count: 0, skipped: 1, units: 0 })
    expect(e.summary).toBe('Nothing to make yet.')
  })
  it('counts music requests, two tracks each, and flags a paid batch over the cap', () => {
    const items = planMusicBatch({ assets, story, targets: [{ kind: 'theme', assetId: 'A1' }, { kind: 'scene', sceneId: 'S1' }] })
    const e = estimateMusic(items, { perMusicRequest: 0.1 })
    expect(e).toMatchObject({ count: 2, units: 2, usd: expect.closeTo(0.2) })
    expect(e.summary).toMatch(/about 4 tracks/)
    const many = Array.from({ length: MAX_PAID_ITEMS + 1 }, (_, i) => ({ id: `m${i}`, assetId: 'A1', assetName: 'MARA', label: 'x', fileTag: 'theme', title: 't', style: 's' }))
    expect(estimateMusic(many, {}).overCap).toBe(true)
    expect(estimateMusic(many.slice(0, MAX_PAID_ITEMS), {}).overCap).toBe(false)
  })
})

describe('failures', () => {
  it('stops the batch on key and credit problems but carries on after an ordinary failure', () => {
    expect(isStopper(new Error('ElevenLabs returned 401 Unauthorized'))).toBe(true)
    expect(isStopper('No elevenlabs key is saved')).toBe(true)
    expect(isStopper('Insufficient credits')).toBe(true)
    expect(isStopper(new Error('The voice server timed out'))).toBe(false)
  })
  it('shortens long provider text', () => {
    expect(failureText(new Error('x'.repeat(400))).length).toBe(160)
    expect(failureText('  a   b ')).toBe('a b')
  })
})
