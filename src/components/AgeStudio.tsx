import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Sparkles, Check, X, Plus, UserPlus, ChevronDown, ChevronRight, Hourglass } from "lucide-react";
import { useModelChoice } from "../data/modelChoice";
import { modelTakesReferences, providerLabels } from "../domain/imageCatalog";
import { anchorFor, approve, costPreview, enqueue, reject, type ImageJob, type QueueState } from "../domain/generationQueue";
import type { ExtractedAsset } from "../domain/productionStudio";
import { styleFingerprint } from "../domain/style2d";
import type { StyleBible } from "../domain/visualDevelopment";
import { editDraft, startDraft, standingOf, type Draft } from "../domain/candidateFlow";
import { ageAdjustmentList, ageCapability, ageDirection, ageKeepChoices, ageModes, ageRequests, ageViews, checkAgeSpec, defaultAgeKeep } from "../domain/age";
import { agePicture, agesOf, newAgeVariant, newRelative } from "../domain/ageFlow";
import { findEntity, latestApproved, type AgeSpec, type VariationState } from "../domain/variations";
import { Picture } from "./wardrobeParts";
import "../wardrobe.css";

export interface AgeStudioProps {
  character: ExtractedAsset;
  assets: ExtractedAsset[];
  setAssets: (update: (assets: ExtractedAsset[]) => ExtractedAsset[]) => void;
  /** Opens another character in the studio (used after making a relative). */
  onOpenAsset: (assetId: string) => void;
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

type Mode = AgeSpec["mode"] | "relative";
const nowIso = () => new Date().toISOString();
const baseSpec = (character: ExtractedAsset): Omit<AgeSpec, "characterId" | "variant"> => ({ mode: "same-person", targetAge: String((/\d+/.exec(character.age ?? "") ? Number(/\d+/.exec(character.age ?? "")![0]) : 30) + 25), keep: [...defaultAgeKeep], anchors: [], adjustments: {} });

export function AgeStudio(props: AgeStudioProps) {
  const { character, variations, updateVariations, queue, setQueue, style: projectStyle, desktop, notify } = props;
  const style = character.style ?? projectStyle;
  const choice = useModelChoice(desktop, props.providersVersion);
  const { provider, modelId, configured } = choice;
  const takesRefs = modelTakesReferences(provider, modelId);
  const capability = ageCapability(takesRefs);
  const cost = costPreview(ageViews.length, queue.perImageUsd);

  const variants = agesOf(variations, character.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("same-person");
  // The settings live in a local draft. Moving the slider edits only this: no record is made and nothing is requested until the button is pressed.
  const [draft, setDraft] = useState<Draft<AgeSpec>>(() => startDraft("age", { ...baseSpec(character), characterId: character.id } as AgeSpec));
  const [more, setMore] = useState(false);
  const [anchorText, setAnchorText] = useState("");
  const [relName, setRelName] = useState("");
  const [relation, setRelation] = useState("daughter");

  const characterPicture = anchorFor(queue, { assetId: character.id, variant: "Canonical" } as ImageJob);
  const spec = draft.spec;
  const direction = ageDirection(character.age, spec.targetAge);
  const entity = selected ? findEntity(variations, selected) : undefined;
  const newest = entity?.revisions[entity.revisions.length - 1];
  const jobsOf = (id: string, revision: number) => queue.jobs.filter((j) => j.variation?.id === id && j.variation.revision === revision);
  const candidates = entity && newest ? jobsOf(entity.id, newest.n) : [];
  const unchanged = !!newest && JSON.stringify({ ...(newest.spec as AgeSpec), variant: undefined }) === JSON.stringify({ ...spec, variant: undefined });

  const open = (id: string | null) => {
    setSelected(id);
    const e = id ? findEntity(variations, id) : undefined;
    const last = e?.revisions[e.revisions.length - 1];
    const s = last ? (last.spec as AgeSpec) : ({ ...baseSpec(character), characterId: character.id } as AgeSpec);
    setMode(s.mode); setDraft(startDraft("age", s, e && last ? { id: e.id, revision: last.n } : undefined)); setAnchorText((s.anchors ?? []).join("; "));
  };
  const setAdjustment = (key: string, value: string) => setDraft((d) => editDraft(d, { adjustments: { ...(d.spec.adjustments ?? {}), [key]: value } }));
  const setAnchors = (text: string) => { setAnchorText(text); setDraft((d) => editDraft(d, { anchors: text.split(";").map((x) => x.trim()).filter(Boolean) })); };

  const ready = (): boolean => {
    if (desktop && choice.keysChecked && !configured[provider]) { notify(`There is no ${providerLabels[provider]} key yet. Add it, then generation starts.`); props.openProviders(); return false; }
    return true;
  };

  const makeCandidate = () => {
    if (mode === "relative") return;
    if (!characterPicture) { notify(`Approve ${character.name}'s front view first (Sheets, Identity).`); return; }
    if (!capability.ok) { notify(capability.message); return; }
    const report = checkAgeSpec(character, { ...spec, mode });
    const bad = report.checks.find((c) => c.result === "fail");
    if (bad) { notify(`${bad.label}: ${bad.detail}`); return; }
    if (!ready()) return;
    const { characterId: _c, variant: _v, ...rest } = spec;
    const made = newAgeVariant(variations, { character, spec: { ...rest, mode }, now: nowIso() });
    updateVariations(() => made.variations);
    setSelected(made.ref.id);
    const saved = findEntity(made.variations, made.ref.id)!.revisions.find((r) => r.n === made.ref.revision)!.spec as AgeSpec;
    const requests = ageRequests({ style, provider, model: modelId, character, lookName: made.variant, age: made.ref, spec: saved, characterPicture, styleFp: styleFingerprint(style) });
    const result = enqueue(queue, requests, Date.now(), true);
    setQueue(() => result.state);
    notify(`Making ${result.added} picture${result.added === 1 ? "" : "s"} of ${character.name} at ${spec.targetAge}…`);
  };

  const makeRelative = () => {
    if (!relName.trim()) { notify("Give the relative a name."); return; }
    const made = newRelative(props.assets, character, { name: relName, relation });
    props.setAssets(() => made.assets);
    notify(`${made.asset.name} is a new character, linked to ${character.name} as ${character.name}'s ${relation}. Make their identity the usual way.`);
    props.onOpenAsset(made.asset.id);
  };

  const decide = (job: ImageJob, yes: boolean) => {
    if (yes) { setQueue((q) => approve(q, job.id)); props.onApproved(job, job.viewKey === "full-front"); } else { setQueue((q) => reject(q, job.id)); if (job.approved) props.onUnapproved(job); }
  };
  const report = newest && entity ? checkAgeSpec(character, newest.spec as AgeSpec) : checkAgeSpec(character, { ...spec, mode: mode === "relative" ? "same-person" : mode });
  const front = candidates.find((j) => j.viewKey === "full-front");
  const portrait = candidates.find((j) => j.viewKey === "portrait");
  const stand = newest ? standingOf(newest, { hasSource: true }) : undefined;
  const approvedVariant = entity && latestApproved(entity) ? (latestApproved(entity)!.spec as AgeSpec).variant : undefined;
  const target = Number(/\d+/.exec(spec.targetAge)?.[0] ?? 30);

  return (
    <section className="panel wd" aria-label="Age and appearance">
      <header className="wd-head"><div><h2><Hourglass size={18} aria-hidden="true" /> Age and appearance</h2><p className="helper">Make {character.name} younger or older. The approved picture is the starting point, and what you say must stay recognisable is kept.</p></div></header>
      <div className="wd-body">
        <nav className="wd-library" aria-label="Ages">
          <button className={`wd-new${selected === null ? " on" : ""}`} onClick={() => open(null)}><Plus size={15} aria-hidden="true" /> New age</button>
          {variants.length === 0 && <p className="helper">No ages yet. {character.name} is shown at {character.age ?? "their current age"}.</p>}
          {variants.map((v) => {
            const last = v.revisions[v.revisions.length - 1];
            const best = latestApproved(v);
            const thumb = best ? agePicture(variations, v.id)?.path : last.media[0]?.path;
            return (
              <button key={v.id} className={`wd-card${selected === v.id ? " on" : ""}`} onClick={() => open(v.id)} aria-label={`${v.name}, ${best ? "approved" : "not approved yet"}`}>
                {thumb ? <img src={convertFileSrc(thumb)} alt="" /> : <span className="wd-thumb" aria-hidden="true"><Hourglass size={20} /></span>}
                <span><b>{v.name}</b><small>{best ? `Approved · version ${best.n}` : "Candidate"}</small></span>
              </button>
            );
          })}
        </nav>
        <div className="wd-work">
          <fieldset className="wd-keep" aria-label="What to make"><legend>What do you want?</legend>
            {ageModes.map((m) => <label key={m.key} title={m.help}><input type="radio" name="age-mode" checked={mode === m.key} disabled={!!entity && m.key === "relative"} onChange={() => { setMode(m.key); if (m.key !== "relative") setDraft((d) => editDraft(d, { mode: m.key as AgeSpec["mode"] })); }} /> {m.label}</label>)}
          </fieldset>
          <p className="helper">{ageModes.find((m) => m.key === mode)?.help}</p>

          {mode === "relative" ? (
            <div className="wd-design">
              <h3>A relative of {character.name}</h3>
              <label>Name<input value={relName} onChange={(e) => setRelName(e.target.value)} placeholder="for example Elsie" /></label>
              <label>Relation to {character.name}<select value={relation} onChange={(e) => setRelation(e.target.value)}>{["daughter", "son", "mother", "father", "sister", "brother", "grandchild", "grandparent", "cousin", "relative"].map((r) => <option key={r}>{r}</option>)}</select></label>
              <div className="wd-actions"><button className="primary" onClick={makeRelative}><UserPlus size={15} aria-hidden="true" /> Make a new character</button><span className="helper">This costs nothing. It adds a separate character; make their identity the usual way.</span></div>
            </div>
          ) : (
            <div className="wd-design">
              <h3>{entity ? entity.name : `${character.name} at another age`}</h3>
              <div className="wd-age-target">
                <div className="wd-age-slider"><span>Target age</span><input type="range" min={1} max={100} value={Math.min(100, Math.max(1, target))} onChange={(e) => setDraft((d) => editDraft(d, { targetAge: e.target.value }))} aria-label="Target age slider" /></div>
                <input type="number" min={1} max={120} value={spec.targetAge} onChange={(e) => setDraft((d) => editDraft(d, { targetAge: e.target.value }))} aria-label="Target age" />
                <span className="helper">{direction === "older" ? `Older than now (${character.age}).` : direction === "younger" ? `Younger than now (${character.age}).` : direction === "same" ? "The same as now." : "Now: " + (character.age ?? "not set") + "."}</span>
              </div>
              <label>What must stay recognisable (separate with ;)<input value={anchorText} onChange={(e) => setAnchors(e.target.value)} placeholder="the scar through the left eyebrow; the strong jaw" /></label>
              <fieldset className="wd-keep"><legend>What must stay exactly the same</legend>
                {ageKeepChoices.map((k) => <label key={k.key}><input type="checkbox" checked={(spec.keep ?? []).includes(k.key)} onChange={(e) => setDraft((d) => editDraft(d, { keep: e.target.checked ? [...(d.spec.keep ?? []), k.key] : (d.spec.keep ?? []).filter((x) => x !== k.key) }))} /> {k.label}</label>)}
              </fieldset>
              <button className="wd-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>{more ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />} More controls</button>
              {more && <div className="wd-fields">{ageAdjustmentList.map((a) => <label key={a.key}>{a.label}<input value={spec.adjustments?.[a.key] ?? ""} onChange={(e) => setAdjustment(a.key, e.target.value)} placeholder={a.hint} /></label>)}</div>}
              {!characterPicture && <p className="helper warn">Approve {character.name}'s front view first (Sheets, Identity). The age picture is made from it.</p>}
              {characterPicture && !capability.ok && <p className="helper warn">{capability.message}</p>}
              <div className="wd-actions">
                <button className="primary" onClick={makeCandidate} disabled={!characterPicture || !capability.ok}>
                  <Sparkles size={15} aria-hidden="true" /> {entity && unchanged ? "Make more candidates" : entity ? "Save as a new version and preview" : "Make candidates"} · {cost.label}
                </button>
                <span className="helper">{draft.edits > 0 ? "Settings changed here only. Nothing is made until you press the button." : `Uses ${modelId} on ${providerLabels[provider]}. Moving the slider costs nothing.`}</span>
              </div>
            </div>
          )}

          {mode !== "relative" && entity && newest && (
            <div className="wd-candidates" aria-live="polite">
              <h3>{entity.name}, version {newest.n} <span className={`wd-badge ${newest.status}`}>{newest.status === "approved" ? "Approved" : newest.status === "rejected" ? "Turned down" : "Waiting for your decision"}</span></h3>
              {stand && <p className="helper">{stand.next}</p>}
              <div className="wd-compare">
                <figure><Picture job={queue.jobs.find((j) => j.outputPath === characterPicture)} label="Source" /><figcaption>{character.name}, approved{character.age ? ` · ${character.age}` : ""}</figcaption></figure>
                <figure><Picture job={front} label="Full body" /><figcaption>At {(newest.spec as AgeSpec).targetAge} · full body{front?.approved ? " · Approved" : front?.rejected ? " · Turned down" : ""}</figcaption>
                  {front?.outputPath && newest.status === "candidate" && <div className="wd-decide"><button className="primary" onClick={() => decide(front, true)}><Check size={14} aria-hidden="true" /> Approve this age</button><button onClick={() => decide(front, false)} aria-label="Turn down this age"><X size={14} aria-hidden="true" /></button></div>}
                </figure>
                <figure><Picture job={portrait} label="Portrait" /><figcaption>At {(newest.spec as AgeSpec).targetAge} · portrait{portrait?.approved ? " · Approved" : ""}</figcaption></figure>
              </div>
              <details className="wd-checks" open={report.state === "needs-review"}>
                <summary>Setting checks: {report.state === "needs-review" ? "Needs review" : "Passed for the checks performed"}</summary>
                <p className="helper">{report.summary}</p>
                <ul>{report.checks.map((c) => <li key={c.id} className={c.result}><b>{c.result === "pass" ? "Passed" : c.result === "fail" ? "Needs a look" : "Not checked"}</b> {c.label}. {c.detail}</li>)}</ul>
              </details>
              <ol className="wd-history" aria-label="Versions">
                {entity.revisions.map((r) => <li key={r.n}>Version {r.n}: age {(r.spec as AgeSpec).targetAge}, {r.status === "approved" ? "approved" : r.status === "rejected" ? "turned down" : "candidate"}</li>)}
              </ol>
              {approvedVariant && <div className="wd-actions"><span className="helper">Approved as “{approvedVariant}”. It is now a look for {character.name}.</span><button onClick={() => props.onOpenSheets(approvedVariant)}>Make reference sheets for this age</button></div>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
