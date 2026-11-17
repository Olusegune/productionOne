import type { AnalysisResult, ExtractedAsset, ScriptScene, ShotRecord } from './productionStudio'
import { artifactGuidance } from './cleanGuidance'
import type { ImageJob, QueueState } from './generationQueue'
import { primaryViewKeys } from './sheetSpecs'
import type { StyleBible } from './visualDevelopment'
import { characterArcs, intensityBand, type CharacterArc, type Emotion } from '../engine/emotion'
import type { ParsedStory, StoryScene } from '../engine/story'

export type ShotSize = 'EWS' | 'WS' | 'MWS' | 'MS' | 'MCU' | 'CU' | 'ECU'
export type CameraAngle = 'eye-level' | 'low' | 'high' | 'overhead' | 'dutch' | 'ots' | 'pov' | 'profile'
export type Coverage = 'establishing' | 'master' | 'single' | 'ots' | 'reaction' | 'insert' | 'cutaway'
export type ScreenDir = 'L>R' | 'R>L' | 'neutral'
export type Movement = 'static' | 'push-in' | 'pull-out' | 'pan' | 'tilt' | 'dolly' | 'track' | 'crane' | 'handheld' | 'orbit' | 'rack-focus'

export const shotSizes: ShotSize[] = ['EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU']
export const sizeLabels: Record<ShotSize, string> = { EWS: 'Extreme wide', WS: 'Wide', MWS: 'Medium wide', MS: 'Medium', MCU: 'Medium close-up', CU: 'Close-up', ECU: 'Extreme close-up' }
export const defaultLens: Record<ShotSize, number> = { EWS: 24, WS: 28, MWS: 35, MS: 40, MCU: 50, CU: 85, ECU: 100 }
export const angles: CameraAngle[] = ['eye-level', 'low', 'high', 'overhead', 'dutch', 'ots', 'pov', 'profile']
export const angleLabels: Record<CameraAngle, string> = { 'eye-level': 'Eye level', low: 'Low angle', high: 'High angle', overhead: 'Overhead', dutch: 'Dutch tilt', ots: 'Over the shoulder', pov: 'Point of view', profile: 'Profile' }
export const movements: Movement[] = ['static', 'push-in', 'pull-out', 'pan', 'tilt', 'dolly', 'track', 'crane', 'handheld', 'orbit', 'rack-focus']
export const movementLabels: Record<Movement, string> = { static: 'Static', 'push-in': 'Slow push in', 'pull-out': 'Pull out', pan: 'Pan', tilt: 'Tilt', dolly: 'Dolly', track: 'Tracking', crane: 'Crane', handheld: 'Handheld', orbit: 'Orbit', 'rack-focus': 'Rack focus' }
export const compositionRules = ['rule of thirds', 'symmetry', 'negative space', 'leading lines', 'depth layers', 'frame within frame', 'low horizon', 'high horizon']
export const coverageLabels: Record<Coverage, string> = { establishing: 'Establishing', master: 'Master', single: 'Single', ots: 'Over the shoulder', reaction: 'Reaction', insert: 'Insert', cutaway: 'Cutaway' }

const FACE: Record<Emotion, [string, string]> = {
  neutral: ['Relaxed, attentive face', 'Balanced stance, quiet breathing'],
  joy: ['A genuine smile that reaches the eyes', 'Open posture, lifted chest'],
  sadness: ['Heavy lids, downturned mouth, glassy eyes', 'Shoulders drawn in, slowed movement'],
  anger: ['Tight jaw, narrowed eyes, flared nostrils', 'Squared shoulders, clenched hands'],
  fear: ['Wide eyes, tense brow, shallow breath', 'Weight back, hands drawn in'],
  surprise: ['Raised brows, parted lips', 'A small involuntary step back'],
  disgust: ['Wrinkled nose, pulled-back lip', 'Head turns away, shoulders recoil'],
  contempt: ['One-sided mouth, cool level gaze', 'Chin lifted, arms folded'],
  love: ['Soft eyes, gentle half smile', 'Leaning toward, relaxed hands'],
  determination: ['Steady gaze, set jaw', 'Grounded feet, squared shoulders'],
}

