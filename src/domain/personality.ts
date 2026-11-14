/**
 * A character's personality, as the person describes how they come across. It shapes two things only: the delivery tags of the emotional-range casting line,
 * and a line about carriage in motion prompts. It never changes who the character is or how they look.
 */
export type Personality = 'timid' | 'cool' | 'bratty' | 'aggressive' | 'warm'

export const personalities: ReadonlyArray<{ value: Personality; label: string; carriage: string }> = [
  { value: 'timid', label: 'Timid, sweet', carriage: 'small, soft, hesitant movements, downward glances, quick to startle' },
  { value: 'cool', label: 'Cool, controlled', carriage: 'slow, minimal and precise, long holds, one sharp clipped turn at the peak' },
  { value: 'bratty', label: 'Bratty, chaotic', carriage: 'quick and bouncy, swaying on the rhythm, snapping toward whatever is loud' },
  { value: 'aggressive', label: 'Aggressive, tough', carriage: 'chin down, hard eyes, heavy deliberate movements, a forward push on the loud moment' },
  { value: 'warm', label: 'Warm, open', carriage: 'easy and generous, leaning in, lots of eye contact' },
]

export const isPersonality = (value: unknown): value is Personality => personalities.some((p) => p.value === value)

/** The seven deliveries of the emotional-range line, in order. */
export type RangeBeat = 'curious' | 'playful' | 'laugh' | 'whisper' | 'gasp' | 'loud' | 'release'

const neutralTags: Record<RangeBeat, string> = { curious: 'curious', playful: 'mischievously', laugh: 'laughs softly', whisper: 'whispers', gasp: 'gasps', loud: 'shouting', release: 'sighs' }

const tagSets: Record<Personality, Record<RangeBeat, string>> = {
  timid: { curious: 'hesitant, curious', playful: 'shyly playful', laugh: 'nervous little laugh', whisper: 'whispers', gasp: 'small startled gasp', loud: 'voice rising with effort', release: 'sighs, relieved' },
  cool: { curious: 'cool, measured', playful: 'dry, faintly amused', laugh: 'dry quiet laugh', whisper: 'low, calm whisper', gasp: 'sharp, clipped intake of breath', loud: 'cold disbelief, still controlled', release: 'slow exhale' },
  bratty: { curious: 'teasing, sing-song', playful: 'cocky, dragging it out', laugh: 'snorting laugh', whisper: 'stage whisper', gasp: 'dramatic gasp', loud: 'loud, playfully annoyed', release: 'theatrical sigh' },
  aggressive: { curious: 'hard, challenging', playful: 'menacing, amused', laugh: 'short harsh laugh', whisper: 'low, threatening whisper', gasp: 'sharp breath in', loud: 'roaring', release: 'heavy exhale' },
  warm: { curious: 'warm, interested', playful: 'gently teasing', laugh: 'easy warm laugh', whisper: 'soft whisper', gasp: 'delighted gasp', loud: 'raised and joyful', release: 'contented sigh' },
}

/** One tag per beat, shaped to the personality; the neutral set when none is chosen. */
export function rangeTags(personality?: string): Record<RangeBeat, string> {
  return isPersonality(personality) ? tagSets[personality] : neutralTags
}

/** A line for motion prompts about how this character carries themselves. Empty when no personality is chosen. */
export function carriageLine(personality?: string): string {
  const found = personalities.find((p) => p.value === personality)
  return found ? `Carriage and expression: ${found.carriage}.` : ''
}
