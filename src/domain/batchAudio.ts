import type { ExtractedAsset } from './productionStudio'
import type { ParsedStory } from '../engine/story'
import type { ProviderId } from './voiceDirection'
import { sampleLines } from './voiceAudition'
import { scriptMusicBrief } from './musicBrief'

/**
 * Batch voice and music: plan many auditions, say plainly what they will spend, and only then run them.
 * Everything here is pure. Nothing starts a request; the screen runs the plan after one deliberate confirming click.
 * The app does not know any provider's prices, so an estimate is always in units the provider bills (characters, requests); dollars appear only when the person has typed their own price.
 */

/** What the provider bills for. Windows voices and speech servers on this network cost nothing. */
export type Billing = 'free' | 'characters' | 'requests'

export const billingFor = (providerId: ProviderId | 'suno'): Billing =>
  providerId === 'suno' ? 'requests' : providerId === 'elevenlabs' || providerId === 'voicekiller' ? 'characters' : 'free'

/** A batch that spends credits is limited to this many items at once; larger jobs are done in several confirmed batches. */
export const MAX_PAID_ITEMS = 20

export interface VoiceChoice {
  include: boolean
  /** Windows voice name, cloud voice id or name, or a server's voice name. */
  voice: string
  /** Overrides the character's first line from the script. */
  line?: string
}

export interface VoiceItem {
  id: string
  assetId: string
  assetName: string
  voice: string
  line: string
  characters: number
  /** Why this character will not be made, in plain words. Skipped items cost nothing and are not run. */
  skip?: string
}

/** One item per ticked character. A character with no line to say, or no voice chosen where one is needed, is listed as skipped rather than guessed at. */
export function planVoiceBatch(args: { assets: ExtractedAsset[]; story?: ParsedStory; choices: Record<string, VoiceChoice>; providerId: ProviderId }): VoiceItem[] {
  const { assets, story, choices, providerId } = args
  const needsVoice = providerId === 'windows' || providerId === 'elevenlabs' || providerId === 'voicekiller'
  const items: VoiceItem[] = []
  for (const asset of assets) {
    const choice = choices[asset.id]
    if (asset.type !== 'character' || !choice?.include) continue
    const line = (choice.line?.trim() || sampleLines(story, asset.name, 1)[0]?.text || '').trim()
    const voice = choice.voice.trim() || (needsVoice ? '' : (asset.soundDirection ?? '').trim())
    const item: VoiceItem = { id: `VB-${asset.id}`, assetId: asset.id, assetName: asset.name, voice, line, characters: line.length }
    if (!line) item.skip = 'No line to speak: the script gives this character no dialogue. Type one.'
    else if (needsVoice && !voice) item.skip = 'No voice chosen.'
    items.push(item)
  }
  return items
}

export type MusicTargetRef = { kind: 'theme'; assetId: string } | { kind: 'scene'; sceneId: string }

export interface MusicItem {
  id: string
  assetId: string
  assetName: string
  /** Plain label for lists, for example "Theme for MARA" or "Score for scene 2". */
  label: string
  /** Short, file-name-safe tag for the saved files, for example "theme" or "scene-3". */
  fileTag: string
  title: string
  style: string
  skip?: string
}

