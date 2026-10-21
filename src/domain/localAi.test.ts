import { describe, expect, it } from 'vitest'
import { bestTextModel, emptyStatus, fitFor, recommendedFor, VISION_HINT, type LocalStatus } from './localAi'

const status = (over: Partial<LocalStatus>): LocalStatus => ({ ...emptyStatus, ...over })

describe('local AI helpers', () => {
  it('rates a model against the graphics memory and hides what cannot run', () => {
    expect(fitFor(8, 12)).toBe('comfortable')
    expect(fitFor(11, 12)).toBe('tight')
    expect(fitFor(16, 12)).toBe('too big')
    expect(fitFor(8, 0)).toBe('unknown')
    const hw = { gpu: 'RTX 3060', vramGb: 12, vramFreeGb: 10, ramGb: 32 }
    const names = recommendedFor(hw, ['gemma3:12b']).map((r) => r.name)
    expect(names).toContain('gemma3:12b')
    expect(names).not.toContain('gemma3:27b')
    expect(recommendedFor(hw, ['Gemma3:12B']).find((r) => r.name === 'gemma3:12b')?.installed).toBe(true)
  })
  it('prefers a model that can see pictures, then the larger one', () => {
    const s = status({ ollama: { url: 'x', up: true, version: '1', models: [{ name: 'llama3.1:8b', sizeGb: 4.9, detail: '' }, { name: 'gemma3:12b', sizeGb: 8.1, detail: '' }, { name: 'qwen2.5vl:3b', sizeGb: 3.2, detail: '' }] } })
    expect(bestTextModel(s)).toEqual({ provider: 'ollama', model: 'gemma3:12b' })
    expect(VISION_HINT.test('llama3.1:8b')).toBe(false)
    expect(bestTextModel(emptyStatus)).toBeNull()
    expect(bestTextModel(status({ lmstudio: { url: 'y', up: true, version: '', models: [{ name: 'qwen2.5-vl-7b', sizeGb: 0, detail: '' }] } }))).toEqual({ provider: 'lmstudio', model: 'qwen2.5-vl-7b' })
  })
})
