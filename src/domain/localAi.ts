export interface ModelInfo { name: string; sizeGb: number; detail: string }
export interface ServiceInfo { url: string; up: boolean; version: string; models: ModelInfo[] }
export interface ComfyInfo { url: string; version: string; device: string; vramGb: number }
export interface Hardware { gpu: string; vramGb: number; vramFreeGb: number; ramGb: number }
export interface LocalStatus { ollama: ServiceInfo; lmstudio: ServiceInfo; comfyui: ComfyInfo[]; hardware: Hardware }
export interface Template { id: string; title: string; kind: 'image' | 'video'; ready: boolean; uses: string; missing: string[]; takesReference: boolean; note: string }
export interface LocalConfig { ollamaUrl?: string; lmstudioUrl?: string; comfyUrl?: string; textProvider?: 'ollama' | 'lmstudio'; textModel?: string; autoConnect?: boolean }

export const emptyStatus: LocalStatus = { ollama: { url: '', up: false, version: '', models: [] }, lmstudio: { url: '', up: false, version: '', models: [] }, comfyui: [], hardware: { gpu: '', vramGb: 0, vramFreeGb: 0, ramGb: 0 } }

/** Models that can see pictures as well as read text (they can plan shots and check continuity from images). */
export const VISION_HINT = /vl|vision|llava|gemma3|minicpm|moondream|pixtral|qwen2\.5vl|qwen3-vl|llama3\.2-vision|granite3\.2-vision/i

export interface Recommendation { group: 'Writing and planning' | 'Images' | 'Video'; name: string; why: string; how: string; minVramGb: number; sizeGb?: number }

/**
 * What suits this computer. These are starting points, not guarantees: the local scene moves quickly, file names change, and only the Ollama names and sizes below were
 * checked against Ollama's own library. Image and video entries say what to look for in ComfyUI's model manager or on Hugging Face.
 */
export const recommendations: Recommendation[] = [
  { group: 'Writing and planning', name: 'qwen2.5vl:3b', why: 'Smallest model that plans and sees pictures.', how: 'ollama pull qwen2.5vl:3b', minVramGb: 4, sizeGb: 3.2 },
  { group: 'Writing and planning', name: 'gemma3:4b', why: 'Small and quick; writes well and can see images.', how: 'ollama pull gemma3:4b', minVramGb: 4, sizeGb: 3.3 },
  { group: 'Writing and planning', name: 'qwen2.5vl:7b', why: 'Plans and sees: shot plans, continuity checks from images.', how: 'ollama pull qwen2.5vl:7b', minVramGb: 8, sizeGb: 6.0 },
  { group: 'Writing and planning', name: 'gemma3:12b', why: 'Strong writing and image reading. A good default for 12 GB cards.', how: 'ollama pull gemma3:12b', minVramGb: 10, sizeGb: 8.1 },
  { group: 'Writing and planning', name: 'qwen3:8b', why: 'Careful planning over long scripts (text only).', how: 'ollama pull qwen3:8b', minVramGb: 8, sizeGb: 5.2 },
  { group: 'Writing and planning', name: 'gemma3:27b', why: 'The strongest of this family for a 24 GB card.', how: 'ollama pull gemma3:27b', minVramGb: 20, sizeGb: 17 },
  { group: 'Images', name: 'SDXL checkpoint (Juggernaut XL, RealVisXL, SDXL base)', why: 'Runs on almost any card; text only, no reference images.', how: 'Download a .safetensors checkpoint into ComfyUI/models/checkpoints.', minVramGb: 6 },
  { group: 'Images', name: 'FLUX.1 [dev], GGUF or fp8', why: 'The strongest local image quality and text rendering. GGUF (Q4 to Q8) fits 12 GB cards.', how: 'Get flux1-dev (GGUF or fp8), clip_l, t5xxl_fp8 and ae.safetensors; the model page needs a free licence acceptance.', minVramGb: 10 },
  { group: 'Images', name: 'FLUX.1 Kontext [dev]', why: 'Edits an image while keeping the character: the best local match for keeping identity across views.', how: 'ComfyUI has a Kontext template under Browse Templates; it needs the Kontext model file.', minVramGb: 16 },
  { group: 'Video', name: 'Wan 2.2 5B (image to video)', why: 'Runs on ordinary cards; about 5 seconds per clip. This app has a ready workflow for it.', how: 'Files: wan2.2_ti2v_5B_fp16 (10 GB), umt5_xxl_fp8_e4m3fn_scaled (6.7 GB), wan2.2_vae (1.4 GB).', minVramGb: 8, sizeGb: 18 },
  { group: 'Video', name: 'LTX-Video (image to video)', why: 'Very fast clips, good for quick motion tests.', how: 'Use ComfyUI\'s LTX-Video template from Browse Templates, then export it (API) and import it here.', minVramGb: 8 },
  { group: 'Video', name: 'Wan 2.2 14B (image to video)', why: 'Higher quality motion; GGUF versions can fit 16 GB.', how: 'ComfyUI template "Wan 2.2 14B image to video"; export (API) and import it here.', minVramGb: 16 },
]

export type Fit = 'comfortable' | 'tight' | 'too big' | 'unknown'
export function fitFor(minVramGb: number, vramGb: number): Fit {
  if (!vramGb) return 'unknown'
  if (vramGb >= minVramGb * 1.2) return 'comfortable'
  if (vramGb >= minVramGb) return 'tight'
  return 'too big'
}

export function recommendedFor(hw: Hardware, installed: string[]): Array<Recommendation & { fit: Fit; installed: boolean }> {
  const have = new Set(installed.map((n) => n.toLowerCase()))
  return recommendations.map((r) => ({ ...r, fit: fitFor(r.minVramGb, hw.vramGb), installed: have.has(r.name.toLowerCase()) })).filter((r) => r.fit !== 'too big')
}

export function bestTextModel(status: LocalStatus): { provider: 'ollama' | 'lmstudio'; model: string } | null {
  const pick = (models: ModelInfo[]) => [...models].sort((a, b) => Number(VISION_HINT.test(b.name)) - Number(VISION_HINT.test(a.name)) || b.sizeGb - a.sizeGb)[0]
  if (status.ollama.up && status.ollama.models.length) return { provider: 'ollama', model: pick(status.ollama.models).name }
  if (status.lmstudio.up && status.lmstudio.models.length) return { provider: 'lmstudio', model: pick(status.lmstudio.models).name }
  return null
}

export const anyLocal = (s: LocalStatus) => s.ollama.up || s.lmstudio.up || s.comfyui.length > 0
