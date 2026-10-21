import { invoke } from "@tauri-apps/api/core";
import { AI_SYSTEM, beatPrompt, parseBeats, type AiSceneReading } from "../engine/aiBeats";
import type { ParsedStory } from "../engine/story";
import type { LocalConfig } from "../domain/localAi";

/** Reads each scene with a local model (Ollama or LM Studio) and returns checked beats. Sequential, so a small graphics card is never asked for two scenes at once. */
export async function runAiPass(story: ParsedStory, config: LocalConfig, onProgress: (done: number, total: number) => void, isCancelled: () => boolean = () => false): Promise<AiSceneReading[]> {
  const kind = config.textProvider ?? "ollama";
  const model = config.textModel;
  if (!model) throw new Error("Choose a local model first (Local AI, then pick one under Ollama or LM Studio).");
  const base = kind === "lmstudio" ? (config.lmstudioUrl ?? "http://127.0.0.1:1234") : (config.ollamaUrl ?? "http://127.0.0.1:11434");
  const scenes = story.scenes.filter((s) => story.characters.some((c) => c.sceneIds.includes(s.id)));
  const out: AiSceneReading[] = [];
  for (let i = 0; i < scenes.length; i++) {
    if (isCancelled()) break;
    onProgress(i, scenes.length);
    const names = story.characters.filter((c) => c.sceneIds.includes(scenes[i].id)).map((c) => c.name);
    const reply = await invoke<string>("local_llm", { kind, base, model, system: AI_SYSTEM, prompt: beatPrompt(scenes[i], names), jsonMode: true, images: [] });
    out.push(parseBeats(reply, scenes[i], names, model));
  }
  onProgress(scenes.length, scenes.length);
  return out;
}
