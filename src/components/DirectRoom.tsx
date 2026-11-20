import { useEffect, useMemo, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Eyebrow } from "./Eyebrow";
import { AlertTriangle, SlidersHorizontal, ArrowDown, ArrowUp, Check, Clapperboard, Copy, Download, ImagePlus, LayoutGrid, List, Maximize2, MoreHorizontal, Square, Sparkles, Trash2, Undo2, Wand2, X } from "lucide-react";
import {
  angleLabels, angles, buildShotPrompt, checkContinuity, compositionRules, coverageLabels, defaultLens, cardFrame, frameForShot, frameJobs, movementLabels, movements, planCoverage, replanScene, shotListCsv, shotListMarkdown,
  shotReferences, shotSizes, sizeLabels, sortShots, type CameraAngle, type Movement, type ScreenDir, type ShotSize,
} from "../domain/direct";
import { addCleaned, addSupplied, approve, enqueue, reconsider, reject, retry, type ImageJob, type QueueState } from "../domain/generationQueue";
import { modelTakesReferences } from "../domain/imageCatalog";
import type { AnalysisResult, ShotRecord } from "../domain/productionStudio";
import type { StyleBible } from "../domain/visualDevelopment";
import { emotions } from "../engine/emotion";
import { useModelChoice } from "../data/modelChoice";
import { Animatic } from "./Animatic";
import { FramePreview } from "./FramePreview";
import { Fold } from "./Fold";
import { Lightbox, type LightboxItem } from "./Lightbox";
import { CleanRender } from "./CleanRender";
import { ModelPicker } from "./ModelPicker";
import { ShotCameraLighting } from "./ShotCameraLighting";
import { lightingTestPrompts } from "../domain/lighting";

