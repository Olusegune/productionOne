import { useMemo, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Layers, AlertTriangle, Check, RefreshCw, LayoutGrid } from "lucide-react";
import { anchorFor, type ImageJob, type QueueState } from "../domain/generationQueue";
import type { ExtractedAsset } from "../domain/productionStudio";
import { stalenessOf } from "../domain/variationGraph";
import { canApprove, checkComposition, composeLook, lookQueueVariant, type ComposeInput } from "../domain/lookComposer";
import { refreshLook, regenerationPlan } from "../domain/regeneration";
import { lookForScene } from "../domain/lookAssignments";
import { ageComparison, conditionComparison, transformationComparison, type ComparisonSheet } from "../domain/variationManifest";
import { approvedPicture, findEntity, latestApproved, type ConditionSpec, type FitSpec, type GarmentSpec, type LookSpec, type Ref, type TransformationSpec, type VariationState } from "../domain/variations";
import "../wardrobe.css";

export interface LooksStudioProps {
  character: ExtractedAsset;
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  queue: QueueState;
  desktop: boolean;
  notify: (message: string) => void;
  scenes?: Array<{ id: string; heading?: string }>;
  /** Jumps to another tab of the character (the studio that can fix something). */
  onOpenSection: (section: "wardrobe" | "age" | "transform") => void;
  onOpenSheets: (variant: string) => void;
}

const nowIso = () => new Date().toISOString();
const NONE = "";
const parse = (v: string): Ref | undefined => { if (!v) return undefined; const [id, rev] = v.split("@"); return { id, revision: Number(rev) }; };
const key = (r: Ref) => `${r.id}@${r.revision}`;

