import { describe, expect, it } from 'vitest'
import { paintRange } from './rangeFill'

const slider = (min: string, max: string, value: string) => { const el = document.createElement('input'); el.type = 'range'; el.min = min; el.max = max; el.value = value; return el }

describe('slider fill', () => {
  it('sets how far along the handle is, as a percentage', () => {
    const a = slider('0', '100', '25'); paintRange(a); expect(a.style.getPropertyValue('--p')).toBe('25%')
    const b = slider('3', '10', '6.5'); paintRange(b); expect(parseFloat(b.style.getPropertyValue('--p'))).toBeCloseTo(50, 5)
    const c = slider('-100', '100', '0'); paintRange(c); expect(c.style.getPropertyValue('--p')).toBe('50%')
  })
  it('never changes the value', () => {
    const a = slider('0', '10', '7'); paintRange(a); expect(a.value).toBe('7')
  })
})
