import { parseStory, type ParsedStory } from '../engine/story'
import type { CameraAngle, Coverage, Movement, ScreenDir, ShotSize } from './direct'

export type AssetType = 'character' | 'costume' | 'prop' | 'set' | 'environment'

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
  motionDirection?: string
  interactionDirection?: string
  soundDirection?: string
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
  for (const p of story.props) addAsset(p.name, 'prop', p.sceneIds)
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

export type VideoModel = 'Seedance 2.0' | 'Kling 3.0' | 'Veo 3.1'
export interface VideoPreset { model: VideoModel; apiModel: string; aspectRatios: string[]; maxReferences: number; supportsAudio: boolean; supportsFirstLastFrame: boolean; verified: boolean; verifiedAt: string; documentationUrl: string; note: string }

export const videoPresets: Record<VideoModel, VideoPreset> = {
  'Seedance 2.0': { model:'Seedance 2.0',apiModel:'bytedance/seedance-2',aspectRatios:['16:9','9:16','1:1'],maxReferences:9,supportsAudio:true,supportsFirstLastFrame:true,verified:true,verifiedAt:'2026-10-20',documentationUrl:'https://docs.kie.ai/market/bytedance/seedance-2',note:'First/last-frame and multimodal-reference modes are mutually exclusive.' },
  'Kling 3.0': { model:'Kling 3.0',apiModel:'kling-3.0',aspectRatios:['16:9','9:16','1:1'],maxReferences:4,supportsAudio:true,supportsFirstLastFrame:true,verified:false,verifiedAt:'2026-10-20',documentationUrl:'https://docs.kie.ai/market/kling/kling-3-0',note:'Preset remains export-only until exact endpoint limits pass a credentialed acceptance test.' },
  'Veo 3.1': { model:'Veo 3.1',apiModel:'veo-3.1-generate-preview',aspectRatios:['16:9','9:16'],maxReferences:3,supportsAudio:true,supportsFirstLastFrame:true,verified:true,verifiedAt:'2026-10-20',documentationUrl:'https://ai.google.dev/gemini-api/docs/video',note:'Preview API is scheduled for shutdown on 2026-10-22; migrate direct generation to Gemini Omni Flash.' },
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
