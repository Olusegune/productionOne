import { useMemo, useState } from "react";
import { GitBranch, Lock } from "lucide-react";
import type { ExtractedAsset } from "../domain/productionStudio";
import { lookForScene } from "../domain/lookAssignments";
import { branchScene, branchesOf, driftSince, freezeScene, resolveSnapshot, snapshotsOf } from "../domain/sceneContinuity";
import type { VariationState } from "../domain/variations";
import "../wardrobe.css";

export interface ContinuityPanelProps {
  variations: VariationState;
  updateVariations: (update: (v: VariationState) => VariationState) => void;
  scenes: Array<{ id: string; heading?: string }>;
  characters: ExtractedAsset[];
  notify: (message: string) => void;
}

const nowIso = () => new Date().toISOString();

/** Freezes what a scene was made with, by exact version, and keeps branches ("night version") apart. Nothing frozen ever changes. */
export function ContinuityPanel({ variations, updateVariations, scenes, characters, notify }: ContinuityPanelProps) {
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? "");
  const [branch, setBranch] = useState("main");
  const [newBranch, setNewBranch] = useState("");
  const nameOf = (id: string) => characters.find((c) => c.id === id)?.name ?? id;
  const branches = ["main", ...branchesOf(variations, sceneId).filter((b) => b !== "main")];
  const cast = useMemo(() => characters.flatMap((c) => { const l = sceneId ? lookForScene(variations, c.id, sceneId) : undefined; return l ? [{ assetId: c.id, look: l.ref, label: `${c.name} wears ${l.name}` }] : []; }), [characters, variations, sceneId]);
  const snaps = snapshotsOf(variations, sceneId, branch).sort((a, b) => b.n - a.n);
  if (scenes.length === 0) return null;

  const freeze = () => {
    const made = freezeScene(variations, sceneId, cast.map(({ assetId, look }) => ({ assetId, look })), { now: nowIso(), branch });
    if ("error" in made) { notify(made.error); return; }
    updateVariations((v) => { const r = freezeScene(v, sceneId, cast.map(({ assetId, look }) => ({ assetId, look })), { now: nowIso(), branch }); return "error" in r ? v : r.state; });
    notify(`Frozen: version ${made.snapshot.n} of ${branch}. It will always show these exact versions.`);
  };
  const makeBranch = () => {
    const made = branchScene(variations, sceneId, branch, newBranch, nowIso());
    if ("error" in made) { notify(made.error); return; }
    updateVariations((v) => { const r = branchScene(v, sceneId, branch, newBranch, nowIso()); return "error" in r ? v : r.state; });
    setBranch(made.snapshot.branch); setNewBranch("");
    notify(`Branch "${made.snapshot.branch}" started from ${branch}.`);
  };

  return (
    <section className="panel wd" aria-label="Scene continuity">
      <header className="wd-head"><div><h2><Lock size={18} aria-hidden="true" /> Scene continuity</h2><p className="helper">Freeze a scene to record exactly which version of each look it was made with. A frozen scene never changes, even when looks are revised later. A branch is a separate version of the same scene, such as a night version.</p></div></header>
      <div className="wd-design">
        <div className="wd-fields">
          <label>Scene<select value={sceneId} onChange={(e) => { setSceneId(e.target.value); setBranch("main"); }}>{scenes.map((s) => <option key={s.id} value={s.id}>{s.heading ?? s.id}</option>)}</select></label>
          <label>Branch<select value={branch} onChange={(e) => setBranch(e.target.value)}>{branches.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
        </div>
        {cast.length === 0 ? <p className="helper">No one has a look assigned to this scene yet. Assign looks to scenes above, then freeze it.</p> : <ul>{cast.map((c) => <li key={c.assetId}>{c.label}</li>)}</ul>}
        <button className="primary" disabled={cast.length === 0} onClick={freeze}>Freeze this scene on {branch}</button>
        <div className="wd-fields">
          <label>New branch from {branch}<input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="night version" /></label>
          <button disabled={!newBranch.trim() || snaps.length === 0} onClick={makeBranch}><GitBranch size={13} aria-hidden="true" /> Start branch</button>
        </div>
      </div>
      {snaps.length > 0 && (
        <ul className="wd-library" aria-label="Frozen versions">
          {snaps.map((s) => {
            const drift = driftSince(variations, s, nameOf);
            return (
              <li key={`${s.branch}-${s.n}`}>
                <b>{s.branch} · version {s.n}</b> <small>{new Date(s.createdAt).toLocaleDateString()}{s.fromBranch ? ` · from ${s.fromBranch.branch} ${s.fromBranch.n}` : ""}</small>
                <small>{resolveSnapshot(variations, s).map((c) => `${nameOf(c.assetId)}: ${c.look ? `${c.look.name} v${c.look.ref.revision}` : "no look"}`).join(" · ")}</small>
                {drift.map((d, i) => <small key={i} className="wd-why">{d}</small>)}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
