import type { AnalysisResult, ShotRecord } from './productionStudio'
import { stalenessOf } from './variationGraph'
import { addRevision, approveRevision, findEntity, latestApproved, type LookSpec, type Ref, type VariationState } from './variations'

/**
 * Which look a character wears in which scenes. The scene is the story's scene id; the look is a production look (an outfit, possibly in a condition).
 * Assigning is a decision made by a person, so it is a new approved revision of the look: earlier assignments stay in its history.
 */
export function assignLook(state: VariationState, lookId: string, sceneIds: string[], now: string): { variations: VariationState; ref: Ref } {
  const look = findEntity(state, lookId)
  const rev = look && latestApproved(look)
  if (!look || look.kind !== 'look' || !rev) throw new Error('Only an approved look can be assigned to scenes.')
  const spec: LookSpec = { ...(rev.spec as LookSpec), sceneIds: [...new Set(sceneIds)].sort() }
  const made = addRevision(state, lookId, { spec, now, parent: { id: lookId, revision: rev.n }, note: 'Scene assignment' })
  return { variations: approveRevision(made.state, made.ref), ref: made.ref }
}

export interface SceneLook { lookId: string; name: string; queueVariant: string; ref: Ref }

/** The look a character is assigned for a scene, if any. When two looks claim the same scene, the one assigned most recently wins. */
export function lookForScene(state: VariationState, characterId: string, sceneId: string): SceneLook | undefined {
  let found: SceneLook | undefined
  let at = ''
  for (const e of state.entities) {
    if (e.kind !== 'look' || e.characterId !== characterId) continue
    const rev = latestApproved(e)
    const spec = rev?.spec as LookSpec | undefined
    if (!rev || !spec?.sceneIds?.includes(sceneId)) continue
    if (rev.createdAt >= at) { at = rev.createdAt; found = { lookId: e.id, name: e.name, queueVariant: spec.queueVariant ?? 'Canonical', ref: { id: e.id, revision: rev.n } } }
  }
  return found
}

export interface LookFinding { level: 'warn' | 'info'; shotId: string; message: string }

/** Checks each shot's chosen look against the look assigned to its scene. It reads the plan and the records; it cannot see inside a picture. */
export function checkLookAssignments(shots: ShotRecord[], variations: VariationState, analysis: AnalysisResult): LookFinding[] {
  const out: LookFinding[] = []
  const assets = new Map(analysis.assets.map((a) => [a.id, a]))
  for (const s of shots) {
    for (const [assetId, chosen] of Object.entries(s.looks ?? {})) {
      const a = assets.get(assetId)
      const assigned = lookForScene(variations, assetId, s.sceneId)
      if (!a || !assigned) continue
      if (chosen !== assigned.queueVariant) out.push({ level: 'warn', shotId: s.id, message: `${a.name} is set to "${chosen}" in ${s.id}, but "${assigned.name}" is assigned to this scene.` })
      else if (stalenessOf(variations, assigned.ref).stale) out.push({ level: 'info', shotId: s.id, message: `${a.name}'s look "${assigned.name}" in ${s.id} was approved before something it uses changed. Check it still matches.` })
    }
  }
  return out
}
