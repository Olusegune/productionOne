import { describe, expect, it } from 'vitest'
import { videoPresets } from './productionStudio'
import { demoVideoModels } from './imageCatalog'

describe('video models', () => {
  const names = Object.keys(videoPresets)
  it('offers more than Kling and Seedance: the newest Seedance, Kling 4.0, Wan 3.0, HappyHorse, MiniMax H3, PixVerse and Grok Imagine', () => {
    for (const n of ['Seedance 2.5', 'Kling 4.0', 'Wan 3.0', 'HappyHorse 1.1', 'MiniMax H3', 'PixVerse V6', 'Grok Imagine 1.5', 'Seedance 2.0', 'Kling 3.0', 'Hailuo 2.3']) expect(names).toContain(n)
  })
  it('every preset names its model, its provider and a documentation page, and no unverified model claims to be verified', () => {
    for (const n of names) {
      const p = videoPresets[n as keyof typeof videoPresets]
      expect(p.model).toBe(n)
      expect(p.apiModel.length).toBeGreaterThan(2)
      expect(p.documentationUrl).toMatch(/^https:\/\//)
      expect(p.aspectRatios.length).toBeGreaterThan(0)
    }
    for (const n of ['Seedance 2.5', 'Kling 4.0', 'Wan 3.0', 'HappyHorse 1.1', 'MiniMax H3', 'PixVerse V6', 'Grok Imagine 1.5']) expect(videoPresets[n as keyof typeof videoPresets].verified).toBe(false)
  })
  it('the motion demo list has no duplicate ids and every Kie id looks like vendor/model', () => {
    const ids = demoVideoModels.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9.-]+\/[a-z0-9.-]+$/)
  })
})
