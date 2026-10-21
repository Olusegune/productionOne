export type ProviderKey = 'kie' | 'google' | 'openai' | 'openrouter' | 'fal'

export interface CatalogModel {
  provider: ProviderKey
  id: string
  name: string
  /** Where the entry came from. Built-in entries are documented, not live-tested here; discovered ones come straight from the provider's own list. */
  source: 'built-in' | 'discovered'
  references: boolean
  note: string
}

export const providerLabels: Record<ProviderKey, string> = { kie: 'Kie.ai', google: 'Google Gemini', openai: 'OpenAI', openrouter: 'OpenRouter', fal: 'fal.ai' }
export const providerOrder: ProviderKey[] = ['kie', 'google', 'openai', 'openrouter', 'fal']

/** Reference images are sent where the adapter supports them (see providers.rs). Kie depends on the model: see modelTakesReferences. */
export const providerSendsReferences: Record<ProviderKey, boolean> = { kie: true, google: true, openrouter: true, openai: false, fal: false }

const KIE_REFERENCE_MODELS = /image-to-image|edit|nanobanana|nano-banana-edit|pro-image|ideogram\/character|wan\/2-7-image|seedream\/(?:4-5|v4)-edit/i

/** Whether a model can receive reference images (kie decides this per model; the request is also checked against Kie's own schema at run time). */
export function modelTakesReferences(provider: ProviderKey, id: string): boolean {
  if (provider === 'kie') return KIE_REFERENCE_MODELS.test(id)
  return providerSendsReferences[provider]
}

export const BUILT_IN_CHECKED = '2026-10-21'

const kie = (id: string, name: string, note = ''): CatalogModel => ({ provider: 'kie', id, name, source: 'built-in', references: modelTakesReferences('kie', id), note: note || 'From Kie.ai\'s published model index. Price is set by Kie; enter your own figure in the spending limit.' })