/** Builds each music request from what the script and the person's confirmed fields state, the same way the single maker does. Nothing is invented. */
export function planMusicBatch(args: { assets: ExtractedAsset[]; story?: ParsedStory; targets: MusicTargetRef[]; idea?: string }): MusicItem[] {
  const { assets, story, targets, idea = '' } = args
  const items: MusicItem[] = []
  for (const target of targets) {
    if (target.kind === 'theme') {
      const asset = assets.find((a) => a.id === target.assetId)
      if (!asset) continue
      const brief = scriptMusicBrief(asset, { kind: 'theme' }, story, idea)
      const item: MusicItem = { id: `MB-theme-${asset.id}`, assetId: asset.id, assetName: asset.name, label: `Theme for ${asset.name}`, fileTag: 'theme', title: brief.title, style: brief.style }
      if (!brief.style) item.skip = `Not enough stated. Missing: ${brief.missing.join(', ') || 'a personality'}.`
      items.push(item)
    } else {
      const scene = story?.scenes.find((s) => s.id === target.sceneId)
      if (!scene) continue
      const who = assets.find((a) => a.type === 'character' && a.sceneIds.includes(scene.id))
      const label = `Score for scene ${scene.number}: ${scene.setting}`
      if (!who) { items.push({ id: `MB-scene-${scene.id}`, assetId: '', assetName: '', label, fileTag: `scene-${scene.number}`, title: '', style: '', skip: 'No character is placed in this scene, so there is nothing to base the music on.' }); continue }
      const brief = scriptMusicBrief(who, { kind: 'scene', sceneId: scene.id }, story, idea)
      const item: MusicItem = { id: `MB-scene-${scene.id}`, assetId: who.id, assetName: who.name, label, fileTag: `scene-${scene.number}`, title: brief.title, style: brief.style }
      if (!brief.style) item.skip = `Not enough stated. Missing: ${brief.missing.join(', ') || 'a scene heading'}.`
      items.push(item)
    }
  }
  return items
}

export interface Prices {
  /** USD per 1,000 characters, typed by the person. */
  perThousandCharacters?: number
  /** USD per music request (each request makes two tracks), typed by the person. */
  perMusicRequest?: number
}

export interface Estimate {
  /** Items that will actually run. */
  count: number
  skipped: number
  billing: Billing
  units: number
  unitLabel: string
  /** Null when the batch is free or the person has not typed a price. */
  usd: number | null
  /** One plain sentence for the confirm step. */
  summary: string
  overCap: boolean
}

const positive = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
const money = (n: number) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function estimateVoice(items: VoiceItem[], providerId: ProviderId, prices: Prices): Estimate {
  const run = items.filter((i) => !i.skip)
  const billing = billingFor(providerId)
  const units = run.reduce((n, i) => n + i.characters, 0)
  const usd = billing === 'characters' && positive(prices.perThousandCharacters) ? (units / 1000) * prices.perThousandCharacters : null
  const summary = run.length === 0
    ? 'Nothing to make yet.'
    : billing === 'free'
      ? `${plural(run.length, 'line')} will be made on this computer or your network. This spends no credits.`
      : `${plural(run.length, 'line')}, ${plural(units, 'character')} in all, will be sent to your ${providerId === 'elevenlabs' ? 'ElevenLabs' : 'VoiceKiller'} account. ${usd !== null ? `At your price that is about ${money(usd)}.` : 'Type your price per 1,000 characters to see a dollar figure; this app does not know the price.'}`
  return { count: run.length, skipped: items.length - run.length, billing, units, unitLabel: 'characters', usd, summary, overCap: billing !== 'free' && run.length > MAX_PAID_ITEMS }
}

export function estimateMusic(items: MusicItem[], prices: Prices): Estimate {
  const run = items.filter((i) => !i.skip)
  const usd = positive(prices.perMusicRequest) ? run.length * prices.perMusicRequest : null
  const summary = run.length === 0
    ? 'Nothing to make yet.'
    : `${plural(run.length, 'music request')} will be sent to Kie.ai and spend its credits; each makes two tracks, so about ${run.length * 2} tracks. ${usd !== null ? `At your price that is about ${money(usd)}.` : 'Type your price per request to see a dollar figure; this app does not know the price.'}`
  return { count: run.length, skipped: items.length - run.length, billing: 'requests', units: run.length, unitLabel: 'requests', usd, summary, overCap: run.length > MAX_PAID_ITEMS }
}

export type RunState = 'waiting' | 'making' | 'done' | 'failed' | 'stopped'

/** A short, readable reason for the list when a request fails. Keys and long provider text are never repeated in full. */
export function failureText(error: unknown): string {
  const text = String(error instanceof Error ? error.message : error).replace(/\s+/g, ' ').trim()
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}

/** Authentication and credit problems repeat for every item, so the batch stops instead of making the same failing request again. */
export const isStopper = (error: unknown): boolean => /\b(401|402|403)\b|no .* key|unauthori[sz]ed|invalid.*key|insufficient|credits?|quota/i.test(String(error instanceof Error ? error.message : error))
