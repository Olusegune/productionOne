import { describe, expect, it } from 'vitest'
import { ensureGuide } from './proportionGuide'
import { createProfile } from '../domain/proportions'

describe('making the guide', () => {
  it('gives up quietly outside the desktop app, and for a character without proportions', async () => {
    expect(await ensureGuide(createProfile('a'))).toBeNull()
    expect(await ensureGuide(undefined)).toBeNull()
  })
})
