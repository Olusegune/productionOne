import { describe, expect, it } from 'vitest'
import { builtInModels, mergeCatalog, mergeVideoModels, modelTakesReferences } from './imageCatalog'

describe('image catalog', () => {
  it('keeps the built-in list and adds only new discovered models', () => {
    const merged = mergeCatalog({ kie: { fetchedAt: 1, models: [{ id: 'google/nanobanana-2-1', name: 'dup' }, { id: 'newvendor/new-image-to-image', name: 'New' }] } })
    expect(merged).toHaveLength(builtInModels.length + 1)
    const added = merged.find((m) => m.id === 'newvendor/new-image-to-image')!
    expect(added.source).toBe('discovered')
    expect(added.references).toBe(true)
    expect(merged.filter((m) => m.id === 'google/nanobanana-2-1')).toHaveLength(1)
  })
  it('includes the current Kie and Google image models', () => {
    const ids = builtInModels.map((m) => `${m.provider}:${m.id}`)
    for (const id of ['kie:google/nanobanana-2-1', 'kie:gpt/gpt-image-2-image-to-image', 'kie:seedream/5-pro-image-to-image', 'kie:flux3/klein-edit-image', 'google:gemini-nano-banana-2.1']) expect(ids).toContain(id)
  })
  it('decides reference support per Kie model and never claims it for text-only models', () => {
    expect(modelTakesReferences('kie', 'seedream/5-pro-text-to-image')).toBe(false)
    expect(modelTakesReferences('kie', 'seedream/5-pro-image-to-image')).toBe(true)
    expect(modelTakesReferences('kie', 'google/nanobanana-2-1')).toBe(true)
    expect(modelTakesReferences('openai', 'gpt-image-1.5')).toBe(false)
    expect(modelTakesReferences('google', 'gemini-nano-banana-2.1')).toBe(true)
  })
  it('states no prices and lists video demo models first', () => {
    expect(JSON.stringify(builtInModels)).not.toMatch(/\$\d|USD|per image/i)
    expect(mergeVideoModels({}).map((m) => m.id)).toEqual(['kling/image-to-video', 'bytedance/seedance-2-fast'])
    expect(mergeVideoModels({ 'kie-video': { fetchedAt: 1, models: [{ id: 'hailuo/2-3-image-to-video-standard', name: 'Hailuo' }] } })).toHaveLength(3)
  })
})
