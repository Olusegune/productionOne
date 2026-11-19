import { buildProjectFile, type ProjectFile } from '../data/projectFile'
import type { StudioState } from '../data/projectStore'
import type { ProductionGraph } from './productionGraph'
import type { AnalysisResult, ExtractedAsset } from './productionStudio'
import { buildViewPrompt, sheetTypesFor, viewsFor } from './sheetSpecs'
import { stylePresets, type StyleBible } from './visualDevelopment'

/** A fixed demonstration: one character, one prop and one place, made by hand (no script), each ready for its sheets. Nothing here is random or time-dependent. */
export const demoAssets2D = (): ExtractedAsset[] => [
  { id: 'DEMO-CHAR-001', name: 'Mira', type: 'character', sceneIds: [], status: 'planned', age: '30s', gender: 'female', role: 'harbour pilot',
    description: 'A weathered harbour pilot with a short grey-streaked braid, a long navy coat with brass buttons, a patched satchel and a small scar through her left eyebrow.', never: 'never without the scar' },
  { id: 'DEMO-PROP-001', name: 'Brass lantern', type: 'prop', sceneIds: [], status: 'planned',
    description: 'A squat brass storm lantern with a cracked blue glass shade, a looped leather handle and a dented base.' },
  { id: 'DEMO-SET-001', name: 'Harbour office', type: 'set', sceneIds: [], status: 'planned',
    description: 'A cramped harbour master\'s office above the quay: wood panelling, charts pinned to the walls, a big brass telescope.',
    layout: 'The door is on the left wall. A large desk sits in the centre facing the door. A tall window with the quay behind it is directly behind the desk. A chart table runs along the right wall. The brass telescope stands in the right corner by the window.' },
]

/** The styles used to show the library working: one from each family that most needs its own handling. */
export const DEMO_STYLE_NAMES = ['Clean digital cel animation', 'Watercolor Storybook', 'Flat vector', 'Graphic novel', 'Low-resolution pixel art'] as const

export const styleByName = (name: string): StyleBible => {
  const found = stylePresets.find((s) => s.name === name)
  if (!found) throw new Error(`No style called ${name}`)
  return found
}

export interface DemoRequest { assetId: string; assetName: string; sheetType: string; viewKey: string; label: string; prompt: string }

/** Every request the demo would make for a style: the character's turnaround, expressions, poses and costume, the prop's views, and the place's establishing and layout views. Prompts only; nothing is sent. */
export function demo2DRequests(style: StyleBible): DemoRequest[] {
  const out: DemoRequest[] = []
  const plan: Array<[string, string[]]> = [['character', ['Turnaround', 'Expressions', 'Poses', 'Wardrobe']], ['prop', ['Multi-view']], ['set', ['Establishing', 'Layout']]]
  for (const asset of demoAssets2D()) {
    const wanted = plan.find(([type]) => type === asset.type)?.[1] ?? []
    for (const sheet of sheetTypesFor(asset.type).filter((t) => wanted.includes(t))) {
      for (const view of viewsFor(asset.type, sheet)) {
        out.push({ assetId: asset.id, assetName: asset.name, sheetType: sheet, viewKey: view.key, label: view.label,
          prompt: buildViewPrompt({ style, asset, variant: 'Canonical', sheetType: sheet as never, view, anchored: !['front', 'full-front', 'establishing', 'plan'].includes(view.key) && view.key !== 'portrait', backdrop: 'gray' }) })
      }
    }
  }
  return out
}

const emptyGraph: ProductionGraph = { schemaVersion: 1, nodes: [], edges: [] }

/** A saved project (.pone) for the demonstration, in one style. Fixed date so the file is identical every time it is made. */
export function demo2DProject(style: StyleBible): ProjectFile {
  const analysis: AnalysisResult = { scenes: [], assets: demoAssets2D() }
  const studio: StudioState = {
    script: '', analysis, shots: [], jobs: [], storyboardsEnabled: false, model: 'Seedance 2.0', styleBible: { ...style, locked: false },
    title: `2D style demo: ${style.name}`, format: '16:9',
  }
  return buildProjectFile(`2D style demo: ${style.name}`, structuredClone(emptyGraph), studio, '2026-11-19T00:00:00.000Z')
}
