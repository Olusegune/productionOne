/** Voice providers and per-line performance direction. A provider only offers the controls it can honour; anything it cannot do is reported, never faked. */

export type ProviderId = 'windows' | 'chatterbox' | 'qwen-tts' | 'speech-server'
export type VoiceEvent = 'laugh' | 'chuckle' | 'cough' | 'grunt' | 'sigh' | 'gasp'
export type VoiceState = 'neutral' | 'out of breath' | 'eating' | 'carrying a heavy load' | 'whispering' | 'shouting'

export interface VoiceProvider {
  id: ProviderId
  label: string
  /** Where it runs. 'windows' needs no server; 'http' talks to a speech server on this computer or your network. */
  transport: 'windows' | 'http'
  defaultBase: string
  defaultModel: string
  /** Non-speech sounds the model reads as inline tags in the text. Empty means none are supported natively. */
  inlineEvents: VoiceEvent[]
  /** Can make a voice from a written description in the voice field. */
  describesVoice: boolean
  /** True only for providers that have been run end to end. */
  verified: boolean
  note: string
}

export const providers: VoiceProvider[] = [
  { id: 'windows', label: 'Windows voices (stand-in)', transport: 'windows', defaultBase: '', defaultModel: '', inlineEvents: [], describesVoice: false, verified: true, note: 'Free and offline. For casting and timing only.' },
  { id: 'chatterbox', label: 'Chatterbox (local server)', transport: 'http', defaultBase: 'http://127.0.0.1:4123', defaultModel: 'chatterbox', inlineEvents: ['laugh', 'chuckle', 'cough'], describesVoice: false, verified: false, note: 'Open model by Resemble AI that you run yourself. Inline sound tags depend on the version you install; the voice is a name or a reference clip your server knows.' },
  { id: 'qwen-tts', label: 'Qwen TTS (local server)', transport: 'http', defaultBase: 'http://127.0.0.1:8000', defaultModel: 'qwen3-tts', inlineEvents: [], describesVoice: true, verified: false, note: 'Alibaba open model you run yourself. Whether the voice field accepts a written description depends on the server you use.' },
  { id: 'speech-server', label: 'Other speech server', transport: 'http', defaultBase: 'http://127.0.0.1:8000', defaultModel: '', inlineEvents: [], describesVoice: false, verified: false, note: 'Any server on this computer or your network with a /v1/audio/speech route.' },
]

export const providerById = (id: ProviderId) => providers.find((p) => p.id === id) ?? providers[0]

export const voiceEvents: VoiceEvent[] = ['laugh', 'chuckle', 'cough', 'grunt', 'sigh', 'gasp']
export const voiceStates: VoiceState[] = ['neutral', 'out of breath', 'eating', 'carrying a heavy load', 'whispering', 'shouting']

export interface EventCue { event: VoiceEvent; at: 'before' | 'after' }
export interface VoiceDirection { emotion: string; state: VoiceState; events: EventCue[] }
export const emptyDirection: VoiceDirection = { emotion: '', state: 'neutral', events: [] }

export interface Performance {
  /** Exactly what is sent to the voice. */
  text: string
  /** What the provider will do. */
  applied: string[]
  /** What was asked for but cannot be done by this provider, and what to do about it. */
  notApplied: string[]
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Turns a line plus direction into the text sent to the provider, and says plainly what was and was not honoured. */
export function buildPerformance(line: string, direction: VoiceDirection, provider: VoiceProvider): Performance {
  let text = line.trim()
  const applied: string[] = []
  const notApplied: string[] = []
  if (direction.state === 'out of breath') {
    text = text.replace(/([.!?])\s+/g, '$1 ... ').replace(/,\s+/g, '... ')
    applied.push('Out of breath: added short pauses to the text.')
  } else if (direction.state !== 'neutral') {
    notApplied.push(`${cap(direction.state)}: a speech model cannot reliably voice this. It is saved in the casting brief; record it, or add the sound as a separate effect.`)
  }
  if (direction.emotion.trim()) notApplied.push(`Emotion "${direction.emotion.trim()}": sent only in the casting brief; this provider takes no style instruction.`)
  for (const cue of direction.events) {
    if (provider.inlineEvents.includes(cue.event)) {
      text = cue.at === 'before' ? `[${cue.event}] ${text}` : `${text} [${cue.event}]`
      applied.push(`${cap(cue.event)} ${cue.at} the line (inline tag).`)
    } else {
      notApplied.push(`${cap(cue.event)} ${cue.at} the line: ${provider.label} has no ${cue.event} sound. Layer a separate sound effect ${cue.at} this line.`)
    }
  }
  return { text, applied, notApplied }
}

/** A casting-and-performance brief for any outside tool: carries everything the provider could not apply. */
export function performanceBrief(line: string, direction: VoiceDirection): string {
  return [
    `Line: "${line}"`,
    direction.emotion.trim() && `Emotion: ${direction.emotion.trim()}`,
    direction.state !== 'neutral' && `Physical state while speaking: ${direction.state}`,
    ...direction.events.map((c) => `Non-speech sound ${c.at} the line: ${c.event}`),
  ].filter(Boolean).join('\n')
}
