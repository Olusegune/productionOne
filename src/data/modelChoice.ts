import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocalAi, localCatalog } from "./localAi";
import { mergeCatalog, providerOrder, type CatalogModel, type DiscoveredCatalog, type ProviderKey } from "../domain/imageCatalog";

const KEY = "po:model";
export const startModel: Record<ProviderKey, string> = { kie: "google/nanobanana-2-1", google: "gemini-nano-banana-2.1", openai: "gpt-image-1.5", openrouter: "bytedance-seed/seedream-4.5", fal: "fal-ai/flux/dev", comfyui: "sdxl-keyframes" };

export function readModelChoice(): { provider: ProviderKey; modelId: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && providerOrder.includes(raw.provider) && typeof raw.modelId === "string" && raw.modelId) return raw;
  } catch { /* A missing or broken value falls back to the default. */ }
  return { provider: "kie", modelId: startModel.kie };
}
export function writeModelChoice(provider: ProviderKey, modelId: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ provider, modelId })); } catch { /* The choice is a convenience; the app works without it. */ }
}

/** The model the person is generating with, the providers that have a key, and the full model list (built in plus each provider's own). Shared by the sheet panel and the Director's room. */
export function useModelChoice(desktop: boolean, providersVersion: number) {
  const initial = useMemo(readModelChoice, []);
  const [provider, setProvider] = useState<ProviderKey>(initial.provider);
  const [modelId, setModelId] = useState(initial.modelId);
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [discovered, setDiscovered] = useState<DiscoveredCatalog>({});
  const [refreshing, setRefreshing] = useState(false);
  const switched = useRef(false);
  const local = useLocalAi(desktop);
  const catalog: CatalogModel[] = useMemo(() => mergeCatalog(discovered, localCatalog(local.templates, local.custom)), [discovered, local.templates, local.custom]);
  const comfyUp = local.status.comfyui.length > 0;

  useEffect(() => {
    if (!desktop) return;
    let live = true;
    void (async () => {
      const status: Record<string, boolean> = {};
      for (const p of providerOrder.filter((x) => x !== "comfyui")) status[p] = await invoke<boolean>("credential_status", { provider: p }).catch(() => false);
      let saved: DiscoveredCatalog = (await invoke<DiscoveredCatalog>("model_catalog").catch(() => ({}))) ?? {};
      const age = Date.now() / 1000 - (saved.kie?.fetchedAt ?? 0);
      if (age > 86400) saved = (await invoke<DiscoveredCatalog>("kie_models").catch(() => saved)) ?? saved;
      if (!live) return;
      setConfigured({ ...status, comfyui: false });
      setDiscovered(saved);
      if (!switched.current) {
        switched.current = true;
        const first = providerOrder.find((p) => p !== "comfyui" && status[p]);
        if (first && !status[provider]) { setProvider(first); setModelId(startModel[first]); writeModelChoice(first, startModel[first]); }
      }
    })();
    return () => { live = false; };
  }, [desktop, providersVersion]);

  const configuredAll = useMemo<Record<string, boolean>>(() => ({ ...configured, comfyui: comfyUp }), [configured, comfyUp]);
  const pick = (p: ProviderKey, id: string) => { setProvider(p); setModelId(id); writeModelChoice(p, id); };
  const refresh = async (): Promise<string> => {
    setRefreshing(true);
    try {
      const next = await invoke<DiscoveredCatalog>(provider === "kie" ? "kie_models" : "discover_models", { provider });
      setDiscovered(next);
      return "Model list refreshed.";
    } catch (error) {
      return String(error);
    } finally {
      setRefreshing(false);
    }
  };
  return { provider, modelId, configured: configuredAll, catalog, discovered, refreshing, pick, refresh };
}
