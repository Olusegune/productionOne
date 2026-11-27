import { useState } from "react";
import { Sparkles, Check, X, Plus, Trash2 } from "lucide-react";
import { approve, costPreview, enqueue, reject, type ImageJob, type QueueState } from "../domain/generationQueue";
import { modelTakesReferences, providerLabels } from "../domain/imageCatalog";
import { styleFingerprint } from "../domain/style2d";
import type { StyleBible } from "../domain/visualDevelopment";
import { checkCondition } from "../domain/conditionChecks";
import { conditionKinds, conditionPicture, conditionRequests, conditionTree, garmentComponents, inheritedRegions, newCondition, reviseCondition, sideChoices, type BranchNode } from "../domain/conditions";
import { findEntity, latestApproved, type CharacterSide, type ConditionRegion, type ConditionSpec, type GarmentSpec, type Ref, type VariationState } from "../domain/variations";
import { garmentAssetId, garmentPicture } from "../domain/wardrobeFlow";
import { Picture } from "./wardrobeParts";

export interface ConditionStudioProps {
  garment: { id: string; name: string };
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  queue: QueueState;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  style: StyleBible;
  provider: string;
  modelId: string;
  providerKey: Parameters<typeof modelTakesReferences>[0];
  /** Returns false (and tells the person why) when generation cannot start yet. */
  ready: () => boolean;
  onApproved: (job: ImageJob, primary: boolean) => void;
  onUnapproved: (job: ImageJob) => void;
  notify: (message: string) => void;
}

const nowIso = () => new Date().toISOString();
const emptyRegion = (): ConditionRegion => ({ component: "Sleeve", side: "character-left", severity: "moderate", description: "" });
const stateWords: Record<string, string> = { "passed-for-checks-performed": "Passed for the checks performed", "needs-review": "Needs review", "not-checked": "Not checked", "unable-to-check": "Unable to check" };

function Branch({ node, selected, onPick }: { node: BranchNode; selected: string | null; onPick: (id: string) => void }) {
  return (
    <li>
      <button className={`wd-node${selected === node.entityId ? " on" : ""}`} style={{ marginLeft: node.depth * 16, ["--indent" as string]: `${node.depth * 16}px` }} onClick={() => onPick(node.entityId)} aria-label={`${node.name}, ${node.status}`}>
        <b>{node.name}</b><small>{node.status === "approved" ? "Approved" : "Candidate"}</small>
      </button>
      {node.children.length > 0 && <ul>{node.children.map((c) => <Branch key={c.entityId} node={c} selected={selected} onPick={onPick} />)}</ul>}
    </li>
  );
}

