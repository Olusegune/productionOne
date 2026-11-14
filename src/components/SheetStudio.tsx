import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Columns2, Wand2, ImagePlus, LayoutGrid, Maximize2, Pause, Play, RefreshCw, Sparkles, Square, X } from "lucide-react";
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
  anchorFor,
  shouldAnchor,
  retry,
  summarize,
  wouldEnqueue,
  costPreview,
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
import { anchorStatus, suggestReferenceModel } from "../domain/identityAnchor";
import {
  buildViewPrompt,
  intensities,
  outputName,
  backdropChoices,
  primaryViewKeys,
  shapeChoices,
  shapeFor,
  sheetTypesFor,
  viewsFor,
  type Backdrop,
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
import { EmptyState } from "./EmptyState";
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
  /** When given, notes are held by the project and saved with it; otherwise they live only in this panel. */
  notesByAsset?: Record<string, string>;
  setNotesByAsset?: (update: (m: Record<string, string>) => Record<string, string>) => void;
  /** Per-sheet choices saved with the project: shape (asset|sheet) and backdrop (asset|sheet|backdrop). Empty means the defaults. */
  settings?: Record<string, string>;
  setSettings?: (update: (m: Record<string, string>) => Record<string, string>) => void;
}) {
  const { assets, scenes, story, assetIndex, style, queue, setQueue, desktop, providersVersion, onApproved, notify, openProviders, openLocal, controlRef, refs, setRefs, focusSheetType } = props;
  const asset = assets[Math.min(assetIndex, Math.max(0, assets.length - 1))];
  const variants = useMemo(() => (asset ? detectStoryVariants(asset, scenes, story) : []), [asset, scenes, story]);
  const [variant, setVariant] = useState("Canonical");
  const sheetTypes = asset ? sheetTypesFor(asset.type) : [];
  const [sheetType, setSheetType] = useState<SheetType>("Turnaround");
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  // Notes belong to one asset: switching assets must never carry another asset's notes into its prompts.
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const notesByAsset = props.notesByAsset ?? localNotes;
  const setNotesByAsset = props.setNotesByAsset ?? setLocalNotes;
  const notes = asset ? notesByAsset[asset.id] ?? "" : "";
  const setNotes = (value: string) => { if (asset) setNotesByAsset((m) => ({ ...m, [asset.id]: value })); };
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const settings = props.settings ?? localSettings;
  const setSettings = props.setSettings ?? setLocalSettings;
  const choice = useModelChoice(desktop, providersVersion);
  const { provider, modelId, configured, catalog, refreshing } = choice;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [size, setSize] = useState<"grid" | "large">("grid");
  const [compare, setCompare] = useState<string[]>([]);
  const [quality, setQuality] = useState<number | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const activeType: SheetType = sheetTypes.includes(sheetType) ? sheetType : (sheetTypes[0] ?? "Turnaround");
  useEffect(() => { if (focusSheetType && sheetTypes.includes(focusSheetType)) setSheetType(focusSheetType); }, [focusSheetType, asset?.id]);
  const activeVariant = variants.includes(variant) ? variant : "Canonical";
  useEffect(() => { setLightbox(null); setCompare([]); setPicked([]); },[asset?.id, activeType, activeVariant]);
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

  const shapeKey = asset ? `${asset.id}|${activeType}` : "";
  const shapeOverride = settings[shapeKey] ?? "";
  const backdropKey = `${shapeKey}|backdrop`;
  const backdrop: Backdrop = backdropChoices.some((b) => b.value === settings[backdropKey]) ? (settings[backdropKey] as Backdrop) : "gray";
  const setSetting = (key: string, value: string) => setSettings((m) => { const next = { ...m }; if (value) next[key] = value; else delete next[key]; return next; });
  const setShape = (value: string) => setSetting(shapeKey, value);
  const setBackdrop = (value: string) => setSetting(backdropKey, value === "gray" ? "" : value);
  /** `only` limits the run to those view keys; `force` makes a new revision even where an image already exists (never for views still in the queue). */
  const generate = (testOneFirst = false, only?: string[], force = false) => {
    if (!asset) return;
    const pool = only ? views.filter((v) => only.includes(v.key)) : views;
    const chosen = testOneFirst ? (pool.filter((v) => primaryViewKeys.includes(v.key))[0] ? [pool.filter((v) => primaryViewKeys.includes(v.key))[0]] : pool.slice(0, 1)) : pool;
    const requests = chosen.map((view) => ({
      assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key, label: view.label,
      prompt: buildViewPrompt({ style, asset, variant: activeVariant, sheetType: activeType, view, notes, model: modelId, backdrop, anchored: modelTakesReferences(provider, modelId) && shouldAnchor(queue, { assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key }) }),
      aspect: shapeFor(view, shapeOverride), fullBody: view.fullBody, provider, model: modelId,
      references: modelTakesReferences(provider, modelId) ? (refs[asset.id] ?? []) : [],
      useAnchor: modelTakesReferences(provider, modelId) && shouldAnchor(queue, { assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key }),
      outputName: (revision: number) => outputName(asset, activeVariant, activeType, view, revision),
    }));
    const result = enqueue(queue, requests, Date.now(), force);
    setQueue(() => result.state);
    if (!result.added) { notify("Nothing was added: every view already has an image or is in the queue. To make new versions, tick the views you want and press Regenerate, or use Regenerate unapproved."); return; }
    setPicked([]);
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

  if (!asset) return <section className="panel sheet-studio"><EmptyState icon={Sparkles} title="Analyze a script first" tone="gold">Sheets are planned per character, prop and set once your script has been analyzed.</EmptyState></section>;

  const newKeys = views.filter((v) => wouldEnqueue(jobFor(v.key))).map((v) => v.key);
  const redoKeys = views.filter((v) => { const j = jobFor(v.key); return !!j && !j.approved && wouldEnqueue(j, true) && !wouldEnqueue(j); }).map((v) => v.key);
  const pickedKeys = picked.filter((k) => { const j = jobFor(k); return !!j && wouldEnqueue(j, true); });
  const newCost = costPreview(newKeys.length, queue.perImageUsd);
  const redoCost = costPreview(redoKeys.length, queue.perImageUsd);
  const pickedCost = costPreview(pickedKeys.length, queue.perImageUsd);
  const togglePick = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  const approvedCount = views.filter((v) => jobFor(v.key)?.approved).length;
  const generatingCount = views.filter((v) => ["generating", "validating", "queued", "pending"].includes(jobFor(v.key)?.status ?? "")).length;
  const reviewCount = views.filter((v) => jobFor(v.key)?.status === "needs-review").length;
  const mine = refs[asset.id] ?? [];
  const anchorOn = modelTakesReferences(provider, modelId);
  const anchorPath = anchorFor(queue, { assetId: asset.id, variant: activeVariant } as ImageJob);
  const lock = anchorStatus({ takesReferences: anchorOn, anchorPath, anchorLabel: "front view" });
  const suggestion = anchorOn ? undefined : suggestReferenceModel(catalog, { provider, modelId }, configured);
  /** One labelled image of every view that has a picture, saved to Documents\Production One\Sheets. */
  const exportSheet = async () => {
    if (!asset || viewItems.length < 1) return;
    try {
      const path = await invoke<string>("export_contact_sheet", { title: `${asset.name} ${activeType}`, cells: viewItems.map((it) => ({ path: it.job.outputPath, label: it.label })), columns: viewItems.length <= 5 ? viewItems.length : 4 });
      notify(`Saved one image of this sheet: ${path}`);
    } catch (error) { notify(String(error)); }
  };
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
        <label><span>Shape</span>
          <select value={shapeOverride} onChange={(e) => setShape(e.target.value)} aria-label="Image shape for this sheet" title="The shape of new images on this sheet. Images already made keep their shape.">
            <option value="">Default ({shapeChoices.find((s) => s.value === views[0]?.aspect)?.label ?? views[0]?.aspect ?? "by view"})</option>
            {shapeChoices.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select></label>
        <label><span>Backdrop</span>
          <select value={backdrop} onChange={(e) => setBackdrop(e.target.value)} aria-label="Backdrop for this sheet" title="One flat background for every new image on this sheet, so the views agree. Images already made keep theirs.">
            {backdropChoices.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select></label>
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
          {desktop && viewItems.length >= 2 && (
            <div className="ss-export"><button className="secondary" onClick={() => void exportSheet()} title="Combine the views on this sheet into one labelled image"><LayoutGrid size={14} aria-hidden="true" /> Export sheet as one image</button><small>{viewItems.length} of {views.length} views have a picture</small></div>
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
                    {job && job.qaNotes.length === 1 && <small className="qa-note">{job.qaNotes[0]}</small>}
                    {job && job.qaNotes.length > 1 && (
                      <details className="qa-group">
                        <summary>{job.qaNotes.length} quality notes</summary>
                        {job.qaNotes.map((n) => <small key={n} className="qa-note">{n}</small>)}
                      </details>
                    )}
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
                    {job && job.status === "completed" && job.rejected && <button className="secondary" onClick={() => generate(false, [view.key], true)}>Regenerate</button>}
                    {job && wouldEnqueue(job, true) && !job.approved && <label className="view-pick"><input type="checkbox" checked={picked.includes(view.key)} onChange={() => togglePick(view.key)} /> Select</label>}
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
            <button className="primary" onClick={() => generate(false)} disabled={!newKeys.length}><Sparkles size={15} /> Generate {newKeys.length} view{newKeys.length === 1 ? "" : "s"}</button>
            <p className="ss-cost" aria-live="polite">{newCost.label}</p>
            {newKeys.length > 1 && <button className="secondary" onClick={() => generate(true, newKeys)} title="Make one image first to check the look">Test one first</button>}
            {redoKeys.length > 0 && <>
              <button className="secondary" onClick={() => generate(false, redoKeys, true)} title="Makes a new version of every view that is not approved yet. Approved views are left alone."><RefreshCw size={14} /> Regenerate {redoKeys.length} unapproved</button>
              <p className="ss-cost">{redoCost.label}</p>
            </>}
            {pickedKeys.length > 0 && <>
              <button className="secondary" onClick={() => generate(false, pickedKeys, true)}><RefreshCw size={14} /> Regenerate {pickedKeys.length} selected</button>
              <p className="ss-cost">{pickedCost.label}</p>
            </>}
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
          <Fold title="Notes" hint="added to every prompt, saved with the project" defaultOpen>
            <textarea className="ss-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. dust-worn jacket, torn left sleeve" aria-label="Notes for this sheet" />
          </Fold>
          <Fold title="Identity lock" hint={lock.kind === "locked" ? "on" : lock.kind === "waiting-for-anchor" ? "needs approved front" : "off: model has no references"} defaultOpen={lock.kind !== "locked"}>
            <p className="helper" role={lock.kind === "no-references" ? "alert" : undefined}>{lock.message}</p>
            {suggestion && <button className="secondary" onClick={() => { choice.pick(suggestion.provider, suggestion.id); notify(`Switched to ${suggestion.name}: it uses your approved front view as a reference.`); }}>Switch to {suggestion.name}</button>}
            {lock.kind === "no-references" && !suggestion && <p className="helper">No model with reference support is available with your current keys. Add a Kie.ai or Google key to lock identity.</p>}
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
