import { useMemo, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Clapperboard, Copy, Download, ImagePlus, Maximize2, Sparkles, Trash2, Wand2, X } from "lucide-react";
import {
  angleLabels, angles, buildShotPrompt, checkContinuity, compositionRules, coverageLabels, defaultLens, frameForShot, frameJobs, movementLabels, movements, planCoverage, replanScene, shotListCsv, shotListMarkdown,
  shotReferences, shotSizes, sizeLabels, sortShots, type CameraAngle, type Movement, type ScreenDir, type ShotSize,
} from "../domain/direct";
import { addSupplied, approve, enqueue, reject, retry, type ImageJob, type QueueState } from "../domain/generationQueue";
import { modelTakesReferences } from "../domain/imageCatalog";
import type { AnalysisResult, ShotRecord } from "../domain/productionStudio";
import type { StyleBible } from "../domain/visualDevelopment";
import { emotions } from "../engine/emotion";
import { useModelChoice } from "../data/modelChoice";
import { Animatic } from "./Animatic";
import { FramePreview } from "./FramePreview";
import { Lightbox, type LightboxItem } from "./Lightbox";
import { ModelPicker } from "./ModelPicker";

const ASPECT = "16:9";

/** The Director's room: plan the coverage of each scene, edit every shot like a director would, make storyboard frames from your approved references, check continuity and play the animatic. */
export function DirectRoom(props: {
  analysis: AnalysisResult;
  shots: ShotRecord[];
  setShots: (update: (s: ShotRecord[]) => ShotRecord[]) => void;
  queue: QueueState;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  style: StyleBible;
  assetRefs: Record<string, string[]>;
  desktop: boolean;
  providersVersion: number;
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  title: string;
  notify: (message: string) => void;
  openProviders: () => void;
}) {
  const { analysis, shots, setShots, queue, setQueue, style, assetRefs, desktop, providersVersion, enabled, setEnabled, title, notify, openProviders } = props;
  const choice = useModelChoice(desktop, providersVersion);
  const [sceneId, setSceneId] = useState(analysis.scenes[0]?.id ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const scene = analysis.scenes.find((s) => s.id === sceneId) ?? analysis.scenes[0];
  const sceneShots = shots.filter((s) => s.sceneId === scene?.id);
  const shot = shots.find((s) => s.id === selected) ?? sceneShots[0];
  const findings = useMemo(() => checkContinuity(shots, analysis, queue), [shots, analysis, queue]);
  const characters = analysis.assets.filter((a) => a.type === "character");
  const sets = analysis.assets.filter((a) => a.type === "set" || a.type === "environment");

  if (!enabled) {
    return (
      <section className="panel dr-off">
        <span className="eyebrow">Optional</span>
        <h3>Director's room</h3>
        <p className="helper">Plan shots from your script, make storyboard frames with your approved characters and sets, check continuity and play an animatic. Nothing here is needed to make character sheets or a delivery package.</p>
        <button className="primary" onClick={() => setEnabled(true)}><Clapperboard size={15} /> Turn on the Director's room</button>
      </section>
    );
  }

  const update = (id: string, patch: Partial<ShotRecord>) => setShots((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const planAll = () => {
    const planned = planCoverage(analysis);
    if (!planned.length) { notify("Analyze a script first: the plan is built from the scenes, characters and feelings it finds."); return; }
    setShots(() => planned);
    setSelected(planned[0].id);
    notify(`Planned ${planned.length} shots across ${analysis.scenes.length} scenes. Edit anything: it is a starting point.`);
  };
  const planScene = () => {
    if (!scene) return;
    setShots((list) => replanScene(list, analysis, scene.id, queue));
    notify(`Planned coverage for ${scene.heading}. Shots with approved frames were kept.`);
  };
  const move = (id: string, d: number) => setShots((list) => { const i = list.findIndex((s) => s.id === id); const j = i + d; if (i < 0 || j < 0 || j >= list.length || list[j].sceneId !== list[i].sceneId) return list; const copy = [...list]; [copy[i], copy[j]] = [copy[j], copy[i]]; return sortShots(copy.map((s, k) => ({ ...s, order: k + 1 })), analysis); });
  const duplicate = (s: ShotRecord) => setShots((list) => { const n = list.reduce((m, x) => Math.max(m, Number(/(\d+)$/.exec(x.id)?.[1] ?? 0)), 0) + 1; const copy = { ...s, id: `SHOT-${String(n).padStart(3, "0")}`, title: `${s.title ?? s.id} (copy)`, storyboardStatus: "planned" as const }; const i = list.findIndex((x) => x.id === s.id); const out = [...list]; out.splice(i + 1, 0, copy); return out.map((x, k) => ({ ...x, order: k + 1 })); });
  const remove = (id: string) => { setShots((list) => list.filter((s) => s.id !== id).map((s, k) => ({ ...s, order: k + 1 }))); if (selected === id) setSelected(null); };
  const addShot = () => {
    if (!scene) return;
    const n = shots.reduce((m, x) => Math.max(m, Number(/(\d+)$/.exec(x.id)?.[1] ?? 0)), 0) + 1;
    const base: ShotRecord = { id: `SHOT-${String(n).padStart(3, "0")}`, sceneId: scene.id, order: shots.length + 1, duration: 4, assetIds: [], action: "Describe what the camera sees.", dialogue: "", speaker: "", emotionalObjective: "Observation", facialActing: "", bodyLanguage: "", microAnimation: "", cameraFraming: sizeLabels.MS, cameraMovement: movementLabels.static, lighting: "", soundEffects: "", ambience: "", music: "", transition: "Cut", storyboardStatus: "planned", title: "New shot", coverage: "single", size: "MS", angle: "eye-level", lens: 40, movement: "static", composition: ["rule of thirds"], screenDir: "neutral" };
    setShots((list) => sortShots([...list, base], analysis));
    setSelected(base.id);
  };

  const makeFrames = (list: ShotRecord[], force = false, testOne = false) => {
    const takesRefs = modelTakesReferences(choice.provider, choice.modelId);
    const chosen = testOne ? list.slice(0, 1) : list;
    const requests = chosen.map((s) => {
      const refs = takesRefs ? shotReferences(s, analysis, queue, assetRefs) : [];
      return {
        assetId: s.id, variant: "Storyboard", sheetType: "Storyboard", viewKey: "frame", label: s.title ?? s.id, aspect: ASPECT, fullBody: false, provider: choice.provider, model: choice.modelId,
        prompt: buildShotPrompt(s, analysis, style, refs, ASPECT), references: refs.map((r) => r.path), outputName: (rev: number) => `${s.id}_storyboard_v${String(rev).padStart(2, "0")}`,
      };
    });
    const result = enqueue(queue, requests, Date.now(), force);
    setQueue(() => result.state);
    if (!result.added) { notify("Those shots already have frames waiting or approved. Use Regenerate on a shot to make another version."); return; }
    if (desktop && !choice.configured[choice.provider]) { notify(`Queued ${result.added} frame${result.added === 1 ? "" : "s"}, but there is no ${choice.provider} key yet.`); openProviders(); return; }
    notify(`Generating ${result.added} storyboard frame${result.added === 1 ? "" : "s"}${takesRefs ? " from your approved references" : " (this model takes no reference images, so people are described, not matched)"}…`);
  };

  const useOwnFrame = async (s: ShotRecord) => {
    try {
      const picked = await invoke<string[]>("pick_image_files", { multiple: false });
      if (!picked.length) return;
      const [file] = await invoke<Array<{ path: string; inspection: { width: number; height: number } }>>("import_images", { paths: picked });
      const out = addSupplied(queue, { assetId: s.id, variant: "Storyboard", sheetType: "Storyboard", viewKey: "frame", label: s.title ?? s.id, aspect: ASPECT, fullBody: false, path: file.path, width: file.inspection.width, height: file.inspection.height });
      setQueue(() => out.state);
      update(s.id, { storyboardStatus: "approved" });
      notify(`Using your image as the frame for ${s.id}.`);
    } catch (e) { notify(String(e)); }
  };
  const approveFrame = (job: ImageJob) => { setQueue((q) => approve(q, job.id)); update(job.assetId, { storyboardStatus: "approved" }); };
  const rejectFrame = (job: ImageJob) => setQueue((q) => reject(q, job.id));

  const exportList = async (kind: "csv" | "md") => {
    const text = kind === "csv" ? shotListCsv(shots, analysis.scenes) : shotListMarkdown(title, shots, analysis.scenes);
    const name = `${title.replace(/[^A-Za-z0-9 -]+/g, " ").trim() || "Shot list"} shot list.${kind}`;
    if (!desktop) { const url = URL.createObjectURL(new Blob([text], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); return; }
    try { const saved = await invoke<string | null>("save_text_dialog", { suggested: name, contents: text, extension: kind }); if (saved) notify(`Saved ${saved}`); } catch (e) { notify(String(e)); }
  };

  const lbItems: LightboxItem[] = sceneShots.flatMap((s) => { const j = frameForShot(queue, s.id); return j?.outputPath ? [{ job: j, label: s.title ?? s.id }] : []; });
  const sceneFindings = findings.filter((f) => !f.shotId || sceneShots.some((s) => s.id === f.shotId));
  const needFrames = sceneShots.filter((s) => !frameJobs(queue, s.id).some((j) => j.approved || j.status === "queued" || j.status === "generating" || j.status === "validating" || j.status === "needs-review"));
  const frameCount = shots.filter((s) => frameForShot(queue, s.id)).length;

  return (
    <div className="dr">
      <div className="dr-top">
        <div>
          <span className="eyebrow">Director's room</span>
          <h2>{shots.length} shots · {frameCount} with frames</h2>
        </div>
        <div className="dr-top-actions">
          <ModelPicker catalog={choice.catalog} configured={choice.configured} provider={choice.provider} modelId={choice.modelId} onPick={choice.pick} onRefresh={() => void choice.refresh().then(notify)} refreshing={choice.refreshing} />
          <button className="secondary" onClick={planAll}><Wand2 size={14} /> Plan all scenes</button>
          <button className="secondary" onClick={() => void exportList("csv")} disabled={!shots.length}><Download size={14} /> CSV</button>
          <button className="secondary" onClick={() => void exportList("md")} disabled={!shots.length}><Download size={14} /> Markdown</button>
          <button className="secondary" onClick={() => setEnabled(false)} title="Hide the Director's room. Your shots are kept.">Turn off</button>
        </div>
      </div>

      <div className="dr-grid">
        <nav className="dr-scenes panel" aria-label="Scenes">
          {analysis.scenes.map((s) => {
            const mine = shots.filter((x) => x.sceneId === s.id);
            const warns = findings.filter((f) => f.level === "warn" && mine.some((m) => m.id === f.shotId)).length;
            return (
              <button key={s.id} className={s.id === scene?.id ? "on" : ""} onClick={() => { setSceneId(s.id); setSelected(null); }}>
                <b>{s.number}. {s.setting}</b>
                <small>{s.timeOfDay.toLowerCase()} · {mine.length} shot{mine.length === 1 ? "" : "s"}{warns ? ` · ${warns} warning${warns === 1 ? "" : "s"}` : ""}</small>
              </button>
            );
          })}
          {analysis.scenes.length === 0 && <p className="helper">Analyze a script in Story and its scenes appear here.</p>}
        </nav>

        <section className="dr-board">
          <div className="dr-board-bar">
            <h3>{scene?.heading ?? "No scene"}</h3>
            <div className="dr-board-actions">
              <button className="secondary" onClick={planScene} disabled={!scene}><Wand2 size={14} /> Plan this scene</button>
              <button className="secondary" onClick={addShot} disabled={!scene}>Add shot</button>
              <button className="secondary" disabled={!needFrames.length} onClick={() => makeFrames(needFrames, false, true)} title="Make one frame first to check the look">Test one first</button>
              <button className="primary" disabled={!needFrames.length} onClick={() => makeFrames(needFrames)}><Sparkles size={15} /> Generate {needFrames.length} frame{needFrames.length === 1 ? "" : "s"}</button>
            </div>
          </div>
          {sceneShots.length === 0 && <div className="dr-empty"><p>No shots in this scene yet.</p><button className="primary" onClick={planScene} disabled={!scene}><Wand2 size={15} /> Plan the coverage for this scene</button></div>}
          <div className="dr-cards">
            {sceneShots.map((s, i) => {
              const frame = frameForShot(queue, s.id);
              const mine = frameJobs(queue, s.id);
              const live = mine.find((j) => ["queued", "generating", "validating"].includes(j.status));
              const warns = findings.filter((f) => f.shotId === s.id && f.level === "warn").length;
              const at = lbItems.findIndex((it) => it.job.id === frame?.id);
              return (
                <article key={s.id} className={`dr-card${s.id === shot?.id ? " on" : ""}`} data-shot={s.id}>
                  <button className="dr-thumb" onClick={() => setSelected(s.id)} aria-label={`Select ${s.title ?? s.id}`}>
                    {frame?.outputPath ? <img src={convertFileSrc(frame.outputPath)} alt={`Frame for ${s.title ?? s.id}`} /> : <FramePreview shot={s} aspect={ASPECT} />}
                    <span className="dr-num">{i + 1}</span>
                    <span className={`dr-state ${live ? "busy" : frame?.approved ? "ok" : frame ? "review" : ""}`}>{live ? live.status : frame?.approved ? "Approved" : frame ? (frame.status === "needs-review" ? "Needs review" : "Frame") : "No frame"}</span>
                    {warns > 0 && <span className="dr-warn" title="Continuity warnings"><AlertTriangle size={13} /> {warns}</span>}
                    {at >= 0 && <span className="dr-zoom" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setLightbox(at); }} onKeyDown={(e) => { if (e.key === "Enter") setLightbox(at); }} aria-label="Open full size"><Maximize2 size={14} /></span>}
                  </button>
                  <div className="dr-meta">
                    <b>{s.title ?? s.id}</b>
                    <span className="dr-chips"><i>{s.coverage ? coverageLabels[s.coverage] : "Shot"}</i><i>{s.size}</i><i>{s.lens}mm</i><i>{s.movement ? movementLabels[s.movement] : "Static"}</i><i>{s.duration}s</i></span>
                    {s.dialogue && <q>{s.speaker}: {s.dialogue}</q>}
                  </div>
                  <div className="dr-actions">
                    {frame?.status === "needs-review" && (<><button className="primary" onClick={() => approveFrame(frame)}><Check size={13} /> Approve</button><button className="secondary" onClick={() => rejectFrame(frame)}><X size={13} /> Reject</button></>)}
                    {!live && frame?.status !== "needs-review" && <button className="secondary" onClick={() => makeFrames([s], true)}><Sparkles size={13} /> {frame ? "Regenerate" : "Frame"}</button>}
                    {mine.some((j) => j.status === "failed") && !live && <button className="secondary" onClick={() => { const j = mine.find((x) => x.status === "failed"); if (j) setQueue((q) => retry(q, j.id)); }}>Retry</button>}
                    {desktop && <button className="icon-mini" onClick={() => void useOwnFrame(s)} title="Use your own image as this frame" aria-label="Use my own image"><ImagePlus size={14} /></button>}
                    <button className="icon-mini" onClick={() => move(s.id, -1)} aria-label="Move up"><ArrowUp size={14} /></button>
                    <button className="icon-mini" onClick={() => move(s.id, 1)} aria-label="Move down"><ArrowDown size={14} /></button>
                    <button className="icon-mini" onClick={() => duplicate(s)} aria-label="Duplicate shot"><Copy size={14} /></button>
                    <button className="icon-mini" onClick={() => remove(s.id)} aria-label="Delete shot"><Trash2 size={14} /></button>
                  </div>
                </article>
              );
            })}
          </div>
          {sceneFindings.length > 0 && (
            <div className="dr-findings" aria-label="Continuity">
              <h4>Continuity</h4>
              <ul>{sceneFindings.slice(0, 12).map((f, i) => <li key={i} className={f.level}><button onClick={() => f.shotId && setSelected(f.shotId)}>{f.level === "warn" ? <AlertTriangle size={14} /> : null} {f.message}</button></li>)}</ul>
            </div>
          )}
        </section>

        <aside className="dr-inspector panel" aria-label="Shot editor">
          {!shot ? <p className="helper">Select a shot to edit it.</p> : (
            <>
              <FramePreview shot={shot} aspect={ASPECT} />
              <label><span>Title</span><input value={shot.title ?? ""} onChange={(e) => update(shot.id, { title: e.target.value })} /></label>
              <div className="dr-two">
                <label><span>Size</span><select value={shot.size ?? "MS"} onChange={(e) => { const size = e.target.value as ShotSize; update(shot.id, { size, lens: defaultLens[size], cameraFraming: sizeLabels[size] }); }}>{shotSizes.map((s) => <option key={s} value={s}>{sizeLabels[s]}</option>)}</select></label>
                <label><span>Angle</span><select value={shot.angle ?? "eye-level"} onChange={(e) => update(shot.id, { angle: e.target.value as CameraAngle })}>{angles.map((a) => <option key={a} value={a}>{angleLabels[a]}</option>)}</select></label>
                <label><span>Lens (mm)</span><input type="number" min={8} max={400} value={shot.lens ?? 40} onChange={(e) => update(shot.id, { lens: Number(e.target.value) || 40 })} /></label>
                <label><span>Movement</span><select value={shot.movement ?? "static"} onChange={(e) => update(shot.id, { movement: e.target.value as Movement, cameraMovement: movementLabels[e.target.value as Movement] })}>{movements.map((m) => <option key={m} value={m}>{movementLabels[m]}</option>)}</select></label>
                <label><span>Screen direction</span><select value={shot.screenDir ?? "neutral"} onChange={(e) => update(shot.id, { screenDir: e.target.value as ScreenDir })}><option value="neutral">Neutral</option><option value="L>R">Facing right</option><option value="R>L">Facing left</option></select></label>
                <label><span>Length (s)</span><input type="number" min={1} max={30} step={0.5} value={shot.duration} onChange={(e) => update(shot.id, { duration: Math.max(1, Number(e.target.value) || 4) })} /></label>
              </div>
              <fieldset><legend>Composition</legend><div className="dr-tags">{compositionRules.map((c) => { const on = shot.composition?.includes(c); return <button key={c} className={on ? "on" : ""} onClick={() => update(shot.id, { composition: on ? (shot.composition ?? []).filter((x) => x !== c) : [...(shot.composition ?? []), c] })}>{c}</button>; })}</div></fieldset>
              <fieldset><legend>In the shot</legend>
                <div className="dr-tags">{characters.map((c) => { const on = shot.assetIds.includes(c.id); return <button key={c.id} className={on ? "on" : ""} onClick={() => update(shot.id, { assetIds: on ? shot.assetIds.filter((x) => x !== c.id) : [...shot.assetIds, c.id], focusAssetId: shot.focusAssetId ?? c.id })}>{c.name}</button>; })}</div>
                {shot.assetIds.filter((id) => characters.some((c) => c.id === id)).map((id) => { const c = characters.find((x) => x.id === id)!; const looks = ["Canonical", ...new Set((analysis.story?.variants ?? []).filter((v) => v.character.toUpperCase() === c.name.toUpperCase()).map((v) => v.value))]; return <label key={id} className="dr-look"><span>{c.name} wears</span><select value={shot.looks?.[id] ?? "Canonical"} onChange={(e) => update(shot.id, { looks: { ...(shot.looks ?? {}), [id]: e.target.value } })}>{looks.map((l) => <option key={l}>{l}</option>)}</select></label>; })}
                <label className="dr-look"><span>Set</span><select value={shot.setAssetId ?? ""} onChange={(e) => update(shot.id, { setAssetId: e.target.value || undefined, assetIds: [...shot.assetIds.filter((x) => !sets.some((s) => s.id === x)), ...(e.target.value ? [e.target.value] : [])] })}><option value="">None</option>{sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              </fieldset>
              <label><span>Action</span><textarea rows={3} value={shot.action} onChange={(e) => update(shot.id, { action: e.target.value })} /></label>
              <div className="dr-two">
                <label><span>Speaker</span><input value={shot.speaker} onChange={(e) => update(shot.id, { speaker: e.target.value.toUpperCase() })} /></label>
                <label><span>Feeling</span><select value={shot.emotion ?? "neutral"} onChange={(e) => update(shot.id, { emotion: e.target.value })}>{emotions.map((e) => <option key={e}>{e}</option>)}</select></label>
              </div>
              <label><span>Dialogue (from the script)</span><textarea rows={2} value={shot.dialogue} onChange={(e) => update(shot.id, { dialogue: e.target.value })} /></label>
              <label><span>Lighting</span><input value={shot.lighting} onChange={(e) => update(shot.id, { lighting: e.target.value })} /></label>
              <label><span>Sound</span><input value={shot.soundEffects} onChange={(e) => update(shot.id, { soundEffects: e.target.value })} placeholder="Sound effects, ambience, silence" /></label>
            </>
          )}
        </aside>
      </div>

      <Animatic shots={shots} queue={queue} scenes={analysis.scenes} />
      {lightbox !== null && lbItems.length > 0 && <Lightbox items={lbItems} index={Math.min(lightbox, lbItems.length - 1)} onIndex={setLightbox} onClose={() => setLightbox(null)} onApprove={approveFrame} onReject={rejectFrame} />}
    </div>
  );
}
