import type { ExtractedAsset } from './productionStudio'
import type { ParsedStory, StoryScene } from '../engine/story'
import { isPersonality } from './personality'

export const TITLE_MAX = 80
export const STYLE_MAX = 1000

/** The musical colour of each personality. Stated by the person, so it is safe to use. */
const musicalMood: Record<string, string> = {
  timid: 'sparse and gentle, soft piano and airy strings, hesitant phrasing',
  cool: 'minimal and controlled, muted bass and dry percussion, restrained and spacious',
  bratty: 'bouncy and bright, playful rhythm, quick staccato hooks',
  aggressive: 'heavy and driving, hard percussion, low distorted bass, forceful',
  warm: 'open and inviting, acoustic guitar and warm strings, flowing melody',
}

export interface MusicBrief {
  title: string
  style: string
  /** What the style was built from, in plain words, so the person can see nothing was invented. */
  evidence: string[]
  missing: string[]
}

export type MusicTarget = { kind: 'theme' } | { kind: 'scene'; sceneId: string }

const clamp = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max).trimEnd())

/** The scenes a character appears in, for the "score a scene" choice. */
export function scenesFor(asset: ExtractedAsset, story?: ParsedStory): StoryScene[] {
  return story ? story.scenes.filter((s) => asset.sceneIds.includes(s.id)) : []
}

/** Builds a music brief from stated fields and the scene's own heading. A theme uses the character; a scene uses where and when it is set. Nothing is guessed. */
export function scriptMusicBrief(asset: ExtractedAsset, target: MusicTarget, story?: ParsedStory, idea = ''): MusicBrief {
  const evidence: string[] = []
  const missing: string[] = []
  const parts: string[] = []
  let title = ''
  if (target.kind === 'theme') {
    title = `${asset.name} theme`
    const mood = isPersonality(asset.personality) ? musicalMood[asset.personality] : ''
    if (mood) { parts.push(mood); evidence.push(`Personality: ${asset.personality}`) } else missing.push('a personality')
    if (asset.role?.trim()) { parts.push(`theme for the ${asset.role.trim()}`); evidence.push(`Role: ${asset.role.trim()}`) }
  } else {
    const scene = story?.scenes.find((s) => s.id === target.sceneId)
    if (!scene) { missing.push('a scene') } else {
      title = `Scene ${scene.number} ${scene.setting}`.trim()
      const where = [scene.intExt !== 'UNSPECIFIED' ? scene.intExt.toLowerCase() : '', scene.setting, scene.timeOfDay !== 'UNSPECIFIED' ? scene.timeOfDay.toLowerCase() : ''].filter(Boolean).join(', ')
      if (where) { parts.push(`underscore for a scene set ${where}`); evidence.push(`Scene heading: ${scene.heading}`) }
      const mood = isPersonality(asset.personality) ? musicalMood[asset.personality] : ''
      if (mood) { parts.push(`leaning ${mood}`); evidence.push(`${asset.name}'s personality: ${asset.personality}`) }
    }
  }
  if (asset.soundDirection?.trim()) { parts.push(asset.soundDirection.trim()); evidence.push('Your sound direction') }
  if (idea.trim()) { parts.push(idea.trim()); evidence.push('Your idea') }
  const style = parts.length ? clamp(`${parts.join('; ')}.`, STYLE_MAX) : ''
  return { title: clamp(title, TITLE_MAX), style, evidence, missing }
}

export const MUSIC_HELPER_SYSTEM = 'You write short music prompts for an AI music generator. Reply with JSON only: {"title": "...", "style": "..."}. The title is at most 6 words. The style names genre, instruments, tempo, mood and texture in one paragraph of 25 to 70 words. Use only the facts you are given. Never invent plot, names or lyrics.'

export function musicHelperPrompt(asset: ExtractedAsset, target: MusicTarget, story: ParsedStory | undefined, idea: string): string {
  const scene = target.kind === 'scene' ? story?.scenes.find((s) => s.id === target.sceneId) : undefined
  const facts = [asset.role && `role: ${asset.role}`, isPersonality(asset.personality) && `personality: ${asset.personality}`, asset.soundDirection && `sound direction: ${asset.soundDirection}`].filter(Boolean).join('\n')
  return [target.kind === 'theme' ? `A theme for the character ${asset.name}.` : `Music under a scene featuring ${asset.name}.`, scene && `Scene heading: ${scene.heading}`, scene?.action.length ? `What happens: ${scene.action.slice(0, 4).map((a) => a.text).join(' ')}` : '', facts || 'No other facts are known.', idea.trim() && `The person wants: ${idea.trim()}`].filter(Boolean).join('\n')
}

/** Reads the model's reply (JSON or plain text) into a title and style within the service's limits. Null when nothing is usable. */
export function parseMusicReply(reply: string): { title: string; style: string } | null {
  const text = reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const json = text.match(/\{[\s\S]*\}/)
  if (!json) return null
  try {
    const v = JSON.parse(json[0]) as { title?: unknown; style?: unknown }
    const style = typeof v.style === 'string' ? v.style.replace(/\s+/g, ' ').trim() : ''
    if (style.length < 10) return null
    return { title: clamp(typeof v.title === 'string' ? v.title.trim() : '', TITLE_MAX), style: clamp(style, STYLE_MAX) }
  } catch { return null }
}