export function LooksStudio(props: LooksStudioProps) {
  const { character, variations, updateVariations, queue, desktop, notify } = props;
  const mine = variations.entities.filter((e) => e.characterId === character.id);
  const latest = (id: string): Ref | undefined => { const e = findEntity(variations, id); const l = e && latestApproved(e); return l ? { id, revision: l.n } : undefined; };

  const ages = mine.filter((e) => e.kind === "age" && latestApproved(e));
  const stages = mine.filter((e) => e.kind === "transformation" && latestApproved(e));
  const fits = mine.filter((e) => e.kind === "fit" && latestApproved(e));
  const conditions = variations.entities.filter((e) => e.kind === "condition" && latestApproved(e));
  const accessories = variations.entities.filter((e) => e.kind === "garment" && latestApproved(e) && /^(accessory|headwear|footwear)$/i.test((latestApproved(e)!.spec as GarmentSpec).category ?? ""));
  const looks = mine.filter((e) => e.kind === "look");

  const [name, setName] = useState("");
  const [body, setBody] = useState(NONE);
  const [fit, setFit] = useState(NONE);
  const [condition, setCondition] = useState(NONE);
  const [acc, setAcc] = useState<string[]>([]);
  const [sceneIds, setSceneIds] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);

  const input: ComposeInput = useMemo(() => {
    const b = parse(body);
    const bodyKind = b ? findEntity(variations, b.id)?.kind : undefined;
    return { characterId: character.id, name, ...(b && bodyKind === "age" ? { age: b } : {}), ...(b && bodyKind === "transformation" ? { transformation: b } : {}), ...(parse(fit) ? { fit: parse(fit) } : {}), ...(parse(condition) ? { condition: parse(condition) } : {}), ...(acc.length ? { accessories: acc.map((a) => parse(a)!) } : {}), ...(sceneIds.length ? { sceneIds } : {}) };
  }, [body, fit, condition, acc, sceneIds, name, variations, character.id]);
  const conflicts = useMemo(() => checkComposition(variations, input), [variations, input]);
  const ok = canApprove(conflicts, accepted) && !!name.trim() && (!!input.fit || !!input.age || !!input.transformation);

  // Choosing an outfit fills in the body and condition it was made for, so the common case has no conflict to resolve.
  const chooseFit = (v: string) => {
    setFit(v); setAccepted([]);
    const f = parse(v);
    const spec = f ? (findEntity(variations, f.id)?.revisions.find((r) => r.n === f.revision)?.spec as FitSpec | undefined) : undefined;
    setBody(spec?.body ? key(spec.body) : NONE);
    setCondition(spec?.condition ? key(spec.condition) : NONE);
  };

  const pictureOf = (ref: Ref | undefined): string | undefined => {
    if (!ref) return undefined;
    const rev = findEntity(variations, ref.id)?.revisions.find((r) => r.n === ref.revision);
    return rev ? approvedPicture(rev)?.path : undefined;
  };
  const parts: Array<{ label: string; ref?: Ref }> = [
    { label: input.age ? "Age" : input.transformation ? "Stage" : "Body", ref: input.age ?? input.transformation },
    { label: "Outfit", ref: input.fit },
    { label: "Condition", ref: input.condition },
    ...(input.accessories ?? []).map((a) => ({ label: "Accessory", ref: a })),
  ];

  const approveLook = () => {
    try {
      // Compose first (it refuses on a conflict), so a failure is reported and nothing is saved.
      const made = composeLook(variations, input, nowIso(), accepted);
      updateVariations(() => made.variations);
      notify(`“${name.trim()}” is approved as a look for ${character.name}, pinned to the versions you chose.`);
      setName(""); setAccepted([]);
    } catch (e) { notify((e as Error).message); }
  };

  const plan = useMemo(() => regenerationPlan(variations), [variations]);
  const myStale = plan.steps.filter((s) => { const e = findEntity(variations, s.entityId); return e?.characterId === character.id || e?.kind === "condition" || e?.kind === "garment"; });
  const sectionFor = (kind: string): "wardrobe" | "age" | "transform" => (kind === "age" ? "age" : kind === "transformation" ? "transform" : "wardrobe");
  const refresh = (lookId: string) => {
    try { const made = refreshLook(variations, lookId, nowIso()); updateVariations(() => made.variations); notify("The look now points at the newest approved versions of its parts."); } catch (e) { notify((e as Error).message); }
  };

  const basePath = anchorFor(queue, { assetId: character.id, variant: "Canonical" } as ImageJob);
  const exportSheet = async (sheet: ComparisonSheet) => {
    if (sheet.cells.length < 2) { notify("There is nothing to compare yet: approve at least one more picture."); return; }
    try {
      const path = await invoke<string>("export_contact_sheet", { title: sheet.title, cells: sheet.cells, columns: sheet.columns });
      notify(`Saved ${sheet.title}: ${path}`);
    } catch (e) { notify(String(e)); }
  };
  const kinds = [...new Set(stages.map((s) => (latestApproved(s)!.spec as TransformationSpec).kind))];
  const garmentsWithConditions = [...new Set(conditions.map((c) => (latestApproved(c)!.spec as ConditionSpec).garment.id))];

  const lookParts = (l: (typeof looks)[number]): string => {
    const spec = latestApproved(l)?.spec as LookSpec | undefined;
    if (!spec) return "Not approved yet";
    const bits = [spec.age && findEntity(variations, spec.age.id)?.name, spec.transformation && findEntity(variations, spec.transformation.id)?.name, spec.fit && "outfit", spec.condition && findEntity(variations, spec.condition.id)?.name, spec.accessories?.length ? `${spec.accessories.length} accessor${spec.accessories.length === 1 ? "y" : "ies"}` : ""].filter(Boolean);
    return bits.length ? bits.join(" · ") : "The character as approved";
  };

  return (
    <section className="panel wd" aria-label="Looks and continuity">
      <header className="wd-head"><div><h2><Layers size={18} aria-hidden="true" /> Looks and continuity</h2><p className="helper">A look is an approved combination of a body, an outfit, a condition and accessories, pinned to the exact versions you chose. Nothing is made for you: you pick the parts, clashes are shown, and you approve.</p></div></header>

      {myStale.length > 0 && (
        <div className="wd-stale" role="region" aria-label="Needs updating">
          <h3><AlertTriangle size={16} aria-hidden="true" /> Needs updating ({myStale.length})</h3>
          <p className="helper">Something these were made from has a newer approved version. Only these are affected; {plan.untouchedApprovals} other approved item{plan.untouchedApprovals === 1 ? " is" : "s are"} untouched. Remake from the top of the list down.</p>
          <ol>
            {myStale.map((s) => (
              <li key={key(s.ref)}>
                <b>{s.name}</b> — {s.action}
                <small>{s.because.join(" ")}</small>
                <span className="wd-actions">
                  {s.kind === "look" ? <button onClick={() => refresh(s.entityId)}><RefreshCw size={13} aria-hidden="true" /> Bring up to date</button> : <button onClick={() => props.onOpenSection(sectionFor(s.kind))}>Open the studio</button>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="wd-body">
        <nav className="wd-library" aria-label="Looks">
          <p className="helper"><b>{character.name}'s looks</b></p>
          {looks.length === 0 && <p className="helper">No looks yet. Approve an outfit, an age or a stage and it becomes one, or compose one here.</p>}
          {looks.map((l) => {
            const rev = latestApproved(l);
            const stale = rev ? stalenessOf(variations, { id: l.id, revision: rev.n }).stale : false;
            const spec = rev?.spec as LookSpec | undefined;
            return (
              <div className="wd-lookrow" key={l.id}>
                <b>{l.name}</b>
                <small>{lookParts(l)}</small>
                <small>{rev ? `Version ${rev.n}` : "Candidate"}{stale ? " · Out of date" : ""}{spec?.sceneIds?.length ? ` · ${spec.sceneIds.length} scene${spec.sceneIds.length === 1 ? "" : "s"}` : ""}</small>
                {spec?.queueVariant && spec.queueVariant !== "Canonical" && <button onClick={() => props.onOpenSheets(spec.queueVariant!)}>Open its sheets</button>}
              </div>
            );
          })}
        </nav>

        <div className="wd-work">
          <div className="wd-design">
            <h3>Compose a look</h3>
            <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="for example Mara at 65, rain-soaked" /></label>
            <div className="wd-fields">
              <label>Outfit<select value={fit} onChange={(e) => chooseFit(e.target.value)}><option value={NONE}>No outfit</option>{fits.map((f) => <option key={f.id} value={key(latest(f.id)!)}>{f.name}</option>)}</select></label>
              <label>Body<select value={body} onChange={(e) => { setBody(e.target.value); setAccepted([]); }}><option value={NONE}>{character.name}, as approved</option>{ages.length > 0 && <optgroup label="Ages">{ages.map((a) => <option key={a.id} value={key(latest(a.id)!)}>{a.name}</option>)}</optgroup>}{stages.length > 0 && <optgroup label="Transformation stages">{stages.map((a) => <option key={a.id} value={key(latest(a.id)!)}>{a.name}</option>)}</optgroup>}</select></label>
              <label>Condition<select value={condition} onChange={(e) => { setCondition(e.target.value); setAccepted([]); }}><option value={NONE}>Pristine</option>{conditions.map((c) => <option key={c.id} value={key(latest(c.id)!)}>{c.name}</option>)}</select></label>
            </div>
            {accessories.length > 0 && (
              <fieldset className="wd-keep"><legend>Accessories</legend>
                {accessories.map((a) => <label key={a.id}><input type="checkbox" checked={acc.includes(key(latest(a.id)!))} onChange={(e) => { const k = key(latest(a.id)!); setAcc((cur) => (e.target.checked ? [...cur, k] : cur.filter((x) => x !== k))); setAccepted([]); }} /> {a.name}</label>)}
              </fieldset>
            )}
            {(props.scenes?.length ?? 0) > 0 && (
              <fieldset className="wd-keep"><legend>Worn in these scenes</legend>
                {props.scenes!.map((sc) => <label key={sc.id}><input type="checkbox" checked={sceneIds.includes(sc.id)} onChange={(e) => setSceneIds((cur) => (e.target.checked ? [...cur, sc.id] : cur.filter((x) => x !== sc.id)))} /> {sc.heading ?? sc.id}</label>)}
              </fieldset>
            )}

            <div className="wd-parts" aria-label="Preview of the combination">
              {parts.filter((p) => p.ref).map((p, i) => {
                const pic = pictureOf(p.ref);
                return <figure key={i}>{pic ? <img src={convertFileSrc(pic)} alt={p.label} /> : <div className="wd-empty">No picture</div>}<figcaption>{p.label}: {findEntity(variations, p.ref!.id)?.name} (v{p.ref!.revision})</figcaption></figure>;
              })}
              {parts.every((p) => !p.ref) && <p className="helper">Choose an outfit, an age or a stage to start.</p>}
            </div>
            {input.fit && <p className="helper">The look's picture is the approved outfit picture: {pictureOf(input.fit) ? "present" : "none yet"}. {lookQueueVariant(variations, input) !== "Canonical" ? `Its sheets are made under “${lookQueueVariant(variations, input)}”.` : ""}</p>}

            {conflicts.length > 0 && (
              <ul className="wd-conflicts" aria-label="Conflicts">
                {conflicts.map((c) => (
                  <li key={c.id} className={c.severity}>
                    <b>{c.severity === "blocks" ? "Cannot be approved" : "Check this"}</b> {c.message}
                    {c.fix && <small>{c.fix}</small>}
                    {c.severity === "warns" && <label><input type="checkbox" checked={accepted.includes(c.id)} onChange={(e) => setAccepted((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id)))} /> I have seen this and accept it</label>}
                  </li>
                ))}
              </ul>
            )}
            <div className="wd-actions">
              <button className="primary" onClick={approveLook} disabled={!ok}><Check size={15} aria-hidden="true" /> Approve this look</button>
              <span className="helper">{conflicts.some((c) => c.severity === "blocks") ? "Fix what blocks it first." : conflicts.length ? "Accept each warning to approve." : "Nothing clashes."}</span>
            </div>
          </div>

          {(props.scenes?.length ?? 0) > 0 && looks.some((l) => latestApproved(l)) && (
            <div className="wd-design">
              <h3>In the story</h3>
              <ul className="wd-scenes">
                {props.scenes!.map((sc) => {
                  const l = lookForScene(variations, character.id, sc.id);
                  return <li key={sc.id}><b>{sc.heading ?? sc.id}</b>: {l ? l.name : "no look assigned"}</li>;
                })}
              </ul>
              <p className="helper">Assign a look to scenes from the outfit's screen or by composing it above. The Director's room warns when a shot uses a different one.</p>
            </div>
          )}

          {desktop && (
            <div className="wd-design">
              <h3>Comparison sheets</h3>
              <p className="helper">One labelled image with every approved picture side by side. Each label carries its version id.</p>
              <div className="wd-actions">
                <button onClick={() => void exportSheet(ageComparison(variations, character.name, character.id, basePath, queue.jobs))} disabled={ages.length === 0}><LayoutGrid size={14} aria-hidden="true" /> Age comparison</button>
                {kinds.map((k) => <button key={k} onClick={() => void exportSheet(transformationComparison(variations, character.name, character.id, k, basePath, queue.jobs))}><LayoutGrid size={14} aria-hidden="true" /> {k} stages</button>)}
                {garmentsWithConditions.map((g) => <button key={g} onClick={() => void exportSheet(conditionComparison(variations, g, queue.jobs))}><LayoutGrid size={14} aria-hidden="true" /> {findEntity(variations, g)?.name} conditions</button>)}
                {ages.length === 0 && kinds.length === 0 && garmentsWithConditions.length === 0 && <span className="helper">Make an age, a transformation stage or a condition first.</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
