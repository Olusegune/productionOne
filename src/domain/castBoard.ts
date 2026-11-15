import type { ExtractedAsset } from './productionStudio'
import type { ParsedStory, StoryScene, StoryVariant } from '../engine/story'

export interface AssetEvidence {
  line?: number
  text: string
  kind: 'description' | 'dialogue' | 'prop' | 'scene' | 'none'
}

const clip = (text: string, max = 220) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`)
const mentions = (text: string, name: string) => !!name.trim() && text.toLowerCase().includes(name.trim().toLowerCase())

/** The scenes an asset is in, in script order, each with the line to jump to. Only scenes the reader actually linked to it. */
export function scenesOf(asset: ExtractedAsset, story?: ParsedStory): StoryScene[] {
  return story ? story.scenes.filter((s) => asset.sceneIds.includes(s.id)).sort((a, b) => a.number - b.number) : []
}

/**
 * The words in the script that explain why this asset exists, so it can be shown beside its picture. A character: the first description line that names them,
 * else their first line of dialogue. A prop: the line the reader found it on. Anything else: the heading of its first scene. Nothing is written for the person.
 */
export function evidenceFor(asset: ExtractedAsset, story?: ParsedStory): AssetEvidence {
  if (!story) return { text: '', kind: 'none' }
  const scenes = scenesOf(asset, story)
  if (asset.type === 'prop') {
    const prop = story.props.find((p) => p.name.toLowerCase() === asset.name.toLowerCase())
    const e = prop?.evidence[0]
    if (e) return { line: e.line, text: clip(e.text), kind: 'prop' }
  }
  if (asset.type === 'character') {
    for (const s of story.scenes) {
      const hit = s.action.find((a) => mentions(a.text, asset.name))
      if (hit) return { line: hit.line, text: clip(hit.text), kind: 'description' }
    }
    for (const s of story.scenes) {
      const hit = s.dialogue.find((d) => d.speaker.toUpperCase() === asset.name.toUpperCase() && d.text.trim())
      if (hit) return { line: hit.line, text: clip(hit.text), kind: 'dialogue' }
    }
  }
  const first = scenes[0]
  return first ? { line: first.startLine, text: first.heading, kind: 'scene' } : { text: '', kind: 'none' }
}

/** Ages and costumes the script gives this character, each with its source line. Characters only. */
export function looksOf(asset: ExtractedAsset, story?: ParsedStory): StoryVariant[] {
  if (!story || asset.type !== 'character') return []
  return story.variants.filter((v) => v.character.toUpperCase() === asset.name.toUpperCase())
}

/** The accent for each kind of asset: a thin edge on its card, never the text colour. */
export const typeTint: Record<ExtractedAsset['type'], string> = {
  character: 'var(--tint-character)',
  costume: 'var(--tint-costume)',
  prop: 'var(--tint-prop)',
  set: 'var(--tint-set)',
  environment: 'var(--tint-environment)',
}

export const typeName: Record<ExtractedAsset['type'], string> = { character: 'Character', costume: 'Costume', prop: 'Prop', set: 'Set', environment: 'Environment' }

/** Which asset is selected after the list changes: the same one if it is still there, else the first. */
export function keepSelection(assets: ExtractedAsset[], selectedId: string | null): string | null {
  if (selectedId && assets.some((a) => a.id === selectedId)) return selectedId
  return assets[0]?.id ?? null
}
