/**
 * Enhancing a picture with Topaz Labs: what is offered, what size the result would be, and what it is likely to cost, all worked out BEFORE anything is sent.
 * Only Topaz's non-generative Enhance models are offered: they enlarge and sharpen, they do not redraw the picture.
 */
export interface TopazModel { id: string; label: string; note: string }

export const topazModels: TopazModel[] = [
  { id: 'Standard V2', label: 'Standard', note: 'Best all-round. Sharpens and enlarges most pictures.' },
  { id: 'High Fidelity V2', label: 'High fidelity', note: 'For pictures that are already sharp: keeps fine detail and texture.' },
  { id: 'Low Resolution V2', label: 'Low resolution', note: 'For small, soft or blurry pictures.' },
  { id: 'CGI', label: 'CGI and illustration', note: 'For 3D renders, cartoons and drawn art.' },
  { id: 'Text Refine', label: 'Text', note: 'For pictures with writing in them, such as signs and labels.' },
]

export const MAX_SIDE = 32_000
export const MAX_PIXELS = 50_000_000
/** The figure Topaz's pricing page uses in its worked example. It is shown as an estimate, never as a quote. */
export const EXAMPLE_MP_PER_CREDIT = 24

export type TopazPlan = { ok: true; width: number; height: number; megapixels: number; credits: number } | { ok: false; reason: string }

export function topazPlan(width: number | undefined, height: number | undefined, scale: number): TopazPlan {
  if (!width || !height) return { ok: false, reason: 'The size of this picture is not known yet.' }
  if (scale !== 2 && scale !== 4) return { ok: false, reason: 'Choose 2x or 4x.' }
  const w = width * scale, h = height * scale
  if (width < 16 || height < 16) return { ok: false, reason: 'This picture is too small to enhance.' }
  if (Math.max(w, h) > MAX_SIDE) return { ok: false, reason: `${scale}x would be ${w} by ${h} pixels, more than Topaz's ${MAX_SIDE} pixel limit. Choose 2x.` }
  if (w * h > MAX_PIXELS) return { ok: false, reason: `${scale}x would be ${w} by ${h} pixels (over ${MAX_PIXELS / 1_000_000} million). Choose 2x.` }
  const megapixels = Math.round((w * h) / 100_000) / 10
  return { ok: true, width: w, height: h, megapixels, credits: Math.max(1, Math.ceil(megapixels / EXAMPLE_MP_PER_CREDIT)) }
}

/** One honest sentence about the cost. */
export const costSentence = (plan: Extract<TopazPlan, { ok: true }>): string =>
  `The result will be ${plan.width} by ${plan.height} pixels (${plan.megapixels} megapixels). Topaz charges credits by output size; with its example rate of ${EXAMPLE_MP_PER_CREDIT} megapixels per credit that is about ${plan.credits} credit${plan.credits === 1 ? '' : 's'}. Topaz bills your account and reports the exact number when it is done.`
