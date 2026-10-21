import { describe, expect, it } from 'vitest'
import { builtInModels, mergeCatalog } from './imageCatalog'

describe('image catalog', () => {
  it('keeps the built-in list and adds only new discovered models', () => {
    const merged = mergeCatalog({ google: { fetchedAt: 1, models: [{ id: 'gemini-3.1-flash-image', name: 'dup' }, { id: 'gemini-new-image', name: 'New' }] } })
    expect(merged).toHaveLength(builtInModels.length + 1)
    expect(merged.find((m) => m.id === 'gemini-new-image')?.source).toBe('discovered')
    expect(merged.filter((m) => m.id === 'gemini-3.1-flash-image')).toHaveLength(1)
  })
  it('states no prices', () => {
    expect(JSON.stringify(builtInModels)).not.toMatch(/\$|USD|per image/i)
  })
})
