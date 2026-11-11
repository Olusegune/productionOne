import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Columns2, Wand2, ImagePlus, LayoutGrid, Maximize2, Pause, Play, Sparkles, Square, X } from "lucide-react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  addCleaned,
  addSupplied,
  approve,
  cancel,
  cancelAllWaiting,
  enqueue,
  reassignModel,
  reject,
  retry,
  summarize,
  waitingForAnchor,
  type ImageJob,
  type QueueState,
} from "../domain/generationQueue";
import {
  mergeCatalog,
  modelTakesReferences,
  providerLabels,
  providerOrder,
  type ProviderKey,
  type CatalogModel,
  type DiscoveredCatalog,
} from "../domain/imageCatalog";
import {
  buildViewPrompt,
  intensities,
  outputName,
  primaryViewKeys,
  sheetTypesFor,
  viewsFor,
  type Intensity,
} from "../domain/sheetSpecs";
import type { ExtractedAsset, ScriptScene } from "../domain/productionStudio";
import { detectStoryVariants, type SheetType, type StyleBible } from "../domain/visualDevelopment";
import { characterArcs, expressionPlan } from "../engine/emotion";
import type { ParsedStory } from "../engine/story";
import { ModelPicker } from "./ModelPicker";
import { useModelChoice } from "../data/modelChoice";
import { Lightbox, type LightboxItem } from "./Lightbox";
import { Fold } from "./Fold";
import { CleanRender } from "./CleanRender";

const providers = providerOrder;

const thumbCache = new Map<string, string>();
function Thumb({ job }: { job: ImageJob }) {
  const [src, setSrc] = useState<string | null>(job.outputPath ? (thumbCache.get(job.outputPath) ?? null) : null);
  useEffect(() => {
    const path = job.outputPath;
    if (!path || thumbCache.has(path)) { if (path) setSrc(thumbCache.get(path) ?? null); return; }
    let live = true;
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<string>("image_preview", { path, maxEdge: 480 }))
      .then((url) => { thumbCache.set(path, url); if (live) setSrc(url); })
      .catch(() => {});
    return () => { live = false; };
  }, [job.outputPath]);
  return src ? <img src={src} alt={`${job.label} reference`} /> : <div className="thumb-empty">{job.status === "generating" ? "Generating…" : "No image yet"}</div>;
}