/** Seconds a line takes to say, plus a beat to land it. */
export const estimateDuration = (text: string, min = 2, max = 10) => Math.min(max, Math.max(min, Math.round((text.trim().split(/\s+/).filter(Boolean).length / 2.6 + 1) * 2) / 2))

export function lightingFor(timeOfDay: string, intExt: StoryScene['intExt']): string {
  const t = timeOfDay.toUpperCase()
  const inside = intExt === 'INT'
  if (/DAWN|SUNRISE|EARLY/.test(t)) return inside ? 'Soft cool window light, warm spill on skin, low contrast' : 'Low warm sun skimming the ground, soft haze, gentle rim light'
  if (/DUSK|SUNSET|TWILIGHT|EVENING/.test(t)) return inside ? 'Warm lamp light against deep blue windows' : 'Warm golden edge light with neutral skin tones, long shadows'
  if (/NIGHT|MIDNIGHT/.test(t)) return inside ? 'Motivated practical lamps, cool fill, deep shadows' : 'Moonlit blue ambience with a warm practical source'
  return inside ? 'Natural window light, soft fill, readable shadows' : 'Bright natural daylight, soft shadows, clean skin tones'
}

const slugId = (n: number) => `SHOT-${String(n).padStart(3, '0')}`
const nextShotNumber = (shots: ShotRecord[]) => shots.reduce((n, s) => Math.max(n, Number(/(\d+)$/.exec(s.id)?.[1] ?? 0)), 0) + 1

export interface ShotDraft {
  coverage: Coverage
  size: ShotSize
  angle: CameraAngle
  movement: Movement
  title: string
  characters: ExtractedAsset[]
  focus?: ExtractedAsset
  screenDir?: ScreenDir
  action: string
  dialogue?: { speaker: string; text: string; parenthetical?: string }
  emotion?: { emotion: Emotion; intensity: number }
  duration?: number
  composition?: string[]
  sound?: string
  setAsset?: ExtractedAsset
  /** Costumes and props that belong in the frame, besides the people and the set. */
  extras?: ExtractedAsset[]
  looks?: Record<string, string>
  evidenceLine?: number
}

function toShot(draft: ShotDraft, scene: ScriptScene, story: StoryScene | undefined, id: string, order: number): ShotRecord {
  const emotion = draft.emotion ?? { emotion: 'neutral' as Emotion, intensity: 1 }
  const [face, body] = FACE[emotion.emotion]
  const lens = defaultLens[draft.size]
  return {
    id, sceneId: scene.id, order, duration: draft.duration ?? 4, assetIds: [...new Set([...draft.characters, ...(draft.setAsset ? [draft.setAsset] : []), ...(draft.extras ?? [])].map((a) => a.id))], action: draft.action,
    dialogue: draft.dialogue?.text ?? '', speaker: draft.dialogue?.speaker ?? '', emotionalObjective: emotion.emotion === 'neutral' ? 'Observation' : `${emotion.emotion} (${emotion.intensity}/10)`,
    facialActing: face, bodyLanguage: body, microAnimation: emotion.intensity >= 7 ? 'Held breath, tiny tremor, one slow blink' : 'One blink, slow breath, slight weight shift',
    cameraFraming: sizeLabels[draft.size], cameraMovement: movementLabels[draft.movement], lighting: lightingFor(scene.timeOfDay, story?.intExt ?? 'UNSPECIFIED'),
    soundEffects: draft.sound ?? '', ambience: `${scene.setting.toLowerCase()} room tone`, music: '', transition: 'Cut', storyboardStatus: 'planned',
    title: draft.title, coverage: draft.coverage, size: draft.size, angle: draft.angle, lens, movement: draft.movement, composition: draft.composition ?? ['rule of thirds'], screenDir: draft.screenDir ?? 'neutral',
    focusAssetId: draft.focus?.id, setAssetId: draft.setAsset?.id, looks: draft.looks, emotion: emotion.emotion, emotionIntensity: emotion.intensity, evidenceLine: draft.evidenceLine,
  }
}

