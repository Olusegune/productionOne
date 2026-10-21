import { useEffect, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emptyStatus, type LocalConfig, type LocalStatus, type Template } from "../domain/localAi";
import type { CatalogModel } from "../domain/imageCatalog";

interface State { status: LocalStatus; templates: Template[]; custom: string[]; config: LocalConfig; checked: boolean; busy: boolean; error: string }
let state: State = { status: emptyStatus, templates: [], custom: [], config: {}, checked: false, busy: false, error: "" };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

/** Looks for Ollama, LM Studio and ComfyUI, reads what each has, and remembers where ComfyUI was found. Safe to call often: it only reads. */
export async function refreshLocal(): Promise<State> {
  if (state.busy) return state;
  set({ busy: true, error: "" });
  try {
    const config: LocalConfig = (await invoke<LocalConfig>("local_config_get").catch(() => ({} as LocalConfig))) ?? {};
    const status = await invoke<LocalStatus>("local_detect", { ollamaUrl: config.ollamaUrl ?? null, lmstudioUrl: config.lmstudioUrl ?? null, comfyUrl: config.comfyUrl ?? null });
    let templates: Template[] = [];
    let custom: string[] = [];
    const comfy = status.comfyui[0];
    if (comfy) {
      templates = await invoke<Template[]>("comfy_templates", { base: comfy.url }).catch(() => []);
      custom = await invoke<string[]>("comfy_custom_workflows").catch(() => []);
      if (config.comfyUrl !== comfy.url) { config.comfyUrl = comfy.url; await invoke("local_config_set", { config }).catch(() => {}); }
    }
    if (status.ollama.up && !config.textModel && status.ollama.models.length) {
      const { bestTextModel } = await import("../domain/localAi");
      const best = bestTextModel(status);
      if (best) { config.textProvider = best.provider; config.textModel = best.model; await invoke("local_config_set", { config }).catch(() => {}); }
    }
    set({ status, templates, custom, config, checked: true, busy: false });
  } catch (e) {
    set({ busy: false, checked: true, error: String(e) });
  }
  return state;
}

export async function saveLocalConfig(patch: LocalConfig) {
  const config = { ...state.config, ...patch };
  await invoke("local_config_set", { config });
  set({ config });
}

/** Lets the person choose a workflow they exported from ComfyUI (API format) and keeps a copy for the app. Returns its name, or null if they cancelled. */
export async function addCustomWorkflow(): Promise<string | null> {
  const picked = await invoke<string | null>("pick_workflow_file");
  if (!picked) return null;
  return invoke<string>("comfy_add_workflow", { path: picked });
}

export function useLocalAi(desktop: boolean, autoDetect = true) {
  const snap = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);
  useEffect(() => { if (desktop && autoDetect && !state.checked && !state.busy) void refreshLocal(); }, [desktop, autoDetect]);
  return snap;
}

/** ComfyUI's ready-made and imported workflows as entries for the model picker. */
export function localCatalog(templates: Template[], custom: string[]): CatalogModel[] {
  const built = templates.filter((t) => t.kind === "image").map<CatalogModel>((t) => ({ provider: "comfyui", id: t.id, name: t.title, source: "discovered", references: t.takesReference, note: t.ready ? `${t.note} Using ${t.uses}.` : `Not ready: ${t.missing.join("; ")}` }));
  const mine = custom.map<CatalogModel>((name) => ({ provider: "comfyui", id: name, name: `Your workflow: ${name}`, source: "discovered", references: false, note: "A workflow you exported from ComfyUI. Use {{prompt}}, {{seed}}, {{width}} and {{height}} in it." }));
  return [...built, ...mine];
}