export function ConditionStudio(props: ConditionStudioProps) {
  const { garment, variations, updateVariations, queue, setQueue, style, provider, modelId, notify } = props;
  const takesRefs = modelTakesReferences(props.providerKey, modelId);
  const tree = conditionTree(variations, garment.id);
  const approvedConditions = variations.entities.filter((e) => e.kind === "condition" && latestApproved(e) && (latestApproved(e)!.spec as ConditionSpec).garment.id === garment.id);
  const garmentRev = findEntity(variations, garment.id);
  const garmentSpec = garmentRev ? (latestApproved(garmentRev)?.spec as GarmentSpec | undefined) : undefined;
  const garmentRef: Ref | undefined = garmentRev && latestApproved(garmentRev) ? { id: garment.id, revision: latestApproved(garmentRev)!.n } : undefined;

  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("tear");
  const [from, setFrom] = useState("");
  const [regions, setRegions] = useState<ConditionRegion[]>([emptyRegion()]);
  const [keepText, setKeepText] = useState("");
  const cond = selected ? findEntity(variations, selected) : undefined;
  const newest = cond?.revisions[cond.revisions.length - 1];
  const jobsOf = (id: string, revision: number) => queue.jobs.filter((j) => j.variation?.id === id && j.variation.revision === revision);
  const previews = cond && newest ? jobsOf(cond.id, newest.n) : [];
  const cost = costPreview(3, queue.perImageUsd);

  const open = (id: string | null) => {
    setSelected(id);
    const e = id ? findEntity(variations, id) : undefined;
    const last = e?.revisions[e.revisions.length - 1];
    const spec = last?.spec as ConditionSpec | undefined;
    setName(e?.name ?? ""); setKind(spec?.kind ?? "tear"); setFrom(spec?.from?.id ?? ""); setRegions(spec?.regions.length ? spec.regions.map((r) => ({ ...r })) : [emptyRegion()]); setKeepText(spec?.keep?.join("; ") ?? "");
  };
  const setRegion = (i: number, patch: Partial<ConditionRegion>) => setRegions((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const currentSpec = (): Omit<ConditionSpec, "garment"> => ({ kind, regions: regions.filter((r) => r.description.trim() || r.component.trim()).map((r) => ({ ...r })), ...(keepText.trim() ? { keep: keepText.split(";").map((x) => x.trim()).filter(Boolean) } : {}) });

  const makePreviews = () => {
    if (!garmentRef || !garmentSpec) { notify("Approve the garment first."); return; }
    const label = name.trim() || (conditionKinds.find((k) => k.key === kind)?.label ?? "Condition");
    if (!regions.some((r) => r.description.trim())) { notify("Say what changed: describe at least one change."); return; }
    if (!props.ready()) return;
    let ref: Ref;
    let variationsAfter: VariationState;
    const base = currentSpec();
    const fromRef = from ? (() => { const f = findEntity(variations, from); const l = f && latestApproved(f); return l ? { id: from, revision: l.n } : undefined; })() : undefined;
    if (!cond) {
      const made = newCondition(variations, { name: label, garment: garmentRef, kind, regions: base.regions, from: fromRef, keep: base.keep, now: nowIso() });
      variationsAfter = made.variations; ref = made.ref; setSelected(made.ref.id);
    } else if (newest && (newest.status !== "candidate" || changedFromSaved(newest.spec as ConditionSpec, base))) {
      const made = reviseCondition(variations, cond.id, { ...(newest.spec as ConditionSpec), ...base, garment: garmentRef, ...(fromRef ? { from: fromRef } : {}) }, nowIso());
      variationsAfter = made.variations; ref = made.ref;
    } else if (newest) {
      variationsAfter = variations; ref = { id: cond.id, revision: newest.n };
    } else return;
    updateVariations(() => variationsAfter);
    const spec = findEntityRevisionSpec(variationsAfter, ref);
    const inherited = inheritedRegions(variationsAfter, ref).earlier;
    // The picture to start from: the earlier condition's approved picture if this continues from one, otherwise the garment's.
    const earlierPic = spec.from ? conditionPicture(variationsAfter, spec.from.id) : undefined;
    const garmentPic = garmentPicture(variationsAfter, garment.id);
    const source = !takesRefs ? undefined : earlierPic ? { path: earlierPic.path, of: "earlier-condition" as const, ref: earlierPic.ref } : garmentPic ? { path: garmentPic.path, of: "garment" as const, ref: garmentPic.ref } : undefined;
    const requests = conditionRequests({ style, provider, model: modelId, assetId: garmentAssetId(garment.id), assetName: garment.name, condition: ref, conditionName: label, spec, garmentName: garment.name, garment: garmentSpec, earlier: inherited, source, styleFp: styleFingerprint(style) });
    const result = enqueue(queue, requests, Date.now(), true);
    setQueue(() => result.state);
    notify(`Making ${result.added} picture${result.added === 1 ? "" : "s"} of ${garment.name} in this condition…`);
  };

  const decide = (job: ImageJob, yes: boolean) => {
    if (yes) { setQueue((q) => approve(q, job.id)); props.onApproved(job, true); } else { setQueue((q) => reject(q, job.id)); if (job.approved) props.onUnapproved(job); }
  };
  const report = cond && newest ? checkCondition(variations, { id: cond.id, revision: newest.n }) : undefined;
  const earlier = cond && newest ? inheritedRegions(variations, { id: cond.id, revision: newest.n }).earlier : [];

  return (
    <div className="wd-cond">
      <h3>Condition: wear, damage, dirt and repair</h3>
      <p className="helper">A condition starts from the approved garment, or continues from an approved earlier condition. What an earlier condition established stays in place. Left and right are always the wearer’s.</p>
      <div className="wd-cond-body">
        <div className="wd-tree">
          <button className={`wd-new${selected === null ? " on" : ""}`} onClick={() => open(null)}><Plus size={15} aria-hidden="true" /> New condition</button>
          {tree.length === 0 ? <p className="helper">No conditions yet. The garment is pristine.</p> : <ul aria-label="Conditions">{tree.map((n) => <Branch key={n.entityId} node={n} selected={selected} onPick={open} />)}</ul>}
        </div>
        <div className="wd-cond-form">
          <label>Name of this condition<input value={name} onChange={(e) => setName(e.target.value)} placeholder="for example Left sleeve torn" disabled={!!cond} /></label>
          <label>Start from<select value={from} onChange={(e) => setFrom(e.target.value)} disabled={!!cond}><option value="">The pristine garment</option>{approvedConditions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Kind<select value={kind} onChange={(e) => setKind(e.target.value)}>{conditionKinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></label>
          <fieldset className="wd-regions"><legend>What changed, and where</legend>
            {regions.map((r, i) => (
              <div className="wd-region" key={i}>
                <select aria-label={`Part ${i + 1}`} value={r.component} onChange={(e) => setRegion(i, { component: e.target.value })}>{garmentComponents.map((c) => <option key={c}>{c}</option>)}</select>
                <select aria-label={`Side ${i + 1}`} value={r.side} onChange={(e) => setRegion(i, { side: e.target.value as CharacterSide })}>{sideChoices.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
                <select aria-label={`Severity ${i + 1}`} value={r.severity} onChange={(e) => setRegion(i, { severity: e.target.value as ConditionRegion["severity"] })}><option value="light">Light</option><option value="moderate">Moderate</option><option value="heavy">Heavy</option></select>
                <input aria-label={`Description ${i + 1}`} value={r.description} onChange={(e) => setRegion(i, { description: e.target.value })} placeholder={conditionKinds.find((k) => k.key === kind)?.hint} />
                <button aria-label={`Remove change ${i + 1}`} onClick={() => setRegions((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : [emptyRegion()]))}><Trash2 size={14} aria-hidden="true" /></button>
              </div>
            ))}
            <button onClick={() => setRegions((rs) => [...rs, emptyRegion()])}><Plus size={14} aria-hidden="true" /> Add a change</button>
            <small className="helper">“Wearer’s left” is the person’s own left. In a front view it is on the right of the picture.</small>
          </fieldset>
          <label>Must stay unchanged (separate with ;)<input value={keepText} onChange={(e) => setKeepText(e.target.value)} placeholder="the collar; the pocket layout" /></label>
          {earlier.length > 0 && <p className="helper">Already in place from earlier conditions: {earlier.map((e) => `${e.region.component} (${e.region.description})`).join("; ")}.</p>}
          <div className="wd-actions">
            <button className="primary" onClick={makePreviews}><Sparkles size={15} aria-hidden="true" /> {cond && newest?.status === "candidate" && !changedFromSaved(newest.spec as ConditionSpec, currentSpec()) ? "Make more previews" : cond ? "Save as a new version and preview" : "Make previews"} · {cost.label}</button>
            <span className="helper">Uses {modelId} on {providerLabels[props.providerKey]}. {takesRefs ? "The approved picture is the starting point." : "This model cannot see pictures, so each one starts from the words alone."}</span>
          </div>
        </div>
      </div>
      {cond && newest && (
        <div className="wd-candidates" aria-live="polite">
          <h3>{cond.name}, version {newest.n} <span className={`wd-badge ${newest.status}`}>{newest.status === "approved" ? "Approved" : newest.status === "rejected" ? "Turned down" : "Waiting for your decision"}</span></h3>
          <div className="wd-strip">
            {previews.length === 0 && <div className="wd-empty">No previews yet.</div>}
            {[...previews].sort((a, b) => a.viewKey.localeCompare(b.viewKey)).map((j) => (
              <figure key={j.id}>
                <Picture job={j} label={j.label} />
                <figcaption>{j.label}{j.approved ? " · Approved" : j.rejected ? " · Turned down" : ""}</figcaption>
                {j.outputPath && newest.status === "candidate" && <div className="wd-decide"><button className="primary" onClick={() => decide(j, true)}><Check size={14} aria-hidden="true" /> Approve condition</button><button onClick={() => decide(j, false)} aria-label={`Turn down ${j.label}`}><X size={14} aria-hidden="true" /></button></div>}
              </figure>
            ))}
          </div>
          {report && (
            <details className="wd-checks" open={report.state === "needs-review"}>
              <summary>Record checks: {stateWords[report.state]}</summary>
              <p className="helper">{report.summary}</p>
              <ul>{report.checks.map((c) => <li key={c.id} className={c.result}><b>{c.result === "pass" ? "Passed" : c.result === "fail" ? "Needs a look" : "Not checked"}</b> {c.label}. {c.detail}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/** Whether the form no longer matches the saved candidate. A saved revision is never edited, so a change makes a new version. */
function changedFromSaved(saved: ConditionSpec, form: Omit<ConditionSpec, "garment">): boolean {
  const pick = (x: { kind: string; regions: ConditionRegion[]; keep?: string[] }) => JSON.stringify({ kind: x.kind, regions: x.regions, keep: x.keep ?? [] });
  return pick(saved) !== pick(form);
}

function findEntityRevisionSpec(state: VariationState, ref: Ref): ConditionSpec {
  const e = findEntity(state, ref.id);
  return e!.revisions.find((r) => r.n === ref.revision)!.spec as ConditionSpec;
}