/**
 * A coverage plan for one scene, from rules a working director would recognise: establish the place, a master with everyone in it, over-the-shoulder pairs for dialogue that keep screen
 * direction consistent (the 180-degree rule), close-ups where the script's feeling peaks, and inserts for props that carry meaning. It is a starting point to edit, not a decision.
 */
export function planScene(story: ParsedStory, scene: StoryScene, analysis: AnalysisResult, arcs: CharacterArc[], previousSetting: string | undefined, firstNumber: number, firstOrder: number): ShotRecord[] {
  const legacy = analysis.scenes.find((s) => s.id === scene.id)
  if (!legacy) return []
  const byName = (name: string) => analysis.assets.find((a) => a.type === 'character' && a.name.toUpperCase() === name.toUpperCase().replace(/^(?:YOUNG|OLD|ELDER|LITTLE)\s+/, ''))
  const setAsset = analysis.assets.find((a) => (a.type === 'set' || a.type === 'environment') && a.name.toUpperCase() === scene.setting.toUpperCase())
  // A voice on a loudspeaker, a narrator or a recording is heard, not seen: it is not cast in the picture.
  const unseen = (name: string) => /(?:^|\s)(?:VOICE|ANNOUNCER|NARRATOR|INTERCOM)$|^RECORDED\s/i.test(name.trim())
  const here = story.characters.filter((c) => c.sceneIds.includes(scene.id) && !unseen(c.name)).map((c) => byName(c.name)).filter((a): a is ExtractedAsset => !!a)
  const looksFor = (chars: ExtractedAsset[]) => Object.fromEntries(chars.map((c) => [c.id, story.variants.find((v) => v.character.toUpperCase() === c.name.toUpperCase() && v.sceneId === scene.id && v.kind !== 'age')?.value ?? story.variants.find((v) => v.character.toUpperCase() === c.name.toUpperCase() && v.sceneId === scene.id)?.value ?? 'Canonical']))
  const drafts: ShotDraft[] = []
  const place = scene.setting.toLowerCase()
  // What people wear (their costume asset) and the props the script puts near a moment, so the frame can keep them consistent.
  const costumesOf = (chars: ExtractedAsset[]) => chars.map((c) => analysis.assets.find((a) => a.type === 'costume' && a.name.toUpperCase() === `${c.name} costume`.toUpperCase())).filter((a): a is ExtractedAsset => !!a)
  const propAsset = (name: string) => analysis.assets.find((a) => a.type === 'prop' && a.name === name)
  const propsNear = (line: number, radius: number) => story.props.filter((p) => p.sceneIds.includes(scene.id) && p.evidence.some((e) => Math.abs(e.line - line) <= radius)).map((p) => propAsset(p.name)).filter((a): a is ExtractedAsset => !!a).slice(0, 2)
  const sceneProps = story.props.filter((p) => p.sceneIds.includes(scene.id)).sort((a, b) => b.sceneIds.length - a.sceneIds.length).map((p) => propAsset(p.name)).filter((a): a is ExtractedAsset => !!a).slice(0, 3)
  if (setAsset && scene.setting !== previousSetting) {
    drafts.push({ coverage: 'establishing', size: scene.intExt === 'EXT' ? 'EWS' : 'WS', angle: scene.intExt === 'EXT' ? 'high' : 'eye-level', movement: scene.intExt === 'EXT' ? 'crane' : 'static', title: `Establishing: ${place}`, characters: [], setAsset, action: `Establish ${place}, ${scene.timeOfDay.toLowerCase()}.`, duration: 4, composition: ['depth layers', 'leading lines'], sound: `${place} ambience` })
  }
  if (here.length) drafts.push({ coverage: 'master', size: here.length > 1 ? 'WS' : 'MWS', angle: 'eye-level', movement: 'static', title: `Master: ${here.map((c) => c.name).join(' and ')}`, characters: here, setAsset, extras: [...costumesOf(here), ...sceneProps], looks: looksFor(here), action: `${here.map((c) => c.name).join(' and ')} in ${place}.`, duration: 5, composition: ['rule of thirds', 'depth layers'], screenDir: 'neutral' })
  // Dialogue: group same-speaker lines, then cover alternating speakers over the shoulder, keeping each speaker on one side of the line.
  const sideOf = new Map<string, ScreenDir>()
  const speakers = [...new Set(scene.dialogue.filter((d) => d.speaker !== 'LYRIC' && !unseen(d.speaker)).map((d) => d.speaker.toUpperCase()))]
  speakers.slice(0, 2).forEach((s, i) => sideOf.set(s, i === 0 ? 'L>R' : 'R>L'))
  const groups: Array<{ speaker: string; text: string; parenthetical?: string; line: number }> = []
  for (const d of scene.dialogue) {
    if (d.speaker === 'LYRIC') continue
    const last = groups[groups.length - 1]
    if (last && last.speaker === d.speaker.toUpperCase()) last.text += ` ${d.text}`
    else groups.push({ speaker: d.speaker.toUpperCase(), text: d.text, parenthetical: d.parenthetical, line: d.line })
  }
  const emotionOf = (name: string) => arcs.find((a) => a.character.toUpperCase() === name.toUpperCase())?.points.find((p) => p.sceneId === scene.id)?.reading
  for (const g of groups.slice(0, 8)) {
    const who = byName(g.speaker)
    const reading = emotionOf(g.speaker)
    const strong = !!reading && reading.emotion !== 'neutral' && reading.intensity >= 6
    const pair = here.length > 1
    drafts.push({
      coverage: pair && !strong ? 'ots' : 'single', size: strong ? 'CU' : pair ? 'MCU' : 'MS', angle: pair && !strong ? 'ots' : 'eye-level', movement: strong && reading!.intensity >= 8 ? 'push-in' : 'static',
      title: `${g.speaker}: ${g.text.slice(0, 32)}${g.text.length > 32 ? '…' : ''}`, characters: pair ? here : who ? [who] : [], extras: [...costumesOf(pair ? here : who ? [who] : []), ...propsNear(g.line, 8)], focus: who, setAsset, looks: looksFor(who ? [who] : []), screenDir: sideOf.get(g.speaker) ?? 'neutral',
      action: `${g.speaker} speaks${g.parenthetical ? ` (${g.parenthetical})` : ''}.`, dialogue: { speaker: g.speaker, text: g.text, parenthetical: g.parenthetical }, emotion: reading ? { emotion: reading.emotion, intensity: reading.intensity } : undefined,
      duration: estimateDuration(g.text), composition: strong ? ['negative space'] : ['rule of thirds'], evidenceLine: g.line,
    })
  }
  // Close-ups where feeling peaks but nobody speaks it.
  for (const c of here) {
    const r = emotionOf(c.name)
    if (r && r.emotion !== 'neutral' && r.intensity >= 6 && !drafts.some((d) => d.focus?.id === c.id && d.size === 'CU')) {
      drafts.push({ coverage: 'reaction', size: 'CU', angle: 'eye-level', movement: r.intensity >= 8 ? 'push-in' : 'static', title: `${c.name}: ${r.emotion}`, characters: [c], focus: c, looks: looksFor([c]), action: `${c.name} reacts: ${r.emotion}.`, emotion: { emotion: r.emotion, intensity: r.intensity }, duration: 3, composition: ['negative space'], screenDir: 'neutral' })
    }
  }
  // Props that carry meaning (a stated condition) get an insert.
  // A prop that returns in two or more scenes (the typewriter, the photograph) gets an insert where it first appears, as well as one with a stated condition.
  for (const p of story.props.filter((x) => x.sceneIds.includes(scene.id) && (x.condition || (x.sceneIds.length >= 2 && x.sceneIds[0] === scene.id))).slice(0, 2)) {
    const asset = analysis.assets.find((a) => a.type === 'prop' && a.name === p.name)
    drafts.push({ coverage: 'insert', size: 'ECU', angle: 'eye-level', movement: 'rack-focus', title: `Insert: ${p.name}`, characters: [], action: `Close on the ${p.name}${p.condition ? `, ${p.condition}` : ''}.`, duration: 2, composition: ['negative space'], setAsset: asset })
  }
  return drafts.map((d, i) => toShot(d, legacy, scene, slugId(firstNumber + i), firstOrder + i))
}

