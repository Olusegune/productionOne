import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Maximize2, Pause, Play, Sparkles, X } from "lucide-react";
import {
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
import { Lightbox, type LightboxItem } from "./Lightbox";

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
  /** Lets the top-bar Generate button start a test from outside this panel. */
  controlRef?: { current: { generateFirst: () => void } | null };
}) {
  const { assets, scenes, story, assetIndex, style, queue, setQueue, desktop, providersVersion, onApproved, notify, openProviders, controlRef } = props;
  const asset = assets[Math.min(assetIndex, Math.max(0, assets.length - 1))];
  const variants = useMemo(() => (asset ? detectStoryVariants(asset, scenes, story) : []), [asset, scenes, story]);
  const [variant, setVariant] = useState("Canonical");
  const sheetTypes = asset ? sheetTypesFor(asset.type) : [];
  const [sheetType, setSheetType] = useState<SheetType>("Turnaround");
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [notes, setNotes] = useState("");
  const [provider, setProvider] = useState<ProviderKey>("google");
  const [modelId, setModelId] = useState("gemini-nano-banana-2.1");
  const startModel: Record<ProviderKey, string> = { kie: "google/nanobanana-2-1", google: "gemini-nano-banana-2.1", openai: "gpt-image-1.5", openrouter: "bytedance-seed/seedream-4.5", fal: "fal-ai/flux/dev" };
  const switched = useRef(false);
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [discovered, setDiscovered] = useState<DiscoveredCatalog>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const activeType: SheetType = sheetTypes.includes(sheetType) ? sheetType : (sheetTypes[0] ?? "Turnaround");
  const activeVariant = variants.includes(variant) ? variant : "Canonical";
  const catalog = useMemo(() => mergeCatalog(discovered), [discovered]);
  const model: CatalogModel | undefined = catalog.find((m) => m.provider === provider && m.id === modelId);
  const [fromStory, setFromStory] = useState(true);
  const plan = useMemo(() => {
    if (!story || !asset || asset.type !== "character") return undefined;
    const arc = characterArcs(story).find((a) => a.character.toUpperCase() === asset.name.toUpperCase());
    return arc ? expressionPlan(arc) : undefined;
  }, [story, asset]);
  const usePlan = fromStory && !!plan && plan.length > 1;
  const views = asset ? viewsFor(asset.type, activeType, intensity, usePlan ? plan : undefined) : [];

  useEffect(() => {
    if (!desktop) return;
    let live = true;
    void import("@tauri-apps/api/core").then(async ({ invoke }) => {
      const status: Record<string, boolean> = {};
      for (const p of providers) status[p] = await invoke<boolean>("credential_status", { provider: p }).catch(() => false);
      let saved: DiscoveredCatalog = (await invoke<DiscoveredCatalog>("model_catalog").catch(() => ({}))) ?? {};
      // Kie publishes its whole model list without a key: keep it fresh (once a day) so every current model is offered.
      const age = Date.now() / 1000 - (saved.kie?.fetchedAt ?? 0);
      if (age > 86400) saved = (await invoke<DiscoveredCatalog>("kie_models").catch(() => saved)) ?? saved;
      if (live) {
        setConfigured(status);
        setDiscovered(saved);
        if (!switched.current) {
          switched.current = true;
          const first = providers.find((p) => status[p]);
          if (first && !status[provider]) { setProvider(first); setModelId(startModel[first]); }
        }
      }
    });
    return () => { live = false; };
  }, [desktop, providersVersion]);

  const jobFor = (viewKey: string) => {
    const mine = queue.jobs.filter((j) => asset && j.assetId === asset.id && j.variant === activeVariant && j.sheetType === activeType && j.viewKey === viewKey);
    return mine.reduce<ImageJob | undefined>((a, b) => (!a || b.revision > a.revision ? b : a), undefined);
  };

  const generate = (testOneFirst = false) => {
    if (!asset) return;
    const chosen = testOneFirst ? (views.filter((v) => primaryViewKeys.includes(v.key))[0] ? [views.filter((v) => primaryViewKeys.includes(v.key))[0]] : views.slice(0, 1)) : views;
    const requests = chosen.map((view) => ({
      assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key, label: view.label,
      prompt: buildViewPrompt({ style, asset, variant: activeVariant, sheetType: activeType, view, notes }),
      aspect: view.aspect, fullBody: view.fullBody, provider, model: modelId,
      references: [] as string[],
      useAnchor: modelTakesReferences(provider, modelId) && !primaryViewKeys.includes(view.key),
      outputName: (revision: number) => outputName(asset, activeVariant, activeType, view, revision),
    }));
    const result = enqueue(queue, requests);
    setQueue(() => result.state);
    if (!result.added) { notify("Every view of this sheet is already queued or approved."); return; }
    const what = `${result.added} view${result.added === 1 ? "" : "s"}${testOneFirst ? " (a test of the first one)" : ""}`;
    if (desktop && !configured[provider]) { notify(`Queued ${what}, but there is no ${providerLabels[provider]} key yet. Add it, then generation starts.`); openProviders(); return; }
    notify(`Generating ${what}…`);
  };
  if (controlRef) controlRef.current = { generateFirst: () => generate(true) };

  const refreshModels = async () => {
    setRefreshing(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const next = await invoke<DiscoveredCatalog>(provider === "kie" ? "kie_models" : "discover_models", { provider });
      setDiscovered(next);
      notify(`Model list refreshed from ${providerLabels[provider]}.`);
    } catch (error) {
      notify(String(error));
    } finally {
      setRefreshing(false);
    }
  };

  const stats = summarize(queue);
  const waiting = stats.queued + stats.pending;
  const viewItems: LightboxItem[] = views.flatMap((v) => { const j = jobFor(v.key); return j?.outputPath ? [{ job: j, label: v.label }] : []; });
  const doApprove = (job: ImageJob) => { setQueue((q) => approve(q, job.id)); onApproved(job, primaryViewKeys.includes(job.viewKey)); };
  const doReject = (job: ImageJob) => setQueue((q) => reject(q, job.id));

  if (!asset) return <section className="panel sheet-studio"><h3>Analyze a script first</h3><p className="helper">Sheets are planned per character, prop and set once your script has been analyzed.</p></section>;

  return (
    <section className="panel sheet-studio" aria-label="Reference sheets">
      <div className="ss-head">
        <div>
          <span className="eyebrow">Reference sheets</span>
          <h3>{asset.name} <span className="ss-type">{activeType}</span></h3>
        </div>
        <div className="ss-head-actions">
          {queue.paused ? (
            <button className="secondary" disabled={!waiting && !stats.generating} onClick={() => setQueue((q) => ({ ...q, paused: false }))}><Play size={14} /> Resume</button>
          ) : (
            <button className="secondary" disabled={!waiting && !stats.generating} onClick={() => setQueue((q) => ({ ...q, paused: true }))}><Pause size={14} /> Pause</button>
          )}
          <button className="secondary" disabled={!waiting} onClick={() => setQueue((q) => cancelAllWaiting(q))}>Cancel waiting</button>
        </div>
      </div>

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
        <label className="ss-model"><span>Model</span>
          <ModelPicker catalog={catalog} configured={configured} provider={provider} modelId={modelId} onPick={(p, id) => { setProvider(p); setModelId(id); }} onRefresh={() => void refreshModels()} refreshing={refreshing} />
        </label>
      </div>
      <p className="helper">
        {model ? `${model.name}. ${model.note}` : "Custom model id: this app does not know its capabilities."}{" "}
        {modelTakesReferences(provider, modelId) ? "Your approved front view is sent as a reference to keep the character consistent." : "This model takes no reference images, so consistency relies on the written description."}
      </p>

      <div className="ss-actions">
        <input className="ss-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for this sheet, e.g. dust-worn jacket, torn left sleeve" aria-label="Notes for this sheet" />
        <button className="primary" onClick={() => generate(false)} disabled={!views.length}><Sparkles size={15} /> Generate {views.length} view{views.length === 1 ? "" : "s"}</button>
        {views.length > 1 && <button className="secondary" onClick={() => generate(true)} title="Make one image first to check the look">Test one first</button>}
        {!configured[provider] && desktop && <button className="secondary" onClick={openProviders}>Add {providerLabels[provider]} key</button>}
      </div>
      {!desktop && <p className="helper">Image generation runs in the Windows app. The browser preview shows the plan only.</p>}

      <div className="view-grid">
        {views.map((view) => {
          const job = jobFor(view.key);
          const at = viewItems.findIndex((it) => it.job.id === job?.id);
          return (
            <article key={view.key} className={`view-card ${job?.status ?? "none"}`}>
              <button className="view-thumb" disabled={at < 0} onClick={() => setLightbox(at)} aria-label={at >= 0 ? `Open ${view.label} full size` : `${view.label}: no image yet`}>
                {job ? <Thumb job={job} /> : <div className="thumb-empty">Not generated</div>}
                {at >= 0 && <span className="vt-zoom"><Maximize2 size={15} /></span>}
                <span className={`vt-status ${job?.status ?? "none"}`}>{job ? `${statusLabel[job.status]}${job.revision > 1 ? ` · v${job.revision}` : ""}${job.approved ? " · Approved" : job.rejected ? " · Rejected" : ""}` : "Not generated"}</span>
              </button>
              <div className="view-meta">
                <b>{view.label}</b>
                {job?.qaNotes.map((n) => <small key={n} className="qa-note">{n}</small>)}
                {job?.error && <small className="qa-note">{job.error}</small>}
                {job && job.status === "queued" && waitingForAnchor(queue, job) && <small>Waits for the approved front view, then uses it as its reference.</small>}
                {job?.width && <small>{job.width}×{job.height}px</small>}
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
              </div>
            </article>
          );
        })}
      </div>

      {lightbox !== null && viewItems.length > 0 && (
        <Lightbox items={viewItems} index={Math.min(lightbox, viewItems.length - 1)} onIndex={setLightbox} onClose={() => setLightbox(null)} onApprove={doApprove} onReject={doReject} />
      )}
    </section>
  );
}
