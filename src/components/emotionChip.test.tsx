import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { EmotionChip, emotionColor, emotionColorLight } from './bible'
import { contrast } from '../domain/appearance'

/** The chip sits on a 16 percent tint of its own colour over the panel behind it. */
const mix = (hex: string, bg: string, a = 0.16) => {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const x = c(hex), y = c(bg)
  return `#${x.map((v, i) => Math.round(v * a + y[i] * (1 - a)).toString(16).padStart(2, '0')).join('')}`
}
const emotions = Object.keys(emotionColor) as Array<keyof typeof emotionColor>

describe('emotion chips are readable in both themes', () => {
  it('has a darkened colour for every emotion', () => {
    expect(Object.keys(emotionColorLight).sort()).toEqual([...emotions].sort())
  })
  it('light theme: every chip reads at 4.5:1 on every light surface', () => {
    for (const bg of ['#efeae0', '#fbf9f4', '#ffffff', '#e3ebf6', '#f0e7d8']) {
      for (const e of emotions) expect(contrast(emotionColorLight[e], mix(emotionColorLight[e], bg)), `${e} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('dark theme: every chip reads at 4.5:1 on the dark surfaces', () => {
    for (const bg of ['#151a24', '#1c2330', '#1b1815', '#262019', '#0e131d', '#151c2a']) {
      for (const e of emotions) expect(contrast(emotionColor[e], mix(emotionColor[e], bg)), `${e} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('the chip carries both colours as variables and no fixed colour', () => {
    const { container } = render(<EmotionChip emotion="joy" intensity={7} />)
    const chip = container.querySelector('.po-emotion') as HTMLElement
    expect(chip.style.getPropertyValue('--emo')).toBe(emotionColor.joy)
    expect(chip.style.getPropertyValue('--emo-l')).toBe(emotionColorLight.joy)
    expect(chip.style.color).toBe('')
    expect(chip.textContent).toBe('joy 7')
  })
})
