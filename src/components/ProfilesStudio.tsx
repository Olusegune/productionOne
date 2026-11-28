import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import type { ExtractedAsset } from "../domain/productionStudio";
import { BODY_PLANS } from "../domain/creatureLab";
import { acceptProposal, approvedProfiles, exemptFrom, inheritedFor, profilesOf, proposals, recordProfile, setMembership } from "../domain/profiles";
import { approveRevision, type BodyPlan, type ProfileSpec, type VariationState } from "../domain/variations";
import "../wardrobe.css";

export interface ProfilesStudioProps {
  asset: ExtractedAsset;
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  notify: (message: string) => void;
}

const nowIso = () => new Date().toISOString();
const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

/** Species and factions: what this being inherits, and differences offered as proposals. Nothing approved is ever overwritten. */
export function ProfilesStudio({ asset, variations, updateVariations, notify }: ProfilesStudioProps) {
  const mine = profilesOf(variations, asset.id);
  const all = approvedProfiles(variations);
  const joinable = all.filter((p) => !p.spec.members.includes(asset.id));
  const inherited = useMemo(() => inheritedFor(variations, asset.id), [variations, asset.id]);
  const open = useMemo(() => proposals(variations).filter((p) => p.assetId === asset.id), [variations, asset.id]);

  const [level, setLevel] = useState<ProfileSpec["level"]>("species");
  const [name, setName] = useState("");
  const [bodyPlan, setBodyPlan] = useState<BodyPlan | "">("");
  const [eyes, setEyes] = useState("");
  const [never, setNever] = useState("");
  const [intentional, setIntentional] = useState("");
  const [join, setJoin] = useState("");

  const create = () => {
    const spec: ProfileSpec = { level, name: name.trim(), members: [asset.id], intentional: lines(intentional), never: lines(never), traits: {}, exceptions: {}, ...(bodyPlan ? { bodyPlan } : {}), ...(eyes !== "" && Number.isInteger(Number(eyes)) && Number(eyes) >= 0 ? { eyes: Number(eyes) } : {}) };
    const made = recordProfile(variations, spec, nowIso());
    if ("error" in made) { notify(made.error); return; }
    updateVariations((v) => { const r = recordProfile(v, spec, nowIso()); return "error" in r ? v : approveRevision(r.state, r.ref); });
    notify(`${level === "species" ? "Species" : "Faction"} "${spec.name}" saved with ${asset.name} in it. Nothing already approved was changed; any differences appear below as proposals.`);
    setName(""); setBodyPlan(""); setEyes(""); setNever(""); setIntentional("");
  };

  const membership = (id: string, member: boolean) => updateVariations((v) => { const r = setMembership(v, id, asset.id, member, nowIso()); return "error" in r ? v : r.state; });

  return (
    <section className="panel wd" aria-label="Species and factions">
      <header className="wd-head"><div><h2><Users size={18} aria-hidden="true" /> Species and factions</h2><p className="helper">What {asset.name} shares with others. A species or faction can state a body plan, eyes, features that are intentional or never allowed. They are only ever proposals: nothing already approved changes unless you accept it.</p></div></header>

      <div className="wd-design">
        <h3>{asset.name} belongs to</h3>
        {mine.length === 0 && <p className="helper">No species or faction yet.</p>}
        <ul>{mine.map((p) => <li key={p.id}><b>{p.spec.name}</b> <small>({p.spec.level})</small> <button onClick={() => membership(p.id, false)}>Leave</button></li>)}</ul>
        {joinable.length > 0 && (
          <div className="wd-fields">
            <label>Join<select value={join} onChange={(e) => setJoin(e.target.value)}><option value="">Choose…</option>{joinable.map((p) => <option key={p.id} value={p.id}>{p.spec.name} ({p.spec.level})</option>)}</select></label>
            <button disabled={!join} onClick={() => { membership(join, true); setJoin(""); }}>Add {asset.name}</button>
          </div>
        )}
        {inherited.length > 0 && (
          <>
            <h3>Inherited</h3>
            <ul>{inherited.map((e) => <li key={e.field}><b>{e.field}</b>: {e.value} <small>(from {e.from})</small></li>)}</ul>
          </>
        )}
      </div>

      {open.length > 0 && (
        <div className="wd-stale" role="region" aria-label="Proposals">
          <h3>Proposals ({open.length})</h3>
          <p className="helper">These differ from {asset.name}'s approved record. Accepting makes a new version for you to approve; keeping yours records an exception.</p>
          <ul>
            {open.map((p, i) => (
              <li key={`${p.field}-${i}`}>{p.message}
                <span className="wd-actions">
                  <button onClick={() => { updateVariations((v) => { const r = acceptProposal(v, p, asset.name, nowIso()); return "error" in r ? v : r.state; }); notify("A new version was made. Approve it in Anatomy to apply the change."); }}>Accept</button>
                  <button onClick={() => updateVariations((v) => { const r = exemptFrom(v, p.profile.id, asset.id, p.field, nowIso()); return "error" in r ? v : approveRevision(r.state, r.ref); })}>Keep mine</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="wd-design">
        <h3>Start a species or faction with {asset.name}</h3>
        <div className="wd-fields">
          <label>Kind<select value={level} onChange={(e) => setLevel(e.target.value as ProfileSpec["level"])}><option value="species">Species</option><option value="faction">Faction</option></select></label>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Venari" /></label>
          <label>Body plan<select value={bodyPlan} onChange={(e) => setBodyPlan(e.target.value as BodyPlan | "")}><option value="">Not stated</option>{BODY_PLANS.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
          <label>Eyes<input type="number" min={0} value={eyes} onChange={(e) => setEyes(e.target.value)} placeholder="not stated" /></label>
        </div>
        <label>Intentional (one per line)<textarea rows={2} value={intentional} onChange={(e) => setIntentional(e.target.value)} /></label>
        <label>Never (one per line)<textarea rows={2} value={never} onChange={(e) => setNever(e.target.value)} /></label>
        <button className="primary" disabled={!name.trim()} onClick={create}>Save</button>
      </div>
    </section>
  );
}
