import type { ExtractedAsset } from './productionStudio'
import type { ParsedStory } from '../engine/story'
import { castingLine, sampleLines } from './voiceAudition'
import { isPersonality } from './personality'

/** ElevenLabs Voice Design accepts a description of 20 to 1000 characters and sample text of 100 to 1000. */
export const DESCRIPTION_MIN = 20
export const DESCRIPTION_MAX = 1000
export const SAMPLE_MIN = 100
export const SAMPLE_MAX = 1000

/** How each personality sounds when it speaks. Stated by the person, so it is safe to use. */
const spokenManner: Record<string, string> = {
  timid: 'soft, hesitant, a little breathy, trailing off at the ends of sentences',
  cool: 'low, even and unhurried, dry, with very little rise and fall',
  bratty: 'quick, bright and cheeky, with a teasing lift and clipped emphasis',
  aggressive: 'hard-edged and forceful, clipped consonants, a growl when pushed',
  warm: 'open, friendly and gentle, smiling through the words',
}

export interface VoiceBrief {
  /** A description ready for a voice-design engine. Empty when the script and the character's fields say too little. */
  description: string
  /** Text the designed voice reads, taken from the character's own dialogue where there is enough. */
  sample: string
  /** What the description was built from, in plain words, so the person can see nothing was invented. */
  evidence: string[]
  /** What would make it better. */
  missing: string[]
}

const clamp = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`)

/** Builds a voice brief only from what the person confirmed and what the script says. Nothing is guessed from a name or a picture. */
export function scriptVoiceBrief(asset: ExtractedAsset, story?: ParsedStory, idea = ''): VoiceBrief {
  const evidence: string[] = []
  const missing: string[] = []
  const parts: string[] = []
  const years = Number.parseInt(asset.age ?? '', 10)
  const who = [Number.isFinite(years) ? `${years}-year-old` : asset.age?.trim(), asset.gender?.trim()].filter(Boolean).join(' ')
  if (who) { parts.push(who); evidence.push(`Stated: ${who}`) } else missing.push('age and gender')
  if (asset.role?.trim()) { parts.push(`who is the ${asset.role.trim()}`); evidence.push(`Role: ${asset.role.trim()}`) }
  const manner = isPersonality(asset.personality) ? spokenManner[asset.personality] : ''
  if (manner) { parts.push(`speaking ${manner}`); evidence.push(`Personality: ${asset.personality}`) } else missing.push('a personality')
  if (asset.soundDirection?.trim()) { parts.push(asset.soundDirection.trim()); evidence.push('Your sound direction') }
  if (idea.trim()) { parts.push(idea.trim()); evidence.push('Your idea') }
  let description = parts.length ? `Voice of a ${parts.join(', ')}.` : ''
  if (description.length < DESCRIPTION_MIN) description = ''
  const lines = sampleLines(story, asset.name, 12).map((l) => l.text)
  let sample = clamp(lines.join(' '), SAMPLE_MAX)
  if (lines.length) evidence.push(`${lines.length} line${lines.length === 1 ? '' : 's'} this character speaks in the script`)
  else missing.push('dialogue in the script')
  if (sample.length < SAMPLE_MIN) {
    sample = clamp(`${sample} ${castingLine('pangram', false)}`.trim(), SAMPLE_MAX)
    if (lines.length) missing.push('more dialogue (a standard line was added to reach the minimum length)')
  }
  return { description: description ? clamp(description, DESCRIPTION_MAX) : '', sample, evidence, missing }
}

export const HELPER_SYSTEM = 'You write short voice descriptions for a text-to-speech voice-design tool. Reply with JSON only: {"description": "..."}. Describe age range, gender, pitch, timbre, pace, accent (only if given), emotional colour and manner of speaking, in one paragraph of 30 to 80 words. Use only the facts you are given. Never invent a backstory, a name or an accent that was not stated.'

/** The question sent to the local model. It carries only confirmed fields, the person's idea and the character's own lines. */
export function helperPrompt(asset: ExtractedAsset, lines: string[], idea: string): string {
  const facts = [asset.age && `age: ${asset.age}`, asset.gender && `gender: ${asset.gender}`, asset.role && `role: ${asset.role}`, isPersonality(asset.personality) && `personality: ${asset.personality}`, asset.soundDirection && `sound direction: ${asset.soundDirection}`].filter(Boolean).join('\n')
  return [`Character: ${asset.name}`, facts || 'No other facts are known.', idea.trim() && `The person wants: ${idea.trim()}`, lines.length ? `Lines this character speaks:\n${lines.slice(0, 8).map((l) => `- ${l}`).join('\n')}` : 'No dialogue is available yet.'].filter(Boolean).join('\n')
}

/** Reads the model's reply, which may be JSON or plain text, and returns a description that fits the engine's limits. Empty when there is nothing usable. */
export function parseHelperReply(reply: string): string {
  let text = reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const json = text.match(/\{[\s\S]*\}/)
  if (json) { try { const v = JSON.parse(json[0]) as { description?: unknown }; text = typeof v.description === 'string' ? v.description : '' } catch { /* use the text as it came */ } }
  text = text.replace(/\s+/g, ' ').trim()
  return text.length < DESCRIPTION_MIN ? '' : clamp(text, DESCRIPTION_MAX)
}
