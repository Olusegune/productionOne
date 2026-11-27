import { useMemo, useState } from "react";
import { AlertTriangle, Check, Link2, X } from "lucide-react";
import type { ExtractedAsset } from "../domain/productionStudio";
import type { SceneState } from "../domain/sceneState";
import { reasonText } from "../domain/regeneration";
import { addRelationship, describeRelationship, proposeFromScene, relationshipConflicts, relationshipViews, VERBS } from "../domain/relationships";
import { addRevision, approveRevision, findEntity, latestApproved, rejectRevision, type Ref, type RelationshipSpec, type Subject, type VariationState } from "../domain/variations";
import "../wardrobe.css";

export interface RelationshipsStudioProps {
  asset: ExtractedAsset;
  assets: ExtractedAsset[];
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  sceneStates?: Record<string, SceneState>;
  scenes?: Array<{ id: string; heading?: string }>;
  notify: (message: string) => void;
}

const nowIso = () => new Date().toISOString();

/** The ways to say how this asset relates to another. Each builds the record in the order "a does something to b". */
const WAYS: Array<{ id: string; label: string; build: (me: string, other: string, ratio: number) => RelationshipSpec }> = [
  { id: "owns", label: "owns", build: (me, o) => ({ relation: "ownership", a: { asset: me }, b: { asset: o }, exclusive: true, basis: "declared" }) },
  { id: "belongs", label: "belongs to", build: (me, o) => ({ relation: "ownership", a: { asset: o }, b: { asset: me }, exclusive: true, basis: "declared" }) },
  ...VERBS.map((v) => ({ id: v, label: v === "sit" ? "sits on" : v === "hold" ? "holds" : v === "wear" ? "wears" : v === "operate" ? "operates" : v === "open" ? "opens" : "carries", build: (me: string, o: string): RelationshipSpec => ({ relation: "interaction", a: { asset: me }, b: { asset: o }, verb: v, basis: "declared" }) })),
  { id: "scale", label: "is this many times the height of", build: (me, o, ratio) => ({ relation: "scale", a: { asset: me }, b: { asset: o }, ratio, basis: "declared" }) },
  { id: "attach", label: "is attached to", build: (me, o) => ({ relation: "attachment", a: { asset: me }, b: { asset: o }, basis: "declared" }) },
];

