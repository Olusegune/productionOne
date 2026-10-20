import { demoGraph } from '../domain/demoGraph'
import type { ProductionGraph } from '../domain/productionGraph'

const KEY = 'production-guy:project:v1'

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
