import { parseStory, type ParsedStory } from '../engine/story'
import type { CameraAngle, Coverage, Movement, ScreenDir, ShotSize } from './direct'

export type AssetType = 'character' | 'costume' | 'prop' | 'set' | 'environment'

/** The voice a person chose for a character, kept with the project so every later line and batch reuses it. Which engine, and the voice as that engine names it. */
export interface CastVoice {
  provider: string
  /** Windows voice name, cloud voice id or name, or a speech server's voice name. */
  voice: string
  /** What to show the person (for example the cloud voice's display name). */
  label?: string
  model?: string
}

export interface ExtractedAsset {
  id: string
  name: string
  type: AssetType
  sceneIds: string[]
  status: 'planned' | 'approved'
  /** Optional, user-confirmed character identity fields. Empty means unknown, never guessed. */
  age?: string
  gender?: string
  race?: string
  ethnicity?: string
  role?: string
  /** What must never drift, in the person's own words (for example "never pale porcelain skin"). Written into every image and video prompt for the character. */
  never?: string
  /** How the character comes across (see personality.ts). Shapes voice tags and motion carriage only. */
  personality?: string
  motionDirection?: string
  interactionDirection?: string
  soundDirection?: string
  /** The voice chosen for this character (characters only). */
  castVoice?: CastVoice
  prompt?: string
}

export interface ScriptScene {
  id: string
  number: number
  heading: string
  setting: string
  timeOfDay: string
  body: string
  dialogue: Array<{ speaker: string; line: string; source: 'script' | 'proposed' }>
}

export interface AnalysisResult { scenes: ScriptScene[]; assets: ExtractedAsset[]; story?: ParsedStory }

const slug = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/** Reads a script with the story engine (free, local) and maps it to scenes and production assets. The full reading, with line evidence, is kept in `story`. */
/** Fields a person fills in or confirms. A fresh reading of the script must never wipe them. */
const KEPT_FIELDS = ['age', 'gender', 'race', 'ethnicity', 'role', 'never', 'personality', 'motionDirection', 'interactionDirection', 'soundDirection', 'castVoice', 'prompt'] as const

/**
 * Re-reading a script makes new assets; this carries over what the person set on the ones that are still there (matched by type and name).
 * An asset keeps its old id: ids contain a running number, so a new location added earlier in the script would otherwise renumber every character and orphan their pictures, references and shots.
 * A value the person set wins over one the reader found. Approval stays with an asset that still exists, because its pictures are tied to the same id. Assets the script no longer has are dropped.
 */
export function mergeAnalysis(previous: AnalysisResult, next: AnalysisResult): AnalysisResult {
  const before = new Map(previous.assets.map((a) => [`${a.type}:${slug(a.name)}`, a]))
  const assets = next.assets.map((asset) => {
    const old = before.get(`${asset.type}:${slug(asset.name)}`)
    if (!old) return asset
    const merged: ExtractedAsset = { ...asset, id: old.id, status: old.status === 'approved' ? 'approved' : asset.status }
    for (const key of KEPT_FIELDS) {
      const value = old[key]
      if (value !== undefined && value !== '') (merged as unknown as Record<string, unknown>)[key] = value
    }
    return merged
  })
  return { ...next, assets }
}

/** The sample project and an unnamed one carry placeholder names. */
const placeholderTitles = new Set(['', 'the last horizon', 'untitled production', 'untitled'])

/**
 * A new script with a title line names the project, but only while the project still has a placeholder name. A name the person chose is never replaced.
 * Returns the new name, or undefined to leave it alone.
 */
export function titleFromScript(current: string, scriptTitle: string | undefined): string | undefined {
  const next = scriptTitle?.replace(/\s+/g, ' ').trim()
  if (!next || !placeholderTitles.has(current.trim().toLowerCase()) || next.toLowerCase() === current.trim().toLowerCase()) return undefined
  // A title typed in capitals reads better as a name: THE RENEWAL becomes The Renewal.
  return next === next.toUpperCase() && /[A-Z]/.test(next) ? next.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase()) : next
}

