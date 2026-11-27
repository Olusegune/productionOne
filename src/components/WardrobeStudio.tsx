import { useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Shirt, Sparkles, Check, X, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useModelChoice } from "../data/modelChoice";
import { modelTakesReferences, providerLabels } from "../domain/imageCatalog";
import { anchorFor, approve, costPreview, enqueue, reject, type ImageJob, type QueueState } from "../domain/generationQueue";
import type { ExtractedAsset } from "../domain/productionStudio";
import { styleFingerprint } from "../domain/style2d";
import type { StyleBible } from "../domain/visualDevelopment";
import { editDraft, startDraft, standingOf, type Draft } from "../domain/candidateFlow";
import { stalenessOf } from "../domain/variationGraph";
import { approvedPicture, findEntity, latestApproved, type FitSpec, type GarmentSpec, type Ref, type VariationState } from "../domain/variations";
import { defaultKeep, fitCapability, fitRequests, garmentCategories, garmentFieldList, garmentRequests, keepChoices } from "../domain/wardrobe";
import { garmentAssetId, garmentPicture, newGarment, reviseGarment, startFit } from "../domain/wardrobeFlow";
import { proportionWords } from "../domain/characterLayers";
import type { ProportionProfile } from "../domain/proportions";
import "../wardrobe.css";

export interface WardrobeStudioProps {
  character: ExtractedAsset;
  setAssets: (update: (assets: ExtractedAsset[]) => ExtractedAsset[]) => void;
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
  /** Opens the Sheets tab on this look, so the wardrobe sheets can be made for it. */
  onOpenSheets: (variant: string) => void;
  proportions?: Record<string, ProportionProfile>;
}

const blank: GarmentSpec = { description: "", category: "Custom", details: {} };
const now = () => new Date().toISOString();

function Picture({ job, label }: { job?: ImageJob; label: string }) {
  if (job?.outputPath) return <img src={convertFileSrc(job.outputPath)} alt={label} />;
  const busy = job && (job.status === "queued" || job.status === "pending" || job.status === "generating" || job.status === "validating");
  return <div className="wd-empty">{busy ? "Making it…" : job?.status === "failed" ? "Failed. See the queue." : "No picture yet"}</div>;
}

