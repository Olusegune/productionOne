export type ProviderKey = 'kie' | 'google' | 'openai' | 'openrouter' | 'fal' | 'comfyui'

export interface CatalogModel {
  provider: ProviderKey
  id: string
  name: string
  /** Where the entry came from. Built-in entries are documented, not live-tested here; discovered ones come straight from the provider's own list. */
  source: 'built-in' | 'discovered'
  references: boolean
  note: string
}

export const providerLabels: Record<ProviderKey, string> = { kie: 'Kie.ai', google: 'Google Gemini', openai: 'OpenAI', openrouter: 'OpenRouter', fal: 'fal.ai', comfyui: 'ComfyUI (on this computer)' }
export const providerOrder: ProviderKey[] = ['comfyui', 'kie', 'google', 'openai', 'openrouter', 'fal']
/** Providers that run on this computer or your network: free per image, and they work with no internet. */
export const localProviders: ProviderKey[] = ['comfyui']

/** Reference images are sent where the adapter supports them (see providers.rs). Kie depends on the model: see modelTakesReferences. */
export const providerSendsReferences: Record<ProviderKey, boolean> = { kie: true, google: true, openrouter: true, openai: false, fal: false, comfyui: false }

const KIE_REFERENCE_MODELS = /image-to-image|edit|nanobanana|nano-banana-edit|pro-image|ideogram\/character|wan\/2-7-image|seedream\/(?:4-5|v4)-edit/i

/** Whether a model can receive reference images (kie decides this per model; the request is also checked against Kie's own schema at run time). */
export function modelTakesReferences(provider: ProviderKey, id: string): boolean {
  if (provider === 'kie') return KIE_REFERENCE_MODELS.test(id)
  return providerSendsReferences[provider]
}

export const BUILT_IN_CHECKED = '2026-11-17'

const kie = (id: string, name: string, note = ''): CatalogModel => ({ provider: 'kie', id, name, source: 'built-in', references: modelTakesReferences('kie', id), note: note || 'From Kie.ai\'s published model index. Price is set by Kie; enter your own figure in the spending limit.' })

