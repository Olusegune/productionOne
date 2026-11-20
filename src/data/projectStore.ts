import type { QueueState } from '../domain/generationQueue'
import type { DemoClip } from '../domain/demoClips'
import { demoGraph } from '../domain/demoGraph'
import type { ProductionGraph } from '../domain/productionGraph'
import type { AnalysisResult, GenerationJob, ShotRecord, VideoModel } from '../domain/productionStudio'
import type { StyleBible } from '../domain/visualDevelopment'
import type { ProportionProfile } from '../domain/proportions'
import type { FitRule } from '../domain/fit'
import type { SceneState } from '../domain/sceneState'
import type { Reviews } from '../domain/visualReview'
import type { Ledgers } from '../domain/correction'
import type { LookState } from '../domain/grade'
import type { WorldRules } from '../domain/worldRules'

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
  queue?: QueueState
  clips?: DemoClip[]
  assetRefs?: Record<string, string[]>
  /** Notes typed on each asset's reference sheet; saved so they survive closing the project. */
  sheetNotes?: Record<string, string>
  /** Choices made per sheet: the shape under asset|sheet and the backdrop under asset|sheet|backdrop. */
  sheetSettings?: Record<string, string>
  /** The shape of the finished frames and video, chosen once for the project (for example 9:16 for TikTok). */
  format?: string
  /** Target proportions per character (asset id). Absent in projects saved before 0.52; a character without one is unchanged. */
  proportions?: Record<string, ProportionProfile>
  /** Set and prop rules proposed from each character's proportions, with the decisions made on them (asset id to rules). */
  fitRules?: Record<string, FitRule[]>
  /** Where things are in each scene (world space), separate from each shot's camera (scene id to state). */
  sceneStates?: Record<string, SceneState>
  /** Visual review results: deterministic and vision findings kept apart, and which categories were checked per output. */
  reviews?: Reviews
  /** Correction attempts and spend per finding. */
  corrections?: Ledgers
  /** Named looks (grades) and where they apply. Metadata only: grades are never baked into pictures. */
  looks?: LookState
  /** World rules: the starting profile new characters begin from, and the scale convention. */
  world?: WorldRules
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
