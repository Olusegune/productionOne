export interface CatalogModel {
  provider: 'google' | 'openai' | 'openrouter' | 'fal'
  id: string
  name: string
  /** Where the entry came from. Built-in entries are documented, not live-tested in this build. */
  source: 'built-in' | 'discovered'
  references: boolean
  note: string
}

export const providerLabels: Record<CatalogModel['provider'], string> = { google: 'Google Gemini', openai: 'OpenAI', openrouter: 'OpenRouter', fal: 'fal.ai' }

/** Reference images are sent only where the adapter supports them (see providers.rs). */
export const providerSendsReferences: Record<CatalogModel['provider'], boolean> = { google: true, openrouter: true, openai: false, fal: false }

export const BUILT_IN_CHECKED = '2026-10-21'

/** Fallback catalog: ids from the provider documentation the project already recorded. No prices or capabilities are stated here; discover or confirm with the provider. */
export const builtInModels: CatalogModel[] = [
  { provider: 'google', id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', source: 'built-in', references: true, note: 'Multi-reference generation; good first choice for identity across views.' },
  { provider: 'google', id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview', source: 'built-in', references: true, note: 'Higher fidelity; confirm the price before a large batch.' },
  { provider: 'openai', id: 'gpt-image-1.5', name: 'GPT Image 1.5', source: 'built-in', references: false, note: 'Strong text-to-image. Reference images are not wired for OpenAI in this build.' },
  { provider: 'openai', id: 'gpt-image-1', name: 'GPT Image 1', source: 'built-in', references: false, note: 'Reference images are not wired for OpenAI in this build.' },
  { provider: 'openrouter', id: 'bytedance-seed/seedream-4.5', name: 'Seedream 4.5 (OpenRouter)', source: 'built-in', references: true, note: 'Check the exact id with Refresh models.' },
  { provider: 'fal', id: 'fal-ai/flux/dev', name: 'FLUX dev (fal.ai)', source: 'built-in', references: false, note: 'Text-to-image only here; reference images are not wired for fal.ai in this build.' },
]

export interface DiscoveredEntry { id: string; name: string }
export type DiscoveredCatalog = Partial<Record<CatalogModel['provider'], { fetchedAt: number; models: DiscoveredEntry[] }>>

/** Built-in entries first, then anything the provider listed that the built-in list does not already have. */
export function mergeCatalog(discovered: DiscoveredCatalog): CatalogModel[] {
  const merged = [...builtInModels]
  for (const provider of Object.keys(discovered) as CatalogModel['provider'][]) {
    for (const model of discovered[provider]?.models ?? []) {
      if (merged.some((m) => m.provider === provider && m.id === model.id)) continue
      merged.push({ provider, id: model.id, name: model.name, source: 'discovered', references: providerSendsReferences[provider], note: 'Listed by the provider. Capabilities and price are not verified here.' })
    }
  }
  return merged
}
