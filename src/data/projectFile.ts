import { demoGraph } from '../domain/demoGraph'
import type { ProductionGraph } from '../domain/productionGraph'
import type { StudioState } from './projectStore'
import { defaultStyleBible } from '../domain/visualDevelopment'

export const PROJECT_FORMAT = 'production-one-project'
export const PROJECT_EXTENSION = 'pone'

export interface ProjectFile {
  format: typeof PROJECT_FORMAT
  version: 1
  title: string
  savedAt: string
  graph: ProductionGraph
  studio: StudioState
}

export type ParsedProject = { ok: true; file: ProjectFile; legacy: boolean } | { ok: false; error: string }

export function buildProjectFile(title: string, graph: ProductionGraph, studio: StudioState, savedAt = new Date().toISOString()): ProjectFile {
  return { format: PROJECT_FORMAT, version: 1, title, savedAt, graph, studio }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const hasStudioShape = (value: Record<string, unknown>) =>
  isObject(value.analysis) && Array.isArray(value.analysis.scenes) && Array.isArray(value.analysis.assets) && Array.isArray(value.shots)

/** Reads a native .pone project, or a legacy Production Guy (.pguy / .pguy.json) export. Never throws and never mutates the input. */
export function parseProjectFile(text: string): ParsedProject {
  let data: unknown
  try { data = JSON.parse(text) } catch { return { ok: false, error: 'This file is not valid JSON, so it cannot be a Production One or Production Guy project.' } }
  if (!isObject(data)) return { ok: false, error: 'This file does not look like a project.' }
  if (data.format === PROJECT_FORMAT) {
    if (data.version !== 1) return { ok: false, error: `This project was saved by a newer Production One (file version ${String(data.version)}). Update the app to open it.` }
    if (!isObject(data.studio) || !hasStudioShape(data.studio) || !isObject(data.graph)) return { ok: false, error: 'This Production One project is missing its story data.' }
    return { ok: true, legacy: false, file: data as unknown as ProjectFile }
  }
  if (hasStudioShape(data)) {
    const graph = isObject(data.graph) && data.graph.schemaVersion === 1 ? (data.graph as unknown as ProductionGraph) : structuredClone(demoGraph)
    const studio: StudioState = {
      script: typeof data.script === 'string' ? data.script : '',
      analysis: data.analysis as unknown as StudioState['analysis'],
      shots: data.shots as StudioState['shots'],
      jobs: Array.isArray(data.jobs) ? (data.jobs as StudioState['jobs']) : [],
      storyboardsEnabled: typeof data.storyboardsEnabled === 'boolean' ? data.storyboardsEnabled : false,
      model: (data.model as StudioState['model']) ?? 'Seedance 2.0',
      assetOutputs: isObject(data.assetOutputs) ? (data.assetOutputs as Record<string, string>) : {},
      styleBible: isObject(data.styleBible) ? (data.styleBible as unknown as StudioState['styleBible']) : defaultStyleBible,
    }
    const title = typeof data.title === 'string' && data.title.trim() ? data.title : 'Imported Production Guy project'
    return { ok: true, legacy: true, file: buildProjectFile(title, graph, studio) }
  }
  return { ok: false, error: 'This file is not a Production One (.pone) or Production Guy (.pguy) project.' }
}

export const suggestedFileName = (title: string) =>
  `${title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled production'}.${PROJECT_EXTENSION}`