/** Fallback catalog. Kie's full list is read live with Refresh models (no key needed); Google, OpenAI and OpenRouter lists are read with a key. No prices are stated here. */
export const builtInModels: CatalogModel[] = [
  kie('google/nanobanana-2-1', 'Nano Banana 2.1', 'Takes up to 10 reference images: the best fit for keeping a character consistent.'),
  kie('google/pro-image-to-image', 'Nano Banana Pro'),
  kie('google/nano-banana-edit', 'Nano Banana Edit'),
  kie('google/nano-banana-2-lite', 'Nano Banana 2 Lite'),
  kie('minimax-h3/text-to-image', 'MiniMax H3 · text to image'),
  kie('minimax-h3/image-edit', 'MiniMax H3 · image edit'),
  kie('gpt/gpt-image-2-text-to-image', 'GPT Image 2 · text to image'),
  kie('gpt/gpt-image-2-image-to-image', 'GPT Image 2 · image to image'),
  kie('gpt/gpt-image-2-6-flare-text-to-image', 'GPT Image 2.6 Flare · text to image'),
  kie('gpt/gpt-image-2-6-flare-image-to-image', 'GPT Image 2.6 Flare · image to image'),
  kie('gpt/gpt-image-2-6-sunburst-text-to-image', 'GPT Image 2.6 Sunburst · text to image'),
  kie('gpt/gpt-image-2-6-sunburst-image-to-image', 'GPT Image 2.6 Sunburst · image to image'),
  kie('gpt/gpt-image-2-6-economy-text-to-image', 'GPT Image 2.6 Economy · text to image'),
  kie('gpt/gpt-image-2-6-economy-image-to-image', 'GPT Image 2.6 Economy · image to image'),
  kie('gpt/gpt-image-2-5-flare-text-to-image', 'GPT Image 2.5 Flare · text to image'),
  kie('gpt/gpt-image-2-5-flare-image-to-image', 'GPT Image 2.5 Flare · image to image'),
  kie('gpt/gpt-image-2-5-sunburst-text-to-image', 'GPT Image 2.5 Sunburst · text to image'),
  kie('gpt/gpt-image-2-5-sunburst-image-to-image', 'GPT Image 2.5 Sunburst · image to image'),
  kie('seedream/5-5-text-to-image', 'Seedream 5.5 · text to image'),
  kie('seedream/5-5-image-to-image', 'Seedream 5.5 · image to image'),
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
  { id: 'bytedance/seedance-2-5', name: 'Seedance 2.5', note: 'Kie.ai. The newest Seedance.' },
  { id: 'bytedance/seedance-2-5-flash', name: 'Seedance 2.5 Flash', note: 'Kie.ai. A faster, lower-cost Seedance 2.5.' },
  { id: 'kling/v3-turbo-image-to-video', name: 'Kling 3.0 Turbo · image to video', note: 'Kie.ai.' },
  { id: 'kling/v4-keyframe-to-video', name: 'Kling 4.0 · keyframe to video', note: 'Kie.ai. Starts and ends on pictures you give it.' },
  { id: 'kling/v4-reference-to-video', name: 'Kling 4.0 · reference to video', note: 'Kie.ai. Keeps a character from reference images.' },
  { id: 'wan/3-0-video', name: 'Wan 3.0', note: 'Kie.ai. The newest Wan.' },
  { id: 'wan/2-7-image-to-video', name: 'Wan 2.7 · image to video', note: 'Kie.ai.' },
  { id: 'happyhorse-1-1/image-to-video', name: 'HappyHorse 1.1 · image to video', note: 'Kie.ai.' },
  { id: 'happyhorse-1-1/reference-to-video', name: 'HappyHorse 1.1 · reference to video', note: 'Kie.ai.' },
  { id: 'minimax-h3/image-to-video', name: 'MiniMax H3 · image to video', note: 'Kie.ai.' },
  { id: 'minimax-h3/reference-to-video', name: 'MiniMax H3 · reference to video', note: 'Kie.ai.' },
  { id: 'hailuo/2-3-image-to-video-pro', name: 'Hailuo 2.3 Pro · image to video', note: 'Kie.ai.' },
  { id: 'pixverse/image-to-video', name: 'PixVerse V6 · image to video', note: 'Kie.ai.' },
  { id: 'grok-imagine/image-to-video', name: 'Grok Imagine · image to video', note: 'Kie.ai.' },
]

export interface DiscoveredEntry { id: string; name: string }
export type DiscoveredCatalog = Partial<Record<ProviderKey | 'kie-video', { fetchedAt: number; models: DiscoveredEntry[] }>>

/** Built-in entries first, then anything the provider listed that the built-in list does not already have. */
export function mergeCatalog(discovered: DiscoveredCatalog, local: CatalogModel[] = []): CatalogModel[] {
  const merged = [...local, ...builtInModels]
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
  // The motion demo starts from an approved picture, so text-to-video models (which take no picture) are left out of the list.
  const textOnly = (m: { id: string; name: string }) => /text[-\s_]?to[-\s_]?video/i.test(m.id) || /text[-\s_]?to[-\s_]?video/i.test(m.name)
  for (const m of discovered['kie-video']?.models ?? []) if (!textOnly(m) && !merged.some((x) => x.id === m.id)) merged.push({ id: m.id, name: m.name, note: 'Listed by Kie.ai. Price and limits are not verified here.' })
  return merged
}

export interface EngineOption {
  key: string
  provider: ProviderKey
  model: string
  label: string
  /** The provider has a key (or, for ComfyUI, is running). */
  available: boolean
  takesReferences: boolean
  /** Why it cannot be used yet, or what is lost by using it. */
  note: string
  /** `latest` = the newest of each family, shown first; `other` = every other image model the catalog knows. */
  group: 'latest' | 'other'
}

const PROVIDER_NEEDS: Record<ProviderKey, string> = { kie: 'needs a Kie.ai key', google: 'needs a Google key', openai: 'needs an OpenAI key', openrouter: 'needs an OpenRouter key', fal: 'needs a fal.ai key', comfyui: 'start ComfyUI from Local AI' }

/** Models that are not picture generators for a view (upscalers, background removers, segmenters, callbacks) or need other inputs. */
const NOT_A_VIEW_MAKER = /upscale|remove-background|layer-decomposition|segment|callback|remix|character-edit|crisp/i

