import type { CastVoice, ExtractedAsset } from './productionStudio'
import { providerById, type ProviderId } from './voiceDirection'

/** The voice saved for a character, but only when it belongs to the engine being used (a Windows voice name means nothing to ElevenLabs). */
export const savedVoiceFor = (asset: Pick<ExtractedAsset, 'castVoice'>, providerId: ProviderId | string): CastVoice | undefined =>
  asset.castVoice && asset.castVoice.provider === providerId && asset.castVoice.voice.trim() ? asset.castVoice : undefined

/** Saves a voice on a character. Nothing else about the character changes. */
export function rememberVoice(asset: ExtractedAsset, voice: CastVoice): ExtractedAsset {
  const cleaned: CastVoice = { provider: voice.provider, voice: voice.voice.trim(), ...(voice.label?.trim() ? { label: voice.label.trim() } : {}), ...(voice.model?.trim() ? { model: voice.model.trim() } : {}) }
  return cleaned.voice ? { ...asset, castVoice: cleaned } : asset
}

export function forgetVoice(asset: ExtractedAsset): ExtractedAsset {
  const { castVoice: _gone, ...rest } = asset
  return rest
}

/** One plain line for the screen, for example "Rachel (ElevenLabs)". */
export function describeCastVoice(voice: CastVoice): string {
  const engine = providerById(voice.provider as ProviderId).label.replace(/\s*\(.*\)$/, '')
  return `${voice.label || voice.voice} (${engine})`
}

/** Characters in this list that already have a voice for this engine, and how many that is. Used for the batch summary. */
export const countWithSavedVoice = (assets: ExtractedAsset[], providerId: ProviderId): number => assets.filter((a) => a.type === 'character' && savedVoiceFor(a, providerId)).length
