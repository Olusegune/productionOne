import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Check, Info, RotateCcw, Wand2, X } from "lucide-react";
import type { ImageJob } from "../domain/generationQueue";

export interface CleanParams { temperature: number; tint: number; saturation: number; denoise: number; highlights: number; bloom: number; sharpen: number; texture: number; intensity: number; exposure: number; contrast: number; /** 1, 2 or 4: a smooth enlargement made when saving */ enlarge: number }
export interface CleanSuggestion { id: string; severity: "info" | "suggest" | "warn"; message: string; remedy: string; params: CleanParams | null }
export interface CleanReport { width: number; height: number; warmCast: number; clippedHighlights: number; clippedShadows: number; noise: number; edgeOvershoot: number; bloom: number; skinFraction: number; skinDetail: number; suggestions: CleanSuggestion[] }
export interface CleanSaved { path: string; width: number; height: number }

/** How a picture is made bigger: a smooth filter on this computer, or an upscaler. Topaz and Magnific cost money and are only used when their button is pressed. */
export type EnlargeMethod = "smooth" | "local" | "topaz" | "magnific";
export const enlargeMethods: Array<{ id: EnlargeMethod; label: string; paid: boolean; name: string; cost: string }> = [
  { id: "smooth", label: "Smooth (free, instant, no new detail)", paid: false, name: "a smooth filter", cost: "" },
  { id: "local", label: "Real-ESRGAN (free, needs ComfyUI)", paid: false, name: "Real-ESRGAN", cost: "" },
  { id: "topaz", label: "Topaz (paid, uses your Kie credits, untested)", paid: true, name: "Topaz", cost: "Billed by Kie.ai from your credits; see your Kie dashboard for the price." },
  { id: "magnific", label: "Magnific (paid, about €0.10 to €0.50, untested)", paid: true, name: "Magnific", cost: "Billed by Magnific per picture; about €0.10 for a 2x of a small frame, more for larger ones." },
];

export const neutral: CleanParams = { temperature: 0, tint: 0, saturation: 0, denoise: 0, highlights: 0, bloom: 0, sharpen: 0, texture: 50, intensity: 100, exposure: 0, contrast: 0, enlarge: 1 };

/** Adds a suggestion's changes on top of the current settings. Controls the suggestion does not touch stay as they are. */
export function mergeSuggestion(current: CleanParams, s: CleanParams): CleanParams {
  const out = { ...current };
  (Object.keys(neutral) as Array<keyof CleanParams>).forEach((k) => { if (k !== "texture" && k !== "intensity" && k !== "enlarge" && s[k] !== 0) out[k] = s[k]; });
  if (s.texture !== neutral.texture) out.texture = s.texture;
  return out;
}

const sliders: Array<{ key: keyof CleanParams; label: string; min: number; max: number; hint: string }> = [
  { key: "exposure", label: "Brightness", min: -100, max: 100, hint: "Darker to brighter (about one stop each way)" },
  { key: "contrast", label: "Contrast", min: -100, max: 100, hint: "Flatter to more contrast" },
  { key: "temperature", label: "Temperature", min: -100, max: 100, hint: "Cooler to warmer" },
  { key: "tint", label: "Tint", min: -100, max: 100, hint: "Greener to more magenta" },
  { key: "saturation", label: "Colour strength", min: -100, max: 100, hint: "Muted to vivid. All the way down is black and white" },
  { key: "highlights", label: "Highlight recovery", min: 0, max: 100, hint: "Tone down blown-out whites" },
  { key: "bloom", label: "Bloom reduction", min: 0, max: 100, hint: "Less glow around lights" },
  { key: "denoise", label: "Noise reduction", min: 0, max: 100, hint: "Smooth grain, keep edges" },
  { key: "texture", label: "Texture kept", min: 0, max: 100, hint: "Protects natural detail from smoothing" },
  { key: "sharpen", label: "Sharpness", min: -100, max: 100, hint: "Softer to sharper" },
];

/**
 * Image quality inspector. It measures one image, offers suggestions that say what they do and when to leave them alone, and shows the corrected result next to the original.
 * Nothing touches the original file: "Save" writes a new revision of the view.
 */
