/** Voice providers and per-line performance direction. A provider only offers the controls it can honour; anything it cannot do is reported, never faked. */

import { supportsAudioTags } from './elevenModels'

export type ProviderId = 'windows' | 'chatterbox' | 'qwen-tts' | 'wazobia' | 'speech-server' | 'elevenlabs' | 'voicekiller'
export type VoiceEvent = 'laugh' | 'chuckle' | 'cough' | 'grunt' | 'sigh' | 'gasp'
export type VoiceState = 'neutral' | 'out of breath' | 'eating' | 'carrying a heavy load' | 'whispering' | 'shouting'

export interface VoiceProvider {
  id: ProviderId
  label: string
  /** Where it runs. 'windows' needs no server; 'http' talks to a speech server on this computer or your network. */
  transport: 'windows' | 'http' | 'cloud'
  defaultBase: string
  defaultModel: string
  /** Non-speech sounds the model reads as inline tags in the text, and the tag word each one uses. Absent means none are supported natively. */
  eventTags?: Partial<Record<VoiceEvent, string>>
  /** Physical states the model reads as a tag (for example whispering). */
  stateTags?: Partial<Record<VoiceState, string>>
  /** Tags only work with models this says yes to (matched by pattern so newer models work without an update). */
  tagModelCheck?: (modelId: string) => boolean
  /** The emotion is passed as a tag the model may or may not honour. */
  emotionAsTag?: boolean
  /** Emotion and physical state are sent as a plain-language instruction field. */
  takesInstructions?: boolean
  /** Can make a separate sound effect (grunt, laugh, engine) from a written description. */
  soundEffects?: boolean
  /** Can design a new voice from a written description, then keep it. */
  designsVoices?: boolean
  /** Models the person can choose between. */
  models?: Array<{ id: string; label: string }>
  /** Credential names this provider needs saved in the Windows Credential Manager. */
  keys?: Array<{ id: string; label: string }>
  /** Can make a voice from a written description in the voice field. */
  describesVoice: boolean
  /** Nigerian-language engine with its own language, reference clip and expressiveness settings. */
  languages?: Array<{ id: string; label: string }>
  /** True only for providers that have been run end to end. */
  verified: boolean
  note: string
}