export function analyzeScript(text: string): AnalysisResult {
  const story = parseStory(text)
  const scenes: ScriptScene[] = story.scenes.map((scene) => ({
    id: scene.id, number: scene.number, heading: scene.heading, setting: scene.setting, timeOfDay: scene.timeOfDay, body: scene.body,
    dialogue: scene.dialogue.filter((d) => d.speaker !== 'LYRIC').map((d) => ({ speaker: d.speaker, line: d.text, source: d.source })),
  }))
  if (!scenes.length && text.trim()) scenes.push({ id: 'SCENE-001', number: 1, heading: 'UNTITLED SCENE', setting: 'Unspecified', timeOfDay: 'UNSPECIFIED', body: text.trim(), dialogue: [] })
  const assets = new Map<string, ExtractedAsset>()
  const addAsset = (name: string, type: AssetType, sceneIds: string[]) => {
    const key = `${type}:${slug(name)}`
    const existing = assets.get(key)
    if (existing) { for (const id of sceneIds) if (!existing.sceneIds.includes(id)) existing.sceneIds.push(id); return }
    assets.set(key, { id: `${type.slice(0, 4).toUpperCase()}-${slug(name)}-${String(assets.size + 1).padStart(3, '0')}`, name, type, sceneIds: [...sceneIds], status: 'planned' })
  }
  for (const scene of scenes) addAsset(scene.setting, scene.setting === 'Unspecified' ? 'environment' : 'set', [scene.id])
  for (const c of story.characters) addAsset(c.name, 'character', c.sceneIds)
  for (const p of story.props) {
    addAsset(p.name, 'prop', p.sceneIds)
    // A prop that shows something (a photograph) keeps what the script says it shows, so its picture and every shot of it match.
    const made = assets.get(`prop:${slug(p.name)}`)
    if (made && p.description && !made.prompt) made.prompt = `As the script describes it: ${p.description}`
  }
  // What each character wears, read from the script's description of them: one costume per character, its items kept as the prompt so the wardrobe sheet starts from the script's own words.
  for (const c of story.costumes ?? []) {
    const name = `${c.character} costume`
    addAsset(name, 'costume', c.sceneIds)
    const made = assets.get(`costume:${slug(name)}`)
    if (made && !made.prompt) made.prompt = `Costume worn by ${c.character}, as the script describes it: ${c.items.join(', ')}.`
  }
  return { scenes, assets: [...assets.values()], story }
}

export interface PromptPackage {
  universal: string
  compact: string
  technical: string
  negative: string
}

export function compileAssetPrompt(asset: ExtractedAsset, style: string): PromptPackage {
  const identity = `${asset.type} ${asset.name}`
  const identityNotes = asset.type === 'character'
    ? [asset.age && `age ${asset.age}`, asset.gender, asset.race, asset.ethnicity, asset.role].filter(Boolean).join(', ')
    : ''
  const identityLine = identityNotes ? `Character identity notes: ${identityNotes}.` : ''
  const universal = asset.prompt?.trim() || `Create a production-ready ${identity}. Preserve canonical identity across every view. ${style}. Neutral reference lighting, clean background, accurate materials, complete silhouette, no embedded text.`
  return {
    universal: `${universal}${identityLine ? ` ${identityLine}` : ''}`,
    compact: `${identity}, ${style}, production reference, neutral lighting, consistent identity, clean background`,
    technical: `${identity}. Orthographic reference presentation; front, three-quarter, side, and rear views; consistent scale and proportions; neutral 5500K lighting; uncluttered graphite-gray background; artwork only.`,
    negative: 'embedded labels, watermark, cropped subject, duplicate limbs, inconsistent costume, dramatic color cast, heavy bloom, illegible details',
  }
}

export type QueueStatus = 'queued' | 'running' | 'paused' | 'complete' | 'failed' | 'cancelled'
export interface GenerationJob { id: string; assetId: string; provider: string; model: string; mode: 'external' | 'direct'; status: QueueStatus; attempts: number; outputPath?: string; error?: string }