/**
 * The engine choice for a view that must be made again. First the newest of each family, in order of preference (the first one the catalog has wins, so a
 * retired id never appears and a newer id is used as soon as the catalog lists it): Nano Banana 2.1, Nano Banana Pro, Seedream (5.5, else 5.0 Pro), GPT Image
 * (2.6 Flare, else 2.5 Flare), Ideogram Character, Wan 2.7 Image Pro, MiniMax H3, and a model on this computer. Then every other image model in the catalog (`group: other`).
 * Every engine is always listed, including the one the view used before: choosing it again is how a view is simply tried once more.
 * `needsReferences` is true when the view is built from the approved front (identity lock): then the image-to-image variant is chosen, and an engine that cannot
 * take references says so, because using it drops the lock.
 */
export function quickEngines(catalog: CatalogModel[], configured: Record<string, boolean>, needsReferences: boolean): EngineOption[] {
  const has = (provider: ProviderKey, id: string) => catalog.find((m) => m.provider === provider && m.id === id)
  const make = (m: CatalogModel, label: string, group: 'latest' | 'other'): EngineOption => {
    const available = !!configured[m.provider]
    const lost = needsReferences && !m.references
    return { key: `${m.provider}|${m.id}`, provider: m.provider, model: m.id, label, available, takesReferences: m.references, group, note: !available ? PROVIDER_NEEDS[m.provider] : lost ? 'no identity lock: it cannot use the approved front as a reference' : '' }
  }
  const option = (provider: ProviderKey, id: string, label: string): EngineOption | null => {
    const m = has(provider, id)
    return m ? make(m, label, 'latest') : null
  }
  const pick = (...choices: Array<EngineOption | null>) => choices.find((c) => c && c.available) ?? choices.find((c) => !!c) ?? null
  const first = (...choices: Array<EngineOption | null>) => choices.find((c) => !!c) ?? null
  const kieVariant = (stem: string, label: string) => option('kie', `${stem}-${needsReferences ? 'image-to-image' : 'text-to-image'}`, label)
  const out: Array<EngineOption | null> = [
    pick(option('google', 'gemini-nano-banana-2.1', 'Nano Banana 2.1'), option('kie', 'google/nanobanana-2-1', 'Nano Banana 2.1')),
    pick(option('google', 'gemini-3-pro-image', 'Nano Banana Pro'), option('kie', 'google/pro-image-to-image', 'Nano Banana Pro')),
    first(kieVariant('seedream/5-5', 'Seedream 5.5'), kieVariant('seedream/5-pro', 'Seedream 5.0 Pro'), option('openrouter', 'bytedance-seed/seedream-4.5', 'Seedream 4.5')),
    first(kieVariant('gpt/gpt-image-2-6-flare', 'GPT Image 2.6'), kieVariant('gpt/gpt-image-2-5-flare', 'GPT Image 2.5'), option('openai', 'gpt-image-1.5', 'GPT Image 1.5')),
    option('kie', 'ideogram/character', 'Ideogram Character'),
    option('kie', 'wan/2-7-image-pro', 'Wan 2.7 Image Pro'),
    option('kie', needsReferences ? 'minimax-h3/image-edit' : 'minimax-h3/text-to-image', 'MiniMax H3'),
  ]
  const local = catalog.filter((m) => m.provider === 'comfyui')
  const localModel = (needsReferences ? local.find((m) => m.references) : undefined) ?? local[0]
  if (localModel) out.push(option('comfyui', localModel.id, `On this computer: ${localModel.name}`))
  else out.push({ key: 'comfyui|none', provider: 'comfyui', model: '', label: 'On this computer (ComfyUI)', available: false, takesReferences: false, group: 'latest', note: PROVIDER_NEEDS.comfyui })
  const latest = out.filter((o): o is EngineOption => !!o)
  const taken = new Set(latest.map((o) => o.key))
  const others = catalog
    .filter((m) => !taken.has(`${m.provider}|${m.id}`) && !NOT_A_VIEW_MAKER.test(m.id) && (!needsReferences || m.references || m.provider === 'comfyui'))
    .map((m) => make(m, `${providerLabels[m.provider].replace(/ \(.*\)/, '')}: ${m.name}`, 'other'))
  return [...latest, ...others]
}
