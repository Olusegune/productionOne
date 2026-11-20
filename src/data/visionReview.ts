import { invoke } from '@tauri-apps/api/core'
import { VISION_HINT, type LocalConfig } from '../domain/localAi'
import type { VisionProvider } from '../domain/visualReview'

export type VisionAvailability = { ok: true; provider: VisionProvider; model: string } | { ok: false; why: string }

/**
 * A vision model that runs on this computer (Ollama or LM Studio, chosen in Local AI). Nothing is sent online and nothing is spent. It is opt-in: this only
 * builds the provider; a check runs when a person presses a button. Whether the model is any good at spotting problems is not known: it needs human-labelled evaluation.
 */
export function localVision(config: LocalConfig): VisionAvailability {
  if (!config.textModel) return { ok: false, why: 'Choose a local model first (Local AI).' }
  if (!VISION_HINT.test(config.textModel)) return { ok: false, why: `${config.textModel} does not look like a model that can see pictures. Choose one such as qwen2.5vl or gemma3 in Local AI.` }
  const kind = config.textProvider ?? 'ollama'
  const base = kind === 'lmstudio' ? (config.lmstudioUrl ?? 'http://127.0.0.1:1234') : (config.ollamaUrl ?? 'http://127.0.0.1:11434')
  const model = config.textModel
  return {
    ok: true, model,
    provider: { assess: (prompt, imagePaths) => invoke<string>('local_llm', { kind, base, model, system: 'You check production pictures and answer with JSON only.', prompt, jsonMode: true, images: imagePaths.slice(0, 6) }) },
  }
}
