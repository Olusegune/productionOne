import { useMemo, useState } from "react";
import { Check, ScanFace, Sparkles, X } from "lucide-react";
import { useModelChoice } from "../data/modelChoice";
import { modelTakesReferences, providerLabels } from "../domain/imageCatalog";
import { approve, costPreview, enqueue, reject, type ImageJob, type QueueState } from "../domain/generationQueue";
import type { ExtractedAsset } from "../domain/productionStudio";
import { styleFingerprint } from "../domain/style2d";
import type { StyleBible } from "../domain/visualDevelopment";
import { findEntity, latestApproved, type SkinSpec, type VariationState } from "../domain/variations";
import { approvedSkin, isPhotorealStyle } from "../domain/skin";
import { canApproveRefinement, refinementBlocker, refusedLocally, refinementCost, refinementSummary, skinCapability, skinRequests, skinViews, sourceForView, startSkinRefinement } from "../domain/skinRefine";
import { affectedBy, buildPreflight } from "../domain/preflight";
import { PreflightCard } from "./PreflightCard";
import { plainNote } from "../domain/plainNote";
import { ZoomImage, ZoomToolbar, useZoomSync } from "./ZoomCompare";
import "../wardrobe.css";

export interface SkinRefinementProps {
  character: ExtractedAsset;
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  queue: QueueState;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  style: StyleBible;
  desktop: boolean;
  providersVersion: number;
  onApproved: (job: ImageJob, primary: boolean) => void;
  onUnapproved: (job: ImageJob) => void;
  notify: (message: string) => void;
  openProviders: () => void;
  onOpenSheets: (variant: string) => void;
}

const nowIso = () => new Date().toISOString();
type Mode = "both" | "original" | "candidate";

/**
 * Protected skin refinement for a photorealistic character. The approved picture is the only starting point and stays as it is; the refinement is a new
 * candidate you compare with it and approve as a new version. Generating is always an explicit button: the controls above never start a request.
 */
