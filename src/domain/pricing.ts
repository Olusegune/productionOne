/**
 * What a picture request is likely to cost, shown before every Generate button. These are TYPICAL prices for the model families, not quotes: providers change them,
 * and the real charge is on your provider account. If you have entered your own price per picture in the spending limit, that is used instead and labelled yours.
 * A model on your own computer costs nothing per picture.
 */
export type PriceSource = 'yours' | 'typical' | 'free' | 'unknown'
export interface PriceInfo { usd: number | null; source: PriceSource }

interface Typical { test: RegExp; usd: number }

/** Rough per-picture prices in US dollars, most specific first. Updated by hand; "typical" is the word to trust, not the digits. */
const TYPICAL: Typical[] = [
  { test: /pro-image|nano[-_ ]?banana[-_ ]?pro|gemini-3-pro/i, usd: 0.12 },
  { test: /nano[-_ ]?banana|gemini-.*image|gemini-nano/i, usd: 0.04 },
  { test: /gpt-image|dall-e|openai/i, usd: 0.07 },
  { test: /seedream/i, usd: 0.04 },
  { test: /flux.*(pro|ultra|kontext)/i, usd: 0.06 },
  { test: /flux|sdxl|stable|recraft|ideogram/i, usd: 0.03 },
]

export function priceFor(provider: string, modelId: string, perImageUsd: number | null): PriceInfo {
  if (provider === 'comfyui') return { usd: 0, source: 'free' }
  if (perImageUsd !== null && Number.isFinite(perImageUsd) && perImageUsd >= 0) return { usd: perImageUsd, source: 'yours' }
  const hit = TYPICAL.find((t) => t.test.test(`${provider} ${modelId}`))
  return hit ? { usd: hit.usd, source: 'typical' } : { usd: null, source: 'unknown' }
}

const money = (usd: number) => (usd < 1 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(usd < 10 ? 2 : 1)}`)

/** "3 pictures · about $0.12 (typical price; set yours in the spending limit)". Always says how many pictures, and never hides that a price is an estimate. */
export function costText(count: number, price: PriceInfo): string {
  const noun = `${count} picture${count === 1 ? '' : 's'}`
  if (count === 0) return 'Nothing new to make'
  if (price.source === 'free') return `${noun} · free (runs on your computer)`
  if (price.usd === null) return `${noun} · cost unknown: set a price in the spending limit`
  const total = count * price.usd
  if (price.source === 'yours') return `${noun} · about ${money(total)} at your price of ${money(price.usd)} each`
  return `${noun} · about ${money(total)} (typical price, ${money(price.usd)} each; set yours in the spending limit)`
}

/** Short form for a button: "about $0.04". Empty when there is nothing to say. */
export function costShort(count: number, price: PriceInfo): string {
  if (count === 0) return ''
  if (price.source === 'free') return 'free'
  if (price.usd === null) return 'cost unknown'
  return `about ${money(count * price.usd)}`
}