import { FormatPicker } from "./FormatPicker";
import { formatName, isPortrait, ratioOf, sameShape } from "../domain/formats";

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
  openLocal?: () => void;
  /** The project's shape, for example 9:16. */
  format?: string;
  setFormat?: (aspect: string) => void;
}) {
  const { analysis, shots, setShots, queue, setQueue, style, assetRefs, desktop, providersVersion, enabled, setEnabled, title, notify, openProviders, openLocal } = props;
  const aspect = props.format ?? "16:9";
  const choice = useModelChoice(desktop, providersVersion);
  const [sceneId, setSceneId] = useState(analysis.scenes[0]?.id ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [view, setView] = useState<"grid" | "list" | "large">("grid");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [inspW, setInspW] = useState<number>(() => { try { return Number(localStorage.getItem("po.inspW")) || 380; } catch { return 380; } });
  useEffect(() => { try { localStorage.setItem("po.inspW", String(inspW)); } catch { /* storage may be unavailable */ } }, [inspW]);
  const scene = analysis.scenes.find((s) => s.id === sceneId) ?? analysis.scenes[0];
  const sceneShots = shots.filter((s) => s.sceneId === scene?.id);
  const shot = shots.find((s) => s.id === selected) ?? sceneShots[0];
  const findings = useMemo(() => checkContinuity(shots, analysis, queue), [shots, analysis, queue]);
  const characters = analysis.assets.filter((a) => a.type === "character");
  const sets = analysis.assets.filter((a) => a.type === "set" || a.type === "environment");

  if (!enabled) {
    return (
      <section className="panel dr-off">
        <Eyebrow icon={Sparkles}>Optional</Eyebrow>
        <h3>Director's room</h3>
        <p className="helper">Plan shots from your script, make storyboard frames with your approved characters and sets, check continuity and play an animatic. Nothing here is needed to make character sheets or a delivery package.</p>
        <button className="primary" onClick={() => setEnabled(true)}><Clapperboard size={15} /> Turn on the Director's room</button>
      </section>
    );
  }

  /** One picture per lighting condition for the shot's focus character. Runs only when the person presses the button. */
  const lightingTest = (s: ShotRecord) => {
    const who = analysis.assets.find((a) => a.id === (s.focusAssetId ?? s.camera?.focusTarget)) ?? analysis.assets.find((a) => a.type === "character" && s.assetIds.includes(a.id));
    if (!who) { notify("Choose a character in this shot first: the lighting test is made for one character."); return; }
    const requests = lightingTestPrompts([who.name, who.description ?? ""].filter(Boolean).join(", "), `${sizeLabels[s.size ?? "MS"].toLowerCase()}, ${angleLabels[s.angle ?? "eye-level"].toLowerCase()}`).map((item) => ({
      assetId: who.id, variant: "Lighting test", sheetType: "Lighting test", viewKey: item.presetId, label: item.label, prompt: item.prompt, aspect: "3:4", fullBody: false, provider: choice.provider, model: choice.modelId, references: [] as string[],
      outputName: (rev: number) => `${who.id}_lighting-${item.presetId}_v${String(rev).padStart(2, "0")}`,
    }));
    setQueue((q) => enqueue(q, requests, Date.now(), false).state);
    notify(`Asked for ${requests.length} lighting-test pictures of ${who.name}. Each is a new candidate, not a relit copy of one picture.`);
  };
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
  const reorderTo = (fromId: string, toId: string) => setShots((list) => {
    const from = list.findIndex((s) => s.id === fromId); const to = list.findIndex((s) => s.id === toId);
    if (from < 0 || to < 0 || from === to || list[from].sceneId !== list[to].sceneId) return list;
    const copy = [...list]; const [m] = copy.splice(from, 1); copy.splice(to, 0, m);
    return sortShots(copy.map((s, k) => ({ ...s, order: k + 1 })), analysis);
  });
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
        assetId: s.id, variant: "Storyboard", sheetType: "Storyboard", viewKey: "frame", label: s.title ?? s.id, aspect, fullBody: false, provider: choice.provider, model: choice.modelId,
        prompt: buildShotPrompt(s, analysis, style, refs, aspect, choice.modelId), references: refs.map((r) => r.path), outputName: (rev: number) => `${s.id}_storyboard_v${String(rev).padStart(2, "0")}`,
      };
    });
    const result = enqueue(queue, requests, Date.now(), force);
    setQueue(() => result.state);
    if (!result.added) { notify("Those shots already have frames waiting or approved. Use Regenerate on a shot to make another version."); return; }
    if (desktop && !choice.configured[choice.provider]) {
      if (choice.provider === "comfyui") { notify(`Queued ${result.added} frame${result.added === 1 ? "" : "s"}, but ComfyUI is not running. Start it from Local AI.`); openLocal?.(); } else { notify(`Queued ${result.added} frame${result.added === 1 ? "" : "s"}, but there is no ${choice.provider} key yet.`); openProviders(); }
      return;
    }
    notify(`Generating ${result.added} storyboard frame${result.added === 1 ? "" : "s"}${takesRefs ? " from your approved references" : " (this model takes no reference images, so people are described, not matched)"}…`);
  };

  const useOwnFrame = async (s: ShotRecord) => {
    try {
      const picked = await invoke<string[]>("pick_image_files", { multiple: false });
      if (!picked.length) return;
      const [file] = await invoke<Array<{ path: string; inspection: { width: number; height: number } }>>("import_images", { paths: picked });
      const out = addSupplied(queue, { assetId: s.id, variant: "Storyboard", sheetType: "Storyboard", viewKey: "frame", label: s.title ?? s.id, aspect, fullBody: false, path: file.path, width: file.inspection.width, height: file.inspection.height });
      setQueue(() => out.state);
      update(s.id, { storyboardStatus: "approved" });
      notify(`Using your image as the frame for ${s.id}.`);
    } catch (e) { notify(String(e)); }
  };
  const approveFrame = (job: ImageJob) => { setQueue((q) => approve(q, job.id)); update(job.assetId, { storyboardStatus: "approved" }); };
  const rejectFrame = (job: ImageJob) => { setQueue((q) => reject(q, job.id)); if (job.approved) update(job.assetId, { storyboardStatus: "generated" }); };
  const undoFrame = (job: ImageJob) => { setQueue((q) => reconsider(q, job.id)); if (job.approved) update(job.assetId, { storyboardStatus: "generated" }); };

  const exportList = async (kind: "csv" | "md") => {
    const text = kind === "csv" ? shotListCsv(shots, analysis.scenes) : shotListMarkdown(title, shots, analysis.scenes);
    const name = `${title.replace(/[^A-Za-z0-9 -]+/g, " ").trim() || "Shot list"} shot list.${kind}`;
    if (!desktop) { const url = URL.createObjectURL(new Blob([text], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); return; }
    try { const saved = await invoke<string | null>("save_text_dialog", { suggested: name, contents: text, extension: kind }); if (saved) notify(`Saved ${saved}`); } catch (e) { notify(String(e)); }
  };

  const lbItems: LightboxItem[] = sceneShots.flatMap((s) => { const j = cardFrame(queue, s.id); return j?.outputPath ? [{ job: j, label: s.title ?? s.id }] : []; });
  const sceneFindings = findings.filter((f) => !f.shotId || sceneShots.some((s) => s.id === f.shotId));
  const needFrames = sceneShots.filter((s) => !frameJobs(queue, s.id).some((j) => j.approved || j.status === "queued" || j.status === "generating" || j.status === "validating" || j.status === "needs-review"));
  const wrongShape = sceneShots.filter((s) => { const f = cardFrame(queue, s.id); return !!f?.outputPath && !sameShape(f.aspect, aspect); });
  const frameCount = shots.filter((s) => frameForShot(queue, s.id)).length;

  return (
    <div className="dr">
      <div className="dr-top">
        <div>
          <Eyebrow icon={Clapperboard}>Director's room</Eyebrow>
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

      {props.setFormat && <div className="dr-format"><span className="dr-format-label">Format</span><FormatPicker value={aspect} onChange={props.setFormat} compact /></div>}

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
              <div className="seg" role="group" aria-label="Card layout">
                <button className={view === "grid" ? "on" : ""} aria-pressed={view === "grid"} aria-label="Grid" title="Grid" onClick={() => setView("grid")}><LayoutGrid size={15} /></button>
                <button className={view === "list" ? "on" : ""} aria-pressed={view === "list"} aria-label="List" title="List" onClick={() => setView("list")}><List size={15} /></button>
                <button className={view === "large" ? "on" : ""} aria-pressed={view === "large"} aria-label="Large storyboard" title="Large storyboard" onClick={() => setView("large")}><Square size={15} /></button>
              </div>
              {wrongShape.length > 0 && <span className="dr-shape-note" role="status">{wrongShape.length} frame{wrongShape.length === 1 ? " was" : "s were"} made at another shape ({formatName(aspect)} is {aspect} now). Regenerate to remake.</span>}
              {desktop && <button className="secondary" disabled={lbItems.length === 0} onClick={() => setQuality(0)} title="Brightness, contrast, colour, noise and size for this scene's frames. The original is kept; a corrected copy is saved beside it."><SlidersHorizontal size={14} /> Image quality</button>}
              <button className="secondary" onClick={planScene} disabled={!scene}><Wand2 size={14} /> Plan this scene</button>
              <button className="secondary" onClick={addShot} disabled={!scene}>Add shot</button>
              <button className="secondary" disabled={!needFrames.length} onClick={() => makeFrames(needFrames, false, true)} title="Make one frame first to check the look">Test one first</button>
              <button className="primary" disabled={!needFrames.length} onClick={() => makeFrames(needFrames)}><Sparkles size={15} /> Generate {needFrames.length} frame{needFrames.length === 1 ? "" : "s"}</button>
            </div>
          </div>
          {sceneShots.length === 0 && <div className="dr-empty"><p>No shots in this scene yet.</p><button className="primary" onClick={planScene} disabled={!scene}><Wand2 size={15} /> Plan the coverage for this scene</button></div>}
          <div className={`dr-cards ${view}${isPortrait(aspect) ? " portrait" : ""}`} onKeyDown={(e) => {
            if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key) || (e.target as HTMLElement).closest("input, textarea, select")) return;
            const i = sceneShots.findIndex((x) => x.id === shot?.id); if (i < 0) return;
            const j = Math.max(0, Math.min(sceneShots.length - 1, i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1)));
            e.preventDefault(); setSelected(sceneShots[j].id);
            requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-shot="${sceneShots[j].id}"] .dr-thumb`)?.focus());
          }}>
            {sceneShots.map((s, i) => {
              const frame = cardFrame(queue, s.id);
              const mine = frameJobs(queue, s.id);
              const live = mine.find((j) => ["queued", "generating", "validating"].includes(j.status));
              const warns = findings.filter((f) => f.shotId === s.id && f.level === "warn").length;
              const at = lbItems.findIndex((it) => it.job.id === frame?.id);
              return (
                <article key={s.id} className={`dr-card${s.id === shot?.id ? " on" : ""}${dragOver === s.id ? " drop" : ""}`} data-shot={s.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", s.id); e.dataTransfer.effectAllowed = "move"; }} onDragOver={(e) => { e.preventDefault(); if (dragOver !== s.id) setDragOver(s.id); }} onDragLeave={() => setDragOver((d) => (d === s.id ? null : d))} onDrop={(e) => { e.preventDefault(); setDragOver(null); reorderTo(e.dataTransfer.getData("text/plain"), s.id); }}>
                  <button className="dr-thumb" style={{ aspectRatio: String(ratioOf(aspect) || 16 / 9) }} onClick={() => setSelected(s.id)} onDoubleClick={() => at >= 0 && setLightbox(at)} aria-label={`Select ${s.title ?? s.id}`}>
                    {frame?.outputPath ? <img src={convertFileSrc(frame.outputPath)} alt={`Frame for ${s.title ?? s.id}`} /> : <FramePreview shot={s} aspect={aspect} />}
                    <span className="dr-num">{i + 1}</span>
                    <span className={`dr-state ${live ? "busy" : frame?.approved ? "ok" : frame ? "review" : ""}`}>{live ? live.status : frame?.approved ? "Approved" : frame ? (frame.rejected ? "Rejected" : frame.status === "needs-review" || (frame.status === "completed" && !frame.approved && frame.outputPath) ? "Needs review" : frame.status === "failed" && !frame.outputPath ? "Picture missing" : "Frame") : mine.some((j) => j.status === "failed" && /no longer on this computer/.test(j.error ?? "")) ? "Picture missing" : "No frame"}</span>
                    {warns > 0 && <span className="dr-warn" title="Continuity warnings"><AlertTriangle size={13} /> {warns}</span>}
                    {at >= 0 && <span className="dr-zoom" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setLightbox(at); }} onKeyDown={(e) => { if (e.key === "Enter") setLightbox(at); }} aria-label="Open full size"><Maximize2 size={14} /></span>}
                  </button>
                  <div className="dr-meta">
                    <b className="dr-name" title={s.title ?? s.id}>{s.title ?? s.id}</b>
                    <p className="dr-line">{s.action}</p>
                    <div className="dr-chips">
                      <i>{s.coverage ? coverageLabels[s.coverage] : "Shot"}</i>
                      <i>{s.size} · {s.lens}mm</i>
                      <i>{s.movement ? movementLabels[s.movement] : "Static"}</i>
                      <i>{s.duration}s</i>
                      {frame?.outputPath && !sameShape(frame.aspect, aspect) && <i className="off" title={`Made at ${frame.aspect}; the project is ${aspect}`}>Made at {frame.aspect}</i>}
                    </div>
                    {s.dialogue && !(s.title ?? "").includes(s.dialogue.slice(0, 24)) && <q>{s.speaker}: {s.dialogue}</q>}
                  </div>
                  <div className="dr-actions">
                    {frame?.status === "completed" && frame.outputPath && !live && !frame.approved && <button className="primary" onClick={() => approveFrame(frame)}><Check size={13} /> Approve</button>}
                    {frame?.status === "needs-review" && <button className="primary" onClick={() => approveFrame(frame)}><Check size={13} /> Approve</button>}
                    {!live && frame?.status !== "needs-review" && (!frame || frame.approved) && <button className={frame ? "secondary" : "primary"} onClick={() => makeFrames([s], true)}><Sparkles size={13} /> {frame ? "Regenerate" : "Generate frame"}</button>}
                    {!live && frame && !frame.approved && (frame.status === "completed" || frame.status === "needs-review") && frame.outputPath && !frame.rejected && <button className="secondary" onClick={() => rejectFrame(frame)}><X size={13} /> Reject</button>}
                    {live && <span className="dr-busy">{live.status}…</span>}
                    {mine.some((j) => j.status === "failed" && j.source !== "supplied" && j.prompt) && !live && <button className="secondary" onClick={() => { const j = mine.find((x) => x.status === "failed" && x.source !== "supplied" && x.prompt); if (j) setQueue((q) => retry(q, j.id)); }}>Retry</button>}
                    <div className="dr-more">
                      <button className="icon-mini" aria-haspopup="menu" aria-expanded={menuFor === s.id} aria-label="More actions" onClick={() => setMenuFor((m) => (m === s.id ? null : s.id))}><MoreHorizontal size={16} /></button>
                      {menuFor === s.id && (
                        <div className="dr-menu" role="menu" onMouseLeave={() => setMenuFor(null)}>
                          {frame?.approved && !live && <button role="menuitem" onClick={() => { setMenuFor(null); undoFrame(frame); }}><Undo2 size={14} /> Undo approval</button>}
                          {frame?.approved && !live && <button role="menuitem" onClick={() => { setMenuFor(null); rejectFrame(frame); }}><X size={14} /> Reject this frame</button>}
                          {frame?.rejected && !live && <button role="menuitem" onClick={() => { setMenuFor(null); undoFrame(frame); }}><Undo2 size={14} /> Undo reject</button>}
                          {frame && !frame.approved && !live && frame.status !== "needs-review" && <button role="menuitem" onClick={() => { setMenuFor(null); makeFrames([s], true); }}><Sparkles size={14} /> Regenerate</button>}
                          {desktop && <button role="menuitem" onClick={() => { setMenuFor(null); void useOwnFrame(s); }}><ImagePlus size={14} /> Use my own image</button>}
                          <button role="menuitem" onClick={() => { setMenuFor(null); move(s.id, -1); }}><ArrowUp size={14} /> Move earlier</button>
                          <button role="menuitem" onClick={() => { setMenuFor(null); move(s.id, 1); }}><ArrowDown size={14} /> Move later</button>
                          <button role="menuitem" onClick={() => { setMenuFor(null); duplicate(s); }}><Copy size={14} /> Duplicate shot</button>
                          <button role="menuitem" className="danger" onClick={() => { setMenuFor(null); remove(s.id); }}><Trash2 size={14} /> Delete shot</button>
                        </div>
                      )}
                    </div>
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

        <aside className="dr-inspector panel" aria-label="Shot editor" style={{ width: inspW }}>
          <div className="dr-resize" role="separator" aria-orientation="vertical" aria-label="Resize the shot editor" tabIndex={0}
            onPointerDown={(e) => { const x0 = e.clientX; const w0 = inspW; const move = (ev: PointerEvent) => setInspW(Math.min(640, Math.max(300, w0 + (x0 - ev.clientX)))); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }}
            onKeyDown={(e) => { if (e.key === "ArrowLeft") setInspW((w) => Math.min(640, w + 24)); if (e.key === "ArrowRight") setInspW((w) => Math.max(300, w - 24)); }} />
          {!shot ? <p className="helper">Select a shot to edit it.</p> : (
            <>
              <FramePreview shot={shot} aspect={aspect} />
              <label><span>Title</span><input value={shot.title ?? ""} onChange={(e) => update(shot.id, { title: e.target.value })} /></label>
              <Fold title="Camera" hint={`${shot.size ?? "MS"} · ${shot.lens ?? 40}mm`} defaultOpen id="camera">
                <div className="dr-two">
                  <label><span>Shot size</span><select value={shot.size ?? "MS"} onChange={(e) => { const size = e.target.value as ShotSize; update(shot.id, { size, lens: defaultLens[size], cameraFraming: sizeLabels[size] }); }}>{shotSizes.map((s) => <option key={s} value={s}>{sizeLabels[s]}</option>)}</select></label>
                  <label><span>Camera angle</span><select value={shot.angle ?? "eye-level"} onChange={(e) => update(shot.id, { angle: e.target.value as CameraAngle })}>{angles.map((a) => <option key={a} value={a}>{angleLabels[a]}</option>)}</select></label>
                  <label><span>Lens (mm)</span><input type="number" min={8} max={400} value={shot.lens ?? 40} onChange={(e) => update(shot.id, { lens: Number(e.target.value) || 40 })} /></label>
                  <label><span>Movement</span><select value={shot.movement ?? "static"} onChange={(e) => update(shot.id, { movement: e.target.value as Movement, cameraMovement: movementLabels[e.target.value as Movement] })}>{movements.map((m) => <option key={m} value={m}>{movementLabels[m]}</option>)}</select></label>
                  <label><span>Duration (s)</span><input type="number" min={1} max={30} step={0.5} value={shot.duration} onChange={(e) => update(shot.id, { duration: Math.max(1, Number(e.target.value) || 4) })} /></label>
                </div>
              </Fold>
              <ShotCameraLighting shot={shot} sceneShots={sceneShots} assets={analysis.assets} flat2D={!!style.spec2d} styleName={style.name} update={update} onLightingTest={lightingTest} />
              <Fold title="Composition" hint={`${shot.composition?.length ?? 0} guides`} id="composition">
                <div className="dr-checks">{compositionRules.map((c) => { const on = !!shot.composition?.includes(c); return <label key={c} className={on ? "on" : ""}><input type="checkbox" checked={on} onChange={() => update(shot.id, { composition: on ? (shot.composition ?? []).filter((x) => x !== c) : [...(shot.composition ?? []), c] })} /> {c}</label>; })}</div>
              </Fold>
              <Fold title="Blocking" hint={shot.screenDir === "L>R" ? "facing right" : shot.screenDir === "R>L" ? "facing left" : "neutral"} id="blocking">
                <div className="seg wide" role="group" aria-label="Screen direction">
                  {([["neutral", "Neutral"], ["L>R", "Facing right"], ["R>L", "Facing left"]] as const).map(([v, label]) => <button key={v} className={(shot.screenDir ?? "neutral") === v ? "on" : ""} aria-pressed={(shot.screenDir ?? "neutral") === v} onClick={() => update(shot.id, { screenDir: v as ScreenDir })}>{label}</button>)}
                </div>
              </Fold>
              <Fold title="Cast and wardrobe" hint={`${shot.assetIds.filter((id) => characters.some((c) => c.id === id)).length} in shot`} defaultOpen id="cast">
                <div className="dr-tiles">{characters.map((c) => { const on = shot.assetIds.includes(c.id); return <button key={c.id} className={on ? "on" : ""} aria-pressed={on} onClick={() => update(shot.id, { assetIds: on ? shot.assetIds.filter((x) => x !== c.id) : [...shot.assetIds, c.id], focusAssetId: shot.focusAssetId ?? c.id })}>{on && <Check size={13} />} {c.name}</button>; })}</div>
                {shot.assetIds.filter((id) => characters.some((c) => c.id === id)).map((id) => { const c = characters.find((x) => x.id === id)!; const looks = ["Canonical", ...new Set((analysis.story?.variants ?? []).filter((v) => v.character.toUpperCase() === c.name.toUpperCase()).map((v) => v.value))]; return <label key={id} className="dr-look"><span>{c.name} wears</span><select value={shot.looks?.[id] ?? "Canonical"} onChange={(e) => update(shot.id, { looks: { ...(shot.looks ?? {}), [id]: e.target.value } })}>{looks.map((l) => <option key={l}>{l}</option>)}</select></label>; })}
                <label className="dr-look"><span>Set</span><select value={shot.setAssetId ?? ""} onChange={(e) => update(shot.id, { setAssetId: e.target.value || undefined, assetIds: [...shot.assetIds.filter((x) => !sets.some((s) => s.id === x)), ...(e.target.value ? [e.target.value] : [])] })}><option value="">None</option>{sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              </Fold>
              <Fold title="Lighting" hint={shot.lighting ? "set" : "from the scene"} id="lighting">
                <label><span>Time of day, style, atmosphere</span><input value={shot.lighting} onChange={(e) => update(shot.id, { lighting: e.target.value })} placeholder="e.g. warm low sun, soft haze" /></label>
              </Fold>
              <Fold title="Performance" hint={shot.emotion ?? "neutral"} id="performance">
                <label><span>Action</span><textarea rows={3} value={shot.action} onChange={(e) => update(shot.id, { action: e.target.value })} /></label>
                <label><span>Feeling</span><select value={shot.emotion ?? "neutral"} onChange={(e) => update(shot.id, { emotion: e.target.value })}>{emotions.map((e) => <option key={e}>{e}</option>)}</select></label>
                <label><span>Acting direction</span><input value={shot.facialActing} onChange={(e) => update(shot.id, { facialActing: e.target.value })} /></label>
                <label><span>Micro-animation</span><input value={shot.microAnimation} onChange={(e) => update(shot.id, { microAnimation: e.target.value })} /></label>
              </Fold>
              <Fold title="Audio" hint={shot.dialogue ? "dialogue" : "none"} id="audio">
                <div className="dr-two">
                  <label><span>Speaker</span><input value={shot.speaker} onChange={(e) => update(shot.id, { speaker: e.target.value.toUpperCase() })} /></label>
                  <label><span>Music</span><input value={shot.music} onChange={(e) => update(shot.id, { music: e.target.value })} /></label>
                </div>
                <label><span>Dialogue (from the script)</span><textarea rows={2} value={shot.dialogue} onChange={(e) => update(shot.id, { dialogue: e.target.value })} /></label>
                <label><span>Sound effects</span><input value={shot.soundEffects} onChange={(e) => update(shot.id, { soundEffects: e.target.value })} placeholder="Sound effects, silence" /></label>
                <label><span>Ambience</span><input value={shot.ambience} onChange={(e) => update(shot.id, { ambience: e.target.value })} /></label>
              </Fold>
            </>
          )}
        </aside>
      </div>

      <Animatic shots={shots} queue={queue} scenes={analysis.scenes} />
      {quality !== null && lbItems.length > 0 && (
        <CleanRender items={lbItems.map((it) => it.job)} index={Math.min(quality, lbItems.length - 1)} onIndex={setQuality} onClose={() => setQuality(null)} notify={notify}
          onSaved={(from, file) => { const out = addCleaned(queue, from, file); setQueue(() => out.state); if (out.job.approved) update(out.job.assetId, { storyboardStatus: "approved" }); }} />
      )}
      {lightbox !== null && lbItems.length > 0 && <Lightbox items={lbItems} index={Math.min(lightbox, lbItems.length - 1)} onIndex={setLightbox} onClose={() => setLightbox(null)} onApprove={approveFrame} onReject={rejectFrame} onReconsider={undoFrame} />}
    </div>
  );
}
