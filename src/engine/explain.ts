import type { ParsedStory } from './story'

export type Confidence = 'high' | 'medium' | 'low'
export interface Finding { kind: 'character' | 'scene' | 'format'; subject: string; confidence: Confidence; reason: string; line?: number }

const FORMAT_WHY: Record<ParsedStory['format'], string> = {
  screenplay: 'INT./EXT. scene headings were found, so standard screenplay rules were used: CAPS cue lines are speakers.',
  shotlist: 'SCENE / SHOT markers were found, so this was read as a shot list.',
  lyrics: 'Bracketed section tags such as [Verse] were found, so this was read as lyrics.',
  prose: 'No scene headings or shot markers were found, so this was read as prose. Names are inferred from repetition.',
  empty: 'There is no text to read.',
}

/** Turns the parse result into reviewable evidence: why this format, and which findings deserve a human check. Deterministic and local. */
export function explainStory(story: ParsedStory): { format: string; findings: Finding[]; needsReview: number } {
  const findings: Finding[] = []
  for (const c of story.characters) {
    const firstScene = story.scenes.find((s) => s.id === c.firstSceneId)
    const line = firstScene?.startLine
    if (c.dialogueCount >= 2) findings.push({ kind: 'character', subject: c.name, confidence: 'high', reason: `Speaks ${c.dialogueCount} times across ${c.sceneIds.length} scene${c.sceneIds.length === 1 ? '' : 's'}.`, line })
    else if (c.dialogueCount === 1 || (c.fromAction !== true && c.mentionCount >= 3)) findings.push({ kind: 'character', subject: c.name, confidence: 'medium', reason: c.dialogueCount === 1 ? 'Speaks once. Confirm this is a person, not a label.' : `Mentioned ${c.mentionCount} times.`, line })
    else findings.push({ kind: 'character', subject: c.name, confidence: 'low', reason: c.fromAction ? 'Found only acting in description, never speaking. Confirm this is a character before generating references.' : 'Mentioned rarely. Confirm before generating references.', line })
  }
  for (const s of story.scenes) {
    if (s.timeOfDay === 'UNSPECIFIED' || s.intExt === 'UNSPECIFIED') findings.push({ kind: 'scene', subject: `${s.number}. ${s.heading}`, confidence: 'medium', reason: `${s.intExt === 'UNSPECIFIED' ? 'No INT/EXT' : ''}${s.intExt === 'UNSPECIFIED' && s.timeOfDay === 'UNSPECIFIED' ? ' and no ' : s.timeOfDay === 'UNSPECIFIED' ? 'No ' : ''}${s.timeOfDay === 'UNSPECIFIED' ? 'time of day' : ''} in the heading. Lighting will be neutral until you set it.`, line: s.startLine })
  }
  if (story.format === 'prose') findings.unshift({ kind: 'format', subject: 'Format', confidence: 'medium', reason: FORMAT_WHY.prose })
  else findings.unshift({ kind: 'format', subject: 'Format', confidence: 'high', reason: FORMAT_WHY[story.format] })
  const rank = { low: 0, medium: 1, high: 2 }
  findings.sort((a, b) => rank[a.confidence] - rank[b.confidence])
  return { format: FORMAT_WHY[story.format], findings, needsReview: findings.filter((f) => f.confidence !== 'high').length }
}