export function advanceQueue(jobs: GenerationJob[], availableProviders: string[]): GenerationJob[] {
  const running = jobs.some((job) => job.status === 'running')
  if (running) return jobs
  const next = jobs.find((job) => job.status === 'queued')
  if (!next) return jobs
  return jobs.map((job) => job.id !== next.id ? job : job.mode === 'direct' && !availableProviders.includes(job.provider)
    ? { ...job, status: 'failed', attempts: job.attempts + 1, error: `Provider ${job.provider} is not configured` }
    : { ...job, status: 'running', attempts: job.attempts + 1 })
}

export const pauseQueue=(jobs:GenerationJob[])=>jobs.map(job=>job.status==='queued'||job.status==='running'?{...job,status:'paused' as const}:job)
export const resumeQueue=(jobs:GenerationJob[])=>jobs.map(job=>job.status==='paused'?{...job,status:'queued' as const}:job)
export const cancelJob=(jobs:GenerationJob[],jobId:string)=>jobs.map(job=>job.id===jobId&&job.status!=='complete'?{...job,status:'cancelled' as const,error:undefined}:job)
export const retryJob=(jobs:GenerationJob[],jobId:string)=>jobs.map(job=>job.id===jobId&&(job.status==='failed'||job.status==='cancelled')?{...job,status:'queued' as const,error:undefined}:job)
export const canSpend=(confirmed:number,estimated:number,alreadySpent:number)=>Number.isFinite(confirmed)&&confirmed>0&&estimated>=0&&alreadySpent>=0&&alreadySpent+estimated<=confirmed

export interface ShotRecord {
  id: string
  sceneId: string
  order: number
  duration: number
  assetIds: string[]
  action: string
  dialogue: string
  speaker: string
  emotionalObjective: string
  facialActing: string
  bodyLanguage: string
  microAnimation: string
  cameraFraming: string
  cameraMovement: string
  lighting: string
  soundEffects: string
  ambience: string
  music: string
  transition: string
  storyboardStatus: 'planned' | 'generated' | 'approved' | 'waived'
  /** Director's-room fields. Optional so projects from earlier versions and the classic editor keep working. */
  title?: string
  coverage?: Coverage
  size?: ShotSize
  angle?: CameraAngle
  lens?: number
  movement?: Movement
  composition?: string[]
  screenDir?: ScreenDir
  focusAssetId?: string
  setAssetId?: string
  /** The look (costume or age variant) each character wears in this shot, by asset id. */
  looks?: Record<string, string>
  emotion?: string
  emotionIntensity?: number
  evidenceLine?: number
}

export function animaticDuration(shots: ShotRecord[]): number {
  return shots.reduce((total, shot) => total + Math.max(0, shot.duration), 0)
}

export function shotAtTime(shots: ShotRecord[], time: number): { shot: ShotRecord; index: number; localTime: number } | null {
  if (!shots.length) return null
  const duration = animaticDuration(shots)
  const clamped = Math.max(0, Math.min(time, Math.max(0, duration - Number.EPSILON)))
  let elapsed = 0
  for (let index = 0; index < shots.length; index++) {
    const end = elapsed + Math.max(0, shots[index].duration)
    if (clamped < end || index === shots.length - 1) return { shot: shots[index], index, localTime: clamped - elapsed }
    elapsed = end
  }
  return null
}

export function normalizeShotOrder(shots: ShotRecord[]): ShotRecord[] {
  return shots.map((shot, index) => ({ ...shot, order: index + 1 }))
}

export type VideoModel = 'Seedance 2.0' | 'Seedance 2.5' | 'Kling 4.0' | 'Wan 3.0' | 'HappyHorse 1.1' | 'MiniMax H3' | 'PixVerse V6' | 'Grok Imagine 1.5' | 'Kling 3.0' | 'Veo 3.1' | 'Gemini Omni Flash' | 'Hailuo 2.3' | 'Wan 2.6' | 'Kling 4.0 Flash' | 'fal.ai video catalog'
export interface VideoPreset { model: VideoModel; provider: 'Kie.ai' | 'Gemini' | 'fal.ai'; apiModel: string; tasks: string[]; aspectRatios: string[]; maxReferences: number; supportsAudio: boolean; supportsFirstLastFrame: boolean; verified: boolean; verifiedAt: string; documentationUrl: string; note: string }

