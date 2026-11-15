/** The app's looks. A look changes the headings, the surfaces and the accent; it never changes what any control does. */
export type Look = 'studio' | 'cinematic' | 'futurist'

export interface LookInfo { id: Look; name: string; tagline: string; description: string; heading: string }

export const looks: ReadonlyArray<LookInfo> = [
  { id: 'studio', name: 'Studio', tagline: 'Calm graphite and champagne', description: 'The default: quiet surfaces, one gold accent, geometric headings.', heading: 'Space Grotesk' },
  { id: 'cinematic', name: 'Cinematic', tagline: 'Warm, serif titles, your colours', description: 'Warmer surfaces and serif page titles. The accent is taken from your visual style\'s palette.', heading: 'Fraunces' },
  { id: 'futurist', name: 'Futurist', tagline: 'Sharp, cool, glowing', description: 'Near-black blue surfaces, a cyan accent with a soft glow, tighter corners and a sharper body font.', heading: 'Space Grotesk' },
]

export const isLook = (value: unknown): value is Look => looks.some((l) => l.id === value)

const KEY = 'po.look'
export function savedLook(): Look {
  try { const v = localStorage.getItem(KEY); return isLook(v) ? v : 'studio' } catch { return 'studio' }
}
export function storeLook(look: Look) {
  try { localStorage.setItem(KEY, look) } catch { /* private window: the choice lasts for this session only */ }
}

const hex = (c: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(c.trim()); if (!m) return null; const n = parseInt(m[1], 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 } }
const lin = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
const luminance = (c: { r: number; g: number; b: number }) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
export const contrast = (a: string, b: string): number => {
  const x = hex(a), y = hex(b)
  if (!x || !y) return 1
  const l1 = luminance(x), l2 = luminance(y)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
const saturation = (c: { r: number; g: number; b: number }) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx === 0 ? 0 : (mx - mn) / mx }
const toHex = (c: { r: number; g: number; b: number }) => `#${[c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`

/** Lifts a colour toward white until it reads on a dark surface (at least 4.5:1), keeping its hue. */
function liftForDark(color: string, surface: string): string {
  let c = hex(color)
  if (!c) return color
  let out = toHex(c)
  for (let i = 0; i < 20 && contrast(out, surface) < 4.5; i++) { c = { r: c.r + (255 - c.r) * 0.12, g: c.g + (255 - c.g) * 0.12, b: c.b + (255 - c.b) * 0.12 }; out = toHex(c) }
  return out
}

/**
 * The accent for the Cinematic look: the most colourful entry of the style's palette, lifted if it is too dark to read on the dark surface.
 * Greys and near-greys are skipped; null when the palette has no colour (the look then keeps champagne).
 */
export function accentFromPalette(palette: string[], surface = '#14110f'): string | null {
  const candidates = palette.map(hex).map((c, i) => (c ? { c, i } : null)).filter((x): x is { c: { r: number; g: number; b: number }; i: number } => !!x).filter((x) => saturation(x.c) >= 0.25 && Math.max(x.c.r, x.c.g, x.c.b) >= 40)
  if (!candidates.length) return null
  candidates.sort((a, b) => saturation(b.c) * (0.4 + luminance(b.c)) - saturation(a.c) * (0.4 + luminance(a.c)))
  return liftForDark(toHex(candidates[0].c), surface)
}
