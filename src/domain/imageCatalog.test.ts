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
    for (const id of ['kie:google/nanobanana-2-1', 'kie:gpt/gpt-image-2-image-to-image', 'kie:seedream/5-pro-image-to-image', 'kie:seedream/5-5-image-to-image', 'kie:gpt/gpt-image-2-6-flare-image-to-image', 'kie:flux3/klein-edit-image', 'google:gemini-nano-banana-2.1']) expect(ids).toContain(id)
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
    const ids = mergeVideoModels({}).map((m) => m.id)
    expect(ids.slice(0, 2)).toEqual(['kling/image-to-video', 'bytedance/seedance-2-fast'])
    for (const id of ['bytedance/seedance-2-5', 'kling/v4-reference-to-video', 'wan/3-0-video', 'happyhorse-1-1/image-to-video', 'minimax-h3/image-to-video', 'pixverse/image-to-video']) expect(ids).toContain(id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(mergeVideoModels({ 'kie-video': { fetchedAt: 1, models: [{ id: 'hailuo/2-3-image-to-video-standard', name: 'Hailuo' }, { id: 'wan/3-0-video', name: 'dup' }] } })).toHaveLength(ids.length + 1)
    // text-to-video models take no picture, so they are not offered for the picture-based motion demo
    expect(mergeVideoModels({ 'kie-video': { fetchedAt: 1, models: [{ id: 'kling/2-6-text-to-video', name: 'Kling 2.6 Text to Video' }, { id: 'grok-imagine/text-to-video', name: 'Grok Imagine Text to Video' }] } })).toHaveLength(ids.length)
  })
})

describe('quick engines for a view that must be made again', () => {
  const comfy: CatalogModel = { provider: 'comfyui', id: 'sdxl-keyframes', name: 'SDXL keyframes', source: 'discovered', references: false, note: '' }
  const catalog = mergeCatalog({}, [comfy])
  const keys = { kie: true, google: true, openai: true, comfyui: true }
  const latest = (c = catalog, k: Record<string, boolean> = keys, r = true) => quickEngines(c, k, r).filter((o) => o.group === 'latest')
  it('offers the newest of each family first: Nano Bananas, Seedream 5.5, GPT Image 2.6, Ideogram Character, Wan, MiniMax H3 and a model on this computer', () => {
    expect(latest().map((o) => o.label)).toEqual(['Nano Banana 2.1', 'Nano Banana Pro', 'Seedream 5.5', 'GPT Image 2.6', 'Ideogram Character', 'Wan 2.7 Image Pro', 'MiniMax H3', 'On this computer: SDXL keyframes'])
  })
  it('falls back to the older Seedream / GPT Image only when the newer one is not in the catalog', () => {
    const older = catalog.filter((m) => !/seedream\/5-5|gpt-image-2-6/.test(m.id))
    const labels = latest(older).map((o) => o.label)
    expect(labels).toContain('Seedream 5.0 Pro')
    expect(labels).toContain('GPT Image 2.5')
  })
  it('keeps every other image model in a second group', () => {
    const other = quickEngines(catalog, keys, true).filter((o) => o.group === 'other')
    expect(other.length).toBeGreaterThan(5)
    expect(other.some((o) => o.model === 'seedream/5-pro-image-to-image')).toBe(true)
    expect(other.some((o) => o.model === 'gpt/gpt-image-2-6-sunburst-image-to-image')).toBe(true)
  })
  it('never lists upscalers, background removers or other tools as a way to make a view', () => {
    const cat = mergeCatalog({ kie: { fetchedAt: 1, models: [{ id: 'topaz/image-upscale', name: 'Topaz' }, { id: 'recraft/remove-background', name: 'Recraft' }, { id: 'seedream/5-pro-layer-decomposition', name: 'Layers' }] } })
    expect(quickEngines(cat, keys, false).some((o) => /upscale|remove-background|layer-decomposition/.test(o.model))).toBe(false)
  })
  it('when the view is built from the approved front, the other group offers only models that take references', () => {
    expect(quickEngines(catalog, keys, true).filter((o) => o.group === 'other' && o.provider !== 'comfyui').every((o) => o.takesReferences)).toBe(true)
    expect(quickEngines(catalog, keys, false).some((o) => o.group === 'other' && !o.takesReferences)).toBe(true)
  })
  it('lists Nano Banana whether the view used it before or not, so it can always be chosen again', () => {
    expect(latest(catalog, keys, false)[0].label).toBe('Nano Banana 2.1')
    expect(quickEngines(catalog, { kie: true }, false)[0]).toMatchObject({ provider: 'kie', model: 'google/nanobanana-2-1', available: true })
  })
  it('Nano Banana Pro works with only a Kie.ai key, and uses Google direct when that has a key', () => {
    expect(latest(catalog, { kie: true })[1]).toMatchObject({ label: 'Nano Banana Pro', provider: 'kie', model: 'google/pro-image-to-image', available: true })
    expect(latest(catalog, { google: true, kie: true })[1]).toMatchObject({ provider: 'google', model: 'gemini-3-pro-image' })
  })
  it('picks the image-to-image variant when the view is built from the approved front, and text-to-image otherwise', () => {
    const withRef = latest()
    expect(withRef.find((o) => o.label === 'Seedream 5.5')?.model).toBe('seedream/5-5-image-to-image')
    expect(withRef.find((o) => o.label === 'GPT Image 2.6')?.model).toBe('gpt/gpt-image-2-6-flare-image-to-image')
    const plain = latest(catalog, keys, false)
    expect(plain.find((o) => o.label === 'Seedream 5.5')?.model).toBe('seedream/5-5-text-to-image')
    expect(plain.find((o) => o.label === 'GPT Image 2.6')?.model).toBe('gpt/gpt-image-2-6-flare-text-to-image')
  })
  it('says when a key is missing, and what is lost on an engine that cannot take references', () => {
    const none = quickEngines(catalog, {}, true)
    expect(none.every((o) => !o.available)).toBe(true)
    expect(none.find((o) => o.label === 'Nano Banana Pro')?.note).toMatch(/key/)
    expect(none.find((o) => o.label === 'Seedream 5.5')?.note).toMatch(/Kie\.ai key/)
    const local = latest().find((o) => o.provider === 'comfyui')!
    expect(local.available).toBe(true)
    expect(local.note).toMatch(/no identity lock/)
  })
  it('falls back to OpenAI direct for GPT Image and OpenRouter for Seedream when the Kie ids are not in the catalog', () => {
    const noKie = catalog.filter((m) => m.provider !== 'kie')
    const out = latest(noKie, { openai: true, openrouter: true }, false)
    expect(out.find((o) => o.provider === 'openai')).toMatchObject({ model: 'gpt-image-1.5', available: true })
    expect(out.find((o) => o.provider === 'openrouter')).toMatchObject({ model: 'bytedance-seed/seedream-4.5', available: true })
  })
  it('shows a start-ComfyUI hint when no local image model is listed', () => {
    const out = latest(mergeCatalog({}), keys, false)
    expect(out.at(-1)).toMatchObject({ provider: 'comfyui', available: false })
    expect(out.at(-1)?.note).toMatch(/Local AI/)
  })
})
