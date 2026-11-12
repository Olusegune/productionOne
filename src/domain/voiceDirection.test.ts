import { describe, expect, it } from 'vitest'
import { buildPerformance, emptyDirection, performanceBrief, providerById } from './voiceDirection'

const chatterbox = providerById('chatterbox')
const windows = providerById('windows')

describe('voice performance direction', () => {
  it('sends a plain line unchanged', () => {
    const p = buildPerformance('Hello there.', emptyDirection, windows)
    expect(p.text).toBe('Hello there.')
    expect(p.applied).toEqual([])
    expect(p.notApplied).toEqual([])
  })
  it('places an inline sound tag only when the provider supports it', () => {
    const dir = { ...emptyDirection, events: [{ event: 'laugh' as const, at: 'after' as const }] }
    expect(buildPerformance('Fine.', dir, chatterbox).text).toBe('Fine. [laugh]')
    const w = buildPerformance('Fine.', dir, windows)
    expect(w.text).toBe('Fine.')
    expect(w.notApplied[0]).toMatch(/separate sound effect/)
  })
  it('never claims a grunt the provider cannot make', () => {
    const dir = { ...emptyDirection, events: [{ event: 'grunt' as const, at: 'before' as const }] }
    const p = buildPerformance('Lift.', dir, chatterbox)
    expect(p.text).toBe('Lift.')
    expect(p.applied).toEqual([])
    expect(p.notApplied).toHaveLength(1)
  })
  it('adds pauses for out of breath and is honest about eating', () => {
    expect(buildPerformance('Wait, stop. Please.', { ...emptyDirection, state: 'out of breath' }, windows).text).toBe('Wait... stop. ... Please.')
    const eating = buildPerformance('Mm.', { ...emptyDirection, state: 'eating' }, chatterbox)
    expect(eating.text).toBe('Mm.')
    expect(eating.notApplied[0]).toMatch(/cannot reliably/)
  })
  it('puts everything in the brief', () => {
    const b = performanceBrief('Go.', { emotion: 'weary', state: 'carrying a heavy load', events: [{ event: 'grunt', at: 'before' }] })
    expect(b).toMatch(/weary/)
    expect(b).toMatch(/heavy load/)
    expect(b).toMatch(/grunt/)
  })
})
