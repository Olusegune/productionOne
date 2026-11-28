import { useState } from "react";
import { Cpu, Zap } from "lucide-react";
import type { ExtractedAsset } from "../domain/productionStudio";
import { ABILITY_TEMPLATES, CUSTOM, MACHINE_TEMPLATES, templateById } from "../domain/templates";
import { approvedMachine, MACHINE_KINDS, machineLine, parsePartLines, partsToLines, recordMachine } from "../domain/machineLab";
import { ABILITY_STATES, abilityLine, abilityRamp, approvedAbilities, recordAbility, STATE_INTENSITY } from "../domain/abilityLab";
import { approveRevision, type AbilitySpec, type AbilityState, type MachineSpec, type VariationState } from "../domain/variations";
import "../wardrobe.css";

export interface MachineAbilityProps {
  asset: ExtractedAsset;
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  notify: (message: string) => void;
}

const nowIso = () => new Date().toISOString();
const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

/** Machine parts: what a robot, android, mech or suit of armour must have, and in which views it must be visible. */
export function MachineStudio({ asset, variations, updateVariations, notify }: MachineAbilityProps) {
  const current = approvedMachine(variations, asset.id)?.spec;
  const [kind, setKind] = useState<MachineSpec["kind"]>(current?.kind ?? "robot");
  const [joints, setJoints] = useState(partsToLines(current?.joints ?? []));
  const [sensors, setSensors] = useState(partsToLines(current?.sensors ?? []));
  const [panels, setPanels] = useState(partsToLines(current?.panels ?? []));
  const [power, setPower] = useState(current?.powerSource ?? "");
  const [intentional, setIntentional] = useState((current?.intentional ?? []).join("\n"));
  const [never, setNever] = useState((current?.never ?? []).join("\n"));
  const [tpl, setTpl] = useState(CUSTOM);
  const applyTemplate = (id: string) => {
    setTpl(id);
    const t = templateById(MACHINE_TEMPLATES, id);
    if (!t || id === CUSTOM) return;
    const f = t.fill;
    setKind(f.kind); setJoints(partsToLines(f.joints)); setSensors(partsToLines(f.sensors)); setPanels(partsToLines(f.panels)); setPower(f.powerSource ?? "");
    setIntentional(f.intentional.join("\n")); setNever(f.never.join("\n"));
  };
  const j = parsePartLines(joints), s = parsePartLines(sensors), p = parsePartLines(panels);
  const errors = [...j.errors, ...s.errors, ...p.errors];
  const spec: MachineSpec = { assetId: asset.id, kind, joints: j.parts, sensors: s.parts, panels: p.parts, intentional: lines(intentional), never: lines(never), ...(power.trim() ? { powerSource: power.trim() } : {}) };

  const save = () => {
    if (errors.length) { notify(errors[0]); return; }
    const made = recordMachine(variations, spec, asset.name, nowIso());
    if ("error" in made) { notify(made.error); return; }
    updateVariations((v) => { const r = recordMachine(v, spec, asset.name, nowIso()); return "error" in r ? v : approveRevision(r.state, r.ref); });
    notify(`Machine parts saved and approved for ${asset.name}. They are written into every new picture.`);
  };

  return (
    <section className="panel wd" aria-label="Machine parts">
      <header className="wd-head"><div><h2><Cpu size={18} aria-hidden="true" /> Machine parts</h2><p className="helper">For a robot, android, mech or powered armour: list the joints, sensors and access panels it must have, and the views each must be visible in. One per line, like <code>elbow x2 @front,side (arms)</code>. A cutaway made from these is a design reference, not an engineering diagram, and is labelled that way.</p></div></header>
      <div className="wd-design">
        <label>Start from a template<select aria-label="Template" value={tpl} onChange={(e) => applyTemplate(e.target.value)}>{MACHINE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        {tpl !== CUSTOM && <p className="helper">{templateById(MACHINE_TEMPLATES, tpl)?.blurb} Nothing is saved until you press Save and approve.</p>}
        <label>Type<select value={kind} onChange={(e) => setKind(e.target.value as MachineSpec["kind"])}>{MACHINE_KINDS.map((k) => <option key={k} value={k}>{k.replace("-", " ")}</option>)}</select></label>
        <label>Joints<textarea rows={3} value={joints} onChange={(e) => setJoints(e.target.value)} placeholder="elbow x2 @front,side (arms)" /></label>
        <label>Sensors<textarea rows={3} value={sensors} onChange={(e) => setSensors(e.target.value)} placeholder="eye lens x2 @front (head)" /></label>
        <label>Access panels<textarea rows={3} value={panels} onChange={(e) => setPanels(e.target.value)} placeholder="chest hatch @front" /></label>
        <label>Power<input value={power} onChange={(e) => setPower(e.target.value)} placeholder="a sealed core in the chest" /></label>
        <label>Intentional (one per line)<textarea rows={2} value={intentional} onChange={(e) => setIntentional(e.target.value)} /></label>
        <label>Never (one per line)<textarea rows={2} value={never} onChange={(e) => setNever(e.target.value)} /></label>
        {errors.length > 0 && <ul className="wd-why" role="alert">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <p className="wd-why" aria-live="polite">{machineLine(spec)}</p>
        <button className="primary" disabled={errors.length > 0} onClick={save}>Save and approve</button>
      </div>
    </section>
  );
}

/** Powers: one visual language across six states, from inactive to aftermath. */
export function AbilityStudio({ asset, variations, updateVariations, notify }: MachineAbilityProps) {
  const mine = approvedAbilities(variations, asset.id);
  const [name, setName] = useState("");
  const [colour, setColour] = useState("");
  const [shape, setShape] = useState("");
  const [motion, setMotion] = useState("");
  const [transparency, setTransparency] = useState<AbilitySpec["transparency"]>("none");
  const [states, setStates] = useState<Partial<Record<AbilityState, string>>>({});
  const spec: AbilitySpec = { assetId: asset.id, name: name.trim(), language: { colour: colour.trim(), shape: shape.trim(), ...(motion.trim() ? { motion: motion.trim() } : {}) }, states: Object.fromEntries(Object.entries(states).filter(([, v]) => v?.trim())) as AbilitySpec["states"], transparency };

  const [tpl, setTpl] = useState(CUSTOM);
  const applyTemplate = (id: string) => {
    setTpl(id);
    const t = templateById(ABILITY_TEMPLATES, id);
    if (!t || id === CUSTOM) return;
    const f = t.fill;
    setName(f.name); setColour(f.language.colour); setShape(f.language.shape); setMotion(f.language.motion ?? ""); setTransparency(f.transparency); setStates({ ...f.states });
  };
  const load = (a: AbilitySpec) => { setName(a.name); setColour(a.language.colour); setShape(a.language.shape); setMotion(a.language.motion ?? ""); setTransparency(a.transparency); setStates({ ...a.states }); };
  const save = () => {
    const made = recordAbility(variations, spec, asset.name, nowIso());
    if ("error" in made) { notify(made.error); return; }
    updateVariations((v) => { const r = recordAbility(v, spec, asset.name, nowIso()); return "error" in r ? v : approveRevision(r.state, r.ref); });
    notify(`Power saved and approved: ${spec.name}.`);
    setName(""); setColour(""); setShape(""); setMotion(""); setStates({}); setTransparency("none");
  };

  return (
    <section className="panel wd" aria-label="Powers">
      <header className="wd-head"><div><h2><Zap size={18} aria-hidden="true" /> Powers</h2><p className="helper">A power keeps one colour and one shape in every state; only how strong it is changes. Describe each state from inactive to aftermath. A picture is only called transparent when its file really has transparency.</p></div></header>
      {mine.length > 0 && (
        <ul className="wd-library" aria-label={`Powers of ${asset.name}`}>
          {mine.map((m) => (
            <li key={m.ref.id}><b>{m.spec.name}</b> <small>{abilityRamp(m.spec).map((r) => `${r.state} ${r.described ? "✓" : "–"}`).join(" · ")}</small> <button onClick={() => load(m.spec)}>Edit</button></li>
          ))}
        </ul>
      )}
      <div className="wd-design">
        <label>Start from a template<select aria-label="Template" value={tpl} onChange={(e) => applyTemplate(e.target.value)}>{ABILITY_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        {tpl !== CUSTOM && <p className="helper">{templateById(ABILITY_TEMPLATES, tpl)?.blurb} Nothing is saved until you press Save and approve.</p>}
        <label>Name of the power<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Venom surge" /></label>
        <div className="wd-fields">
          <label>Colour<input value={colour} onChange={(e) => setColour(e.target.value)} placeholder="acid green" /></label>
          <label>Shape<input value={shape} onChange={(e) => setShape(e.target.value)} placeholder="branching veins of light" /></label>
          <label>Motion<input value={motion} onChange={(e) => setMotion(e.target.value)} placeholder="crawling outward" /></label>
          <label>Transparency<select value={transparency} onChange={(e) => setTransparency(e.target.value as AbilitySpec["transparency"])}><option value="none">Not needed</option><option value="translucent">Looks see-through</option><option value="alpha-required">Needs real transparency</option></select></label>
        </div>
        {ABILITY_STATES.map((st) => <label key={st}>{st[0].toUpperCase() + st.slice(1)} (strength {STATE_INTENSITY[st]} of 5)<input aria-label={`${st} state`} value={states[st] ?? ""} onChange={(e) => setStates((cur) => ({ ...cur, [st]: e.target.value }))} placeholder={st === "inactive" ? "no visible effect" : "what it looks like"} /></label>)}
        {name.trim() && colour.trim() && shape.trim() && <p className="wd-why" aria-live="polite">{abilityLine(spec, "peak")}</p>}
        <button className="primary" onClick={save}>Save and approve</button>
      </div>
    </section>
  );
}
