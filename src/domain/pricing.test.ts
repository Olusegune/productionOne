import { describe, expect, it } from 'vitest'
import { costShort, costText, priceFor } from './pricing'

describe('price before every Generate', () => {
  it('your own price wins and is labelled yours', () => {
    const p = priceFor('kie', 'google/nanobanana-2-1', 0.05)
    expect(p).toEqual({ usd: 0.05, source: 'yours' })
    expect(costText(3, p)).toBe('3 pictures · about $0.15 at your price of $0.05 each')
  })
  it('without one, a typical price is used and called an estimate', () => {
    const p = priceFor('kie', 'google/nanobanana-2-1', null)
    expect(p.source).toBe('typical')
    expect(costText(1, p)).toMatch(/^1 picture · about \$0\.04 \(typical price, \$0\.04 each; set yours in the spending limit\)$/)
    expect(priceFor('kie', 'google/pro-image-to-image', null).usd).toBeGreaterThan(priceFor('kie', 'google/nanobanana-2-1', null).usd!)
    expect(priceFor('google', 'gemini-3-pro-image', null).usd).toBe(0.12)
    expect(priceFor('openai', 'gpt-image-1.5', null).source).toBe('typical')
  })
  it('a model on your computer is free, whatever price you set', () => {
    expect(priceFor('comfyui', 'flux_dev', 0.5)).toEqual({ usd: 0, source: 'free' })
    expect(costText(4, priceFor('comfyui', 'x', null))).toBe('4 pictures · free (runs on your computer)')
    expect(costShort(4, priceFor('comfyui', 'x', null))).toBe('free')
  })
  it('an unknown model says the cost is unknown instead of guessing', () => {
    const p = priceFor('mystery', 'model-x', null)
    expect(p).toEqual({ usd: null, source: 'unknown' })
    expect(costText(2, p)).toBe('2 pictures · cost unknown: set a price in the spending limit')
    expect(costShort(2, p)).toBe('cost unknown')
  })
  it('counts: nothing to make, one, many, and large totals', () => {
    const p = priceFor('kie', 'google/nanobanana-2-1', 0.5)
    expect(costText(0, p)).toBe('Nothing new to make')
    expect(costShort(0, p)).toBe('')
    expect(costText(1, p)).toMatch(/^1 picture ·/)
    expect(costText(24, p)).toBe('24 pictures · about $12.0 at your price of $0.50 each')
  })
  it('ignores nonsense prices', () => {
    expect(priceFor('kie', 'google/nanobanana-2-1', -1).source).toBe('typical')
    expect(priceFor('kie', 'google/nanobanana-2-1', Number.NaN).source).toBe('typical')
  })
})
