/**
 * The emotions engine, free layer: reads the feeling in dialogue and action from the words themselves (emotion words, how it is said, punctuation, intensifiers, negation)
 * and follows it across the story per character. Every reading carries the exact words that produced it and how sure the engine is. It reads text only; it can miss
 * subtext and irony, which is what the optional AI pass (and the writer) are for. Nothing here changes the script.
 */
import type { Evidence, ParsedStory, StoryScene } from './story'

export const emotions = ['neutral', 'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'contempt', 'love', 'determination'] as const
export type Emotion = (typeof emotions)[number]

/** Valence (-1 unpleasant .. 1 pleasant) and arousal (0 calm .. 1 intense): used to order and compare feelings. */
export const feeling: Record<Emotion, { valence: number; arousal: number }> = {
  neutral: { valence: 0, arousal: 0.2 }, joy: { valence: 0.9, arousal: 0.7 }, sadness: { valence: -0.8, arousal: 0.2 }, anger: { valence: -0.8, arousal: 0.9 },
  fear: { valence: -0.7, arousal: 0.85 }, surprise: { valence: 0.1, arousal: 0.85 }, disgust: { valence: -0.7, arousal: 0.5 }, contempt: { valence: -0.6, arousal: 0.4 },
  love: { valence: 0.85, arousal: 0.4 }, determination: { valence: 0.3, arousal: 0.6 },
}

export interface EmotionReading {
  emotion: Emotion
  /** 1 (barely visible) to 10 (extreme). */
  intensity: number
  /** 0..1: how much the words support this reading. Low means treat it as a suggestion. */
  confidence: number
  nuance?: string
  valence: number
  arousal: number
  /** The words that produced the reading. */
  cues: string[]
  source: 'rules' | 'ai'
}

type Entry = [RegExp, Emotion, number, string?]
const w = (src: string) => new RegExp(`\\b(?:${src})`, 'i')

const LEXICON: Entry[] = [
  [w('laugh\\w*|giggl\\w*|chuckl\\w*|smil\\w*|grin\\w*|beam\\w*'), 'joy', 1.2],
  [w('happ(?:y|ily|iness)|glad|delight\\w*|joy\\w*|cheer\\w*|celebrat\\w*|thrill\\w*|excit\\w*|elat\\w*|triumph\\w*'), 'joy', 1.6],
  [w('relie(?:f|ved)|laughs? with relief|exhale[sd]? (?:slowly|at last)'), 'joy', 1.2, 'relief'],
  [w('cr(?:y|ies|ied|ying)\\b|tear(?:s|ful|fully)?\\b|weep\\w*|sob\\w*|sniffl\\w*'), 'sadness', 1.8],
  [w('sad(?:ly|ness)?\\b|sorrow\\w*|heartbroken|despair\\w*|hopeless\\w*|lonely|alone\\b|miss(?:es|ed|ing)? (?:him|her|them|you)|defeat\\w*|dejected|forlorn'), 'sadness', 1.5],
  [w('grie(?:f|ve|ving|ves)|mourn\\w*|bereft|funeral|loss of'), 'sadness', 1.8, 'grief'],
  [w('exhaust\\w*|weary|wearily|tired|drained|worn out'), 'sadness', 1.0, 'exhaustion'],
  [w('sorry|apolog\\w*|forgive me|i failed|my fault'), 'sadness', 1.0, 'regret'],
  [w('angr(?:y|ily)|fur(?:y|ious|iously)|rage\\w*|enrag\\w*|seeth\\w*|livid|outrag\\w*|hate\\b|hatred|bitter(?:ly)?'), 'anger', 1.8],
  [w('shout\\w*|yell\\w*|scream\\w*|snarl\\w*|growl\\w*|snap(?:s|ped)? at|slam(?:s|med)?|smash\\w*|storm(?:s|ed)? (?:out|off|away)|clench\\w*|glar\\w*|curs\\w*'), 'anger', 1.4],
  [w('get out|how dare|shut up|you liar|i never want|damn you'), 'anger', 1.5],
  [w('fear\\w*|afraid|terrif\\w*|scar(?:ed|y)|frighten\\w*|panic\\w*|dread\\w*|horrif\\w*|petrif\\w*|terror'), 'fear', 1.8],
  [w('tremb\\w*|shak(?:es|ing|en)|shiver\\w*|flinch\\w*|cower\\w*|backs? away|hands? shak\\w*|heart (?:pounds|races|hammers)'), 'fear', 1.4],
  [w('nervous\\w*|anxious\\w*|anxiety|worr(?:y|ied|ies)|uneasy|apprehensive|on edge'), 'fear', 1.0, 'anxiety'],
  [w('surpris\\w*|astonish\\w*|stun(?:ned)?|startl\\w*|shock(?:ed)?|gasp\\w*|disbelie\\w*|wide-eyed|freez(?:es|ing)|can\'t believe|cannot believe|what\\?!'), 'surprise', 1.6],
  [w('disgust\\w*|revolt\\w*|nause\\w*|repuls\\w*|sicken\\w*|recoil\\w*|gross|vile|foul'), 'disgust', 1.7],
  [w('sneer\\w*|scorn\\w*|mock\\w*|disdain\\w*|smirk\\w*|sarcas\\w*|condescend\\w*|dismissive\\w*|rolls? (?:her|his|their) eyes|coldly|contempt\\w*|pathetic|beneath'), 'contempt', 1.6],
  [w('love[sd]?\\b|loving\\w*|tender\\w*|adore\\w*|affection\\w*|cherish\\w*|caress\\w*|cradl\\w*|kiss\\w*|embrac\\w*|hug(?:s|ged|ging)?\\b|yearn\\w*|longing|devot\\w*'), 'love', 1.6],
  [w('gentl(?:y|e)|softly|warmly|sweetly'), 'love', 0.6, 'warmth'],
  [w('determin\\w*|resolv\\w*|resolute\\w*|steel(?:s|ed)?|steady|steadily|vow\\w*|swear\\w*|refus\\w*|firm(?:ly)?|focus(?:ed|es)?|set jaw|squares? (?:her|his|their) shoulders|won\'t give up|will not give up|promise\\w*'), 'determination', 1.2],
]

/** Delivery words, mostly from parentheticals: (angrily), (whispering), (through tears). */
const DELIVERY: Array<[RegExp, Emotion, number, string?]> = [
  [w('angrily|furiously|bitterly|harshly|hotly'), 'anger', 1.8], [w('sadly|tearfully|through tears|sobbing|mournfully|wearily'), 'sadness', 1.8],
  [w('happily|excitedly|cheerfully|brightly|laughing|giddy'), 'joy', 1.8], [w('nervously|fearfully|anxiously|shakily|trembling|panicked|frightened'), 'fear', 1.8],
  [w('coldly|sarcastically|mockingly|scornfully|dismissively|icily'), 'contempt', 1.8], [w('tenderly|lovingly|softly|gently|warmly|sweetly'), 'love', 1.6],
  [w('firmly|resolutely|steadily|determined|calmly but|quietly firm'), 'determination', 1.6], [w('shocked|stunned|startled|amazed|disbelieving'), 'surprise', 1.8],
  [w('disgusted|revolted|repulsed'), 'disgust', 1.8],
]

const INTENSIFIER = /\b(very|so|utterly|completely|absolutely|desperately|deeply|extremely|terribly|totally|truly|wildly|violently|openly|uncontrollably|never so)\b/i
const DIMINISHER = /\b(slightly|barely|faint(?:ly)?|a little|a bit|somewhat|almost|hint of|trace of|quiet(?:ly)?|restrained|subtle|subtly|tries? not to|fighting back|holds? back|suppress\w*)\b/i
const NEGATION = /\b(?:not|never|no longer|isn't|aren't|wasn't|don't|doesn't|didn't|without|nothing|cannot|can't)\b(?:\s+\w+){0,2}\s*$/i

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Reads one piece of text (a line of dialogue, an action sentence) with an optional delivery note such as a parenthetical. */
export function readText(text: string, context: { parenthetical?: string } = {}): EmotionReading {
  const score = new Map<Emotion, number>()
  const nuances = new Map<Emotion, string>()
  const cues: string[] = []
  let hits = 0
  const add = (emotion: Emotion, weight: number, cue: string, nuance?: string) => {
    score.set(emotion, (score.get(emotion) ?? 0) + weight)
    if (nuance && !nuances.has(emotion)) nuances.set(emotion, nuance)
    if (!cues.includes(cue)) cues.push(cue)
    hits++
  }
  for (const [rx, emotion, weight, nuance] of LEXICON) {
    const g = new RegExp(rx.source, 'gi')
    for (const m of text.matchAll(g)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 32), m.index ?? 0)
      if (NEGATION.test(before)) continue
      add(emotion, weight, m[0].trim(), nuance)
    }
  }
  if (context.parenthetical) for (const [rx, emotion, weight, nuance] of DELIVERY) { const m = rx.exec(context.parenthetical); if (m) add(emotion, weight, `(${m[0]})`, nuance) }
  const exclaim = (text.match(/!/g) ?? []).length
  const caps = (text.match(/\b[A-Z]{3,}\b/g) ?? []).filter((x) => !/^(?:INT|EXT|CUT|DAY)$/.test(x)).length
  let total = [...score.values()].reduce((a, b) => a + b, 0)
  if (total === 0) {
    const quiet = DIMINISHER.test(context.parenthetical ?? '')
    return { emotion: 'neutral', intensity: quiet ? 1 : clamp(1 + exclaim, 1, 4), confidence: exclaim ? 0.3 : 0.2, valence: 0, arousal: feeling.neutral.arousal, cues: exclaim ? ['!'] : [], source: 'rules' }
  }
  if (INTENSIFIER.test(text) || INTENSIFIER.test(context.parenthetical ?? '')) total *= 1.4
  if (DIMINISHER.test(text) || DIMINISHER.test(context.parenthetical ?? '')) total *= 0.6
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1])
  const [top, topScore] = ranked[0]
  const share = topScore / [...score.values()].reduce((a, b) => a + b, 0)
  const intensity = clamp(Math.round(2 + total * 1.4 + exclaim * 0.8 + Math.min(caps, 3) * 0.6), 1, 10)
  const confidence = clamp((0.25 + 0.15 * hits) * (0.5 + share / 2), 0.1, 0.9)
  const f = feeling[top]
  return { emotion: top, intensity, confidence: Math.round(confidence * 100) / 100, nuance: nuances.get(top), valence: f.valence, arousal: f.arousal, cues, source: 'rules' }
}

