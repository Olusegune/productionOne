import { emotions, type Emotion } from './emotion'
import type { ParsedStory, StoryScene } from './story'

/**
 * The optional AI layer of the emotions engine. A language model (local or cloud) reads one scene at a time and returns structured beats: the feeling, how strong, the
 * subtext and a physical tell. Nothing it says is trusted blindly: a beat only counts if the quote it cites really appears in the scene, the feeling is one the engine knows,
 * and the character is one the script names. Everything it adds is marked as AI so the writer can tell it from what the rules read.
 */
export interface AiBeat { character: string; emotion: Emotion; intensity: number; nuance?: string; quote: string; subtext?: string; tell?: string }
export interface AiSceneReading { sceneId: string; model: string; mood?: { emotion: Emotion; intensity: number }; beats: AiBeat[]; dropped: number }

export const AI_SYSTEM = `You are a careful script analyst helping a director and a character designer. You read one scene and report how each named character feels, with evidence. Answer with JSON only: no prose, no markdown.`

const SYNONYMS: Record<string, Emotion> = {
  happy: 'joy', happiness: 'joy', excited: 'joy', delighted: 'joy', relieved: 'joy', amused: 'joy', hopeful: 'joy', proud: 'joy',
  sad: 'sadness', grief: 'sadness', grieving: 'sadness', sorrow: 'sadness', regret: 'sadness', lonely: 'sadness', tired: 'sadness', exhausted: 'sadness', guilt: 'sadness', guilty: 'sadness',
  angry: 'anger', furious: 'anger', irritated: 'anger', frustrated: 'anger', resentful: 'anger', bitter: 'anger',
  afraid: 'fear', scared: 'fear', anxious: 'fear', nervous: 'fear', worried: 'fear', terrified: 'fear', dread: 'fear',
  shocked: 'surprise', astonished: 'surprise', startled: 'surprise', confused: 'surprise',
  disgusted: 'disgust', revolted: 'disgust', repulsed: 'disgust',
  scornful: 'contempt', disdain: 'contempt', sarcastic: 'contempt', dismissive: 'contempt', smug: 'contempt',
  affection: 'love', tender: 'love', tenderness: 'love', longing: 'love', warmth: 'love', loving: 'love',
  resolve: 'determination', resolute: 'determination', determined: 'determination', resolved: 'determination', defiant: 'determination', courage: 'determination', calm: 'neutral',
}

export function beatPrompt(scene: StoryScene, characters: string[]): string {
  return [
    `Scene: ${scene.heading}`,
    `Named characters: ${characters.join(', ') || '(none)'}`,
    '',
    'Scene text:',
    scene.body || scene.action.map((a) => a.text).join('\n'),
    '',
    'Return JSON in exactly this shape:',
    `{"scene_mood":{"emotion":"<one of ${emotions.join('|')}>","intensity":<1-10>},"beats":[{"character":"<NAME from the list>","emotion":"<one of ${emotions.join('|')}>","intensity":<1-10>,"nuance":"<one or two words, like exhaustion or resolve>","quote":"<words copied exactly from the scene text that show it>","subtext":"<what they really mean, at most 18 words>","tell":"<one physical tell the actor could show, at most 12 words>"}]}`,
    'Rules: give at most one beat per character; skip characters who do not appear; the quote must be copied word for word from the scene text; never invent events.',
  ].join('\n')
}

const norm = (t: string) => t.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
const toEmotion = (raw: unknown): Emotion | null => {
  const w = String(raw ?? '').toLowerCase().trim()
  if ((emotions as readonly string[]).includes(w)) return w as Emotion
  return SYNONYMS[w] ?? null
}
const clampInt = (n: unknown) => Math.min(10, Math.max(1, Math.round(Number(n))))
const short = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

/** Pulls the first JSON object out of a model reply (models sometimes wrap it in text or a code fence). */
export function extractJson(reply: string): unknown {
  const start = reply.indexOf('{')
  if (start < 0) return null
  for (let end = reply.lastIndexOf('}'); end > start; end = reply.lastIndexOf('}', end - 1)) {
    try { return JSON.parse(reply.slice(start, end + 1)) } catch { /* try a shorter slice */ }
  }
  return null
}

export function parseBeats(reply: string, scene: StoryScene, characters: string[], model: string): AiSceneReading {
  const data = extractJson(reply) as { scene_mood?: { emotion?: unknown; intensity?: unknown }; beats?: unknown } | null
  const text = norm(scene.body + ' ' + scene.dialogue.map((d) => d.text).join(' '))
  const known = new Map(characters.map((c) => [c.toUpperCase(), c]))
  const beats: AiBeat[] = []
  let dropped = 0
  const seen = new Set<string>()
  for (const raw of Array.isArray(data?.beats) ? (data!.beats as Array<Record<string, unknown>>) : []) {
    const name = known.get(String(raw?.character ?? '').toUpperCase())
    const emotion = toEmotion(raw?.emotion)
    const quote = short(raw?.quote, 240)
    const intensity = clampInt(raw?.intensity)
    if (!name || !emotion || !quote || !Number.isFinite(intensity) || !text.includes(norm(quote)) || seen.has(name)) { dropped++; continue }
    seen.add(name)
    beats.push({ character: name, emotion, intensity, nuance: short(raw?.nuance, 30), quote, subtext: short(raw?.subtext, 140), tell: short(raw?.tell, 100) })
  }
  const moodEmotion = toEmotion(data?.scene_mood?.emotion)
  return { sceneId: scene.id, model, mood: moodEmotion ? { emotion: moodEmotion, intensity: clampInt(data?.scene_mood?.intensity) } : undefined, beats, dropped }
}

export type StoryWithAi = ParsedStory & { ai?: Record<string, AiSceneReading> }

export function applyAi(story: ParsedStory, readings: AiSceneReading[]): StoryWithAi {
  return { ...story, ai: { ...((story as StoryWithAi).ai ?? {}), ...Object.fromEntries(readings.map((r) => [r.sceneId, r])) } }
}