export function WardrobeStudio(props: WardrobeStudioProps) {
  const { character, variations, updateVariations, queue, setQueue, style: projectStyle, desktop, notify } = props;
  const style = character.style ?? projectStyle;
  const choice = useModelChoice(desktop, props.providersVersion);
  const { provider, modelId, configured } = choice;
  const takesRefs = modelTakesReferences(provider, modelId);
  const perRequest = queue.perImageUsd;

  const garments = variations.entities.filter((e) => e.kind === "garment");
  const [selected, setSelected] = useState<string | null>(null);
  const garment = selected ? (findEntity(variations, selected) ?? null) : null;
  const newest = garment ? garment.revisions[garment.revisions.length - 1] : undefined;
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Draft<GarmentSpec>>(() => startDraft("garment", blank));
  const [more, setMore] = useState(false);
  const [keep, setKeep] = useState<string[]>(defaultKeep);

  const open = (id: string | null) => {
    setSelected(id);
    const g = id ? findEntity(variations, id) : null;
    const last = g?.revisions[g.revisions.length - 1];
    setName(g?.name ?? "");
    setDraft(last ? startDraft("garment", last.spec as GarmentSpec, { id: g!.id, revision: last.n }) : startDraft("garment", blank));
  };
  const spec = draft.spec;
  const setField = (key: string, value: string) => setDraft((d) => editDraft(d, { details: { ...(d.spec.details ?? {}), [key]: value } }));

  const jobsOf = (id: string, revision: number) => queue.jobs.filter((j) => j.variation?.id === id && j.variation.revision === revision);
  const garmentJobs = garment && newest ? jobsOf(garment.id, newest.n) : [];
  const unchanged = !!newest && JSON.stringify(newest.spec) === JSON.stringify(spec);
  const changedFromApproved = !!newest && newest.status === "approved" && !unchanged;

  const ready = (): boolean => {
    if (desktop && choice.keysChecked && !configured[provider]) {
      notify(`There is no ${providerLabels[provider]} key yet. Add it, then generation starts.`);
      props.openProviders();
      return false;
    }
    return true;
  };

  /** Saves the design (a new garment, or a new version when it changed) and queues three clothing pictures. */
  const makePreviews = () => {
    if (!name.trim() || !spec.description.trim()) { notify("Give the garment a name and describe it first."); return; }
    if (!ready()) return;
    let ref: Ref;
    let assetId: string;
    let source: string | undefined;
    if (!garment) {
      const made = newGarment(variations, [], { name: name.trim(), spec, now: now() });
      props.setAssets((assets) => [...assets, made.assets[0]]);
      updateVariations(() => made.variations);
      ref = made.ref; assetId = made.assetId;
      setSelected(made.ref.id);
    } else if (changedFromApproved || (newest && newest.status !== "candidate")) {
      const pic = garmentPicture(variations, garment.id);
      const made = reviseGarment(variations, garment.id, spec, now());
      updateVariations(() => made.variations);
      ref = made.ref; assetId = garmentAssetId(garment.id); source = takesRefs ? pic?.path : undefined;
    } else if (newest) {
      ref = { id: garment.id, revision: newest.n }; assetId = garmentAssetId(garment.id);
    } else return;
    const requests = garmentRequests({ style, provider, model: modelId, assetId, assetName: name.trim(), garment: ref, garmentName: name.trim(), spec, source, styleFp: styleFingerprint(style) });
    const result = enqueue(queue, requests, Date.now(), true);
    setQueue(() => result.state);
    notify(`Making ${result.added} clothing picture${result.added === 1 ? "" : "s"}…`);
  };

  const decide = (job: ImageJob, yes: boolean) => {
    if (yes) { setQueue((q) => approve(q, job.id)); props.onApproved(job, true); } else { setQueue((q) => reject(q, job.id)); if (job.approved) props.onUnapproved(job); }
  };

  // ----- fitting -----
  const pic = garment ? garmentPicture(variations, garment.id) : undefined;
  const characterPicture = anchorFor(queue, { assetId: character.id, variant: "Canonical" } as ImageJob);
  const fitEntity = garment ? variations.entities.find((e) => e.kind === "fit" && e.characterId === character.id && e.revisions.some((r) => (r.spec as FitSpec).garment.id === garment.id)) : undefined;
  const fitNewest = fitEntity?.revisions[fitEntity.revisions.length - 1];
  const fitJobs = fitEntity && fitNewest ? jobsOf(fitEntity.id, fitNewest.n) : [];
  const capability = fitCapability(takesRefs);
  const fitStale = fitEntity && fitNewest?.status === "approved" ? stalenessOf(variations, { id: fitEntity.id, revision: fitNewest.n }) : undefined;

  const makeFit = () => {
    if (!garment || !pic || !characterPicture) return;
    if (!capability.ok) { notify(capability.message); return; }
    if (!ready()) return;
    const fit = startFit(variations, { character, garment: pic.ref, garmentName: garment.name, keep, now: now() });
    updateVariations(() => fit.variations);
    const requests = fitRequests({ style, provider, model: modelId, character, lookName: fit.variant, fit: fit.ref, garment: pic.ref, garmentName: garment.name, garmentSpec: findEntity(variations, garment.id)!.revisions.find((r) => r.n === pic.ref.revision)!.spec as GarmentSpec, keep, characterPicture, garmentPicture: pic.path, proportions: proportionWords(props.proportions?.[character.id]), styleFp: styleFingerprint(style) });
    const result = enqueue(queue, requests, Date.now(), true);
    setQueue(() => result.state);
    notify(`Fitting ${garment.name} on ${character.name}…`);
  };

  const fitJob = [...fitJobs].sort((a, b) => b.revision - a.revision)[0];
  const outfit = fitEntity ? (fitEntity.revisions[fitEntity.revisions.length - 1].spec as FitSpec).variant : undefined;
  const cost = costPreview(3, perRequest);
  const fitCost = costPreview(1, perRequest);
  const stand = newest ? standingOf(newest, { hasSource: false }) : undefined;
  const ordered = useMemo(() => garments, [garments]);

  return (
    <section className="panel wd" aria-label="Wardrobe">
      <header className="wd-head">
        <div><h2><Shirt size={18} aria-hidden="true" /> Wardrobe</h2><p className="helper">Design a garment on its own, approve it, then fit it to {character.name}. The face and body stay as approved; only the clothing changes.</p></div>
      </header>
      <div className="wd-body">
        <nav className="wd-library" aria-label="Garments">
          <button className={`wd-new${selected === null ? " on" : ""}`} onClick={() => open(null)}><Plus size={15} aria-hidden="true" /> New garment</button>
          {ordered.length === 0 && <p className="helper">No garments yet. Describe one and make a preview.</p>}
          {ordered.map((g) => {
            const last = g.revisions[g.revisions.length - 1];
            const best = latestApproved(g);
            const thumb = (best && approvedPicture(best)?.path) ?? last.media[0]?.path;
            return (
              <button key={g.id} className={`wd-card${selected === g.id ? " on" : ""}`} onClick={() => open(g.id)} aria-label={`${g.name}, ${best ? "approved" : "not approved yet"}`}>
                {thumb ? <img src={convertFileSrc(thumb)} alt="" /> : <span className="wd-thumb" aria-hidden="true"><Shirt size={20} /></span>}
                <span><b>{g.name}</b><small>{best ? `Approved · version ${best.n}` : "Candidate"}{g.revisions.length > 1 ? ` · ${g.revisions.length} versions` : ""}</small></span>
              </button>
            );
          })}
        </nav>
        <div className="wd-work">
          <div className="wd-design">
            <h3>{garment ? garment.name : "Design a garment"}</h3>
            <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="for example Field jacket" disabled={!!garment} /></label>
            <label>What is it?<select value={spec.category ?? "Custom"} onChange={(e) => setDraft((d) => editDraft(d, { category: e.target.value }))}>{garmentCategories.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Describe the garment<textarea rows={3} value={spec.description} onChange={(e) => setDraft((d) => editDraft(d, { description: e.target.value }))} placeholder="A waxed cotton field jacket with a corduroy collar and four patch pockets" /></label>
            <div className="wd-fields">
              {garmentFieldList.filter((f) => !f.advanced).map((f) => <label key={f.key}>{f.label}<input value={spec.details?.[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.hint} /></label>)}
            </div>
            <button className="wd-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>{more ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />} More details</button>
            {more && <div className="wd-fields">{garmentFieldList.filter((f) => f.advanced).map((f) => <label key={f.key}>{f.label}<input value={spec.details?.[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.hint} /></label>)}</div>}
            <div className="wd-actions">
              <button className="primary" onClick={makePreviews} disabled={!!garment && newest?.status === "approved" && unchanged}>
                <Sparkles size={15} aria-hidden="true" /> {changedFromApproved ? "Save as a new version and preview" : garment && newest?.status === "candidate" ? "Make more previews" : "Make previews"} · {cost.label}
              </button>
              {garment && newest?.status === "approved" && unchanged && <span className="helper">Approved. Change something to make a new version.</span>}
            </div>
            <p className="helper">The model is {modelId} on {providerLabels[provider]}. Pictures show the clothing only, with no person.</p>
          </div>

          {garment && newest && (
            <div className="wd-candidates" aria-live="polite">
              <h3>Previews of version {newest.n} <span className={`wd-badge ${newest.status}`}>{newest.status === "approved" ? "Approved" : newest.status === "rejected" ? "Turned down" : "Waiting for your decision"}</span></h3>
              {stand && <p className="helper">{stand.next}</p>}
              <div className="wd-strip">
                {garmentJobs.length === 0 && <div className="wd-empty">No previews yet.</div>}
                {garmentJobs.sort((a, b) => a.viewKey.localeCompare(b.viewKey)).map((j) => (
                  <figure key={j.id}>
                    <Picture job={j} label={j.label} />
                    <figcaption>{j.label}{j.approved ? " · Approved" : j.rejected ? " · Turned down" : ""}</figcaption>
                    {j.outputPath && newest.status === "candidate" && <div className="wd-decide"><button className="primary" onClick={() => decide(j, true)}><Check size={14} aria-hidden="true" /> Approve garment</button><button onClick={() => decide(j, false)} aria-label={`Turn down ${j.label}`}><X size={14} aria-hidden="true" /></button></div>}
                  </figure>
                ))}
              </div>
              <ol className="wd-history" aria-label="Versions">
                {garment.revisions.map((r) => <li key={r.n}>Version {r.n}: {r.status === "approved" ? "approved" : r.status === "rejected" ? "turned down" : "candidate"}{r.parent && r.parent.id === garment.id ? ` (from version ${r.parent.revision})` : ""}</li>)}
              </ol>
            </div>
          )}

          {garment && pic && (
            <div className="wd-fit">
              <h3>Fit it to {character.name}</h3>
              {!characterPicture && <p className="helper warn">Approve {character.name}'s front view first (Sheets, Identity). The fit needs it to keep the face and body.</p>}
              {characterPicture && !capability.ok && <p className="helper warn">{capability.message}</p>}
              <fieldset className="wd-keep"><legend>What must stay exactly the same</legend>
                {keepChoices.map((k) => <label key={k.key}><input type="checkbox" checked={keep.includes(k.key)} onChange={(e) => setKeep((cur) => (e.target.checked ? [...cur, k.key] : cur.filter((x) => x !== k.key)))} /> {k.label}</label>)}
              </fieldset>
              <div className="wd-actions">
                <button className="primary" onClick={makeFit} disabled={!characterPicture || !capability.ok}><Sparkles size={15} aria-hidden="true" /> {fitEntity ? "Try another fit" : "Fit it"} · {fitCost.label}</button>
                <span className="helper">Image models cannot fit clothing exactly, so check every candidate against the original.</span>
              </div>
              {fitEntity && fitNewest && (
                <div className="wd-compare">
                  <figure><Picture job={queue.jobs.find((j) => j.outputPath === characterPicture)} label="Approved character" /><figcaption>{character.name}, approved</figcaption></figure>
                  <figure><Picture job={fitJob} label="Fit candidate" /><figcaption>Candidate fit · {fitNewest.status === "approved" ? "Approved" : fitNewest.status === "rejected" ? "Turned down" : "waiting"}</figcaption>
                    {fitJob?.outputPath && fitNewest.status === "candidate" && <div className="wd-decide"><button className="primary" onClick={() => decide(fitJob, true)}><Check size={14} aria-hidden="true" /> Approve outfit</button><button onClick={() => decide(fitJob, false)} aria-label="Turn down this fit"><X size={14} aria-hidden="true" /></button></div>}
                  </figure>
                  <figure><img src={convertFileSrc(pic.path)} alt="Approved garment" /><figcaption>{garment.name}, approved</figcaption></figure>
                </div>
              )}
              {fitStale?.stale && <p className="helper warn">This outfit was fitted to an earlier version of the garment. It keeps working as approved; make a new fit to update it.</p>}
              {outfit && fitNewest?.status === "approved" && (
                <div className="wd-actions"><span className="helper">Outfit approved as “{outfit}”. It is now a look for {character.name}.</span><button onClick={() => props.onOpenSheets(outfit)}>Make wardrobe sheets for this look</button></div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