export function RelationshipsStudio({ asset, assets, variations, updateVariations, sceneStates, scenes, notify }: RelationshipsStudioProps) {
  const nameOf = (id: string) => assets.find((a) => a.id === id)?.name ?? id;
  const all = useMemo(() => relationshipViews(variations), [variations]);
  const mine = all.filter((v) => v.spec.a.asset === asset.id || v.spec.b.asset === asset.id);
  const conflicts = useMemo(() => relationshipConflicts(variations, nameOf).filter((c) => c.refs.some((r) => mine.some((m) => m.ref.id === r.id))), [variations, mine, assets]);
  // Only offer things that make sense for the sentence: owners are characters, sizes compare characters and props, and nobody sits on a person.
  const fits = (wayId: string, a: ExtractedAsset) => (wayId === "belongs" ? a.type === "character" : wayId === "scale" ? a.type === "character" || a.type === "prop" : wayId === "attach" ? true : a.type !== "character");

  const [way, setWay] = useState("owns");
  const [other, setOther] = useState("");
  const [ratio, setRatio] = useState("1");
  const [pinText, setPinText] = useState("");
  const [sceneIds, setSceneIds] = useState<string[]>([]);

  // The versions of this character this could be pinned to: only approved ones, so the relationship follows a body that exists.
  const pins = variations.entities.filter((e) => (e.kind === "age" || e.kind === "transformation") && e.characterId === asset.id && latestApproved(e));
  const ratioNumber = Number(ratio);
  const chosen = WAYS.find((w) => w.id === way)!;
  const draft = other ? chosen.build(asset.id, other, ratioNumber) : undefined;
  const preview = draft ? describeRelationship(draft, nameOf) : "";

  const add = () => {
    if (!draft) return;
    const spec: RelationshipSpec = { ...draft, ...(sceneIds.length ? { sceneIds } : {}) };
    if (pinText) {
      const [id, rev] = pinText.split("@");
      const pin: Ref = { id, revision: Number(rev) };
      const side: "a" | "b" = spec.a.asset === asset.id ? "a" : "b";
      spec[side] = { ...spec[side], pin } as Subject;
    }
    const made = addRelationship(variations, spec, nameOf, nowIso());
    if ("error" in made) { notify(made.error); return; }
    updateVariations((v) => { const r = addRelationship(v, spec, nameOf, nowIso()); return "error" in r ? v : r.state; });
    notify(`Recorded as a candidate: ${describeRelationship(spec, nameOf)}. Approve it for it to count.`);
    setOther(""); setPinText(""); setSceneIds([]);
  };

  // What the scenes already say, so a person can keep it instead of typing it again.
  const proposals = useMemo(() => {
    const out: Array<{ sceneId: string; spec: RelationshipSpec }> = [];
    for (const [sceneId, s] of Object.entries(sceneStates ?? {})) for (const spec of proposeFromScene(s.world, variations, sceneId)) if (spec.a.asset === asset.id || spec.b.asset === asset.id) out.push({ sceneId, spec });
    return out;
  }, [sceneStates, variations, asset.id]);

  const decide = (ref: Ref, to: "approve" | "reject") => updateVariations((v) => { try { return to === "approve" ? approveRevision(v, ref) : rejectRevision(v, ref); } catch { return v; } });

  /** Confirms a relationship that has gone out of date still holds: a new version pinned to the newest approved versions, for the person to approve. */
  const reconfirm = (ref: Ref) => {
    updateVariations((v) => {
      const entity = findEntity(v, ref.id);
      const rev = entity?.revisions.find((r) => r.n === ref.revision);
      if (!entity || !rev) return v;
      const spec = structuredClone(rev.spec as RelationshipSpec);
      for (const side of ["a", "b"] as const) {
        const pin = spec[side].pin;
        const target = pin ? findEntity(v, pin.id) : undefined;
        const newest = target ? latestApproved(target) : undefined;
        if (pin && newest) spec[side] = { ...spec[side], pin: { id: pin.id, revision: newest.n } };
      }
      return addRevision(v, ref.id, { spec, now: nowIso(), note: "Confirmed to still hold after something it depends on changed." }).state;
    });
    notify("A new version was made. Approve it to confirm the relationship still holds.");
  };

  const status = (v: (typeof mine)[number]) => (v.status === "approved" ? (v.stale ? "Needs a look" : "Approved") : v.status === "candidate" ? "Candidate" : "Turned down");

  return (
    <section className="panel wd" aria-label="Relationships">
      <header className="wd-head"><div><h2><Link2 size={18} aria-hidden="true" /> Relationships</h2><p className="helper">What is true about {asset.name} and other things wherever they appear: who owns what, who sits where, how big one is next to another. Approved relationships are checked against your scenes and are flagged if something they depend on changes.</p></div></header>

      {conflicts.length > 0 && (
        <div className="wd-stale" role="alert"><h3><AlertTriangle size={16} aria-hidden="true" /> These disagree</h3><ul>{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul></div>
      )}

      <div className="wd-body">
        <nav className="wd-library" aria-label={`Relationships of ${asset.name}`}>
          <p className="helper"><b>{asset.name}</b></p>
          {mine.length === 0 && <p className="helper">Nothing recorded yet. Add one on the right, or keep what a scene already says.</p>}
          {mine.map((v) => (
            <div className="wd-lookrow" key={v.ref.id}>
              <b>{describeRelationship(v.spec, nameOf)}</b>
              <small>{status(v)}{v.spec.basis === "declared" ? " · stated by you" : " · measured"}{v.spec.sceneIds?.length ? ` · ${v.spec.sceneIds.length} scene${v.spec.sceneIds.length === 1 ? "" : "s"}` : " · everywhere"}</small>
              {v.stale && v.reasons.map((r, i) => <small key={i} className="wd-why">{reasonText(variations, r)}</small>)}
              <span className="wd-actions">
                {v.status === "candidate" && <><button onClick={() => decide(v.ref, "approve")}><Check size={13} aria-hidden="true" /> Approve</button><button onClick={() => decide(v.ref, "reject")}><X size={13} aria-hidden="true" /> Turn down</button></>}
                {v.status === "approved" && v.stale && <button onClick={() => reconfirm(v.ref)}>Confirm it still holds</button>}
              </span>
            </div>
          ))}
        </nav>

        <div className="wd-work">
          <div className="wd-design">
            <h3>Add a relationship</h3>
            <p className="helper">Read it as a sentence: {asset.name} ... something.</p>
            <div className="wd-fields">
              <label>{asset.name}<select value={way} onChange={(e) => { setWay(e.target.value); setOther(""); }}>{WAYS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></label>
              {way === "scale" && <label>Times as tall<input type="number" min={0.01} step={0.05} value={ratio} onChange={(e) => setRatio(e.target.value)} /></label>}
              <label>Other thing<select value={other} onChange={(e) => setOther(e.target.value)}><option value="">Choose…</option>{assets.filter((a) => a.id !== asset.id && fits(way, a)).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}</select></label>
            </div>
            {pins.length > 0 && (
              <label>Applies to this version of {asset.name}<select value={pinText} onChange={(e) => setPinText(e.target.value)}><option value="">As approved (any)</option>{pins.map((p) => <option key={p.id} value={`${p.id}@${latestApproved(p)!.n}`}>{p.name}</option>)}</select></label>
            )}
            {(scenes?.length ?? 0) > 0 && (
              <fieldset className="wd-keep"><legend>Holds in these scenes (none chosen: everywhere)</legend>
                {scenes!.map((sc) => <label key={sc.id}><input type="checkbox" checked={sceneIds.includes(sc.id)} onChange={(e) => setSceneIds((cur) => (e.target.checked ? [...cur, sc.id] : cur.filter((x) => x !== sc.id)))} /> {sc.heading ?? sc.id}</label>)}
              </fieldset>
            )}
            {preview && <p className="wd-why" aria-live="polite">{preview}</p>}
            <button className="primary" disabled={!draft || (way === "scale" && !(ratioNumber > 0))} onClick={add}>Record as a candidate</button>
          </div>

          {proposals.length > 0 && (
            <div className="wd-design">
              <h3>Already in your scenes</h3>
              <p className="helper">Your blocking maps say these. Keep the ones that are true everywhere you want them to be.</p>
              <ul>
                {proposals.map((p, i) => (
                  <li key={i}>{describeRelationship(p.spec, nameOf)} <small>({scenes?.find((s) => s.id === p.sceneId)?.heading ?? p.sceneId})</small>{" "}
                    <button onClick={() => { updateVariations((v) => { const r = addRelationship(v, p.spec, nameOf, nowIso()); return "error" in r ? v : r.state; }); notify("Recorded as a candidate. Approve it for it to count."); }}>Keep</button></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