export function SkinRefinement(props: SkinRefinementProps) {
  const { character, variations, updateVariations, queue, setQueue, style, desktop, notify } = props;
  const choice = useModelChoice(desktop, props.providersVersion);
  const { provider, modelId, configured } = choice;
  const capability = skinCapability(modelTakesReferences(provider, modelId), modelId);
  const profile = approvedSkin(variations, character.id);
  const entity = profile ? findEntity(variations, profile.ref.id) : undefined;
  const newest = entity?.revisions[entity.revisions.length - 1];
  const sources = useMemo(() => Object.fromEntries(skinViews.map((v) => [v.key, sourceForView(queue, character, v.key)])) as Record<string, string | undefined>, [queue, character]);
  const identityPicture = sources["full-front"] ?? sources["portrait"];
  const blocker = refinementBlocker({ style, state: variations, character, identityPicture, capability });
  const cost = costPreview(skinViews.length, queue.perImageUsd);

  const candidates = entity && newest ? queue.jobs.filter((j) => j.variation?.id === entity.id && j.variation.revision === newest.n) : [];
  const spec = (newest?.spec ?? profile?.spec) as SkinSpec | undefined;
  const [viewKey, setViewKey] = useState(skinViews[0].key);
  const [mode, setMode] = useState<Mode>("both");
  const [identityOk, setIdentityOk] = useState(false);
  const [surfaceOk, setSurfaceOk] = useState(false);
  const failed = candidates.filter((j) => j.status === "failed");
  const pending = newest?.status === "candidate" && candidates.length > 0;
  const shown = candidates.find((j) => j.viewKey === viewKey);
  const original = sources[viewKey];
  const zoom = useZoomSync(`${newest?.n ?? 0}-${viewKey}`, [original, shown?.outputPath]);
  const gate = canApproveRefinement({ identity: identityOk, surface: surfaceOk }, !!shown?.outputPath);
  const spent = entity ? refinementCost(queue, entity.id) : undefined;
  const summary = spec ? refinementSummary(spec) : undefined;
  const approvedVariant = entity && latestApproved(entity) ? (latestApproved(entity)!.spec as SkinSpec).variant : undefined;

  const generate = () => {
    if (blocker) { notify(blocker); return; }
    if (desktop && choice.keysChecked && !configured[provider]) { notify(`There is no ${providerLabels[provider]} key yet. Add it, then generation starts.`); props.openProviders(); return; }
    const identityJob = queue.jobs.find((j) => j.outputPath === identityPicture);
    const made = startSkinRefinement(variations, { character, identityJob: identityJob ? { id: identityJob.id, revision: identityJob.revision } : undefined, now: nowIso() });
    if ("error" in made) { notify(made.error); return; }
    updateVariations(() => made.variations);
    const requests = skinRequests({ style, provider, model: modelId, character, lookName: made.variant, skin: made.ref, spec: made.spec, sources: Object.fromEntries(skinViews.map((v) => [v.key, sources[v.key] as string])), styleFp: styleFingerprint(style) });
    const result = enqueue(queue, requests, Date.now(), true);
    setQueue(() => result.state);
    setIdentityOk(false); setSurfaceOk(false);
    notify(`Making ${result.added} refinement candidate${result.added === 1 ? "" : "s"} of ${character.name}. The approved picture is not changed.`);
  };

  const approveShown = () => {
    if (!shown || !gate.ok) return;
    setQueue((q) => approve(q, shown.id));
    props.onApproved(shown, shown.viewKey === "full-front");
  };
  const turnDown = () => { for (const j of candidates) { setQueue((q) => reject(q, j.id)); if (j.approved) props.onUnapproved(j); } setIdentityOk(false); setSurfaceOk(false); };

  const plan = buildPreflight({
    count: skinViews.length, what: `${character.name} with the skin profile applied, as new candidates`, costLabel: cost.label,
    protectedItems: summary?.protectedItems ?? [],
    approvedUntouched: variations.entities.reduce((n, e) => n + e.revisions.filter((r) => r.status === "approved").length, 0),
    affects: affectedBy(variations, profile?.ref),
    uses: [identityPicture ? `${character.name}'s approved picture (one reference, never changed)` : "", `${modelId} on ${providerLabels[provider]}`],
    deliverables: ["A head-and-shoulders and a full-front candidate to compare with the originals", "Nothing is approved until you approve it"],
  });

  if (!isPhotorealStyle(style)) return null;
  return (
    <section className="panel wd" aria-label="Skin refinement">
      <header className="wd-head"><div><h2><ScanFace size={18} aria-hidden="true" /> Refine the skin of the approved picture</h2>
        <p className="helper">Makes new candidates from {character.name}'s approved picture with the skin profile applied, keeping what you protected. The original is never changed. Pressing the button below is the only thing that spends money.</p></div></header>

      {blocker ? <p className="helper warn" role="alert">{blocker}</p> : capability.ok && <p className="helper" role="note">{capability.limitation}</p>}

      <PreflightCard plan={plan} />
      <div className="wd-actions">
        <button className="primary" onClick={generate} disabled={!!blocker}><Sparkles size={15} aria-hidden="true" /> Generate refinement · {cost.label}</button>
        {spent && spent.pictures > 0 && <span className="helper">Spent on refinements so far: {spent.attempts} attempt{spent.attempts === 1 ? "" : "s"}{spent.usd !== null ? `, about $${spent.usd.toFixed(2)}` : ""}. Retries add to this and never replace it.{spent.refused > 0 ? ` ${spent.refused} more ${spent.refused === 1 ? "was" : "were"} refused on this computer before sending, so ${spent.refused === 1 ? "it was" : "they were"} not charged.` : ""}</span>}
      </div>
      {failed.length > 0 && (
        <div className="wd-stale" role="alert">
          <b>{failed.length} picture{failed.length === 1 ? "" : "s"} could not be made.</b>
          <ul>{[...new Set(failed.map((j) => plainNote(j.error ?? "It failed without a message.")))].map((m) => <li key={m}>{m}</li>)}</ul>
          {failed.every(refusedLocally) && <p className="helper">Nothing reached the provider, so nothing was charged. Fix the cause, then press Generate refinement again.</p>}
        </div>
      )}

      {entity && newest && pending && summary && (
        <div className="wd-candidates" aria-live="polite">
          <h3>Compare with the original <span className={`wd-badge ${newest.status}`}>Waiting for your decision</span></h3>
          <div className="rv-seg" role="group" aria-label="Which picture">
            {skinViews.map((v) => <button key={v.key} type="button" className={viewKey === v.key ? "on" : ""} aria-pressed={viewKey === v.key} onClick={() => setViewKey(v.key)}>{v.label}</button>)}
          </div>
          <div className="rv-seg" role="group" aria-label="Before and after">
            {(["both", "original", "candidate"] as Mode[]).map((m) => <button key={m} type="button" className={mode === m ? "on" : ""} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "both" ? "Side by side" : m === "original" ? "Original" : "Candidate"}</button>)}
          </div>
          <ZoomToolbar z={zoom} regions />
          {zoom.headNote && <p className="helper">{zoom.headNote}</p>}
          <div className={`rv-compare${mode === "both" ? "" : " single"}`}>
            {mode !== "candidate" && <figure><ZoomImage z={zoom} index={0} path={original} label={`Original ${viewKey}`} empty="No original of this view" /><figcaption>Original (approved)</figcaption></figure>}
            {mode !== "original" && <figure><ZoomImage z={zoom} index={1} path={shown?.outputPath} label={`Refined candidate ${viewKey}`} empty={shown ? "Still being made" : "No candidate of this view"} /><figcaption>Candidate{shown?.approved ? " · approved" : ""}</figcaption></figure>}
          </div>

          <div className="wd-fields">
            <div className="wd-design"><h4>Protected (should be unchanged)</h4><ul>{summary.protectedItems.map((p) => <li key={p}>{p}</li>)}</ul></div>
            <div className="wd-design"><h4>Intended to change</h4><ul>{summary.intended.map((p) => <li key={p}>{p}</li>)}</ul></div>
          </div>

          <fieldset className="wd-keep"><legend>Your two decisions (kept apart)</legend>
            <label><input type="checkbox" checked={identityOk} onChange={(e) => setIdentityOk(e.target.checked)} /> <b>Identity:</b> the face, age, expression and marks are the same as the original</label>
            <label><input type="checkbox" checked={surfaceOk} onChange={(e) => setSurfaceOk(e.target.checked)} /> <b>Surface:</b> the skin looks more natural than the original</label>
          </fieldset>
          <p className={gate.ok ? "helper" : "helper warn"} role="status">{gate.why}</p>
          <div className="wd-decide">
            <button className="primary" disabled={!gate.ok} onClick={approveShown}><Check size={14} aria-hidden="true" /> Approve as a new version</button>
            <button onClick={() => notify("Change the controls above and press Generate refinement again. This candidate stays in the history; nothing is overwritten.")}>Request changes</button>
            <button onClick={turnDown} aria-label="Turn down this refinement"><X size={14} aria-hidden="true" /> Turn down</button>
          </div>
        </div>
      )}

      {entity && (
        <ol className="wd-history" aria-label="Versions of the skin profile">
          {entity.revisions.map((r) => <li key={r.n}>Version {r.n}: {(r.spec as SkinSpec).preset}, {r.status === "approved" ? (r.media.some((m) => m.role === "approved") ? "approved with a refined picture" : "approved (profile only)") : r.status === "rejected" ? "turned down" : "candidate"}</li>)}
        </ol>
      )}
      {approvedVariant && queue.jobs.some((j) => j.variant === approvedVariant && j.approved) && (
        <div className="wd-actions"><span className="helper">Approved as “{approvedVariant}”. New sheets for it start from the approved skin reference.</span><button onClick={() => props.onOpenSheets(approvedVariant)}>Make reference sheets with this skin</button></div>
      )}
    </section>
  );
}
