import { proportionStatus } from "../domain/proportionStatus";
import { ensureGuide } from "../data/proportionGuide";
import { sheetHints, sheetIconFor } from "../domain/categoryIcons";
import { styleFingerprint } from "../domain/style2d";
import { StyleGallery } from "./StyleGallery";
import { stylePresets } from "../domain/visualDevelopment";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Columns2, Wand2, ImagePlus, LayoutGrid, Maximize2, Pause, Play, RefreshCw, Sparkles, Square, Undo2, X } from "lucide-react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { madeWithEarlierProportions, proportionWords, provenanceFor } from "../domain/characterLayers";
import { costText, priceFor } from "../domain/pricing";
import type { ProportionProfile } from "../domain/proportions";
import {
  addCleaned,
  betterTake,
  addSupplied,
  approve,
  reconsider,
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
  waitingForAnchor,
  type ImageJob,
  type QueueState,
} from "../domain/generationQueue";
import {
  mergeCatalog,
  modelTakesReferences,
  providerLabels,
  providerOrder,
  quickEngines,
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
  aspectCss,
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
import { EngineSwitch } from "./EngineSwitch";
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
  onUnapproved: (job: ImageJob) => void;
  notify: (message: string) => void;
  openProviders: () => void;
  openLocal?: () => void;
  /** Extra photos the person attached to each asset (actor, costume, location). Sent with every request to models that accept references. */
  refs: Record<string, string[]>;
  /** Target proportions per character. A character with none gets exactly the prompts it always did. */
  proportions?: Record<string, ProportionProfile>;
  /** Opens this character's proportions (the Identity tab). */
  onOpenProportions?: () => void;
  setRefs: (update: (r: Record<string, string[]>) => Record<string, string[]>) => void;
  /** Lets the top-bar Generate button start a test from outside this panel. */
  controlRef?: { current: { generateFirst: () => void; generateFresh?: () => void } | null };
  focusSheetType?: SheetType;
  /** Outfit looks made in the Wardrobe studio for this asset, added to the Look list beside the story's own variants. */
  extraLooks?: string[];
  /** Switches the Look to this one (set when leaving the Wardrobe studio for an outfit's sheets). */
  focusVariant?: string;
  /** When given, notes are held by the project and saved with it; otherwise they live only in this panel. */
  notesByAsset?: Record<string, string>;
  setNotesByAsset?: (update: (m: Record<string, string>) => Record<string, string>) => void;
  /** Per-sheet choices saved with the project: shape (asset|sheet) and backdrop (asset|sheet|backdrop). Empty means the defaults. */
  settings?: Record<string, string>;
  setSettings?: (update: (m: Record<string, string>) => Record<string, string>) => void;
  /** When given, the sheet's controls (look, sheet, model, generate, notes) are drawn there, for example in the side inspector, and only the pictures stay in this panel. */
  controlsSlot?: HTMLElement | null;
  /** Sets or clears this asset's own style (an override of the project's). */
  onAssetStyle?: (assetId: string, style: StyleBible | undefined) => void;
  /** Every style the person can choose from, for an asset override. */
  allStyles?: StyleBible[];
  /** Edits an asset's own fields (its description and, for a set, its layout). */
  onPatchAsset?: (assetId: string, patch: Partial<ExtractedAsset>) => void;
}) {
  const { assets, scenes, story, assetIndex, queue, setQueue, desktop, providersVersion, onApproved, onUnapproved, notify, openProviders, openLocal, controlRef, controlsSlot, refs, setRefs, focusSheetType } = props;
  const asset = assets[Math.min(assetIndex, Math.max(0, assets.length - 1))];
  /** The style this asset is made in: its own override if it has one, otherwise the project's. */
  const style = asset?.style ?? props.style;
  const fingerprint = styleFingerprint(style);
  const [pickingStyle, setPickingStyle] = useState(false);
  const extraLooks = props.extraLooks;
  const variants = useMemo(() => { const found = asset ? detectStoryVariants(asset, scenes, story) : []; return [...found, ...(extraLooks ?? []).filter((v) => !found.includes(v))]; }, [asset, scenes, story, extraLooks]);
  const [variant, setVariant] = useState("Canonical");
  useEffect(() => { if (props.focusVariant) setVariant(props.focusVariant); }, [props.focusVariant]);
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
    return mine.reduce<ImageJob | undefined>((a, b) => betterTake(a, b), undefined);
  };

  const shapeKey = asset ? `${asset.id}|${activeType}` : "";
  const shapeOverride = settings[shapeKey] ?? "";
  const backdropKey = `${shapeKey}|backdrop`;
  const backdrop: Backdrop = backdropChoices.some((b) => b.value === settings[backdropKey]) ? (settings[backdropKey] as Backdrop) : "gray";
  const setSetting = (key: string, value: string) => setSettings((m) => { const next = { ...m }; if (value) next[key] = value; else delete next[key]; return next; });
  const setShape = (value: string) => setSetting(shapeKey, value);
  const setBackdrop = (value: string) => setSetting(backdropKey, value === "gray" ? "" : value);
  // "Same as my front view": the colour is read once from the approved front view's own background, so it can go into every prompt in words and as a hex value.
  const frontPath = asset ? anchorFor(queue, { assetId: asset.id, variant: activeVariant } as ImageJob) : undefined;
  const [frontColour, setFrontColour] = useState<{ path: string; hex: string } | null>(null);
  useEffect(() => {
    if (backdrop !== "front" || !frontPath || !desktop || frontColour?.path === frontPath) return;
    let live = true;
    void invoke<string>("backdrop_colour", { path: frontPath }).then((hex) => { if (live) setFrontColour({ path: frontPath, hex }); }).catch(() => {});
    return () => { live = false; };
  }, [backdrop, frontPath, desktop]);
  const backdropHex = backdrop === "front" && frontColour && frontColour.path === frontPath ? frontColour.hex : "";
  /** `only` limits the run to those view keys; `force` makes a new revision even where an image already exists (never for views still in the queue). */
  /** `fresh` makes the picture with no earlier picture of the character attached (only the person's own photos and the proportion guide), so the new proportions are not copied from an old body. */
  const generate = async (testOneFirst = false, only?: string[], force = false, reinterpret = false, fresh = false) => {
    if (!asset) return;
    // The proportion guide: a plain figure at the target proportions, attached last, so a reference picture cannot pull the body back to what it shows.
    const profile = asset.type === "character" ? props.proportions?.[asset.id] : undefined;
    const guidePath = profile && desktop && modelTakesReferences(provider, modelId) && !reinterpret ? await ensureGuide(profile) : null;
    const pool = only ? views.filter((v) => only.includes(v.key)) : views;
    const chosen = testOneFirst ? (pool.filter((v) => primaryViewKeys.includes(v.key))[0] ? [pool.filter((v) => primaryViewKeys.includes(v.key))[0]] : pool.slice(0, 1)) : pool;
    const requests = chosen.map((view) => ({
      assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key, label: view.label,
      prompt: buildViewPrompt({ style, asset, variant: activeVariant, sheetType: activeType, view, notes, model: modelId, backdrop, backdropHex, proportions: proportionWords(props.proportions?.[asset.id]), guide: !!guidePath, anchored: !reinterpret && !fresh && modelTakesReferences(provider, modelId) && shouldAnchor(queue, { assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key }), photoRefs: (refs[asset.id]?.length ?? 0) > 0, reinterpret }),
      aspect: shapeFor(view, shapeOverride), fullBody: view.fullBody, provider, model: modelId,
      references: modelTakesReferences(provider, modelId) ? [...(reinterpret && frontPath ? [frontPath] : []), ...(refs[asset.id] ?? []), ...(guidePath ? [guidePath] : [])] : [],
      styleName: style.name, styleFp: fingerprint,
      provenance: provenanceFor(props.proportions?.[asset.id], [...(!reinterpret && !fresh && modelTakesReferences(provider, modelId) && frontPath && shouldAnchor(queue, { assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key }) ? [{ path: frontPath }] : []), ...(modelTakesReferences(provider, modelId) ? (refs[asset.id] ?? []).map((path) => ({ path })) : [])]),
      useAnchor: !reinterpret && !fresh && modelTakesReferences(provider, modelId) && shouldAnchor(queue, { assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key }),
      outputName: (revision: number) => outputName(asset, activeVariant, activeType, view, revision),
    }));
    const result = enqueue(queue, requests, Date.now(), force);
    setQueue(() => result.state);
    if (!result.added) { notify("Nothing was added: every view already has an image or is in the queue. To make new versions, tick the views you want and press Regenerate, or use Regenerate unapproved."); return; }
    setPicked([]);
    const what = `${result.added} view${result.added === 1 ? "" : "s"}${testOneFirst ? " (a test of the first one)" : ""}`;
    if (desktop && choice.keysChecked && !configured[provider]) {
      if (provider === "comfyui") { notify(`Queued ${what}, but ComfyUI is not running. Start it from Local AI, then generation starts.`); openLocal?.(); } else { notify(`Queued ${what}, but there is no ${providerLabels[provider]} key yet. Add it, then generation starts.`); openProviders(); }
      return;
    }
    notify(`Generating ${what}…`);
  };
  if (controlRef) controlRef.current = { generateFirst: () => generate(true), generateFresh: () => generate(true, undefined, true, false, true) };

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
  const doReject = (job: ImageJob) => { setQueue((q) => reject(q, job.id)); if (job.approved) onUnapproved(job); };
  const doReconsider = (job: ImageJob) => { setQueue((q) => reconsider(q, job.id)); if (job.approved) onUnapproved(job); };

  if (!asset) return <section className="panel sheet-studio"><EmptyState icon={Sparkles} title="Nothing to make sheets for yet" tone="gold">Sheets are planned per character, costume, prop and set. Analyze a script in Story, or use Add to the bible to start from an image you already have.</EmptyState></section>;

  const newKeys = views.filter((v) => wouldEnqueue(jobFor(v.key))).map((v) => v.key);
  const redoKeys = views.filter((v) => { const j = jobFor(v.key); return !!j && !j.approved && wouldEnqueue(j, true) && !wouldEnqueue(j); }).map((v) => v.key);
  const pickedKeys = picked.filter((k) => { const j = jobFor(k); return !!j && wouldEnqueue(j, true); });
  const price = priceFor(provider, modelId, queue.perImageUsd);
  const newCost = { label: costText(newKeys.length, price) };
  const redoCost = { label: costText(redoKeys.length, price) };
  const pickedCost = { label: costText(pickedKeys.length, price) };
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
  /** Every sheet of this asset (this look) with at least one picture, newest picture per view. Locations whose sheets hold a single view each have nothing to combine until they are put together like this. */
  const everyItem = asset ? sheetTypes.flatMap((type) => viewsFor(asset.type, type, intensity, usePlan ? plan : undefined).flatMap((v) => {
    const mine = queue.jobs.filter((j) => j.assetId === asset.id && j.variant === activeVariant && j.sheetType === type && j.viewKey === v.key && j.outputPath);
    const job = mine.reduce<ImageJob | undefined>((a, b) => betterTake(a, b), undefined);
    return job ? [{ job, label: `${type}: ${v.label}` }] : [];
  })) : [];
  const exportEverything = async () => {
    if (!asset || everyItem.length < 1) return;
    try {
      const path = await invoke<string>("export_contact_sheet", { title: `${asset.name} all sheets`, cells: everyItem.slice(0, 40).map((it) => ({ path: it.job.outputPath, label: it.label })), columns: everyItem.length <= 8 ? 4 : 5 });
      notify(`Saved one image of every sheet: ${path}`);
    } catch (error) { notify(String(error)); }
  };
  const toggleCompare = (key: string) => setCompare((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key].slice(-2)));
  const compareItems = compare.map((k) => ({ key: k, view: views.find((v) => v.key === k), job: jobFor(k) })).filter((x): x is { key: string; view: (typeof views)[number]; job: ImageJob } => !!x.view && !!x.job?.outputPath);

  const headActions = (
        <div className="ss-head-actions">
          {(waiting > 0 || stats.generating > 0 || queue.paused) && (queue.paused ? (
            <button className="secondary" onClick={() => setQueue((q) => ({ ...q, paused: false }))}><Play size={14} /> Resume</button>
          ) : (
            <button className="secondary" onClick={() => setQueue((q) => ({ ...q, paused: true }))}><Pause size={14} /> Pause</button>
          ))}
          {waiting > 0 && <button className="secondary" onClick={() => setQueue((q) => cancelAllWaiting(q))}>Cancel waiting</button>}
          {style.spec2d && <button className="secondary" disabled={!frontPath || !modelTakesReferences(provider, modelId)} onClick={() => generate(false, [(views.find((v) => primaryViewKeys.includes(v.key)) ?? views[0])?.key].filter(Boolean) as string[], true, true)} title={frontPath ? `Redraw the approved picture in ${style.name} as a new revision for review. The original and its approval are kept. Identity may not carry over exactly. This uses one image request.` : "Approve a picture first: it is what gets reinterpreted."}>Reinterpret in {style.name}</button>}
          {desktop && <button className="secondary" disabled={viewItems.length === 0} onClick={() => setQuality(0)} title="Check colour, noise, highlights and sharpness, and correct them without changing the original"><Wand2 size={14} /> Image quality</button>}
        </div>
  );
  const bar = (
      <div className="ss-bar">
        <label><span>Look</span>
          <select value={activeVariant} onChange={(e) => setVariant(e.target.value)}>{variants.map((v) => <option key={v}>{v}</option>)}</select></label>
        <div className="ss-style" aria-label="Style for this asset">
          <span>Style</span>
          <div className="ss-style-row">
            <b>{style.name}</b>
            {style.spec2d && <i className="ss-2d-tag">2D</i>}
            <small>{asset.style ? "your override for this asset" : "inherited from the project"}</small>
            {props.onAssetStyle && <button type="button" className="tertiary" onClick={() => setPickingStyle(true)}>{asset.style ? "Change" : "Override for this asset"}</button>}
            {props.onAssetStyle && asset.style && <button type="button" className="tertiary" onClick={() => props.onAssetStyle?.(asset.id, undefined)}>Use the project style</button>}
          </div>
          {style.spec2d && (refs[asset.id]?.length ?? 0) > 0 && <small className="ss-2d-note">Your reference photos are used as identity references only; pictures are redrawn in {style.name}. A photograph can still pull the result toward realism. If it does, use Reinterpret on the approved front view.</small>}
          {style.spec2d && <small className="ss-2d-note">{style.spec2d.providerNote}</small>}
        </div>
        {props.onPatchAsset && (
          <details className="ss-about">
            <summary>{asset.type === "set" || asset.type === "environment" ? "About this place and its layout" : `About this ${asset.type}`}{(asset.description || asset.layout) ? <small> · saved</small> : null}</summary>
            <label><span>Description (your words, added to every picture's prompt)</span>
              <textarea rows={3} aria-label={`Description of ${asset.name}`} value={asset.description ?? ""} onChange={(e) => props.onPatchAsset?.(asset.id, { description: e.target.value })} placeholder={asset.type === "character" ? "Who they are, what they look like, what they wear" : asset.type === "set" || asset.type === "environment" ? "What the place is, its mood and materials" : "What it is, its shape, size and materials"} /></label>
            {(asset.type === "set" || asset.type === "environment") && (
              <label><span>Layout and landmarks (kept the same in every view and every shot in this place)</span>
                <textarea rows={3} aria-label={`Layout of ${asset.name}`} value={asset.layout ?? ""} onChange={(e) => props.onPatchAsset?.(asset.id, { layout: e.target.value })} placeholder="For example: the door is on the left wall, the desk is in the centre facing the door, a tall window is behind the desk, the lamp stands on the desk's right corner" /></label>
            )}
          </details>
        )}
        <div className="ss-sheets" role="group" aria-label="Sheet">
          <span>Sheet</span>
          <div className="ss-sheet-row">{sheetTypes.map((t) => { const Icon = sheetIconFor(t); return <button key={t} type="button" className={`ss-sheet${t === activeType ? " on" : ""}`} aria-pressed={t === activeType} title={sheetHints[t] ?? t} onClick={() => setSheetType(t)}><Icon size={15} aria-hidden="true" /><span>{t}</span></button>; })}</div>
        </div>
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
      </div>
  );
  const more = (
      <details className="ss-more">
        <summary>Shape, backdrop and image model <small>{modelId}</small></summary>
        <div className="ss-bar">
        <label><span>Shape</span>
          <select value={shapeOverride} onChange={(e) => setShape(e.target.value)} aria-label="Image shape for this sheet" title="The shape of new images on this sheet. Images already made keep their shape.">
            <option value="">Default ({shapeChoices.find((s) => s.value === views[0]?.aspect)?.label ?? views[0]?.aspect ?? "by view"})</option>
            {shapeChoices.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select></label>
        <label><span>Backdrop</span>
          <select value={backdrop} onChange={(e) => setBackdrop(e.target.value)} aria-label="Backdrop for this sheet" title="One flat background for every new image on this sheet, so the views agree. Images already made keep theirs.">
            {backdropChoices.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          {backdrop === "front" && <small className="helper">{frontPath ? (backdropHex ? `Keeps your front view's backdrop (about ${backdropHex}).` : "Reading your front view's backdrop…") : "Needs an approved front view. Until there is one, flat grey is used."}</small>}</label>
        <label className="ss-model"><span>Image model · reference sheets</span>
          <ModelPicker catalog={catalog} configured={configured} provider={provider} modelId={modelId} onPick={choice.pick} onRefresh={() => void refreshModels()} refreshing={refreshing} />
        </label>
        <div className="seg" role="group" aria-label="Preview size">
          <button className={size === "grid" ? "on" : ""} onClick={() => setSize("grid")} aria-pressed={size === "grid"} title="Grid" aria-label="Grid previews"><LayoutGrid size={15} /></button>
          <button className={size === "large" ? "on" : ""} onClick={() => setSize("large")} aria-pressed={size === "large"} title="Large previews" aria-label="Large previews"><Square size={15} /></button>
        </div>
        </div>
      </details>
  );
  const sheetSettings = (
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
  );

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
        {!controlsSlot && headActions}
      </header>
      {asset?.type === "character" && (() => {
        const profile = props.proportions?.[asset.id];
        const stale = profile ? queue.jobs.filter((j) => j.assetId === asset.id && j.approved && madeWithEarlierProportions(j.provenance, profile)).length : 0;
        const status = proportionStatus(profile, stale);
        return <p className={`ss-prop-line ${status.kind}`} role="status">{status.text}{props.onOpenProportions && <> <button type="button" className="linklike" onClick={props.onOpenProportions}>{profile ? "Open proportions" : "Set proportions"}</button></>}</p>;
      })()}

      {!controlsSlot && bar}
      {!controlsSlot && more}

      <div className={`ss-work${controlsSlot ? " solo" : ""}`}>
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
          {desktop && everyItem.length >= 2 && everyItem.length > viewItems.length && (
            <div className="ss-export"><button className="secondary" onClick={() => void exportEverything()} title="Put the pictures from every sheet of this asset into one labelled image"><LayoutGrid size={14} aria-hidden="true" /> Export every sheet as one image</button><small>{everyItem.length} pictures across {sheetTypes.length} sheets{everyItem.length > 40 ? " (the first 40 are used)" : ""}</small></div>
          )}
          <div className={`view-grid ${size}`} style={{ "--thumb-aspect": aspectCss(shapeFor(views[0] ?? { aspect: "3:4" }, shapeOverride)) } as React.CSSProperties}>
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
                    {job?.styleFp && job.styleFp !== fingerprint && <small className="qa-note" title="The style changed after this picture was made. Nothing was re-approved: decide whether to keep it or regenerate it.">Made in {job.styleName ?? "an earlier style"}: out of date</small>}
                  </div>
                  <div className="view-actions">
                    {job?.status === "needs-review" && (<>
                      <button className="primary" onClick={() => doApprove(job)}><Check size={14} /> Approve</button>
                      <button className="secondary" onClick={() => doReject(job)}><X size={14} /> Reject</button>
                    </>)}
                    {job?.status === "completed" && job.outputPath && (<>
                      {!job.approved && <button className="primary" onClick={() => doApprove(job)}><Check size={14} /> Approve</button>}
                      {job.approved && <button className="secondary" onClick={() => doReconsider(job)} title="Takes the approval back. The picture goes back to waiting for your decision."><Undo2 size={14} /> Undo approval</button>}
                      {!job.rejected && <button className="secondary" onClick={() => doReject(job)}><X size={14} /> Reject</button>}
                      {job.rejected && <button className="secondary" onClick={() => doReconsider(job)} title="Takes the rejection back. The picture goes back to waiting for your decision."><Undo2 size={14} /> Undo reject</button>}
                    </>)}
                    {job && (job.status === "failed" || job.status === "cancelled") && job.source !== "supplied" && job.prompt && <button className="secondary" onClick={() => setQueue((q) => retry(q, job.id))}>Retry</button>}
                    {job && job.status === "queued" && <button className="secondary" onClick={() => setQueue((q) => cancel(q, job.id))}>Cancel</button>}
                    {job && job.status === "completed" && job.rejected && <button className="secondary" onClick={() => generate(false, [view.key], true)}>Regenerate</button>}
                    {job && wouldEnqueue(job, true) && !job.approved && <label className="view-pick"><input type="checkbox" checked={picked.includes(view.key)} onChange={() => togglePick(view.key)} /> Select</label>}
                    {job && (job.status === "queued" || job.status === "failed") && job.source !== "supplied" && (
                      <EngineSwitch options={quickEngines(catalog, configured, job.useAnchor)} current={job} onUse={(o) => setQueue((q) => reassignModel(q, [job.id], o.provider, o.model, Date.now(), o.takesReferences))} />
                    )}
                    {desktop && <button className="tertiary" onClick={() => void useOwnImage(view.key, view.label)} title="Use your own image for this view"><ImagePlus size={14} /> Use my image</button>}
                    {at >= 0 && <button className={`tertiary${compare.includes(view.key) ? " on" : ""}`} aria-pressed={compare.includes(view.key)} onClick={() => toggleCompare(view.key)} title="Compare with another view"><Columns2 size={14} /> Compare</button>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {!controlsSlot && sheetSettings}
      </div>

      {pickingStyle && props.onAssetStyle && <StyleGallery styles={props.allStyles ?? stylePresets} current={style.name} onChoose={(picked) => { props.onAssetStyle?.(asset.id, { ...picked, locked: false }); setPickingStyle(false); notify(`${asset.name} now uses ${picked.name}. Pictures already made keep their style and are marked out of date: nothing was re-approved.`); }} onClose={() => setPickingStyle(false)} />}
      {quality !== null && viewItems.length > 0 && (
        <CleanRender items={viewItems.map((it) => it.job)} index={Math.min(quality, viewItems.length - 1)} onIndex={setQuality} onClose={() => setQuality(null)} notify={notify}
          onSaved={(from, file) => { const out = addCleaned(queue, from, file); setQueue(() => out.state); if (out.job.approved) onApproved(out.job, primaryViewKeys.includes(out.job.viewKey)); }} />
      )}
      {lightbox !== null && viewItems.length > 0 && (
        <Lightbox items={viewItems} index={Math.min(lightbox, viewItems.length - 1)} onIndex={setLightbox} onClose={() => setLightbox(null)} onApprove={doApprove} onReject={doReject} onReconsider={doReconsider} />
      )}
      {controlsSlot && createPortal(<div className="ss-controls" role="group" aria-label="Sheet controls">{headActions}{bar}{more}{sheetSettings}</div>, controlsSlot)}
    </section>
  );
}