export function planCoverage(analysis: AnalysisResult, only?: string): ShotRecord[] {
  const story = analysis.story
  if (!story) return []
  const arcs = characterArcs(story)
  const out: ShotRecord[] = []
  let prev: string | undefined
  for (const scene of story.scenes) {
    if (!only || scene.id === only) out.push(...planScene(story, scene, analysis, arcs, prev, out.length + 1, out.length + 1))
    prev = scene.setting
  }
  return out
}

/** Replans one scene without losing frames you approved: shots whose frames are approved stay; the rest are replaced. New shots get fresh ids. */
export function replanScene(existing: ShotRecord[], analysis: AnalysisResult, sceneId: string, queue: QueueState): ShotRecord[] {
  const story = analysis.story
  if (!story) return existing
  const scene = story.scenes.find((s) => s.id === sceneId)
  if (!scene) return existing
  const keep = existing.filter((s) => s.sceneId !== sceneId || frameApproved(queue, s.id))
  const arcs = characterArcs(story)
  const idx = story.scenes.indexOf(scene)
  const planned = planScene(story, scene, analysis, arcs, idx > 0 ? story.scenes[idx - 1].setting : undefined, nextShotNumber(keep), 1)
  return sortShots([...keep, ...planned], analysis)
}

export function sortShots(shots: ShotRecord[], analysis: AnalysisResult): ShotRecord[] {
  const sceneIndex = (id: string) => analysis.scenes.findIndex((s) => s.id === id)
  return [...shots].sort((a, b) => sceneIndex(a.sceneId) - sceneIndex(b.sceneId) || a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }))
}

