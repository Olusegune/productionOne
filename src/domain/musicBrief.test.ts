import { describe, expect, it } from 'vitest'
import type { ExtractedAsset } from './productionStudio'
import type { ParsedStory } from '../engine/story'
import { musicHelperPrompt, parseMusicReply, scenesFor, scriptMusicBrief, STYLE_MAX, TITLE_MAX } from './musicBrief'

const amina = (over: Partial<ExtractedAsset> = {}): ExtractedAsset => ({ id: 'A1', name: 'AMINA', type: 'character', sceneIds: ['S1'], status: 'planned', ...over })
const story = { scenes: [
  { id: 'S1', number: 1, heading: 'EXT. DUNES - DUSK', setting: 'DUNES', intExt: 'EXT', timeOfDay: 'DUSK', action: [{ line: 2, text: 'Amina raises the compass.' }], dialogue: [], body: '', startLine: 1, endLine: 3 },
  { id: 'S2', number: 2, heading: 'INT. TENT - NIGHT', setting: 'TENT', intExt: 'INT', timeOfDay: 'NIGHT', action: [], dialogue: [], body: '', startLine: 4, endLine: 5 },
], characters: [], props: [], variants: [], warnings: [], format: 'fountain' } as unknown as ParsedStory

describe('scriptMusicBrief', () => {
  it('builds a theme from the stated personality and role only', () => {
    const b = scriptMusicBrief(amina({ personality: 'cool', role: 'navigator' }), { kind: 'theme' })
    expect(b.title).toBe('AMINA theme')
    expect(b.style).toMatch(/minimal and controlled/)
    expect(b.style).toMatch(/navigator/)
    expect(b.evidence).toContain('Personality: cool')
  })
  it('says what is missing instead of inventing a style', () => {
    const b = scriptMusicBrief(amina(), { kind: 'theme' })
    expect(b.style).toBe('')
    expect(b.missing).toContain('a personality')
  })
  it("scores a scene from where and when it is set, and adds the character's mood", () => {
    const b = scriptMusicBrief(amina({ personality: 'warm' }), { kind: 'scene', sceneId: 'S1' }, story)
    expect(b.style).toMatch(/ext, DUNES, dusk/)
    expect(b.style).toMatch(/open and inviting/)
    expect(b.title).toMatch(/Scene 1/)
  })
  it('handles an unknown scene and keeps to the limits', () => {
    expect(scriptMusicBrief(amina(), { kind: 'scene', sceneId: 'S9' }, story).missing).toContain('a scene')
    const long = scriptMusicBrief(amina({ soundDirection: 'x'.repeat(3000) }), { kind: 'theme' })
    expect(long.style.length).toBeLessThanOrEqual(STYLE_MAX)
    expect(long.title.length).toBeLessThanOrEqual(TITLE_MAX)
  })
  it('lists only the scenes the character is in', () => {
    expect(scenesFor(amina(), story).map((s) => s.id)).toEqual(['S1'])
  })
})

describe('music helper prompt and reply', () => {
  it('sends the scene heading and what happens, not the whole script', () => {
    const p = musicHelperPrompt(amina({ personality: 'cool' }), { kind: 'scene', sceneId: 'S1' }, story, 'slow build')
    expect(p).toMatch(/EXT\. DUNES - DUSK/)
    expect(p).toMatch(/raises the compass/)
    expect(p).toMatch(/slow build/)
    expect(p).not.toMatch(/TENT/)
  })
  it('reads JSON and rejects unusable replies', () => {
    expect(parseMusicReply('<think>x</think>{"title":"Dusk Walk","style":"Slow strings with soft percussion, warm and restrained."}')).toEqual({ title: 'Dusk Walk', style: 'Slow strings with soft percussion, warm and restrained.' })
    expect(parseMusicReply('just words')).toBeNull()
    expect(parseMusicReply('{"title":"x","style":"hi"}')).toBeNull()
    expect(parseMusicReply(JSON.stringify({ title: 't'.repeat(200), style: 's'.repeat(5000) }))!.style.length).toBeLessThanOrEqual(STYLE_MAX)
  })
})