export const videoPresets: Record<VideoModel, VideoPreset> = {
  'Seedance 2.0': { model:'Seedance 2.0',provider:'Kie.ai',apiModel:'bytedance/seedance-2',tasks:['turnaround','acting','pose','expression'],aspectRatios:['21:9','2.39:1','16:9','9:16','1:1'],maxReferences:9,supportsAudio:true,supportsFirstLastFrame:true,verified:true,verifiedAt:'2026-10-20',documentationUrl:'https://docs.kie.ai/market/bytedance/seedance-2',note:'First/last-frame and multimodal-reference modes are mutually exclusive.' },
  'Seedance 2.5': { model:'Seedance 2.5',provider:'Kie.ai',apiModel:'bytedance/seedance-2-5',tasks:['turnaround','acting','pose','expression'],aspectRatios:['21:9','16:9','9:16','1:1'],maxReferences:9,supportsAudio:true,supportsFirstLastFrame:true,verified:false,verifiedAt:'2026-11-17',documentationUrl:'https://docs.kie.ai/market/bytedance/seedance-2-5',note:'Newest Seedance on Kie.ai. Its request is built from the model page; the first run is a test.' },
  'Kling 4.0': { model:'Kling 4.0',provider:'Kie.ai',apiModel:'kling/v4-reference-to-video',tasks:['acting','pose','expression','vehicle'],aspectRatios:['16:9','9:16','1:1'],maxReferences:4,supportsAudio:false,supportsFirstLastFrame:false,verified:false,verifiedAt:'2026-11-17',documentationUrl:'https://docs.kie.ai/market/kling/v4-reference-to-video',note:'Reference-to-video: keeps a character from reference images. Built from the model page; the first run is a test.' },
  'Wan 3.0': { model:'Wan 3.0',provider:'Kie.ai',apiModel:'wan/3-0-video',tasks:['acting','pose','vehicle','prop'],aspectRatios:['16:9','9:16','1:1'],maxReferences:1,supportsAudio:true,supportsFirstLastFrame:false,verified:false,verifiedAt:'2026-11-17',documentationUrl:'https://docs.kie.ai/market/wan/3-0-video',note:'Newest Wan on Kie.ai. Built from the model page; the first run is a test.' },
  'HappyHorse 1.1': { model:'HappyHorse 1.1',provider:'Kie.ai',apiModel:'happyhorse-1-1/image-to-video',tasks:['acting','pose','expression'],aspectRatios:['16:9','9:16','1:1'],maxReferences:1,supportsAudio:false,supportsFirstLastFrame:false,verified:false,verifiedAt:'2026-11-17',documentationUrl:'https://docs.kie.ai/market/happyhorse-1-1/image-to-video',note:'Image-to-video. Built from the model page; the first run is a test.' },
  'MiniMax H3': { model:'MiniMax H3',provider:'Kie.ai',apiModel:'minimax-h3/image-to-video',tasks:['acting','pose','expression'],aspectRatios:['16:9','9:16'],maxReferences:1,supportsAudio:false,supportsFirstLastFrame:false,verified:false,verifiedAt:'2026-11-17',documentationUrl:'https://docs.kie.ai/market/minimax-h3/image-to-video',note:'Image-to-video. Built from the model page; the first run is a test.' },
  'PixVerse V6': { model:'PixVerse V6',provider:'Kie.ai',apiModel:'pixverse/image-to-video',tasks:['acting','pose','expression'],aspectRatios:['16:9','9:16','1:1'],maxReferences:1,supportsAudio:false,supportsFirstLastFrame:false,verified:false,verifiedAt:'2026-11-17',documentationUrl:'https://docs.kie.ai/market/pixverse/image-to-video',note:'Image-to-video. Built from the model page; the first run is a test.' },
  'Grok Imagine 1.5': { model:'Grok Imagine 1.5',provider:'Kie.ai',apiModel:'grok-imagine/1-5-preview',tasks:['acting','pose','expression'],aspectRatios:['16:9','9:16','1:1'],maxReferences:1,supportsAudio:true,supportsFirstLastFrame:false,verified:false,verifiedAt:'2026-11-17',documentationUrl:'https://docs.kie.ai/market/grok-imagine/1-5-preview',note:'Preview model. Built from the model page; the first run is a test.' },
  'Kling 3.0': { model:'Kling 3.0',provider:'Kie.ai',apiModel:'kling-3.0',tasks:['acting','pose','expression','vehicle'],aspectRatios:['21:9','2.39:1','16:9','9:16','1:1'],maxReferences:4,supportsAudio:true,supportsFirstLastFrame:true,verified:false,verifiedAt:'2026-10-20',documentationUrl:'https://docs.kie.ai/market/kling/kling-3-0',note:'Export-only until exact endpoint limits pass a credentialed acceptance test.' },
  'Veo 3.1': { model:'Veo 3.1',provider:'Gemini',apiModel:'veo-3.1-generate-preview',tasks:['acting','expression','extension','dialogue'],aspectRatios:['16:9','9:16'],maxReferences:3,supportsAudio:true,supportsFirstLastFrame:true,verified:true,verifiedAt:'2026-10-20',documentationUrl:'https://ai.google.dev/gemini-api/docs/video',note:'Google Veo with native audio and image-based direction.' },
  'Gemini Omni Flash': { model:'Gemini Omni Flash',provider:'Gemini',apiModel:'gemini-omni-flash',tasks:['acting','expression','editing','extension'],aspectRatios:['16:9','9:16'],maxReferences:3,supportsAudio:true,supportsFirstLastFrame:true,verified:true,verifiedAt:'2026-11-11',documentationUrl:'https://ai.google.dev/gemini-api/docs/video',note:'Fast multimodal video generation and conversational editing; direct adapter is pending.' },
  'Hailuo 2.3': { model:'Hailuo 2.3',provider:'Kie.ai',apiModel:'hailuo/2-3-image-to-video-standard',tasks:['acting','pose','expression'],aspectRatios:['16:9','9:16'],maxReferences:1,supportsAudio:false,supportsFirstLastFrame:false,verified:false,verifiedAt:'2026-11-11',documentationUrl:'https://docs.kie.ai/market',note:'Image-to-video catalog entry; export-only until acceptance-tested.' },
  'Wan 2.6': { model:'Wan 2.6',provider:'Kie.ai',apiModel:'wan/2-6-image-to-video',tasks:['acting','pose','vehicle','prop'],aspectRatios:['16:9','9:16'],maxReferences:1,supportsAudio:true,supportsFirstLastFrame:false,verified:false,verifiedAt:'2026-11-11',documentationUrl:'https://docs.kie.ai/market/wan/2-6-image-to-video',note:'Image-to-video with generated audio; export-only until acceptance-tested.' },
  'Kling 4.0 Flash': { model:'Kling 4.0 Flash',provider:'Kie.ai',apiModel:'kling/v4-flash-keyframe-to-video',tasks:['turnaround','acting','pose','expression'],aspectRatios:['16:9','9:16'],maxReferences:2,supportsAudio:false,supportsFirstLastFrame:true,verified:false,verifiedAt:'2026-11-11',documentationUrl:'https://docs.kie.ai/market/kling/v4-flash-keyframe-to-video',note:'Keyframe-to-video catalog entry; export-only until acceptance-tested.' },
  'fal.ai video catalog': { model:'fal.ai video catalog',provider:'fal.ai',apiModel:'catalog-discovery',tasks:['turnaround','acting','pose','expression','vehicle','cloth'],aspectRatios:['provider-defined'],maxReferences:0,supportsAudio:false,supportsFirstLastFrame:false,verified:false,verifiedAt:'2026-11-11',documentationUrl:'https://fal.ai/models',note:'Live fal.ai discovery is required; choose an exact model before direct generation.' },
}