export const frameJobs = (queue: QueueState, shotId: string) => queue.jobs.filter((j) => j.assetId === shotId && j.sheetType === 'Storyboard')
export const latestFrame = (queue: QueueState, shotId: string): ImageJob | undefined => frameJobs(queue, shotId).filter((j) => j.outputPath).sort((a, b) => b.revision - a.revision)[0]
export const frameApproved = (queue: QueueState, shotId: string) => frameJobs(queue, shotId).some((j) => j.approved)
/** The frame the animatic shows: the newest approved one, else the newest image that exists. */
export const frameForShot = (queue: QueueState, shotId: string): ImageJob | undefined => frameJobs(queue, shotId).filter((j) => j.approved && j.outputPath).sort((a, b) => b.revision - a.revision)[0] ?? latestFrame(queue, shotId)

export interface Finding { level: 'warn' | 'info'; shotId?: string; message: string }

/** Plain-rule continuity checks. They look at the plan and the approved references; they cannot see inside an image, and they say so by only claiming what the plan shows. */
export function checkContinuity(shots: ShotRecord[], analysis: AnalysisResult, queue: QueueState): Finding[] {
  const out: Finding[] = []
  const assets = new Map(analysis.assets.map((a) => [a.id, a]))
  const anchored = (assetId: string) => queue.jobs.some((j) => j.assetId === assetId && j.approved && !!j.outputPath && primaryViewKeys.includes(j.viewKey))
  for (const s of shots) {
    for (const id of s.assetIds) {
      const a = assets.get(id)
      if (a?.type === 'character' && !anchored(id)) out.push({ level: 'warn', shotId: s.id, message: `${a.name} has no approved reference yet, so ${s.id} will rely on the written description.` })
    }
    if (s.speaker && !s.assetIds.some((id) => assets.get(id)?.name.toUpperCase() === s.speaker.toUpperCase()) && s.size !== 'EWS' && s.coverage !== 'cutaway') out.push({ level: 'info', shotId: s.id, message: `${s.speaker} speaks in ${s.id} but is not listed in the shot.` })
    if (s.duration > 12) out.push({ level: 'info', shotId: s.id, message: `${s.id} runs ${s.duration}s; most video models cap near 10s.` })
  }
  const bySceneOrder = shots.filter((s) => s.screenDir && s.screenDir !== 'neutral')
  for (let i = 1; i < bySceneOrder.length; i++) {
    const a = bySceneOrder[i - 1]
    const b = bySceneOrder[i]
    if (a.sceneId !== b.sceneId || !a.focusAssetId || a.focusAssetId !== b.focusAssetId) continue
    if (a.screenDir !== b.screenDir) out.push({ level: 'warn', shotId: b.id, message: `${assets.get(b.focusAssetId!)?.name ?? 'A character'} faces ${b.screenDir === 'L>R' ? 'right' : 'left'} in ${b.id} but faced ${a.screenDir === 'L>R' ? 'right' : 'left'} in ${a.id}: the camera crosses the line.` })
  }
  const story = analysis.story
  if (story) {
    for (const s of shots) {
      for (const [assetId, look] of Object.entries(s.looks ?? {})) {
        const a = assets.get(assetId)
        const sceneLooks = story.variants.filter((v) => a && v.character.toUpperCase() === a.name.toUpperCase() && v.sceneId === s.sceneId).map((v) => v.value)
        if (a && sceneLooks.length && look !== 'Canonical' && !sceneLooks.includes(look)) out.push({ level: 'warn', shotId: s.id, message: `${a.name} is set to "${look}" in ${s.id}, but the script describes "${sceneLooks.join('" and "')}" in this scene.` })
      }
    }
  }
  return out
}

