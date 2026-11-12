import type { ExtractedAsset } from './productionStudio'
import type { ParsedStory } from '../engine/story'
import { isVehicleName } from './demoClips'

export interface InstalledVoice { name: string; gender: string; age: string; culture: string }

/** Dialogue this character actually speaks in the script, with the line each came from. Nothing is invented. */
export function sampleLines(story: ParsedStory | undefined, name: string, limit = 8): Array<{ line: number; text: string }> {
  if (!story) return []
  const out: Array<{ line: number; text: string }> = []
  for (const scene of story.scenes) for (const d of scene.dialogue) if (d.speaker.toUpperCase() === name.toUpperCase() && d.text.trim()) out.push({ line: d.line, text: d.text.trim() })
  return out.slice(0, limit)
}

/** Picks an installed voice that matches the character's stated gender and age when they are known; otherwise the first voice. Stated fields only, never guessed. */
export function suggestVoice(voices: InstalledVoice[], asset: Pick<ExtractedAsset, 'gender' | 'age'>): InstalledVoice | undefined {
  if (!voices.length) return undefined
  const g = (asset.gender ?? '').toLowerCase()
  const want = /^(f|woman|girl|female)/.test(g) ? 'female' : /^(m|man|boy|male)/.test(g) ? 'male' : ''
  const years = Number.parseInt(asset.age ?? '', 10)
  const wantAge = Number.isFinite(years) ? (years < 13 ? 'child' : years >= 60 ? 'senior' : 'adult') : ''
  const score = (v: InstalledVoice) => (want && v.gender.toLowerCase() === want ? 2 : 0) + (wantAge && v.age.toLowerCase().includes(wantAge) ? 1 : 0)
  return [...voices].sort((a, b) => score(b) - score(a))[0]
}

/** A plain-language casting brief for any outside voice or sound tool. Built only from fields the person confirmed. */
export function voiceBrief(asset: ExtractedAsset, line?: string): string {
  const facts = [asset.age && `age ${asset.age}`, asset.gender, asset.role].filter(Boolean).join(', ')
  return [`Voice audition for ${asset.name}${facts ? ` (${facts})` : ''}.`, asset.soundDirection ? `Direction: ${asset.soundDirection}` : 'Direction: not set. Describe the timbre, pace and accent you want.', line ? `Line to perform: "${line}"` : ''].filter(Boolean).join('\n')
}

/** Sound brief for props and vehicles. The video audition can show motion; this lists the sounds a recordist or sound-effects tool should supply. */
export function soundBrief(asset: ExtractedAsset): string {
  const defaults = isVehicleName(asset.name) ? 'engine start, idle, pass-by at speed, tyre noise, door close, horn' : 'handling, set-down, any moving parts, material sound (metal, wood, plastic, fabric)'
  return [`Sound brief for ${asset.name}.`, `Sounds to supply: ${asset.soundDirection?.trim() || defaults}.`, 'Deliver each as a separate clean take with room tone, no music.'].join('\n')
}
