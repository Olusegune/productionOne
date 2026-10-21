import { useEffect, useMemo, useState } from "react";
import { Check, Pause, Play, RefreshCw, Sparkles, X } from "lucide-react";
import {
  approve,
  cancel,
  cancelAllWaiting,
  enqueue,
  estimateRemainingUsd,
  reassignModel,
  reject,
  retry,
  spendGate,
  summarize,
  waitingForAnchor,
  type ImageJob,
  type QueueState,
} from "../domain/generationQueue";
import {
  mergeCatalog,
  providerLabels,
  providerSendsReferences,
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

const providers = ["google", "openai", "openrouter", "fal"] as const;
type ProviderKey = (typeof providers)[number];

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
}) {
  const { assets, scenes, story, assetIndex, style, queue, setQueue, desktop, providersVersion, onApproved, notify, openProviders } = props;
  const asset = assets[Math.min(assetIndex, Math.max(0, assets.length - 1))];
  const variants = useMemo(() => (asset ? detectStoryVariants(asset, scenes, story) : []), [asset, scenes, story]);
  const [variant, setVariant] = useState("Canonical");
  const sheetTypes = asset ? sheetTypesFor(asset.type) : [];
  const [sheetType, setSheetType] = useState<SheetType>("Turnaround");
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [notes, setNotes] = useState("");
  const [provider, setProvider] = useState<ProviderKey>("google");
  const [modelId, setModelId] = useState("gemini-3.1-flash-image");
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [discovered, setDiscovered] = useState<DiscoveredCatalog>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [ceiling, setCeiling] = useState("");
  const [agree, setAgree] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const activeType: SheetType = sheetTypes.includes(sheetType) ? sheetType : (sheetTypes[0] ?? "Turnaround");
  const activeVariant = variants.includes(variant) ? variant : "Canonical";
  const catalog = useMemo(() => mergeCatalog(discovered), [discovered]);
  const choices = catalog.filter((m) => m.provider === provider);
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
      const saved = await invoke<DiscoveredCatalog>("model_catalog").catch(() => ({}));
      if (live) { setConfigured(status); setDiscovered(saved); }
    });
    return () => { live = false; };
  }, [desktop, providersVersion]);

  const jobFor = (viewKey: string) => {
    const mine = queue.jobs.filter((j) => asset && j.assetId === asset.id && j.variant === activeVariant && j.sheetType === activeType && j.viewKey === viewKey);
    return mine.reduce<ImageJob | undefined>((a, b) => (!a || b.revision > a.revision ? b : a), undefined);
  };

  const queueViews = () => {
    if (!asset) return;
    const requests = views.map((view) => ({
      assetId: asset.id, variant: activeVariant, sheetType: activeType, viewKey: view.key, label: view.label,
      prompt: buildViewPrompt({ style, asset, variant: activeVariant, sheetType: activeType, view, notes }),
      aspect: view.aspect, fullBody: view.fullBody, provider, model: modelId,
      references: [] as string[],
      useAnchor: providerSendsReferences[provider] && !primaryViewKeys.includes(view.key),
      outputName: (revision: number) => outputName(asset, activeVariant, activeType, view, revision),
    }));
    const result = enqueue(queue, requests);
    setQueue(() => result.state);
    notify(result.added ? `Queued ${result.added} view${result.added === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} already queued or approved)` : ""}. Nothing is sent until you set and confirm a spending limit.` : "Every view of this sheet is already queued or approved.");
  };

  const confirmSpend = () => {
    const per = Number(price);
    const total = Number(ceiling);
    if (!(per > 0) || !(total >= per)) { notify("Enter a price per image above zero and a total ceiling at least that large."); return; }
    setQueue((q) => ({ ...q, perImageUsd: per, totalCeilingUsd: total, paused: false }));
    setConfirmOpen(false);
    setAgree(false);
    notify(`Generation may start. Ceiling $${total.toFixed(2)} at $${per.toFixed(2)} per image (your figures, not a provider quote).`);
  };

  const refreshModels = async () => {
    setRefreshing(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const next = await invoke<DiscoveredCatalog>("discover_models", { provider });
      setDiscovered(next);
      notify(`Model list refreshed from ${providerLabels[provider]}.`);
    } catch (error) {
      notify(String(error));
    } finally {
      setRefreshing(false);
    }
  };

  const stats = summarize(queue);
  const gate = spendGate(queue);
  const worst = estimateRemainingUsd(queue);
  const waiting = stats.queued + stats.pending;

  if (!asset) return <section className="panel sheet-studio"><span className="eyebrow">REFERENCE SHEETS</span><h3>Analyze a script first</h3><p className="helper">Sheets are planned per character, prop and set once your script has been analyzed.</p></section>;

  return (
    <section className="panel sheet-studio" aria-label="Reference sheets">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">REFERENCE SHEETS</span>
          <h3>{asset.name} · {activeType}</h3>
        </div>
        <div className="button-row">
          {queue.paused ? (
            <button className="secondary" disabled={!waiting && !stats.generating} onClick={() => setQueue((q) => ({ ...q, paused: false }))}><Play size={14} /> Resume</button>
          ) : (
            <button className="secondary" disabled={!waiting && !stats.generating} onClick={() => setQueue((q) => ({ ...q, paused: true }))}><Pause size={14} /> Pause</button>
          )}
          <button className="secondary" disabled={!waiting} onClick={() => setQueue((q) => cancelAllWaiting(q))}>Cancel waiting</button>
        </div>
      </div>

      <div className="sheet-controls">
        <label><span>Story variant</span>
          <select value={activeVariant} onChange={(e) => setVariant(e.target.value)}>{variants.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label><span>Sheet</span>
          <select value={activeType} onChange={(e) => setSheetType(e.target.value as SheetType)}>{sheetTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
        {asset.type === "character" && activeType === "Expressions" && plan && plan.length > 1 && (
          <label><span>Expression set</span>
            <select value={fromStory ? "story" : "full"} onChange={(e) => setFromStory(e.target.value === "story")}>
              <option value="story">From the story ({plan.length} expressions)</option>
              <option value="full">Full set (8 emotions)</option>
            </select></label>
        )}
        {asset.type === "character" && activeType === "Expressions" && !usePlan && (
          <label><span>Acting intensity</span>
            <select value={intensity} onChange={(e) => setIntensity(e.target.value as Intensity)}>{intensities.map((i) => <option key={i}>{i}</option>)}</select></label>
        )}
        <label><span>Provider</span>
          <select value={provider} onChange={(e) => { const p = e.target.value as ProviderKey; setProvider(p); setModelId(catalog.find((m) => m.provider === p)?.id ?? ""); }}>
            {providers.map((p) => <option key={p} value={p}>{providerLabels[p]}{configured[p] ? "" : " (no key)"}</option>)}
          </select></label>
        <label><span>Model</span>
          <input list="image-models" value={modelId} onChange={(e) => setModelId(e.target.value)} aria-label="Image model id" />
          <datalist id="image-models">{choices.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist></label>
      </div>
      <p className="helper">
        {model ? `${model.name} · ${model.source === "built-in" ? "built-in entry, documented but not live-tested here" : "listed by the provider"}. ${model.note}` : "Custom model id: capabilities and price are not known to this app."}
        {" "}{providerSendsReferences[provider] ? "The approved front view is sent as a reference to keep the character consistent." : "This provider cannot receive reference images in this build, so consistency relies on the written description."}
      </p>
      <label className="settings-field"><span>Production notes for this sheet (optional)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. dust-worn jacket, left sleeve torn" /></label>

      <div className="sheet-actions-row">
        <button className="primary" onClick={queueViews} disabled={!views.length}><Sparkles size={15} /> Queue {views.length} view{views.length === 1 ? "" : "s"}</button>
        <button className="secondary" onClick={() => setConfirmOpen(true)} disabled={!desktop}>Spending limit…</button>
        <button className="secondary" onClick={() => void refreshModels()} disabled={!desktop || refreshing || !configured[provider]}><RefreshCw size={14} /> Refresh models</button>
        {!configured[provider] && desktop && <button className="secondary" onClick={openProviders}>Add {providerLabels[provider]} key</button>}
      </div>
      {!desktop && <p className="helper">Image generation runs in the Windows app. The browser preview shows the plan only.</p>}

      <p className="queue-summary" role="status">
        {stats.total === 0 ? "Queue is empty." : `${stats.queued} queued · ${stats.generating + stats.validating} running · ${stats.needsReview} need review · ${stats.completed} completed · ${stats.failed} failed`}
        {queue.paused && stats.total > 0 ? " · Paused" : ""}
        {queue.perImageUsd !== null ? ` · Counted spend $${stats.committedUsd.toFixed(2)} of $${queue.totalCeilingUsd?.toFixed(2)} (at your price)` : ""}
        {worst !== null && waiting ? ` · Worst case for waiting jobs $${worst.toFixed(2)}` : ""}
      </p>
      {!gate.ok && waiting > 0 && <p className="helper warn">{gate.reason}</p>}

      <div className="view-grid">
        {views.map((view) => {
          const job = jobFor(view.key);
          return (
            <article key={view.key} className={`view-card ${job?.status ?? "none"}`}>
              <div className="view-thumb">{job ? <Thumb job={job} /> : <div className="thumb-empty">Not queued</div>}</div>
              <div className="view-meta">
                <b>{view.label}</b>
                <span className={`job-status ${job?.status ?? ""}`}>{job ? `${statusLabel[job.status]}${job.revision > 1 ? ` · v${job.revision}` : ""}${job.approved ? " · Approved" : job.rejected ? " · Rejected" : ""}` : "Not queued"}</span>
                {job?.qaNotes.map((n) => <small key={n} className="qa-note">{n}</small>)}
                {job?.error && <small className="qa-note">{job.error}</small>}
                {job && job.status === "queued" && waitingForAnchor(queue, job) && <small>Waiting for the approved front view, which it will use as its reference.</small>}
                {job?.width && <small>{job.width}×{job.height} px · original file kept</small>}
              </div>
              <div className="view-actions">
                {job?.status === "needs-review" && (<>
                  <button className="primary" onClick={() => { setQueue((q) => approve(q, job.id)); onApproved(job, primaryViewKeys.includes(job.viewKey)); }}><Check size={14} /> Approve</button>
                  <button className="secondary" onClick={() => setQueue((q) => reject(q, job.id))}><X size={14} /> Reject</button>
                </>)}
                {job && (job.status === "failed" || job.status === "cancelled") && <button className="secondary" onClick={() => setQueue((q) => retry(q, job.id))}>Retry</button>}
                {job && job.status === "queued" && <button className="secondary" onClick={() => setQueue((q) => cancel(q, job.id))}>Cancel</button>}
                {job && job.status === "completed" && job.rejected && <button className="secondary" onClick={queueViews}>Regenerate</button>}
                {job && (job.status === "queued" || job.status === "failed") && model && (job.provider !== provider || job.model !== modelId) && (
                  <button className="secondary" onClick={() => setQueue((q) => reassignModel(q, [job.id], provider, modelId))}>Move to {modelId.split("/").pop()}</button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {confirmOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="sheet" role="dialog" aria-modal="true" aria-label="Confirm spending">
            <h3>Confirm spending</h3>
            <div className="sheet-body">
              <p>Generating sends requests to {providerLabels[provider]} that are billed to your account. Provider prices change and this app does not state them, so enter your own figures.</p>
              <p>{waiting} image{waiting === 1 ? "" : "s"} are waiting. Failed attempts also count, because a provider may still bill them.</p>
            </div>
            <label className="settings-field"><span>Price per image (USD)</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price per image in dollars" /></label>
            <label className="settings-field"><span>Total ceiling (USD)</span><input inputMode="decimal" value={ceiling} onChange={(e) => setCeiling(e.target.value)} aria-label="Total spending ceiling in dollars" /></label>
            <label className="agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I approve spending up to this ceiling.</label>
            <div className="button-row sheet-actions">
              <button className="primary" disabled={!agree} onClick={confirmSpend}>Allow generation</button>
              <button className="secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

