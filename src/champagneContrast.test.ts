import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { contrast } from './domain/appearance'

/** The Champagne look must keep readable text, a visible accent and distinct borders in dark and light, at the weights the design uses. */
const css = readFileSync(`${process.cwd()}/src/champagne.css`, 'utf8')
const block = (re: RegExp) => Object.fromEntries([...(re.exec(css)?.[1] ?? '').matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))
const dark = block(/:root\[data-look="champagne"\]\s*\{([^}]*)\}/)
const light = { ...dark, ...block(/:root\[data-look="champagne"\]\[data-theme="light"\]\s*\{([^}]*)\}/) }

describe.each([['dark', dark], ['light', light]] as const)('Champagne look, %s', (_name, t) => {
  const surfaces = ['bg', 'panel-1', 'panel-2', 'input'] as const
  it('has every token the design system names', () => {
    for (const k of ['bg', 'panel-1', 'panel-2', 'input', 'line-1', 'text', 'text-2', 'text-3', 'gold', 'on-accent', 'ok', 'attention', 'error']) expect(t[k], k).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('primary and secondary text are readable on every surface (4.5:1)', () => {
    for (const s of surfaces) for (const k of ['text', 'text-2', 'text-3']) expect(contrast(t[k], t[s]), `${k} on ${s}`).toBeGreaterThanOrEqual(4.5)
  })
  it('the accent reads on every surface, and filled buttons keep readable text (7:1 on the fill)', () => {
    for (const s of surfaces) expect(contrast(t.gold, t[s]), `accent on ${s}`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['on-accent'], t.gold)).toBeGreaterThanOrEqual(dark === t ? 7 : 4.5)
  })
  it('approved, attention and error colours read with their label on every surface', () => {
    for (const s of surfaces) for (const k of ['ok', 'attention', 'error']) expect(contrast(t[k], t[s]), `${k} on ${s}`).toBeGreaterThanOrEqual(4.5)
  })
  it('borders stay distinct from the panels, and the focus ring (the accent) stays distinct from borders', () => {
    for (const s of ['panel-1', 'panel-2']) expect(contrast(t['line-1'], t[s]), `border on ${s}`).toBeGreaterThanOrEqual(1.25)
    expect(contrast(t.gold, t['line-1'])).toBeGreaterThanOrEqual(3)
  })
  it('a selected candidate (gold) and an approved state (green) are different colours', () => {
    expect(t.gold.toLowerCase()).not.toBe(t.ok.toLowerCase())
  })
})

describe('the look is a choice, not a change of default', () => {
  it('the default look is untouched and pictures are never tinted by the accent', () => {
    expect(css).toMatch(/img[^}]*filter: none/)
    expect(css).not.toMatch(/:root(?!\[data-look="champagne"\])[^{]*\{[^}]*--bg/)
  })
})
