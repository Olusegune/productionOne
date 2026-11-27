import { describe, expect, it } from 'vitest'
import type { ExtractedAsset } from './productionStudio'
import { defaultStyleBible } from './visualDevelopment'
import { closeUpReframeLine } from './sheetSpecs'
import { facingAwaySideLine, facingCameraSideLine, mentionsSide, sideLineFor } from './sides'
import { agePrompt, ageViews } from './age'
import { transformationPrompt, transformationViews } from './transformation'

const kael: ExtractedAsset = { id: 'CHAR-KAEL', name: 'KAEL', type: 'character', sceneIds: [], status: 'approved', age: '40' }
const full = ageViews.find((v) => v.key === 'full-front')!
const portrait = ageViews.find((v) => v.key === 'portrait')!
const tfull = transformationViews.find((v) => v.key === 'full-front')!
const tportrait = transformationViews.find((v) => v.key === 'portrait')!

describe('left and right in a prompt', () => {
  it('notices when text names a side', () => {
    expect(mentionsSide('the left arm longer')).toBe(true)
    expect(mentionsSide('a scar through the RIGHT eyebrow')).toBe(true)
    expect(mentionsSide('broader shoulders', undefined, '')).toBe(false)
    expect(mentionsSide('copyright', 'upright posture')).toBe(false)
  })

  it('says the character’s left is on the right of the picture when they face the camera, and the opposite from behind', () => {
    expect(sideLineFor('full-front', 'the left arm')).toBe(facingCameraSideLine)
    expect(sideLineFor('portrait', 'the left eye')).toBe(facingCameraSideLine)
    expect(sideLineFor('rear', 'the left arm')).toBe(facingAwaySideLine)
    expect(facingCameraSideLine).toMatch(/their left side is on the RIGHT of the picture/)
    expect(facingAwaySideLine).toMatch(/their left side is on the LEFT of the picture/)
    expect(sideLineFor('full-front', 'broader shoulders')).toBe('')
  })
})

describe('transformation prompts say which side is meant', () => {
  const spec = { characterId: 'CHAR-KAEL', kind: 'infected', stage: 'Partial', intensity: 3, details: { anatomy: 'the left arm longer and thinner', differences: 'the left hand changes' } }
  it('adds the rule, in the full-body and the portrait view, when the change names a side', () => {
    for (const view of [tfull, tportrait]) {
      const p = transformationPrompt({ style: defaultStyleBible, character: kael, spec, view, source: 'base' })
      expect(p).toMatch(/Left and right here always mean the character’s own left and right/)
      expect(p).toMatch(/their left side is on the RIGHT of the picture/)
    }
  })
  it('does not add it when no side is named', () => {
    const p = transformationPrompt({ style: defaultStyleBible, character: kael, spec: { ...spec, details: { anatomy: 'broader and taller' } }, view: tfull, source: 'base' })
    expect(p).not.toMatch(/Left and right here/)
  })
  it('a side named only in what must stay recognisable also triggers it', () => {
    const p = transformationPrompt({ style: defaultStyleBible, character: kael, spec: { ...spec, details: { anatomy: 'taller' }, anchors: ['the scar through the left eyebrow'] }, view: tportrait, source: 'base' })
    expect(p).toMatch(/Left and right here/)
  })
})

describe('the portrait is a close-up even though the reference is full body', () => {
  const t = { characterId: 'CHAR-KAEL', kind: 'infected', stage: 'Partial', intensity: 3, details: { anatomy: 'taller' } }
  it('transformation: only the non-full-body view gets the close-up line', () => {
    expect(transformationPrompt({ style: defaultStyleBible, character: kael, spec: t, view: tportrait, source: 'base' })).toContain(closeUpReframeLine)
    expect(transformationPrompt({ style: defaultStyleBible, character: kael, spec: t, view: tfull, source: 'base' })).not.toContain(closeUpReframeLine)
  })
  it('age: only the non-full-body view gets the close-up line', () => {
    const a = { characterId: 'CHAR-KAEL', mode: 'same-person' as const, targetAge: '65' }
    expect(agePrompt({ style: defaultStyleBible, character: kael, spec: a, view: portrait })).toContain(closeUpReframeLine)
    expect(agePrompt({ style: defaultStyleBible, character: kael, spec: a, view: full })).not.toContain(closeUpReframeLine)
  })
  it('age: a side named in an anchor or an adjustment adds the rule', () => {
    const a = { characterId: 'CHAR-KAEL', mode: 'same-person' as const, targetAge: '65', anchors: ['the scar through the left eyebrow'] }
    expect(agePrompt({ style: defaultStyleBible, character: kael, spec: a, view: full })).toMatch(/their left side is on the RIGHT of the picture/)
    expect(agePrompt({ style: defaultStyleBible, character: kael, spec: { ...a, anchors: ['the strong jaw'] }, view: full })).not.toMatch(/Left and right here/)
  })
})