export const providers: VoiceProvider[] = [
  { id: 'windows', label: 'Windows voices (stand-in)', transport: 'windows', defaultBase: '', defaultModel: '', describesVoice: false, verified: true, note: 'Free and offline. For casting and timing only.' },
  { id: 'chatterbox', label: 'Chatterbox (local server)', transport: 'http', defaultBase: 'http://127.0.0.1:4123', defaultModel: 'chatterbox', eventTags: { laugh: 'laugh', chuckle: 'chuckle', cough: 'cough' }, describesVoice: false, verified: false, note: 'Open model by Resemble AI that you run yourself. Inline sound tags depend on the version you install; the voice is a name or a reference clip your server knows.' },
  { id: 'qwen-tts', label: 'Qwen TTS (local server)', transport: 'http', defaultBase: 'http://127.0.0.1:8000', defaultModel: 'qwen3-tts',  describesVoice: true, verified: false, note: 'Alibaba open model you run yourself. Whether the voice field accepts a written description depends on the server you use.' },
  { id: 'wazobia', label: 'WazobiaVoice (local server, Nigerian languages)', transport: 'http', defaultBase: 'http://127.0.0.1:8765', defaultModel: 'wazobia',  describesVoice: false, languages: [{ id: 'en', label: 'Nigerian English' }, { id: 'pcm', label: 'Nigerian Pidgin' }, { id: 'ig', label: 'Igbo' }, { id: 'ha', label: 'Hausa' }, { id: 'yo', label: 'Yoruba (weakest, per its model card)' }], verified: false, note: 'Run tools/wazobia_server.py (see its header for setup). Weights are research and non-commercial only. The voice field is the path to a 5-10 second reference clip on this computer; leave it empty for the default voice.' },
  { id: 'elevenlabs', label: 'ElevenLabs (cloud)', transport: 'cloud', defaultBase: '', defaultModel: 'latest', describesVoice: true, designsVoices: true, soundEffects: true, eventTags: { laugh: 'laughs', sigh: 'sighs' }, stateTags: { whispering: 'whispers' }, tagModelCheck: supportsAudioTags, emotionAsTag: true, keys: [{ id: 'elevenlabs', label: 'ElevenLabs API key' }], verified: true, note: 'Paid cloud service: every line spends your ElevenLabs credits. Designs a voice from a description, speaks lines with inline sound tags on Eleven v3 and later (the newest model your account offers is used automatically), and makes separate sound effects. Speech checked live on 2026-11-13 (a short line produced valid audio); voice design and sound effects not yet run live.' },
  { id: 'voicekiller', label: 'VoiceKiller (cloud)', transport: 'cloud', defaultBase: '', defaultModel: '', describesVoice: false, takesInstructions: true, keys: [{ id: 'voicekiller', label: 'VoiceKiller API key' }, { id: 'voicekiller-user', label: 'VoiceKiller user ID' }], verified: true, note: 'Paid cloud service. Emotion and physical state are sent as plain-language instructions, which only directable voices act on. Laughs and grunts are not documented, so they are not applied. Speech checked live on 2026-11-13 (a short line produced valid audio).' },
  { id: 'speech-server', label: 'Other speech server', transport: 'http', defaultBase: 'http://127.0.0.1:8000', defaultModel: '',  describesVoice: false, verified: false, note: 'Any server on this computer or your network with a /v1/audio/speech route.' },
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
  /** Plain-language direction sent in a separate instructions field, for providers that take one. */
  instructions: string
  /** What the provider will do. */
  applied: string[]
  /** What was asked for but cannot be done by this provider, and what to do about it. */
  notApplied: string[]
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Turns a line plus direction into the text sent to the provider, and says plainly what was and was not honoured. */
export function buildPerformance(line: string, direction: VoiceDirection, provider: VoiceProvider, model?: string): Performance {
  let text = line.trim()
  const applied: string[] = []
  const notApplied: string[] = []
  const instructionParts: string[] = []
  const tagsOn = !!provider.eventTags && (!provider.tagModelCheck || (!!model && provider.tagModelCheck(model)))
  const tagWord = (event: VoiceEvent) => (tagsOn ? provider.eventTags?.[event] : undefined)
  const emotion = direction.emotion.trim()
  if (direction.state === 'out of breath') {
    text = text.replace(/([.!?])\s+/g, '$1 ... ').replace(/,\s+/g, '... ')
    applied.push('Out of breath: added short pauses to the text.')
  } else if (direction.state !== 'neutral') {
    const stateTag = tagsOn ? provider.stateTags?.[direction.state] : undefined
    if (stateTag) {
      text = `[${stateTag}] ${text}`
      applied.push(`${cap(direction.state)}: sent as a [${stateTag}] tag (the model may soften it).`)
    } else if (provider.takesInstructions) {
      instructionParts.push(`Speak while ${direction.state}.`)
      applied.push(`${cap(direction.state)}: sent as an instruction (only directable voices act on it).`)
    } else {
      notApplied.push(`${cap(direction.state)}: a speech model cannot reliably voice this. It is saved in the casting brief; record it, or add the sound as a separate effect.`)
    }
  }
  if (emotion) {
    if (provider.takesInstructions) {
      instructionParts.push(`Tone: ${emotion}.`)
      applied.push(`Emotion "${emotion}": sent as an instruction (only directable voices act on it).`)
    } else if (provider.emotionAsTag && tagsOn) {
      text = `[${emotion}] ${text}`
      applied.push(`Emotion "${emotion}": sent as a [${emotion}] tag (the model may ignore tags it does not know).`)
    } else {
      notApplied.push(`Emotion "${emotion}": sent only in the casting brief; this provider takes no style instruction.`)
    }
  }
  for (const cue of direction.events) {
    const word = tagWord(cue.event)
    if (word) {
      text = cue.at === 'before' ? `[${word}] ${text}` : `${text} [${word}]`
      applied.push(`${cap(cue.event)} ${cue.at} the line (inline tag).`)
    } else {
      notApplied.push(`${cap(cue.event)} ${cue.at} the line: ${provider.label} has no ${cue.event} sound${provider.tagModelCheck && !tagsOn ? ' with this model' : ''}. ${provider.soundEffects ? 'Make it as a separate sound effect below and layer it' : 'Layer a separate sound effect'} ${cue.at} this line.`)
    }
  }
  return { text, instructions: instructionParts.join(' '), applied, notApplied }
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
