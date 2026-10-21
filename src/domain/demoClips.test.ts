import { describe, expect, it } from 'vitest'
import { buildMotionPrompt, clipName, motionPresets } from './demoClips'
import { defaultStyleBible } from './visualDevelopment'

describe('motion demo prompts', () => {
  it('always repeats the identity rule and asks for no cuts or text', () => {
    for (const motion of ['turntable', 'walk', 'idle', 'poses'] as const) {
      const p = buildMotionPrompt(motion, '', 'JONAH', defaultStyleBible)
      expect(p).toContain('JONAH')
      expect(p).toContain('stay exactly the same')
      expect(p).toContain('No text')
    }
    expect(motionPresets.turntable.prompt).toContain('360')
  })
  it('uses the writer\'s own words for a custom motion', () => {
    expect(buildMotionPrompt('custom', 'Jonah lifts the lantern.', 'JONAH', defaultStyleBible)).toContain('Jonah lifts the lantern.')
  })
  it('names files by asset and motion', () => {
    expect(clipName('CHAR-JONAH-001', 'turntable')).toBe('CHAR-JONAH-001_turntable_demo')
  })
})