const statusLabel: Record<ImageJob["status"], string> = {
  pending: "Pending",
  queued: "Queued",
  generating: "Generating",
  validating: "Validating",
  completed: "Completed",
  "needs-review": "Needs review",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function SheetStudio(props: {
  assets: ExtractedAsset[];
  scenes: ScriptScene[];
  story?: ParsedStory;
  assetIndex: number;
  style: StyleBible;
  queue: QueueState;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  desktop: boolean;
  providersVersion: number;
  onApproved: (job: ImageJob, primary: boolean) => void;
  notify: (message: string) => void;
  openProviders: () => void;
  openLocal?: () => void;
  /** Extra photos the person attached to each asset (actor, costume, location). Sent with every request to models that accept references. */
  refs: Record<string, string[]>;
  setRefs: (update: (r: Record<string, string[]>) => Record<string, string[]>) => void;
  /** Lets the top-bar Generate button start a test from outside this panel. */
  controlRef?: { current: { generateFirst: () => void } | null };
  focusSheetType?: SheetType;
}) {
  const { assets, scenes, story, assetIndex, style, queue, setQueue, desktop, providersVersion, onApproved, notify, openProviders, openLocal, controlRef, refs, setRefs, focusSheetType } = props;
  const asset = assets[Math.min(assetIndex, Math.max(0, assets.length - 1))];
  const variants = useMemo(() => (asset ? detectStoryVariants(asset, scenes, story) : []), [asset, scenes, story]);
  const [variant, setVariant] = useState("Canonical");
  const sheetTypes = asset ? sheetTypesFor(asset.type) : [];
  const [sheetType, setSheetType] = useState<SheetType>("Turnaround");
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [notes, setNotes] = useState("");
  const choice = useModelChoice(desktop, providersVersion);
  const { provider, modelId, configured, catalog, refreshing } = choice;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [size, setSize] = useState<"grid" | "large">("grid");
  const [compare, setCompare] = useState<string[]>([]);
  const [quality, setQuality] = useState<number | null>(null);

  const activeType: SheetType = sheetTypes.includes(sheetType) ? sheetType : (sheetTypes[0] ?? "Turnaround");
  useEffect(() => { if (focusSheetType && sheetTypes.includes(focusSheetType)) setSheetType(focusSheetType); }, [focusSheetType, asset?.id]);
  const activeVariant = variants.includes(variant) ? variant : "Canonical";
  useEffect(() => { setLightbox(null); setCompare([]); }, [asset?.id, activeType, activeVariant]);
  const model: CatalogModel | undefined = catalog.find((m) => m.provider === provider && m.id === modelId);
  const [fromStory, setFromStory] = useState(true);
  const plan = useMemo(() => {
    if (!story || !asset || asset.type !== "character") return undefined;
    const arc = characterArcs(story).find((a) => a.character.toUpperCase() === asset.name.toUpperCase());
    return arc ? expressionPlan(arc) : undefined;
  }, [story, asset]);
  const usePlan = fromStory && !!plan && plan.length > 1;
  const views = asset ? viewsFor(asset.type, activeType, intensity, usePlan ? plan : undefined) : [];

  const jobFor = (viewKey: string) => {
    const mine = queue.jobs.filter((j) => asset && j.assetId === asset.id && j.variant === activeVariant && j.sheetType === activeType && j.viewKey === viewKey);
    return mine.reduce<ImageJob | undefined>((a, b) => (!a || b.revision > a.revision ? b : a), undefined);
  };

  const generate = (testOneFirst = false) => {
    if (!asset) return;
    const chosen = testOneFirst ? (views.filter((v) => primaryViewKeys.includes(v.key))[0] ? [views.filter((v) => primaryViewKeys.includes(v.key))[0]] : views.slice(0, 1)) : views;
    const requests = chosen.map((view) => ({
      assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key, label: view.label,
      prompt: buildViewPrompt({ style, asset, variant: activeVariant, sheetType: activeType, view, notes, model: modelId }),
      aspect: view.aspect, fullBody: view.fullBody, provider, model: modelId,
      references: modelTakesReferences(provider, modelId) ? (refs[asset.id] ?? []) : [],
      useAnchor: modelTakesReferences(provider, modelId) && !primaryViewKeys.includes(view.key),
      outputName: (revision: number) => outputName(asset, activeVariant, activeType, view, revision),
    }));
    const result = enqueue(queue, requests);
    setQueue(() => result.state);
    if (!result.added) { notify("Every view of this sheet is already queued or approved."); return; }
    const what = `${result.added} view${result.added === 1 ? "" : "s"}${testOneFirst ? " (a test of the first one)" : ""}`;
    if (desktop && !configured[provider]) {
      if (provider === "comfyui") { notify(`Queued ${what}, but ComfyUI is not running. Start it from Local AI, then generation starts.`); openLocal?.(); } else { notify(`Queued ${what}, but there is no ${providerLabels[provider]} key yet. Add it, then generation starts.`); openProviders(); }
      return;
    }
    notify(`Generating ${what}…`);
  };
  if (controlRef) controlRef.current = { generateFirst: () => generate(true) };

  const refreshModels = async () => { notify(await choice.refresh()); };

  const pickImages = async (multiple: boolean): Promise<Array<{ path: string; inspection: { width: number; height: number } }>> => {
    const chosen = await invoke<string[]>("pick_image_files", { multiple });
    if (!chosen.length) return [];
    return invoke<Array<{ path: string; inspection: { width: number; height: number } }>>("import_images", { paths: chosen });
  };
  const useOwnImage = async (viewKey: string, label: string, paths?: Array<{ path: string; inspection: { width: number; height: number } }>) => {
    const view = views.find((v) => v.key === viewKey);
    if (!asset || !view) return;
    try {
      const [file] = paths ?? (await pickImages(false));
      if (!file) return;
      const out = addSupplied(queue, { assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey, label, aspect: view.aspect, fullBody: view.fullBody, path: file.path, width: file.inspection.width, height: file.inspection.height });
      setQueue(() => out.state);
      onApproved(out.job, primaryViewKeys.includes(viewKey));
      notify(`Using your image for ${label}. It is saved as it came, at ${file.inspection.width}×${file.inspection.height}.`);
    } catch (error) { notify(String(error)); }
  };
  const addRefPhotos = async (picked?: Array<{ path: string }>) => {
    if (!asset) return;
    try {
      const files = picked ?? (await pickImages(true));
      if (!files.length) return;
      setRefs((r) => ({ ...r, [asset.id]: [...new Set([...(r[asset.id] ?? []), ...files.map((f) => f.path)])].slice(0, 8) }));
      notify(`Added ${files.length} reference photo${files.length === 1 ? "" : "s"} for ${asset.name}.`);
    } catch (error) { notify(String(error)); }
  };
  // Files dropped on the window go to the view card under the pointer, or to the asset's reference photos.
  const dropHandler = useRef<(paths: string[], x: number, y: number) => void>(() => {});
  dropHandler.current = async (paths, x, y) => {
    const target = document.elementFromPoint(x / window.devicePixelRatio, y / window.devicePixelRatio)?.closest<HTMLElement>("[data-view-key]");
    try {
      const imported = await invoke<Array<{ path: string; inspection: { width: number; height: number } }>>("import_images", { paths: paths.filter((p) => /\.(png|jpe?g|webp)$/i.test(p)).slice(0, 40) });
      if (!imported.length) return;
      if (target?.dataset.viewKey) await useOwnImage(target.dataset.viewKey, target.dataset.viewLabel ?? target.dataset.viewKey, [imported[0]]);
      else await addRefPhotos(imported);
    } catch (error) { notify(String(error)); }
  };
  useEffect(() => {
    if (!desktop) return;
    let off: Array<() => void> = [];
    let dead = false;
    void Promise.all([
      listen<{ paths: string[]; position: { x: number; y: number } }>("tauri://drag-drop", (e) => { document.body.classList.remove("dropping"); dropHandler.current(e.payload.paths, e.payload.position.x, e.payload.position.y); }),
      listen("tauri://drag-enter", () => document.body.classList.add("dropping")),
      listen("tauri://drag-leave", () => document.body.classList.remove("dropping")),
    ]).then((fns) => { if (dead) fns.forEach((f) => f()); else off = fns; });
    return () => { dead = true; off.forEach((f) => f()); document.body.classList.remove("dropping"); };
  }, [desktop]);

  const stats = summarize(queue);
  const waiting = stats.queued + stats.pending;
  const viewItems: LightboxItem[] = views.flatMap((v) => { const j = jobFor(v.key); return j?.outputPath ? [{ job: j, label: v.label }] : []; });
  const doApprove = (job: ImageJob) => { setQueue((q) => approve(q, job.id)); onApproved(job, primaryViewKeys.includes(job.viewKey)); };
  const doReject = (job: ImageJob) => setQueue((q) => reject(q, job.id));

  if (!asset) return <section className="panel sheet-studio"><h3>Analyze a script first</h3><p className="helper">Sheets are planned per character, prop and set once your script has been analyzed.</p></section>;

  const approvedCount = views.filter((v) => jobFor(v.key)?.approved).length;
  const generatingCount = views.filter((v) => ["generating", "validating", "queued", "pending"].includes(jobFor(v.key)?.status ?? "")).length;
  const reviewCount = views.filter((v) => jobFor(v.key)?.status === "needs-review").length;
  const mine = refs[asset.id] ?? [];
  const anchorOn = modelTakesReferences(provider, modelId);
  const toggleCompare = (key: string) => setCompare((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key].slice(-2)));
  const compareItems = compare.map((k) => ({ key: k, view: views.find((v) => v.key === k), job: jobFor(k) })).filter((x): x is { key: string; view: (typeof views)[number]; job: ImageJob } => !!x.view && !!x.job?.outputPath);

  return (
    <section className="panel sheet-studio" aria-label="Reference sheets">
      <header className="ss-head">
        <div>
          <span className="eyebrow">Reference sheets · {activeVariant}</span>
          <h3>{asset.name} <span className="ss-type">{activeType}</span></h3>
          <p className="ss-status" aria-live="polite">
            <i className={reviewCount ? "dot review" : generatingCount ? "dot busy" : "dot"} />
            {views.length ? `${approvedCount} of ${views.length} approved` : "No views planned"}
            {reviewCount > 0 && ` · ${reviewCount} to review`}
            {generatingCount > 0 && ` · ${generatingCount} in the queue`}
            {queue.paused && " · paused"}
          </p>
        </div>
        <div className="ss-head-actions">
          {queue.paused ? (
            <button className="secondary" disabled={!waiting && !stats.generating} onClick={() => setQueue((q) => ({ ...q, paused: false }))}><Play size={14} /> Resume</button>
          ) : (
            <button className="secondary" disabled={!waiting && !stats.generating} onClick={() => setQueue((q) => ({ ...q, paused: true }))}><Pause size={14} /> Pause</button>
          )}
          <button className="secondary" disabled={!waiting} onClick={() => setQueue((q) => cancelAllWaiting(q))}>Cancel waiting</button>
          {desktop && <button className="secondary" disabled={viewItems.length === 0} onClick={() => setQuality(0)} title="Check colour, noise, highlights and sharpness, and correct them without changing the original"><Wand2 size={14} /> Image quality</button>}
        </div>
      </header>

      <div className="ss-bar">
        <label><span>Look</span>
          <select value={activeVariant} onChange={(e) => setVariant(e.target.value)}>{variants.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label><span>Sheet</span>
          <select value={activeType} onChange={(e) => setSheetType(e.target.value as SheetType)}>{sheetTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
        {asset.type === "character" && activeType === "Expressions" && plan && plan.length > 1 && (
          <label><span>Expressions</span>
            <select value={fromStory ? "story" : "full"} onChange={(e) => setFromStory(e.target.value === "story")}>
              <option value="story">From the story ({plan.length})</option>
              <option value="full">Full set (8)</option>
            </select></label>
        )}
        {asset.type === "character" && activeType === "Expressions" && !usePlan && (
          <label><span>Intensity</span>
            <select value={intensity} onChange={(e) => setIntensity(e.target.value as Intensity)}>{intensities.map((i) => <option key={i}>{i}</option>)}</select></label>
        )}
        <label className="ss-model"><span>Image model · reference sheets</span>
          <ModelPicker catalog={catalog} configured={configured} provider={provider} modelId={modelId} onPick={choice.pick} onRefresh={() => void refreshModels()} refreshing={refreshing} />
        </label>
        <div className="seg" role="group" aria-label="Preview size">
          <button className={size === "grid" ? "on" : ""} onClick={() => setSize("grid")} aria-pressed={size === "grid"} title="Grid" aria-label="Grid previews"><LayoutGrid size={15} /></button>
          <button className={size === "large" ? "on" : ""} onClick={() => setSize("large")} aria-pressed={size === "large"} title="Large previews" aria-label="Large previews"><Square size={15} /></button>
        </div>
      </div>

      <div className="ss-work">
        <div className="ss-main">
          {!desktop && <p className="helper">Image generation runs in the Windows app. The browser preview shows the plan only.</p>}
          {compare.length > 0 && (
            <div className="ss-compare-bar">
              <Columns2 size={15} /> {compare.length === 2 ? "Comparing two views side by side" : "Pick one more view to compare"}
              <button className="secondary" onClick={() => setCompare([])}>Clear</button>
            </div>
          )}
          {compareItems.length === 2 && (
            <div className="ss-compare" aria-label="Compare views">
              {compareItems.map(({ key, view, job }) => (
                <figure key={key}><img src={convertFileSrc(job.outputPath!)} alt={`${view.label} at full size`} /><figcaption>{view.label}{job.approved ? " · Approved" : ""}</figcaption></figure>
              ))}
            </div>
          )}
          <div className={`view-grid ${size}`}>
            {views.map((view) => {
              const job = jobFor(view.key);
              const at = viewItems.findIndex((it) => it.job.id === job?.id);
              return (
                <article key={view.key} className={`view-card ${job?.status ?? "none"}${job?.approved ? " approved" : ""}`} data-view-key={view.key} data-view-label={view.label}>
                  <button className="view-thumb" disabled={at < 0} onClick={() => setLightbox(at)} aria-label={at >= 0 ? `Open ${view.label} full size` : `${view.label}: no image yet`}>
                    {job ? <Thumb job={job} /> : <div className="thumb-empty"><ImagePlus size={22} /><span>Not generated</span></div>}
                    {at >= 0 && <span className="vt-zoom"><Maximize2 size={15} /></span>}
                    <span className={`vt-status ${job?.status ?? "none"}`}>{job ? `${statusLabel[job.status]}${job.revision > 1 ? ` · v${job.revision}` : ""}${job.approved ? " · Approved" : job.rejected ? " · Rejected" : ""}` : "Not generated"}</span>
                  </button>
                  <div className="view-meta">
                    <b>{view.label}</b>
                    {job?.qaNotes.map((n) => <small key={n} className="qa-note">{n}</small>)}
                    {job?.error && <small className="qa-note">{job.error}</small>}
                    {job && job.status === "queued" && waitingForAnchor(queue, job) && <small>Waits for the approved front view, then uses it as its reference.</small>}
                    {job?.width && <small>{job.width}×{job.height}px{job.source === "supplied" ? " · your image" : ""}</small>}
                  </div>
                  <div className="view-actions">
                    {job?.status === "needs-review" && (<>
                      <button className="primary" onClick={() => doApprove(job)}><Check size={14} /> Approve</button>
                      <button className="secondary" onClick={() => doReject(job)}><X size={14} /> Reject</button>
                    </>)}
                    {job && (job.status === "failed" || job.status === "cancelled") && <button className="secondary" onClick={() => setQueue((q) => retry(q, job.id))}>Retry</button>}
                    {job && job.status === "queued" && <button className="secondary" onClick={() => setQueue((q) => cancel(q, job.id))}>Cancel</button>}
                    {job && job.status === "completed" && job.rejected && <button className="secondary" onClick={() => generate(false)}>Regenerate</button>}
                    {job && (job.status === "queued" || job.status === "failed") && model && (job.provider !== provider || job.model !== modelId) && (
                      <button className="secondary" onClick={() => setQueue((q) => reassignModel(q, [job.id], provider, modelId))}>Use {model.name}</button>
                    )}
                    {desktop && <button className="tertiary" onClick={() => void useOwnImage(view.key, view.label)} title="Use your own image for this view"><ImagePlus size={14} /> Use my image</button>}
                    {at >= 0 && <button className={`tertiary${compare.includes(view.key) ? " on" : ""}`} aria-pressed={compare.includes(view.key)} onClick={() => toggleCompare(view.key)} title="Compare with another view"><Columns2 size={14} /> Compare</button>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="ss-inspector" aria-label="Sheet settings">
          <div className="ss-actions">
            <button className="primary" onClick={() => generate(false)} disabled={!views.length}><Sparkles size={15} /> Generate {views.length} view{views.length === 1 ? "" : "s"}</button>
            {views.length > 1 && <button className="secondary" onClick={() => generate(true)} title="Make one image first to check the look">Test one first</button>}
            {!configured[provider] && desktop && (provider === "comfyui" ? <button className="secondary" onClick={openLocal}>Start ComfyUI</button> : <button className="secondary" onClick={openProviders}>Add {providerLabels[provider]} key</button>)}
          </div>
          <Fold title="Reference photos" hint={mine.length ? `${mine.length} added` : "none yet"} defaultOpen>
            <div className="ss-refs-row">
              {mine.map((p) => (
                <figure key={p}><img src={convertFileSrc(p)} alt="Reference photo" /><button onClick={() => setRefs((r) => ({ ...r, [asset.id]: (r[asset.id] ?? []).filter((x) => x !== p) }))} aria-label="Remove this photo"><X size={13} /></button></figure>
              ))}
              {desktop && <button className="ss-add" onClick={() => void addRefPhotos()}><ImagePlus size={16} /> Add photos</button>}
            </div>
            {mine.length === 0 && <p className="helper">Photos of the actor, costume or location. Drop images on the window too. They go with every request to models that accept references.</p>}
          </Fold>
          <Fold title="Notes" hint="added to every prompt" defaultOpen>
            <textarea className="ss-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. dust-worn jacket, torn left sleeve" aria-label="Notes for this sheet" />
          </Fold>
          <Fold title="Identity lock" hint={anchorOn ? "on" : "model has no references"}>
            <p className="helper">{anchorOn ? "Your approved front view is sent as a reference to keep the character consistent across the other views." : "This model takes no reference images, so consistency relies on the written description. Choose a model that takes references to lock identity."}</p>
          </Fold>
          <Fold title="Model">
            <p className="helper">{model ? `${model.name}. ${model.note}` : "Custom model id: this app does not know its capabilities."}</p>
          </Fold>
        </aside>
      </div>

      {quality !== null && viewItems.length > 0 && (
        <CleanRender items={viewItems.map((it) => it.job)} index={Math.min(quality, viewItems.length - 1)} onIndex={setQuality} onClose={() => setQuality(null)} notify={notify}
          onSaved={(from, file) => { const out = addCleaned(queue, from, file); setQueue(() => out.state); if (out.job.approved) onApproved(out.job, primaryViewKeys.includes(out.job.viewKey)); }} />
      )}
      {lightbox !== null && viewItems.length > 0 && (
        <Lightbox items={viewItems} index={Math.min(lightbox, viewItems.length - 1)} onIndex={setLightbox} onClose={() => setLightbox(null)} onApprove={doApprove} onReject={doReject} />
      )}
    </section>
  );
}