export function CleanRender(props: {
  items: ImageJob[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onSaved: (job: ImageJob, file: CleanSaved) => void;
  notify: (message: string) => void;
}) {
  const { items, index, onIndex, onClose, onSaved, notify } = props;
  const job = items[index];
  const [params, setParams] = useState<CleanParams>(neutral);
  const [report, setReport] = useState<CleanReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [split, setSplit] = useState(50);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<EnlargeMethod>("smooth");
  /** What just happened, shown inside this panel: the app's own notice sits behind it. */
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const say = (kind: "ok" | "error", text: string) => { setStatus({ kind, text }); notify(text); };
  const [flavor, setFlavor] = useState<"photo" | "sublime" | "photo_denoiser">("photo");
  const stage = useRef<HTMLDivElement>(null);
  const history = useRef<CleanParams[]>([]);

  useEffect(() => {
    setParams(neutral); setReport(null); setError(null); setBefore(null); setAfter(null); history.current = [];
    if (!job?.outputPath) return;
    let live = true;
    void invoke<CleanReport>("clean_analyze", { path: job.outputPath }).then((r) => live && setReport(r)).catch((e) => live && setError(String(e)));
    void invoke<string>("clean_preview", { path: job.outputPath, params: neutral, maxEdge: 1400, original: true }).then((u) => live && setBefore(u)).catch(() => {});
    return () => { live = false; };
  }, [job?.id, job?.outputPath]);

  const changed = useMemo(() => (Object.keys(neutral) as Array<keyof CleanParams>).some((k) => k !== "texture" && k !== "intensity" && k !== "enlarge" && params[k] !== 0), [params]);
  const enlarging = params.enlarge > 1;
  const chosen = enlargeMethods.find((m) => m.id === method)!;
  /** An upscaler (not the smooth filter) is doing the enlarging. */
  const remote = enlarging && method !== "smooth";
  useEffect(() => {
    if (!job?.outputPath) return;
    if (!changed) { setAfter(null); return; }
    let live = true;
    const t = window.setTimeout(() => {
      void invoke<string>("clean_preview", { path: job.outputPath, params, maxEdge: 1400, original: false }).then((u) => live && setAfter(u)).catch((e) => live && setError(String(e)));
    }, 140);
    return () => { live = false; window.clearTimeout(t); };
  }, [params, changed, job?.outputPath]);

  const set = useCallback((next: CleanParams) => { history.current.push(params); setParams(next); }, [params]);
  const undo = () => { const p = history.current.pop(); if (p) setParams(p); };
  const reset = () => { history.current.push(params); setParams(neutral); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const save = async (all: boolean) => {
    if (!changed && !enlarging) return;
    setBusy(true);
    setStatus(null);
    try {
      if (remote) {
        // One picture at a time: a paid upscale is never run across a whole sheet. Adjustments are saved first, and the upscaler works on that copy.
        if (!job.outputPath) return;
        let path = job.outputPath;
        if (changed) path = (await invoke<CleanSaved>("clean_save", { path, params: { ...params, enlarge: 1 } })).path;
        const file = await invoke<CleanSaved>("upscale_image", { method, path, factor: params.enlarge, flavor: method === "magnific" ? flavor : null });
        onSaved(job, file);
        say("ok", `Saved a ${params.enlarge}× copy made with ${chosen.name} (${file.width}×${file.height}). The original is kept.`);
        setParams(neutral); history.current = [];
        return;
      }
      const targets = all ? items : [job];
      let n = 0;
      for (const t of targets) {
        if (!t.outputPath) continue;
        const file = await invoke<CleanSaved>("clean_save", { path: t.outputPath, params });
        onSaved(t, file); n += 1;
      }
      say("ok", `Saved ${n} corrected revision${n === 1 ? "" : "s"}. The originals are kept.`);
      if (!all) { setParams(neutral); history.current = []; }
    } catch (e) { say("error", String(e)); } finally { setBusy(false); }
  };

  const dragSplit = (e: React.PointerEvent) => {
    const el = stage.current; if (!el) return;
    const move = (clientX: number) => { const r = el.getBoundingClientRect(); setSplit(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))); };
    move(e.clientX);
    const onMove = (ev: PointerEvent) => move(ev.clientX);
    const up = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", up);
  };

  if (!job) return null;
  return createPortal(
    <div className="cr" role="dialog" aria-modal="true" aria-label="Image quality">
      <div className="cr-bar">
        <b>Image quality</b>
        <span>{job.label}{job.revision > 1 ? ` · v${job.revision}` : ""}</span>
        {items.length > 1 && <div className="cr-nav"><button className="secondary" onClick={() => onIndex((index - 1 + items.length) % items.length)} aria-label="Previous image">‹</button><small>{index + 1} / {items.length}</small><button className="secondary" onClick={() => onIndex((index + 1) % items.length)} aria-label="Next image">›</button></div>}
        <button className="secondary cr-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="cr-body">
        <div className="cr-stage" ref={stage} onPointerDown={dragSplit}>
          {before && <img className="cr-img" src={before} alt="Original" draggable={false} />}
          {after && <img className="cr-img cr-after" src={after} alt="Corrected" draggable={false} style={{ clipPath: `inset(0 0 0 ${split}%)` }} />}
          {after && <><i className="cr-handle" style={{ left: `${split}%` }} role="slider" aria-label="Before and after" aria-valuenow={Math.round(split)} aria-valuemin={0} aria-valuemax={100} tabIndex={0} onKeyDown={(e) => { if (e.key === "ArrowLeft") setSplit((s) => Math.max(0, s - 4)); if (e.key === "ArrowRight") setSplit((s) => Math.min(100, s + 4)); }} /><span className="cr-tag l">Original</span><span className="cr-tag r">Corrected</span></>}
          {!before && !error && <p className="cr-wait">Reading the image…</p>}
        </div>
        <aside className="cr-side">
          <section>
            <h4>Suggestions</h4>
            {error && <p className="cr-note warn"><AlertTriangle size={14} /> {error}</p>}
            {!report && !error && <p className="helper">Measuring…</p>}
            {report?.suggestions.map((s) => (
              <div key={s.id} className={`cr-sug ${s.severity}`}>
                <p>{s.severity === "warn" ? <AlertTriangle size={14} /> : <Info size={14} />} {s.message}</p>
                {s.remedy && <small>{s.remedy}</small>}
                {s.params && <button className="secondary" onClick={() => set(mergeSuggestion(params, s.params!))}><Wand2 size={13} /> Try this</button>}
              </div>
            ))}
            <p className="cr-limit">These are measurements, not a verdict. Filters cannot fix faces, hands, likeness or plastic-looking skin; regenerate or retouch for those.</p>
          </section>
          <section>
            <h4>Adjust</h4>
            {sliders.map((c) => (
              <label key={c.key} className="cr-slider" title={c.hint}>
                <span>{c.label}<output>{Math.round(params[c.key])}</output></span>
                <input type="range" min={c.min} max={c.max} value={params[c.key]} onChange={(e) => setParams({ ...params, [c.key]: Number(e.target.value) })} onPointerDown={() => history.current.push(params)} />
              </label>
            ))}
            <label className="cr-slider"><span>Overall strength<output>{Math.round(params.intensity)}%</output></span>
              <input type="range" min={0} max={100} value={params.intensity} onChange={(e) => setParams({ ...params, intensity: Number(e.target.value) })} onPointerDown={() => history.current.push(params)} /></label>
            <label className="cr-slider" title="Makes the picture bigger with a smooth filter. It does not add detail: it is not an AI upscaler.">
              <span>Enlarge<output>{params.enlarge > 1 ? `${params.enlarge}×` : "off"}</output></span>
              <select aria-label="Enlarge" value={params.enlarge} onChange={(e) => set({ ...params, enlarge: Number(e.target.value) })}>
                <option value={1}>Keep the size</option><option value={2}>2× (smooth)</option><option value={4}>4× (smooth)</option>
              </select>
            </label>
            {enlarging && (
              <label className="cr-slider"><span>Enlarge with</span>
                <select aria-label="Enlarge method" value={method} onChange={(e) => setMethod(e.target.value as EnlargeMethod)}>
                  {enlargeMethods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
            )}
            {enlarging && method === "magnific" && (
              <label className="cr-slider"><span>Magnific style</span>
                <select aria-label="Magnific style" value={flavor} onChange={(e) => setFlavor(e.target.value as typeof flavor)}>
                  <option value="photo">Photo</option><option value="sublime">Sublime (illustration, art)</option><option value="photo_denoiser">Photo, noise removed</option>
                </select>
              </label>
            )}
            {enlarging && !chosen.paid && method === "smooth" && <p className="cr-note"><Info size={14} /> A smooth enlargement makes the picture bigger without adding detail. For real detail choose an upscaler above, or regenerate at a higher quality.</p>}
            {enlarging && method === "local" && <p className="cr-note"><Info size={14} /> Runs on your computer through ComfyUI with a Real-ESRGAN model (RealESRGAN_x4plus.pth in models/upscale_models). It needs ComfyUI running. 2x is made from its 4x result.</p>}
            {remote && chosen.paid && <p className="cr-note warn"><AlertTriangle size={14} /> {chosen.name} costs money. {chosen.cost} It runs only when you press the button below, on this one picture. It cannot be undone, and the result is kept as a new copy.</p>}
            {changed && <p className="cr-note"><Info size={14} /> Corrections change how the image looks. A warm or grainy look can be intentional: check faces and costume colours before saving.</p>}
          </section>
          {status && <p className={`cr-note${status.kind === "error" ? " warn" : ""}`} role={status.kind === "error" ? "alert" : "status"}>{status.kind === "error" ? <AlertTriangle size={14} /> : <Check size={14} />} {status.text}</p>}
          <div className="cr-actions">
            <button className="primary" disabled={(!changed && !enlarging) || busy} onClick={() => void save(false)}><Check size={15} /> {busy ? (remote ? "Working…" : "Saving…") : remote ? `Upscale ${params.enlarge}× with ${chosen.name}${chosen.paid ? " (paid)" : ""} and save` : "Save corrected revision"}</button>
            {items.length > 1 && !remote && <button className="secondary" disabled={(!changed && !enlarging) || busy} onClick={() => void save(true)}>Apply to all {items.length} images</button>}
            <div className="cr-row"><button className="tertiary" disabled={!history.current.length} onClick={undo}>Undo</button><button className="tertiary" disabled={!changed && !enlarging} onClick={reset}><RotateCcw size={13} /> Reset</button></div>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