/** Fallback catalog. Kie's full list is read live with Refresh models (no key needed); Google, OpenAI and OpenRouter lists are read with a key. No prices are stated here. */
export const builtInModels: CatalogModel[] = [
  kie('google/nanobanana-2-1', 'Nano Banana 2.1', 'Takes up to 10 reference images: the best fit for keeping a character consistent.'),
  kie('google/pro-image-to-image', 'Nano Banana Pro'),
  kie('google/nano-banana-edit', 'Nano Banana Edit'),
  kie('gpt/gpt-image-2-text-to-image', 'GPT Image 2 · text to image'),
  kie('gpt/gpt-image-2-image-to-image', 'GPT Image 2 · image to image'),
  kie('gpt/gpt-image-2-5-flare-text-to-image', 'GPT Image 2.5 Flare · text to image'),
  kie('gpt/gpt-image-2-5-flare-image-to-image', 'GPT Image 2.5 Flare · image to image'),
  kie('gpt/gpt-image-2-5-sunburst-text-to-image', 'GPT Image 2.5 Sunburst · text to image'),
  kie('gpt/gpt-image-2-5-sunburst-image-to-image', 'GPT Image 2.5 Sunburst · image to image'),
  kie('seedream/5-pro-text-to-image', 'Seedream 5.0 Pro · text to image'),
  kie('seedream/5-pro-image-to-image', 'Seedream 5.0 Pro · image to image'),
  kie('seedream/5-lite-text-to-image', 'Seedream 5.0 Lite · text to image'),
  kie('seedream/5-flash-text-to-image', 'Seedream 5.0 Flash · text to image'),
  kie('seedream/5-flash-image-to-image', 'Seedream 5.0 Flash · image to image'),
  kie('flux3/klein-text-to-image', 'FLUX 3 Klein · text to image'),
  kie('flux3/klein-edit-image', 'FLUX 3 Klein · edit image'),
  kie('flux2/pro-image-to-image', 'FLUX 2 Pro · image to image'),
  kie('grok-imagine-image-2-0/text-to-image', 'Grok Imagine Image 2.0 · text to image'),
  kie('grok-imagine-image-2-0/image-to-image', 'Grok Imagine Image 2.0 · image edit'),
  kie('wan/2-7-image', 'Wan 2.7 Image'),
  kie('wan/2-7-image-pro', 'Wan 2.7 Image Pro'),
  kie('qwen3-pro/text-to-image', 'Qwen3 Pro · text to image'),
  kie('qwen3-pro/image-to-image', 'Qwen3 Pro · image to image'),
  kie('ideogram/character', 'Ideogram Character', 'Built for keeping one character consistent.'),
  { provider: 'google', id: 'gemini-nano-banana-2.1', name: 'Nano Banana 2.1 (Gemini)', source: 'built-in', references: true, note: 'The id FilmCrafter uses against Google. Multi-reference.' },
  { provider: 'google', id: 'gemini-3-pro-image', name: 'Nano Banana Pro (Gemini 3 Pro Image)', source: 'built-in', references: true, note: 'Higher fidelity; confirm the price before a large batch.' },
  { provider: 'google', id: 'gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash Lite Image', source: 'built-in', references: true, note: 'Lighter and cheaper.' },
  { provider: 'google', id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', source: 'built-in', references: true, note: 'FilmCrafter\'s notes mark this id as retiring on 29 Oct 2026. Prefer Nano Banana 2.1.' },
  { provider: 'openai', id: 'gpt-image-1.5', name: 'GPT Image 1.5', source: 'built-in', references: false, note: 'Reference images are not wired for OpenAI direct in this build (use GPT Image through Kie for references). Refresh models to see newer ids.' },
  { provider: 'openai', id: 'gpt-image-1', name: 'GPT Image 1', source: 'built-in', references: false, note: 'Reference images are not wired for OpenAI direct in this build.' },
  { provider: 'openrouter', id: 'bytedance-seed/seedream-4.5', name: 'Seedream 4.5 (OpenRouter)', source: 'built-in', references: true, note: 'Refresh models to list every image model OpenRouter offers.' },
  { provider: 'fal', id: 'fal-ai/flux/dev', name: 'FLUX dev (fal.ai)', source: 'built-in', references: false, note: 'Text-to-image only here; reference images are not wired for fal.ai in this build.' },
  { provider: 'fal', id: 'fal-ai/nano-banana', name: 'Nano Banana (fal.ai)', source: 'built-in', references: false, note: 'Text-to-image only here.' },
]

/** Video models for the motion demo (turnaround, walk, pose). The full Kie video list is read live; these are the starting choices. */
export const demoVideoModels: Array<{ id: string; name: string; note: string }> = [
  { id: 'kling/image-to-video', name: 'Kling 2.6 · image to video', note: 'Kie.ai. FilmCrafter has run this model against Kie.' },
  { id: 'bytedance/seedance-2-fast', name: 'Seedance 2.0 Fast', note: 'Kie.ai. Faster and lower cost than full Seedance 2.0.' },
]

export interface DiscoveredEntry { id: string; name: string }
export type DiscoveredCatalog = Partial<Record<ProviderKey | 'kie-video', { fetchedAt: number; models: DiscoveredEntry[] }>>

/** Built-in entries first, then anything the provider listed that the built-in list does not already have. */
export function mergeCatalog(discovered: DiscoveredCatalog): CatalogModel[] {
  const merged = [...builtInModels]
  for (const provider of providerOrder) {
    for (const model of discovered[provider]?.models ?? []) {
      if (merged.some((m) => m.provider === provider && m.id === model.id)) continue
      merged.push({ provider, id: model.id, name: model.name, source: 'discovered', references: modelTakesReferences(provider, model.id), note: 'Listed by the provider. Capabilities and price are not verified here.' })
    }
  }
  return merged
}

export function mergeVideoModels(discovered: DiscoveredCatalog) {
  const merged = [...demoVideoModels]
  for (const m of discovered['kie-video']?.models ?? []) if (!merged.some((x) => x.id === m.id)) merged.push({ id: m.id, name: m.name, note: 'Listed by Kie.ai. Price and limits are not verified here.' })
  return merged
}
