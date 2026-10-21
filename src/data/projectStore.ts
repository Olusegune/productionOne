import { demoGraph } from '../domain/demoGraph'
import type { ProductionGraph } from '../domain/productionGraph'
import type { AnalysisResult, GenerationJob, ShotRecord, VideoModel } from '../domain/productionStudio'
import type { StyleBible } from '../domain/visualDevelopment'

const KEY = 'production-guy:project:v1'
const STUDIO_KEY = 'production-guy:studio:v1'

export interface StudioState {
  script: string
  analysis: AnalysisResult
  shots: ShotRecord[]
  jobs: GenerationJob[]
  storyboardsEnabled: boolean
  model: VideoModel
  assetOutputs?: Record<string,string>
  styleBible?: StyleBible
  title?: string
}

export const projectStore = {
  loadLocal(): ProductionGraph {
    const saved = localStorage.getItem(KEY)
    if (!saved) return structuredClone(demoGraph)
    try {
      const parsed = JSON.parse(saved) as ProductionGraph
      return parsed.schemaVersion === 1 ? parsed : structuredClone(demoGraph)
    } catch { return structuredClone(demoGraph) }
  },
  async load(): Promise<ProductionGraph> {
    if ('__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core')
      const saved = await invoke<string | null>('load_project')
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ProductionGraph
          if (parsed.schemaVersion === 1) return parsed
        } catch { /* Fall through to a clean graph. */ }
      }
    }
    return this.loadLocal()
  },
  async save(graph: ProductionGraph) {
    const serialized = JSON.stringify(graph)
    localStorage.setItem(KEY, serialized)
    if ('__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('save_project', { contents: serialized })
    }
  },
  clear() { localStorage.removeItem(KEY) },
}

export const studioStore = {
  async load(): Promise<StudioState | null> {
    let saved: string | null = localStorage.getItem(STUDIO_KEY)
    if ('__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core')
      saved = await invoke<string | null>('load_studio') ?? saved
    }
    if (!saved) return null
    try { return JSON.parse(saved) as StudioState } catch { return null }
  },
  async save(state: StudioState) {
    const serialized = JSON.stringify(state)
    localStorage.setItem(STUDIO_KEY, serialized)
    if ('__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('save_studio', { contents: serialized })
    }
  },
}
