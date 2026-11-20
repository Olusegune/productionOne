import { presetById, type CameraPreset } from './camera'
import type { ShotRecord } from './productionStudio'

export interface Advice { preset: CameraPreset; rationale: string; confidence: 'low' | 'medium'; limits: string }

export interface AdviceContext {
  /** The shots already planned in this scene (including this one). */
  sceneShots: ShotRecord[]
  /** Name of the project's style, used only to notice documentary, miniature and graphic looks. */
  styleName: string
  /** The scene has a set asset. */
  hasSet: boolean
  /** How many characters are in this shot. */
  characters: number
}

const LIMITS = 'A suggestion from the script, the feeling and the coverage so far. It cannot judge performance, rhythm or what you intend, and your approved plan is not changed.'

/**
 * Alternatives for one shot. It reads what is already planned (and does not change it), gives a short reason for each and never claims more than medium
 * confidence. Shots that already match a suggestion are not suggested again.
 */
export function adviseShot(shot: ShotRecord, ctx: AdviceContext): Advice[] {
  const out: Advice[] = []
  const push = (id: string, rationale: string, confidence: Advice['confidence'] = 'low') => {
    const preset = presetById(id)
    if (!preset || out.some((a) => a.preset.id === id)) return
    if (shot.size === preset.size && shot.angle === preset.angle && shot.movement === preset.movement) return
    out.push({ preset, rationale, confidence, limits: LIMITS })
  }
  const others = ctx.sceneShots.filter((s) => s.id !== shot.id)
  const hasWide = others.some((s) => s.coverage === 'establishing' || s.size === 'EWS' || s.size === 'WS')
  const intensity = shot.emotionIntensity ?? 0
  const feeling = shot.emotion ?? 'neutral'
  const style = ctx.styleName.toLowerCase()

  if (ctx.hasSet && !hasWide) push('wide-architectural', 'No wide frame of the place exists in this scene yet, so a viewer may not learn where it is.', 'medium')
  if (ctx.characters >= 2 && shot.dialogue.trim()) push('intimate-dialogue', 'Two or more people and spoken lines: a close, steady pair of frames keeps attention on the exchange.', 'medium')
  if (intensity >= 7 && ['sadness', 'fear', 'love', 'determination'].includes(feeling)) push('restrained-close-up', `A strong ${feeling} (${intensity}/10) often plays best held close and still.`)
  if (['anger', 'contempt'].includes(feeling) && intensity >= 5) push('low-angle-confrontation', `${feeling} at ${intensity}/10 can read as power or threat from a low angle.`)
  if (ctx.characters === 1 && ctx.hasSet && (shot.size === 'WS' || shot.size === 'MWS' || shot.size === 'EWS')) push('environment-portrait', 'One person in a place that matters: keep both readable.')
  if (/documentary|naturalism|naturalistic/.test(style)) push('handheld-documentary', 'The project style is documentary or naturalistic.')
  if (/miniature|clay|stop-motion|diorama/.test(style)) push('miniature-observation', 'The project style is a miniature or model world.')
  if (/flat|geometric|paper|minimalist|vector|folk|mid-century/.test(style)) push('graphic-tableau', 'The project style is flat and graphic, which suits a composed, symmetrical frame.')
  if (shot.screenDir && shot.screenDir !== 'neutral' && out.length === 0) push('environment-portrait', 'No stronger reason found; this keeps the established screen direction while showing the place.')
  return out
}
