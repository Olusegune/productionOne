import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Sparkles, Check, X, Plus, Wand2 } from "lucide-react";
import { useModelChoice } from "../data/modelChoice";
import { modelTakesReferences, providerLabels } from "../domain/imageCatalog";
import { anchorFor, approve, costPreview, enqueue, reject, type ImageJob, type QueueState } from "../domain/generationQueue";
import type { ExtractedAsset } from "../domain/productionStudio";
import { styleFingerprint } from "../domain/style2d";
import type { StyleBible } from "../domain/visualDevelopment";
import { editDraft, startDraft, standingOf, type Draft } from "../domain/candidateFlow";
import { audienceChoices, checkTransformation, costumeChoices, detailFields, intensityWords, recognisabilityWords, stageIntensity, stageNames, symmetryChoices, transformationCapability, transformationPresets, transformationRequests, transformationViews } from "../domain/transformation";
import { lastApprovedStage, newStage, stageLines, stageLookName, stagePicture } from "../domain/transformationFlow";
import { findEntity, latestApproved, type TransformationSpec, type VariationState } from "../domain/variations";
import { mentionsSide, sideCheckWarning } from "../domain/sides";
import { Picture } from "./wardrobeParts";
import "../wardrobe.css";

export interface TransformStudioProps {
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

type Spec = Omit<TransformationSpec, "characterId" | "variant" | "from">;
const nowIso = () => new Date().toISOString();
const preset0 = transformationPresets[0];
const fromPreset = (key: string, stage: string): Spec => {
  const p = transformationPresets.find((x) => x.key === key) ?? preset0;
  return { kind: p.label, stage, intensity: stageIntensity[stage] ?? 3, recognisability: 4, anchors: [], symmetry: p.symmetry, costume: "keep", audience: "teen", details: { anatomy: p.anatomy, surface: p.surface, features: p.features, differences: "" }, expectedAnatomy: [] };
};

export function TransformStudio(props: TransformStudioProps) {
  const { character, variations, updateVariations, queue, setQueue, style: projectStyle, desktop, notify } = props;
  const style = character.style ?? projectStyle;
  const choice = useModelChoice(desktop, props.providersVersion);
  const { provider, modelId, configured } = choice;
  const takesRefs = modelTakesReferences(provider, modelId);
  const capability = transformationCapability(takesRefs);
  const cost = costPreview(transformationViews.length, queue.perImageUsd);

  const lines = stageLines(variations, character.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [presetKey, setPresetKey] = useState(preset0.key);
  // The settings are a local draft: moving a slider edits only this. Nothing is saved or requested until the button is pressed.
  const [draft, setDraft] = useState<Draft<TransformationSpec>>(() => startDraft("transformation", { ...fromPreset(preset0.key, stageNames[0]), characterId: character.id } as TransformationSpec));
  const [anchorText, setAnchorText] = useState("");
  const [anatomyText, setAnatomyText] = useState("");

  const characterPicture = anchorFor(queue, { assetId: character.id, variant: "Canonical" } as ImageJob);
  const spec = draft.spec;
  const entity = selected ? findEntity(variations, selected) : undefined;
  const newest = entity?.revisions[entity.revisions.length - 1];
  const jobsOf = (id: string, revision: number) => queue.jobs.filter((j) => j.variation?.id === id && j.variation.revision === revision);
  const candidates = entity && newest ? jobsOf(entity.id, newest.n) : [];

  // Where this stage starts from: the last approved stage of the same kind, or the character as approved.
  const prior = entity ? undefined : lastApprovedStage(variations, character.id, spec.kind);
  const savedFrom = entity && newest ? (newest.spec as TransformationSpec).from : undefined;
  const fromEntity = savedFrom ? findEntity(variations, savedFrom.id) : undefined;
  const sourcePath = savedFrom ? stagePicture(variations, savedFrom.id)?.path : prior ? prior.path : characterPicture;
  const sourceLabel = savedFrom ? (fromEntity?.name ?? "earlier stage") : prior ? `${prior.stage} (approved)` : `${character.name}, approved`;
  const previousSpec = (savedFrom ? (fromEntity && (fromEntity.revisions[fromEntity.revisions.length - 1].spec as TransformationSpec)) : prior ? (findEntity(variations, prior.entityId)!.revisions[findEntity(variations, prior.entityId)!.revisions.length - 1].spec as TransformationSpec) : undefined) ?? undefined;

  const open = (id: string | null) => {
    setSelected(id);
    const e = id ? findEntity(variations, id) : undefined;
    const last = e?.revisions[e.revisions.length - 1];
    const s = last ? (last.spec as TransformationSpec) : ({ ...fromPreset(presetKey, stageNames[0]), characterId: character.id } as TransformationSpec);
    setDraft(startDraft("transformation", s, e && last ? { id: e.id, revision: last.n } : undefined));
    setAnchorText((s.anchors ?? []).join("; ")); setAnatomyText((s.expectedAnatomy ?? []).join("\n"));
  };
  const choosePreset = (key: string) => {
    setPresetKey(key);
    const p = transformationPresets.find((x) => x.key === key) ?? preset0;
    // A preset only fills the fields. Every one of them can be changed afterwards.
    setDraft((d) => editDraft(d, { kind: p.label, symmetry: p.symmetry, details: { ...(d.spec.details ?? {}), anatomy: p.anatomy, surface: p.surface, features: p.features } }));
  };
  const setDetail = (key: string, value: string) => setDraft((d) => editDraft(d, { details: { ...(d.spec.details ?? {}), [key]: value } }));
  const setAnchors = (text: string) => { setAnchorText(text); setDraft((d) => editDraft(d, { anchors: text.split(";").map((x) => x.trim()).filter(Boolean) })); };
  const setAnatomy = (text: string) => { setAnatomyText(text); setDraft((d) => editDraft(d, { expectedAnatomy: text.split("\n").map((x) => x.trim()).filter(Boolean) })); };
  const setStage = (stage: string) => setDraft((d) => editDraft(d, { stage, ...(stageIntensity[stage] ? { intensity: stageIntensity[stage] } : {}) }));

  const ready = (): boolean => {
    if (desktop && choice.keysChecked && !configured[provider]) { notify(`There is no ${providerLabels[provider]} key yet. Add it, then generation starts.`); props.openProviders(); return false; }
    return true;
  };

  const makeCandidates = () => {
    if (!characterPicture || !sourcePath) { notify(`Approve ${character.name}'s front view first (Sheets, Identity).`); return; }
    if (!capability.ok) { notify(capability.message); return; }
    if (!spec.stage.trim() || !spec.kind.trim()) { notify("Choose a kind of transformation and name the stage."); return; }
    const report = checkTransformation(spec, previousSpec);
    // Only the essentials stop a candidate. The rest (declared anatomy, progression, what changed) stays visible below as "Needs a look".
    const bad = report.checks.find((c) => c.result === "fail" && ["anchors", "recognisability", "describes-change"].includes(c.id));
    if (bad) { notify(`${bad.label}: ${bad.detail}`); return; }
    if (!ready()) return;
    const { characterId: _c, variant: _v, from: _f, ...rest } = spec;
    let made;
    // Making a stage that already exists again keeps that stage's own predecessor, never the latest approved stage.
    const sameName = variations.entities.find((e) => e.kind === "transformation" && e.characterId === character.id && e.name === stageLookName(character.name, rest.kind, rest.stage));
    const from = sameName ? (sameName.revisions[sameName.revisions.length - 1].spec as TransformationSpec).from : (savedFrom ?? prior?.ref);
    try { made = newStage(variations, { character, spec: rest, from, now: nowIso() }); } catch (e) { notify((e as Error).message); return; }
    updateVariations(() => made.variations);
    setSelected(made.ref.id);
    const saved = findEntity(made.variations, made.ref.id)!.revisions.find((r) => r.n === made.ref.revision)!.spec as TransformationSpec;
    const of = saved.from ? { stage: (findEntity(made.variations, saved.from.id)!.revisions.find((r) => r.n === saved.from!.revision)!.spec as TransformationSpec).stage } : ("base" as const);
    const requests = transformationRequests({ style, provider, model: modelId, character, lookName: made.variant, stage: made.ref, spec: saved, source: { path: sourcePath, of, ref: saved.from }, styleFp: styleFingerprint(style) });
    const result = enqueue(queue, requests, Date.now(), true);
    setQueue(() => result.state);
    notify(`Making ${result.added} picture${result.added === 1 ? "" : "s"} of ${character.name}, ${spec.stage.toLowerCase()}…`);
  };

  const decide = (job: ImageJob, yes: boolean) => {
    if (yes) { setQueue((q) => approve(q, job.id)); props.onApproved(job, job.viewKey === "full-front"); } else { setQueue((q) => reject(q, job.id)); if (job.approved) props.onUnapproved(job); }
  };
  const report = checkTransformation(newest && entity ? (newest.spec as TransformationSpec) : spec, previousSpec);
  const front = candidates.find((j) => j.viewKey === "full-front");
  const portrait = candidates.find((j) => j.viewKey === "portrait");
  const stand = newest ? standingOf(newest, { hasSource: true }) : undefined;
  const approvedVariant = entity && latestApproved(entity) ? (latestApproved(entity)!.spec as TransformationSpec).variant : undefined;
  const label = (n: number | undefined, words: readonly string[]) => words[Math.min(words.length, Math.max(1, Math.round(n ?? 3))) - 1];

  return (
    <section className="panel wd" aria-label="Transformations">
      <header className="wd-head"><div><h2><Wand2 size={18} aria-hidden="true" /> Transformations</h2><p className="helper">Change {character.name} in stages: normal, then subtle, partial, full. Each stage continues from the one before it and records what changes, so it stays one character.</p></div></header>
      <div className="wd-body">
        <nav className="wd-library" aria-label="Stages">
          <button className={`wd-new${selected === null ? " on" : ""}`} onClick={() => open(null)}><Plus size={15} aria-hidden="true" /> New stage</button>
          {lines.length === 0 && <p className="helper">No transformations yet. {character.name} is shown as approved.</p>}
          {lines.map((l) => (
            <div key={l.kind} className="wd-line">
              <b>{l.kind}</b>
              <ol>
                {l.stages.map((s) => {
                  const e = findEntity(variations, s.entityId)!;
                  const best = latestApproved(e);
                  const thumb = best ? stagePicture(variations, s.entityId)?.path : e.revisions[e.revisions.length - 1].media[0]?.path;
                  return (
                    <li key={s.entityId}>
                      <button className={`wd-card${selected === s.entityId ? " on" : ""}`} onClick={() => open(s.entityId)} aria-label={`${s.stage}, ${s.status === "approved" ? "approved" : "not approved yet"}`}>
                        {thumb ? <img src={convertFileSrc(thumb)} alt="" /> : <span className="wd-thumb" aria-hidden="true"><Wand2 size={20} /></span>}
                        <span><b>{s.stage}</b><small>{s.status === "approved" ? "Approved" : "Candidate"}{s.intensity ? ` · intensity ${s.intensity}` : ""}</small></span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </nav>
        <div className="wd-work">
          <div className="wd-design">
            <h3>{entity ? entity.name : "A new stage"}</h3>
            <div className="wd-fields">
              <label>Kind of transformation<select value={presetKey} disabled={!!entity} onChange={(e) => choosePreset(e.target.value)}>{transformationPresets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
              <label>Stage<input list="stage-names" value={spec.stage} onChange={(e) => setStage(e.target.value)} disabled={!!entity && !!savedFrom} /></label>
              <datalist id="stage-names">{stageNames.map((n) => <option key={n} value={n} />)}</datalist>
              {presetKey === "custom" && !entity && <label>Name this kind<input value={spec.kind === "Custom" ? "" : spec.kind} onChange={(e) => setDraft((d) => editDraft(d, { kind: e.target.value }))} placeholder="for example Moth curse" /></label>}
            </div>
            <p className="helper">{transformationPresets.find((p) => p.key === presetKey)?.help} The preset only fills the boxes below; change anything.</p>
            <p className="helper">Starts from: <b>{sourceLabel}</b>.</p>
            <div className="wd-sliders">
              <div className="wd-age-slider"><span>Intensity: {label(spec.intensity, intensityWords)}</span><input type="range" min={1} max={5} value={spec.intensity ?? 3} onChange={(e) => setDraft((d) => editDraft(d, { intensity: Number(e.target.value) }))} aria-label="Intensity" /></div>
              <div className="wd-age-slider"><span>Aim to stay: {label(spec.recognisability, recognisabilityWords)}</span><input type="range" min={1} max={5} value={spec.recognisability ?? 4} onChange={(e) => setDraft((d) => editDraft(d, { recognisability: Number(e.target.value) }))} aria-label="Recognisability target" /></div>
            </div>
            <p className="helper">The recognisability slider is a creative target that you judge by eye. It is not a score.</p>
            <label>What must remain recognisable? (separate with ;)<input value={anchorText} onChange={(e) => setAnchors(e.target.value)} placeholder="the tired kind eyes; the lean build; the dark tousled hair" /></label>
            <div className="wd-fields">{detailFields.map((f) => <label key={f.key}>{f.label}<input value={spec.details?.[f.key] ?? ""} onChange={(e) => setDetail(f.key, e.target.value)} placeholder={f.hint} /></label>)}</div>
            <label>What the body is meant to have, one per line, so it is not read as a mistake<textarea rows={3} value={anatomyText} onChange={(e) => setAnatomy(e.target.value)} placeholder={"fingers: six on each hand\nthe left arm a hand longer"} /></label>
            <div className="wd-fields">
              <label>Symmetry<select value={spec.symmetry ?? "mixed"} onChange={(e) => setDraft((d) => editDraft(d, { symmetry: e.target.value as TransformationSpec["symmetry"] }))}>{symmetryChoices.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
              <label>The costume<select value={spec.costume ?? "keep"} onChange={(e) => setDraft((d) => editDraft(d, { costume: e.target.value as TransformationSpec["costume"] }))}>{costumeChoices.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
              <label>How strong may it be<select value={spec.audience ?? "teen"} onChange={(e) => setDraft((d) => editDraft(d, { audience: e.target.value as TransformationSpec["audience"] }))}>{audienceChoices.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
            </div>
            {mentionsSide(spec.details?.anatomy, spec.details?.surface, spec.details?.features, spec.details?.differences, anchorText, anatomyText) && <p className="helper warn" role="note">{sideCheckWarning}</p>}
            {!characterPicture && <p className="helper warn">Approve {character.name}'s front view first (Sheets, Identity). Every stage is made from it.</p>}
            {characterPicture && !capability.ok && <p className="helper warn">{capability.message}</p>}
            <div className="wd-actions">
              <button className="primary" onClick={makeCandidates} disabled={!characterPicture || !capability.ok}>
                <Sparkles size={15} aria-hidden="true" /> {entity ? "Save as a new version and preview" : "Make candidates"} · {cost.label}
              </button>
              <span className="helper">{draft.edits > 0 ? "Settings changed here only. Nothing is made until you press the button." : `Uses ${modelId} on ${providerLabels[provider]}. The sliders cost nothing.`}</span>
            </div>
          </div>

          {entity && newest && (
            <div className="wd-candidates" aria-live="polite">
              <h3>{entity.name}, version {newest.n} <span className={`wd-badge ${newest.status}`}>{newest.status === "approved" ? "Approved" : newest.status === "rejected" ? "Turned down" : "Waiting for your decision"}</span></h3>
              {stand && <p className="helper">{stand.next}</p>}
              <div className="wd-compare">
                <figure><Picture job={queue.jobs.find((j) => j.outputPath === sourcePath)} label="Source" /><figcaption>{sourceLabel}</figcaption></figure>
                <figure><Picture job={front} label="Full body" /><figcaption>{(newest.spec as TransformationSpec).stage} · full body{front?.approved ? " · Approved" : front?.rejected ? " · Turned down" : ""}</figcaption>
                  {front?.outputPath && newest.status === "candidate" && <div className="wd-decide"><button className="primary" onClick={() => decide(front, true)}><Check size={14} aria-hidden="true" /> Approve this stage</button><button onClick={() => decide(front, false)} aria-label="Turn down this stage"><X size={14} aria-hidden="true" /></button></div>}
                </figure>
                <figure><Picture job={portrait} label="Portrait" /><figcaption>{(newest.spec as TransformationSpec).stage} · portrait{portrait?.approved ? " · Approved" : ""}</figcaption></figure>
              </div>
              <details className="wd-checks" open={report.state === "needs-review"}>
                <summary>Setting checks: {report.state === "needs-review" ? "Needs review" : "Passed for the checks performed"}</summary>
                <p className="helper">{report.summary}</p>
                <ul>{report.checks.map((c) => <li key={c.id} className={c.result}><b>{c.result === "pass" ? "Passed" : c.result === "fail" ? "Needs a look" : "Not checked"}</b> {c.label}. {c.detail}</li>)}</ul>
              </details>
              <ol className="wd-history" aria-label="Versions">
                {entity.revisions.map((r) => <li key={r.n}>Version {r.n}: intensity {(r.spec as TransformationSpec).intensity ?? "?"}, {r.status === "approved" ? "approved" : r.status === "rejected" ? "turned down" : "candidate"}</li>)}
              </ol>
              {approvedVariant && <div className="wd-actions"><span className="helper">Approved as “{approvedVariant}”. It is now a look for {character.name}. Start the next stage from “New stage”.</span><button onClick={() => props.onOpenSheets(approvedVariant)}>Make reference sheets for this stage</button></div>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
