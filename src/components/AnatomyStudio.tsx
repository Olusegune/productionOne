import { useState } from "react";
import { Bone, Plus, X } from "lucide-react";
import type { ExtractedAsset } from "../domain/productionStudio";
import { anatomyLine, approvedCreature, BODY_PLANS, recordCreature, ROLES } from "../domain/creatureLab";
import { approveRevision, type BodyPlan, type CreatureSpec, type NarrativeRole, type VariationState } from "../domain/variations";
import "../wardrobe.css";

export interface AnatomyStudioProps {
  asset: ExtractedAsset;
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  notify: (message: string) => void;
}

const nowIso = () => new Date().toISOString();
const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
type Limb = { name: string; count: string; digits: string };

/** Declares what a being is meant to have, so deliberate anatomy is drawn on purpose and checked against what was declared. */
export function AnatomyStudio({ asset, variations, updateVariations, notify }: AnatomyStudioProps) {
  const current = approvedCreature(variations, asset.id)?.spec;
  const [bodyPlan, setBodyPlan] = useState<BodyPlan>(current?.bodyPlan ?? "humanoid");
  const [role, setRole] = useState<NarrativeRole | "">(current?.role ?? "");
  const [plan, setPlan] = useState(current?.plan ?? "");
  const [eyes, setEyes] = useState(current?.eyes !== undefined ? String(current.eyes) : "");
  const [symmetry, setSymmetry] = useState<CreatureSpec["symmetry"]>(current?.symmetry ?? "symmetric");
  const [limbs, setLimbs] = useState<Limb[]>(current?.limbs.map((l) => ({ name: l.name, count: String(l.count), digits: l.digits !== undefined ? String(l.digits) : "" })) ?? [{ name: "arm", count: "2", digits: "5" }, { name: "leg", count: "2", digits: "" }]);
  const [intentional, setIntentional] = useState((current?.intentional ?? []).join("\n"));
  const [never, setNever] = useState((current?.never ?? []).join("\n"));

  const spec: CreatureSpec = {
    assetId: asset.id, bodyPlan, symmetry, intentional: lines(intentional), never: lines(never),
    limbs: limbs.filter((l) => l.name.trim() && l.count !== "" && Number.isInteger(Number(l.count)) && Number(l.count) >= 0).map((l) => ({ name: l.name.trim(), count: Number(l.count), ...(l.digits !== "" && Number.isInteger(Number(l.digits)) && Number(l.digits) >= 0 ? { digits: Number(l.digits) } : {}) })),
    ...(eyes !== "" && Number.isInteger(Number(eyes)) && Number(eyes) >= 0 ? { eyes: Number(eyes) } : {}), ...(role ? { role } : {}), ...(plan.trim() ? { plan: plan.trim() } : {}),
  };

  const save = () => {
    const made = recordCreature(variations, spec, asset.name, nowIso());
    if ("error" in made) { notify(made.error); return; }
    updateVariations((v) => { const r = recordCreature(v, spec, asset.name, nowIso()); return "error" in r ? v : approveRevision(r.state, r.ref); });
    notify(`Anatomy saved and approved for ${asset.name}. It is written into every new picture.`);
  };
  const setLimb = (i: number, patch: Partial<Limb>) => setLimbs((cur) => cur.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  return (
    <section className="panel wd" aria-label="Anatomy">
      <header className="wd-head"><div><h2><Bone size={18} aria-hidden="true" /> Anatomy</h2><p className="helper">Say what {asset.name} is meant to have. Whatever you declare is written into every new picture and is what checks hold pictures to: six fingers are fine if you said six, and a mistake if you said five. Hero and villain are story roles; they do not change the body.</p></div></header>
      <div className="wd-work">
        <div className="wd-design">
          {current ? <p className="helper">Approved: {anatomyLine(current)}</p> : <p className="helper">Nothing declared yet, so pictures follow the description alone.</p>}
          <div className="wd-fields">
            <label>Body plan<select value={bodyPlan} onChange={(e) => setBodyPlan(e.target.value as BodyPlan)}>{BODY_PLANS.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
            <label>Role in the story<select value={role} onChange={(e) => setRole(e.target.value as NarrativeRole | "")}><option value="">Not set</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            <label>Eyes<input type="number" min={0} value={eyes} onChange={(e) => setEyes(e.target.value)} placeholder="not set" /></label>
            <label>Symmetry<select value={symmetry} onChange={(e) => setSymmetry(e.target.value as CreatureSpec["symmetry"])}><option value="symmetric">symmetric</option><option value="asymmetric">asymmetric</option><option value="mixed">mixed</option></select></label>
          </div>
          <label>Shape in a few words<input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="for example long coiled body, upright forebody" /></label>
          <fieldset className="wd-keep"><legend>Limbs</legend>
            {limbs.map((l, i) => (
              <div className="wd-fields" key={i}>
                <label>Limb<input aria-label={`Limb ${i + 1} name`} value={l.name} onChange={(e) => setLimb(i, { name: e.target.value })} /></label>
                <label>How many<input aria-label={`Limb ${i + 1} count`} type="number" min={0} value={l.count} onChange={(e) => setLimb(i, { count: e.target.value })} /></label>
                <label>Digits each<input aria-label={`Limb ${i + 1} digits`} type="number" min={0} value={l.digits} onChange={(e) => setLimb(i, { digits: e.target.value })} placeholder="optional" /></label>
                <button type="button" aria-label={`Remove limb ${i + 1}`} onClick={() => setLimbs((cur) => cur.filter((_, n) => n !== i))}><X size={13} aria-hidden="true" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setLimbs((cur) => [...cur, { name: "", count: "1", digits: "" }])}><Plus size={13} aria-hidden="true" /> Add a limb</button>
          </fieldset>
          <label>Intentional (one per line)<textarea rows={3} value={intentional} onChange={(e) => setIntentional(e.target.value)} placeholder="six fingers on each hand" /></label>
          <label>Never (one per line)<textarea rows={3} value={never} onChange={(e) => setNever(e.target.value)} placeholder="wings" /></label>
          <p className="wd-why" aria-live="polite">{anatomyLine(spec)}</p>
          <button className="primary" onClick={save}>Save and approve</button>
        </div>
      </div>
    </section>
  );
}
