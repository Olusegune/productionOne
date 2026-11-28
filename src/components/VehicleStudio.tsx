import { useState } from "react";
import { Car } from "lucide-react";
import type { ExtractedAsset } from "../domain/productionStudio";
import type { BodyMetres } from "../domain/fit";
import { VEHICLE_TEMPLATES, CUSTOM, templateById } from "../domain/templates";
import { approvedVehicle, parsePartLines, partsToLines, recordVehicle, seatedFit, VEHICLE_KINDS, vehicleLine, vehicleOccupancyIssues, vehicleScaleLine } from "../domain/vehicleLab";
import { approveRevision, type VariationState, type VehicleSpec } from "../domain/variations";
import { approvedRelationships } from "../domain/relationships";
import "../wardrobe.css";

export interface VehicleStudioProps {
  asset: ExtractedAsset;
  assets: ExtractedAsset[];
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  notify: (message: string) => void;
  bodyOf?: (assetId: string) => BodyMetres | undefined;
}

const nowIso = () => new Date().toISOString();
const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
const num = (t: string) => (t.trim() === "" ? undefined : Number(t));

/** What a vehicle must have: seats, size, entrances and features with the views each must appear in. */
export function VehicleStudio({ asset, assets, variations, updateVariations, notify, bodyOf }: VehicleStudioProps) {
  const current = approvedVehicle(variations, asset.id)?.spec;
  const [tpl, setTpl] = useState(CUSTOM);
  const [kind, setKind] = useState<VehicleSpec["kind"]>(current?.kind ?? "car");
  const [seats, setSeats] = useState(String(current?.seats ?? 4));
  const [lengthM, setLengthM] = useState(current?.lengthM !== undefined ? String(current.lengthM) : "");
  const [widthM, setWidthM] = useState(current?.widthM !== undefined ? String(current.widthM) : "");
  const [heightM, setHeightM] = useState(current?.heightM !== undefined ? String(current.heightM) : "");
  const [interiorM, setInteriorM] = useState(current?.interiorHeightM !== undefined ? String(current.interiorHeightM) : "");
  const [entrances, setEntrances] = useState(partsToLines(current?.entrances ?? []));
  const [features, setFeatures] = useState(partsToLines(current?.features ?? []));
  const [power, setPower] = useState(current?.powerSource ?? "");
  const [intentional, setIntentional] = useState((current?.intentional ?? []).join("\n"));
  const [never, setNever] = useState((current?.never ?? []).join("\n"));

  const apply = (id: string) => {
    setTpl(id);
    const t = templateById(VEHICLE_TEMPLATES, id);
    if (!t || id === CUSTOM) return;
    const f = t.fill;
    setKind(f.kind); setSeats(String(f.seats)); setLengthM(f.lengthM !== undefined ? String(f.lengthM) : ""); setWidthM(f.widthM !== undefined ? String(f.widthM) : ""); setHeightM(f.heightM !== undefined ? String(f.heightM) : ""); setInteriorM(f.interiorHeightM !== undefined ? String(f.interiorHeightM) : "");
    setEntrances(partsToLines(f.entrances)); setFeatures(partsToLines(f.features)); setPower(f.powerSource ?? ""); setIntentional(f.intentional.join("\n")); setNever(f.never.join("\n"));
  };

  const e = parsePartLines(entrances), f = parsePartLines(features);
  const errors = [...e.errors, ...f.errors];
  const spec: VehicleSpec = {
    assetId: asset.id, kind, seats: Number(seats), entrances: e.parts, features: f.parts, intentional: lines(intentional), never: lines(never),
    ...(num(lengthM) !== undefined ? { lengthM: num(lengthM) } : {}), ...(num(widthM) !== undefined ? { widthM: num(widthM) } : {}), ...(num(heightM) !== undefined ? { heightM: num(heightM) } : {}), ...(num(interiorM) !== undefined ? { interiorHeightM: num(interiorM) } : {}),
    ...(power.trim() ? { powerSource: power.trim() } : {}),
  };

  const save = () => {
    if (errors.length) { notify(errors[0]); return; }
    const made = recordVehicle(variations, spec, asset.name, nowIso());
    if ("error" in made) { notify(made.error); return; }
    updateVariations((v) => { const r = recordVehicle(v, spec, asset.name, nowIso()); return "error" in r ? v : approveRevision(r.state, r.ref); });
    notify(`Vehicle details saved and approved for ${asset.name}. They are written into every new picture.`);
  };

  const nameOf = (id: string) => assets.find((a) => a.id === id)?.name ?? id;
  const issues = vehicleOccupancyIssues(variations, nameOf).filter((m) => m.includes(nameOf(asset.id)));
  const riders = approvedRelationships(variations).filter((r) => r.spec.relation === "interaction" && (r.spec.verb === "sit" || r.spec.verb === "operate") && r.spec.b.asset === asset.id).map((r) => r.spec.a.asset);
  const approved = current ? { ...current } : undefined;
  const notes = approved ? [...new Set(riders)].flatMap((id) => { const body = bodyOf?.(id); if (!body) return []; const fit = seatedFit(approved, body, nameOf(id)); const scale = vehicleScaleLine(approved, body, nameOf(asset.id), nameOf(id)); return [fit?.message, scale].filter((x): x is string => !!x).map((m, i) => ({ ok: fit?.ok !== false || i > 0, m })); }) : [];

  return (
    <section className="panel wd" aria-label="Vehicle details">
      <header className="wd-head"><div><h2><Car size={18} aria-hidden="true" /> Vehicle details</h2><p className="helper">If {asset.name} is a vehicle: say how many ride in it, how big it is, and which doors and parts must be visible in which views. One per line, like <code>door x4 @side</code>. Sizes are what you state; the fit against a person is guidance, not measurement.</p></div></header>
      <div className="wd-design">
        <label>Start from a template<select aria-label="Template" value={tpl} onChange={(ev) => apply(ev.target.value)}>{VEHICLE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        {tpl !== CUSTOM && <p className="helper">{templateById(VEHICLE_TEMPLATES, tpl)?.blurb} Nothing is saved until you press Save and approve.</p>}
        <div className="wd-fields">
          <label>Kind<select value={kind} onChange={(ev) => setKind(ev.target.value as VehicleSpec["kind"])}>{VEHICLE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          <label>Seats<input type="number" min={0} value={seats} onChange={(ev) => setSeats(ev.target.value)} /></label>
          <label>Length (m)<input type="number" min={0} step={0.1} value={lengthM} onChange={(ev) => setLengthM(ev.target.value)} placeholder="not stated" /></label>
          <label>Width (m)<input type="number" min={0} step={0.1} value={widthM} onChange={(ev) => setWidthM(ev.target.value)} placeholder="not stated" /></label>
          <label>Height (m)<input type="number" min={0} step={0.1} value={heightM} onChange={(ev) => setHeightM(ev.target.value)} placeholder="not stated" /></label>
          <label>Inside height (m)<input type="number" min={0} step={0.1} value={interiorM} onChange={(ev) => setInteriorM(ev.target.value)} placeholder="not stated" /></label>
        </div>
        <label>Entrances<textarea rows={2} value={entrances} onChange={(ev) => setEntrances(ev.target.value)} placeholder="door x4 @side" /></label>
        <label>Features<textarea rows={3} value={features} onChange={(ev) => setFeatures(ev.target.value)} placeholder="wheel x4 @side" /></label>
        <label>Power<input value={power} onChange={(ev) => setPower(ev.target.value)} placeholder="an electric motor under the floor" /></label>
        <label>Intentional (one per line)<textarea rows={2} value={intentional} onChange={(ev) => setIntentional(ev.target.value)} /></label>
        <label>Never (one per line)<textarea rows={2} value={never} onChange={(ev) => setNever(ev.target.value)} /></label>
        {errors.length > 0 && <ul className="wd-why" role="alert">{errors.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        <p className="wd-why" aria-live="polite">{vehicleLine(spec)}</p>
        <button className="primary" disabled={errors.length > 0} onClick={save}>Save and approve</button>
      </div>
      {issues.length > 0 && <div className="wd-stale" role="alert"><ul>{issues.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
      {notes.length > 0 && <ul className="wd-library" aria-label="Riders">{notes.map((n, i) => <li key={i} className={n.ok ? undefined : "wd-why"}>{n.ok ? "" : "Check: "}{n.m}</li>)}</ul>}
    </section>
  );
}