export interface Beat { sceneId: string; character: string; line: number; quote: string; reading: EmotionReading }

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean)
const nameRx = (name: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')

/** Every reading found for one character in one scene: their own lines (with parentheticals) and the action sentences that name them. */
export function beatsFor(scene: StoryScene, character: string): Beat[] {
  const out: Beat[] = []
  for (const d of scene.dialogue) {
    if (d.speaker.toUpperCase().replace(/^(?:YOUNG|OLD|ELDER|LITTLE)\s+/, '') !== character.toUpperCase()) continue
    out.push({ sceneId: scene.id, character, line: d.line, quote: d.text, reading: readText(d.text, { parenthetical: d.parenthetical }) })
  }
  const rx = nameRx(character)
  for (const act of scene.action) for (const s of sentences(act.text)) if (rx.test(s)) out.push({ sceneId: scene.id, character, line: act.line, quote: s, reading: readText(s.replace(rx, '')) })
  return out
}

/** Merges beats: the strongest feeling wins, but the whole scene's evidence is kept. */
export function combine(beats: Beat[]): EmotionReading {
  const meaningful = beats.filter((b) => b.reading.emotion !== 'neutral')
  if (!meaningful.length) return { emotion: 'neutral', intensity: 1, confidence: beats.length ? 0.25 : 0.1, valence: 0, arousal: feeling.neutral.arousal, cues: [], source: 'rules' }
  const byEmotion = new Map<Emotion, number>()
  for (const b of meaningful) byEmotion.set(b.reading.emotion, (byEmotion.get(b.reading.emotion) ?? 0) + b.reading.intensity * b.reading.confidence)
  const top = [...byEmotion.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const mine = meaningful.filter((b) => b.reading.emotion === top)
  const peak = mine.reduce((a, b) => (b.reading.intensity > a.reading.intensity ? b : a))
  const confidence = clamp(mine.reduce((n, b) => n + b.reading.confidence, 0) / mine.length + 0.05 * (mine.length - 1), 0.1, 0.95)
  return { emotion: top, intensity: peak.reading.intensity, confidence: Math.round(confidence * 100) / 100, nuance: peak.reading.nuance, valence: feeling[top].valence, arousal: feeling[top].arousal, cues: [...new Set(mine.flatMap((b) => b.reading.cues))].slice(0, 6), source: 'rules' }
}

export interface ArcPoint { sceneId: string; sceneNumber: number; reading: EmotionReading; evidence: Evidence[] }
export interface CharacterArc { character: string; points: ArcPoint[] }

/** How each character's feeling travels through the story, scene by scene. */
export function characterArcs(story: ParsedStory): CharacterArc[] {
  return story.characters.map((c) => ({
    character: c.name,
    points: story.scenes.flatMap((scene) => {
      if (!c.sceneIds.includes(scene.id)) return []
      const beats = beatsFor(scene, c.name)
      if (!beats.length) return []
      const strongest = [...beats].filter((b) => b.reading.emotion !== 'neutral').sort((a, b) => b.reading.intensity - a.reading.intensity).slice(0, 2)
      return [{ sceneId: scene.id, sceneNumber: scene.number, reading: combine(beats), evidence: (strongest.length ? strongest : beats.slice(0, 1)).map((b) => ({ line: b.line, text: b.quote })) }]
    }),
  }))
}

export type ActingIntensity = 'subtle' | 'moderate' | 'exaggerated'
export const intensityBand = (n: number): ActingIntensity => (n <= 3 ? 'subtle' : n <= 6 ? 'moderate' : 'exaggerated')

export interface ExpressionNeed { emotion: Emotion; intensity: ActingIntensity; peak: number; sceneIds: string[]; why: string }

/** The expressions this character actually plays, with the intensity the story calls for. Neutral is always included as the baseline. */
export function expressionPlan(arc: CharacterArc): ExpressionNeed[] {
  const byEmotion = new Map<Emotion, { peak: number; scenes: string[]; why: string }>()
  for (const p of arc.points) {
    if (p.reading.emotion === 'neutral') continue
    const cur = byEmotion.get(p.reading.emotion)
    const why = `Scene ${p.sceneNumber}: "${(p.evidence[0]?.text ?? '').slice(0, 80)}"`
    if (!cur) byEmotion.set(p.reading.emotion, { peak: p.reading.intensity, scenes: [p.sceneId], why })
    else { cur.scenes.push(p.sceneId); if (p.reading.intensity > cur.peak) { cur.peak = p.reading.intensity; cur.why = why } }
  }
  const needs: ExpressionNeed[] = [{ emotion: 'neutral', intensity: 'subtle', peak: 1, sceneIds: [], why: 'Baseline reference for the face.' }]
  for (const [emotion, v] of [...byEmotion.entries()].sort((a, b) => b[1].peak - a[1].peak)) needs.push({ emotion, intensity: intensityBand(v.peak), peak: v.peak, sceneIds: v.scenes, why: v.why })
  return needs
}

/** The overall mood of a scene from all its text, for set and lighting direction. */
export function sceneMood(scene: StoryScene): EmotionReading {
  const beats: Beat[] = [...scene.action.flatMap((a) => sentences(a.text).map((s) => ({ sceneId: scene.id, character: '', line: a.line, quote: s, reading: readText(s) }))), ...scene.dialogue.map((d) => ({ sceneId: scene.id, character: d.speaker, line: d.line, quote: d.text, reading: readText(d.text, { parenthetical: d.parenthetical }) }))]
  return combine(beats)
}
