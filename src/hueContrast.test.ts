import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/** Icons that carry meaning need at least 3:1 against the surface they sit on (WCAG 1.4.11), in every theme. */
const css = readFileSync(`${process.cwd()}/src/hues.css`, 'utf8')
const block = (re: RegExp) => { const m = re.exec(css); return Object.fromEntries([...(m?.[1] ?? '').matchAll(/--(hue-[a-z]+):\s*(#[0-9a-f]{6})/gi)].map((x) => [x[1], x[2]])) }
const dark = block(/:root\s*\{([^}]*)\}/)
const light = block(/:root\[data-theme="light"\]\s*\{([^}]*)\}/)

const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('colour cues are readable in both themes', () => {
  it('finds the same set of hues in both themes', () => {
    expect(Object.keys(dark).length).toBeGreaterThanOrEqual(16)
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
  })
  it('every dark-theme hue has 3:1 against the dark page and panel', () => {
    for (const [k, v] of Object.entries(dark)) for (const bg of ['#0d1017', '#151a24', '#1c2330']) expect(ratio(v, bg), `${k} on ${bg}`).toBeGreaterThanOrEqual(3)
  })
  it('every light-theme hue has 3:1 against the light page and white panels', () => {
    for (const [k, v] of Object.entries(light)) for (const bg of ['#eaedf4', '#ffffff']) expect(ratio(v, bg), `${k} on ${bg}`).toBeGreaterThanOrEqual(3)
  })
})
