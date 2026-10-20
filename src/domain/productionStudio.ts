export type AssetType = 'character' | 'costume' | 'prop' | 'set' | 'environment'

export interface ExtractedAsset {
  id: string
  name: string
  type: AssetType
  sceneIds: string[]
  status: 'planned' | 'approved'
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

export interface AnalysisResult { scenes: ScriptScene[]; assets: ExtractedAsset[] }

const sceneHeading = /^(INT\.?|EXT\.?|INT\.\/EXT\.?|EXT\.\/INT\.?)\s+(.+?)(?:\s+-\s+(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS))?$/i
const characterCue = /^[A-Z][A-Z0-9 .'-]{1,35}$/

const slug = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function analyzeScript(text: string): AnalysisResult {
  const lines = text.replace(/\r/g, '').split('\n')
  const scenes: ScriptScene[] = []
  let current: ScriptScene | null = null
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    const match = line.match(sceneHeading)
    if (match) {
      current = { id: `SCENE-${String(scenes.length + 1).padStart(3, '0')}`, number: scenes.length + 1, heading: line, setting: match[2].trim(), timeOfDay: match[3]?.toUpperCase() ?? 'UNSPECIFIED', body: '', dialogue: [] }
      scenes.push(current)
      continue
    }
    if (!current || !line) continue
    current.body += `${current.body ? '\n' : ''}${line}`
    if (characterCue.test(line) && lines[index + 1]?.trim() && !lines[index + 1].trim().match(sceneHeading)) {
      current.dialogue.push({ speaker: line, line: lines[index + 1].trim(), source: 'script' })
    }
  }
  if (!scenes.length && text.trim()) scenes.push({ id: 'SCENE-001', number: 1, heading: 'UNTITLED SCENE', setting: 'Unspecified', timeOfDay: 'UNSPECIFIED', body: text.trim(), dialogue: [] })

  const assets = new Map<string, ExtractedAsset>()
  const addAsset = (name: string, type: AssetType, sceneId: string) => {
    const key = `${type}:${slug(name)}`
    const existing = assets.get(key)
    if (existing) { if (!existing.sceneIds.includes(sceneId)) existing.sceneIds.push(sceneId); return }
    assets.set(key, { id: `${type.slice(0, 4).toUpperCase()}-${slug(name)}-${String(assets.size + 1).padStart(3, '0')}`, name, type, sceneIds: [sceneId], status: 'planned' })
  }
  for (const scene of scenes) {
    addAsset(scene.setting, 'set', scene.id)
    for (const dialogue of scene.dialogue) addAsset(dialogue.speaker.replace(/\s*\(.*\)$/, ''), 'character', scene.id)
    const propMatches = scene.body.matchAll(/(?:holds?|carries|picks up|places|opens|uses)\s+(?:an? |the )?([a-z][a-z -]{2,40}?)(?=\s+and\s+|\s+on\s+|[,.]|$)/gi)
    for (const match of propMatches) addAsset(match[1].trim().replace(/[.,].*$/, ''), 'prop', scene.id)
  }
  return { scenes, assets: [...assets.values()] }
}

export interface PromptPackage {
  universal: string
  compact: string
  technical: string
  negative: string
}

export function compileAssetPrompt(asset: ExtractedAsset, style: string): PromptPackage {
  const identity = `${asset.type} ${asset.name}`
  return {
    universal: `Create a production-ready ${identity}. Preserve canonical identity across every view. ${style}. Neutral reference lighting, clean background, accurate materials, complete silhouette, no embedded text.`,
    compact: `${identity}, ${style}, production reference, neutral lighting, consistent identity, clean background`,
    technical: `${identity}. Orthographic reference presentation; front, three-quarter, side, and rear views; consistent scale and proportions; neutral 5500K lighting; uncluttered graphite-gray background; artwork only.`,
    negative: 'embedded labels, watermark, cropped subject, duplicate limbs, inconsistent costume, dramatic color cast, heavy bloom, illegible details',
  }
}

export type QueueStatus = 'queued' | 'running' | 'paused' | 'complete' | 'failed'
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
  const audio = preset.supportsAudio ? `Audio: dialogue ${shot.speaker ? `by ${shot.speaker}` : ''} “${shot.dialogue}”; SFX ${shot.soundEffects}; ambience ${shot.ambience}; music ${shot.music}.` : ''
  const prompt = `${shot.cameraFraming}, ${shot.cameraMovement}. ${shot.action}. Performance: ${shot.emotionalObjective}; face ${shot.facialActing}; body ${shot.bodyLanguage}; micro-animation ${shot.microAnimation}. Lighting: ${shot.lighting}. ${audio}`.replace(/\s+/g, ' ').trim()
  return { shotId: shot.id, model, prompt, references, warnings, manifest: { ...shot, targetModel: model, references, audioMode: preset.supportsAudio ? 'model' : 'postproduction' } }
}

export function coverageAudit(assets: ExtractedAsset[], shots: ShotRecord[]) {
  const missingAssets = assets.filter((asset) => asset.status !== 'approved').map((asset) => asset.id)
  const incompleteShots = shots.filter((shot) => !['approved', 'waived'].includes(shot.storyboardStatus)).map((shot) => shot.id)
  return { ready: missingAssets.length === 0 && incompleteShots.length === 0, missingAssets, incompleteShots }
}
