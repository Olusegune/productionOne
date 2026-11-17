import { describe, expect, it } from 'vitest'
import { builtInModels, mergeCatalog, mergeVideoModels, modelTakesReferences, quickEngines, type CatalogModel } from './imageCatalog'

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

describe('quick engines for a view that must be made again', () => {
  const comfy: CatalogModel = { provider: 'comfyui', id: 'sdxl-keyframes', name: 'SDXL keyframes', source: 'discovered', references: false, note: '' }
  const catalog = mergeCatalog({}, [comfy])
  const keys = { kie: true, google: true, openai: true, comfyui: true }
  it('offers both Nano Bananas, the newest Seedream, the newest GPT Image, Ideogram Character, Wan and a model on this computer', () => {
    const labels = quickEngines(catalog, keys, true).map((o) => o.label)
    expect(labels).toEqual(['Nano Banana 2.1', 'Nano Banana Pro', 'Seedream 5.0 Pro', 'GPT Image 2.5', 'Ideogram Character', 'Wan 2.7 Image Pro', 'On this computer: SDXL keyframes'])
  })
  it('lists Nano Banana whether the view used it before or not, so it can always be chosen again', () => {
    const labels = quickEngines(catalog, keys, false).map((o) => o.label)
    expect(labels[0]).toBe('Nano Banana 2.1')
    expect(quickEngines(catalog, { kie: true }, false)[0]).toMatchObject({ provider: 'kie', model: 'google/nanobanana-2-1', available: true })
  })
  it('picks the image-to-image variant when the view is built from the approved front, and text-to-image otherwise', () => {
    const withRef = quickEngines(catalog, keys, true)
    expect(withRef.find((o) => o.label === 'Seedream 5.0 Pro')?.model).toBe('seedream/5-pro-image-to-image')
    expect(withRef.find((o) => o.label === 'GPT Image 2.5')?.model).toBe('gpt/gpt-image-2-5-flare-image-to-image')
    const plain = quickEngines(catalog, keys, false)
    expect(plain.find((o) => o.label === 'Seedream 5.0 Pro')?.model).toBe('seedream/5-pro-text-to-image')
    expect(plain.find((o) => o.label === 'GPT Image 2.5')?.model).toBe('gpt/gpt-image-2-5-flare-text-to-image')
  })
  it('says when a key is missing, and what is lost on an engine that cannot take references', () => {
    const none = quickEngines(catalog, {}, true)
    expect(none.every((o) => !o.available)).toBe(true)
    expect(none.find((o) => o.label === 'Nano Banana Pro')?.note).toMatch(/Google key/)
    expect(none.find((o) => o.label === 'Seedream 5.0 Pro')?.note).toMatch(/Kie\.ai key/)
    const local = quickEngines(catalog, keys, true).find((o) => o.provider === 'comfyui')!
    expect(local.available).toBe(true)
    expect(local.note).toMatch(/no identity lock/)
  })
  it('falls back to OpenAI direct for GPT Image and OpenRouter for Seedream when only those keys exist', () => {
    const out = quickEngines(catalog, { openai: true, openrouter: true }, false)
    expect(out.find((o) => o.provider === 'openai')).toMatchObject({ model: 'gpt-image-1.5', available: true })
    expect(out.find((o) => o.provider === 'openrouter')).toMatchObject({ model: 'bytedance-seed/seedream-4.5', available: true })
  })
  it('shows a start-ComfyUI hint when no local image model is listed', () => {
    const out = quickEngines(mergeCatalog({}), keys, false)
    expect(out.at(-1)).toMatchObject({ provider: 'comfyui', available: false })
    expect(out.at(-1)?.note).toMatch(/Local AI/)
  })
})
