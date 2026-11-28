import type { SkinMeasurement } from "../domain/skinQa";

interface Raw { original: RawMetrics; candidate: RawMetrics }
interface RawMetrics { texture: number; highlight: number; r: number; g: number; b: number; used_head: boolean }
const tidy = (m: RawMetrics) => ({ texture: m.texture, highlight: m.highlight, r: m.r, g: m.g, b: m.b, usedHead: m.used_head });

/** Measures the face area of an approved original and a candidate on this computer (free, nothing is sent anywhere). Only works in the desktop app. */
export async function measureSkin(original: string, candidate: string): Promise<{ measurement: SkinMeasurement | null; error?: string }> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return { measurement: null, error: "Measuring pictures needs the desktop app." };
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const raw = await invoke<Raw>("skin_metrics", { original, candidate });
    return { measurement: { original: tidy(raw.original), candidate: tidy(raw.candidate) } };
  } catch (e) {
    return { measurement: null, error: String(e).replace(/^Error:\s*/, "").slice(0, 200) };
  }
}