export interface ShotRef { label: string; path: string; kind: 'character' | 'set' | 'prop' }

/** The approved pictures that go with a shot, in a fixed order so the prompt can name them. */
export function shotReferences(shot: ShotRecord, analysis: AnalysisResult, queue: QueueState, assetRefs: Record<string, string[]> = {}): ShotRef[] {
  const out: ShotRef[] = []
  for (const id of shot.assetIds) {
    const asset = analysis.assets.find((a) => a.id === id)
    if (!asset) continue
    const look = shot.looks?.[id] ?? 'Canonical'
    const pick = (variant: string) => queue.jobs.filter((j) => j.assetId === id && j.variant === variant && j.approved && j.outputPath && primaryViewKeys.includes(j.viewKey)).sort((a, b) => b.revision - a.revision)[0]
    const job = pick(look) ?? pick('Canonical') ?? queue.jobs.filter((j) => j.assetId === id && j.approved && j.outputPath && primaryViewKeys.includes(j.viewKey)).sort((a, b) => b.revision - a.revision)[0]
    if (job?.outputPath) out.push({ label: asset.name, path: job.outputPath, kind: asset.type === 'character' || asset.type === 'costume' ? 'character' : asset.type === 'prop' ? 'prop' : 'set' })
    else if (assetRefs[id]?.[0]) out.push({ label: `${asset.name} (your photo)`, path: assetRefs[id][0], kind: asset.type === 'character' || asset.type === 'costume' ? 'character' : asset.type === 'prop' ? 'prop' : 'set' })
  }
  return out.slice(0, 8)
}