export interface CompiledShotPackage { shotId: string; model: VideoModel; prompt: string; references: string[]; warnings: string[]; manifest: Record<string, unknown> }

export function compileShotPackage(shot: ShotRecord, model: VideoModel, knownAssetIds: string[]): CompiledShotPackage {
  const preset = videoPresets[model]
  const references = shot.assetIds.filter((id) => knownAssetIds.includes(id)).slice(0, preset.maxReferences)
  const warnings: string[] = []
  const missing = shot.assetIds.filter((id) => !knownAssetIds.includes(id))
  if (missing.length) warnings.push(`Missing references: ${missing.join(', ')}`)
  if (shot.assetIds.length > preset.maxReferences) warnings.push(`${model} package limited to ${preset.maxReferences} references`)
  if (!preset.supportsAudio && (shot.dialogue || shot.soundEffects || shot.ambience || shot.music)) warnings.push(`${model} audio metadata is packaged for postproduction`)
  if (!preset.verified) warnings.push(`${model} capability limits require provider-documentation verification before direct generation`)
  const audioParts = [shot.dialogue ? `dialogue${shot.speaker ? ` by ${shot.speaker}` : ''} “${shot.dialogue}”` : '', shot.soundEffects ? `SFX ${shot.soundEffects}` : '', shot.ambience ? `ambience ${shot.ambience}` : '', shot.music ? `music ${shot.music}` : ''].filter(Boolean)
  const audio = preset.supportsAudio && audioParts.length ? `Audio: ${audioParts.join('; ')}.` : ''
  const prompt = `${shot.cameraFraming}, ${shot.cameraMovement}. ${shot.action}. Performance: ${shot.emotionalObjective}; face ${shot.facialActing}; body ${shot.bodyLanguage}; micro-animation ${shot.microAnimation}. Lighting: ${shot.lighting}. ${audio}`.replace(/\s+/g, ' ').trim()
  return { shotId: shot.id, model, prompt, references, warnings, manifest: { ...shot, targetModel: model, references, audioMode: preset.supportsAudio ? 'model' : 'postproduction' } }
}