export function buildShotPrompt(shot: ShotRecord, analysis: AnalysisResult, style: StyleBible, refs: ShotRef[], aspect = '16:9', model = ''): string {
  const scene = analysis.scenes.find((s) => s.id === shot.sceneId)
  const names = shot.assetIds.map((id) => analysis.assets.find((a) => a.id === id)).filter((a): a is ExtractedAsset => !!a)
  const chars = names.filter((a) => a.type === 'character')
  const lines = [
    `Cinematic storyboard frame, ${aspect}. ${sizeLabels[shot.size ?? 'MS']}, ${angleLabels[shot.angle ?? 'eye-level'].toLowerCase()}, ${shot.lens ?? 40}mm lens${shot.movement && shot.movement !== 'static' ? ` (frame the start of a ${movementLabels[shot.movement].toLowerCase()})` : ''}.`,
    scene ? `Setting: ${scene.setting}, ${scene.timeOfDay.toLowerCase()}.` : '',
    chars.length ? `In frame: ${chars.map((c) => `${c.name}${shot.looks?.[c.id] && shot.looks[c.id] !== 'Canonical' ? ` (${shot.looks[c.id]})` : ''}`).join(', ')}.` : '',
    names.some((n) => n.type === 'costume' && n.prompt) ? `Wardrobe, exactly as the script describes it: ${names.filter((n) => n.type === 'costume' && n.prompt).map((n) => n.prompt!.replace(/^Costume worn by /, '').replace(/, as the script describes it:/, ':')).join(' ')}` : '',
    names.some((n) => n.type === 'prop') ? `Props in frame: ${names.filter((n) => n.type === 'prop').map((n) => n.name).join(', ')}.` : '',
    `Action: ${shot.action}`,
    shot.emotion && shot.emotion !== 'neutral' ? `Feeling: ${shot.emotion}. Face: ${shot.facialActing}. Body: ${shot.bodyLanguage}.` : '',
    shot.screenDir && shot.screenDir !== 'neutral' ? `Screen direction: the subject faces ${shot.screenDir === 'L>R' ? 'right' : 'left'}.` : '',
    shot.composition?.length ? `Composition: ${shot.composition.join(', ')}.` : '',
    `Lighting: ${shot.lighting}.`,
    `Style: ${style.name}. ${style.description} Rendering: ${style.rendering}.`,
    refs.length ? `Reference images are attached in this order: ${refs.map((r, i) => `${i + 1} = ${r.label}`).join('; ')}. Keep every person's face, hair, build and costume identical to their reference, and keep the set and props consistent.` : '',
    artifactGuidance(style, model, shot.lighting),
    'No text, no captions, no borders, no watermark. Photographic frame, not a collage.',
  ]
  return lines.filter(Boolean).join('\n')
}

const csv = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`

export function shotListCsv(shots: ShotRecord[], scenes: ScriptScene[]): string {
  const head = ['Shot', 'Scene', 'Coverage', 'Size', 'Angle', 'Lens mm', 'Movement', 'Duration s', 'Characters', 'Action', 'Speaker', 'Dialogue', 'Emotion', 'Lighting', 'Sound', 'Screen direction']
  const rows = shots.map((s) => [s.id, scenes.find((x) => x.id === s.sceneId)?.heading, s.coverage, s.size, s.angle, s.lens, s.movement, s.duration, s.assetIds.join(' '), s.action, s.speaker, s.dialogue, `${s.emotion ?? ''} ${s.emotionIntensity ?? ''}`.trim(), s.lighting, s.soundEffects, s.screenDir])
  return [head, ...rows].map((r) => r.map(csv).join(',')).join('\r\n')
}

export function shotListMarkdown(title: string, shots: ShotRecord[], scenes: ScriptScene[]): string {
  const lines = [`# ${title}: shot list`, '']
  for (const scene of scenes) {
    const mine = shots.filter((s) => s.sceneId === scene.id)
    if (!mine.length) continue
    lines.push(`## ${scene.heading}`, '')
    for (const s of mine) lines.push(`- **${s.id}** · ${s.coverage ? coverageLabels[s.coverage] : 'Shot'} · ${sizeLabels[s.size ?? 'MS']} · ${angleLabels[s.angle ?? 'eye-level']} · ${s.lens ?? 40}mm · ${s.movement ? movementLabels[s.movement] : 'Static'} · ${s.duration}s`, `  - ${s.action}`, ...(s.dialogue ? [`  - ${s.speaker}: "${s.dialogue}"`] : []))
    lines.push('')
  }
  return lines.join('\n')
}

export { intensityBand }