export function coverageAudit(assets: ExtractedAsset[], shots: ShotRecord[], verifiedAssetIds?: string[]) {
  const verified=verifiedAssetIds?new Set(verifiedAssetIds):null
  const missingAssets = assets.filter((asset) => asset.status !== 'approved'||(verified&&!verified.has(asset.id))).map((asset) => asset.id)
  const incompleteShots = shots.filter((shot) => !['approved', 'waived'].includes(shot.storyboardStatus)).map((shot) => shot.id)
  return { ready: missingAssets.length === 0 && incompleteShots.length === 0, missingAssets, incompleteShots }
}

export interface SceneCoverage { sceneId:string; requiredAssets:string[]; verifiedAssets:string[]; missingAssets:string[]; plannedShots:string[]; incompleteShots:string[]; warnings:string[]; videoReady:boolean }

export function sceneCoverageAudit(analysis:AnalysisResult,shots:ShotRecord[],verifiedAssetIds:string[]):SceneCoverage[]{
  const verified=new Set(verifiedAssetIds)
  return analysis.scenes.map(scene=>{
    const requiredAssets=analysis.assets.filter(asset=>asset.sceneIds.includes(scene.id)).map(asset=>asset.id)
    const verifiedAssets=requiredAssets.filter(id=>verified.has(id))
    const missingAssets=requiredAssets.filter(id=>!verified.has(id))
    const sceneShots=shots.filter(shot=>shot.sceneId===scene.id)
    const incompleteShots=sceneShots.filter(shot=>!['approved','waived'].includes(shot.storyboardStatus)).map(shot=>shot.id)
    const warnings=sceneShots.flatMap(shot=>shot.assetIds.filter(id=>!requiredAssets.includes(id)).map(id=>`${shot.id} references ${id}, which is not associated with ${scene.id}`))
    if(!sceneShots.length)warnings.push('No shots planned; asset-only delivery remains available')
    return{sceneId:scene.id,requiredAssets,verifiedAssets,missingAssets,plannedShots:sceneShots.map(shot=>shot.id),incompleteShots,warnings,videoReady:missingAssets.length===0&&sceneShots.length>0&&incompleteShots.length===0}
  })
}
