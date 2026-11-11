import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Copy, Download, PackageCheck, Play, RotateCcw } from "lucide-react";
import { committedUsd, retry, type QueueState } from "../domain/generationQueue";
import { videoPresets, type AnalysisResult, type CompiledShotPackage, type SceneCoverage, type ShotRecord, type VideoModel } from "../domain/productionStudio";
import { Fold } from "./Fold";

const videoPurposes = {
  turnaround: "Character turnaround · preserve identity across front, side and back views",
  acting: "Acting performance · generate believable facial and body performance",
  posing: "Pose study · explore readable body language and silhouette",
  expression: "Expression test · explore facial emotion and micro-performance",
} as const;
type VideoPurpose = keyof typeof videoPurposes;
import { AgentDepartmentBoard } from "./AgentDepartmentBoard";

type Audit = { ready: boolean; missingAssets: string[]; incompleteShots: string[] };

/** Deliver: what is ready, what is not and where to fix it, the shot compiler with an editable prompt, and the three ways to hand the work on. */
export function DeliveryCenter(props: {
  analysis: AnalysisResult;
  shots: ShotRecord[];
  audit: Audit;
  sceneCoverage: SceneCoverage[];
  queue: QueueState;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  compiled: CompiledShotPackage;
  model: VideoModel;
  setModel: (m: VideoModel) => void;
  selectedShot: number;
  setSelectedShot: (i: number) => void;
  kieConfigured: boolean;
  submitting: boolean;
  onExportShot: () => void;
  onBuild: () => void;
  onDirect: () => void;
  openAsset: (assetId: string) => void;
  openShot: (shotId: string) => void;
  notify: (message: string) => void;
  styleLocked: boolean;
}) {
  const { analysis, shots, audit, sceneCoverage, queue, setQueue, compiled, model, setModel, selectedShot, setSelectedShot, kieConfigured, submitting, onExportShot, onBuild, onDirect, openAsset, openShot, notify, styleLocked } = props;
  const [videoPurpose, setVideoPurpose] = useState<VideoPurpose>("acting");
  const preset = videoPresets[model];
  const name = (id: string) => analysis.assets.find((a) => a.id === id)?.name ?? id;
  const kind = (id: string) => analysis.assets.find((a) => a.id === id)?.type ?? "asset";
  const sceneName = (id: string) => analysis.scenes.find((s) => s.id === id)?.heading ?? id;
  const shotName = (id: string) => { const s = shots.find((x) => x.id === id); return s ? `${s.title ?? s.id}` : id; };
  const failed = queue.jobs.filter((j) => j.status === "failed");
  const needsReview = queue.jobs.filter((j) => j.status === "needs-review").length;
  const active = queue.jobs.filter((j) => ["queued", "generating", "validating", "pending"].includes(j.status)).length;
  const total = Math.max(1, analysis.assets.length);
  const percent = audit.ready ? 100 : Math.round(((analysis.assets.length - audit.missingAssets.length) / total) * 100);
  const [prompt, setPrompt] = useState(compiled.prompt);
  const [edited, setEdited] = useState(false);
  useEffect(() => { setPrompt(`${videoPurposes[videoPurpose]}\n\n${compiled.prompt}`); setEdited(false); }, [compiled.prompt, compiled.shotId, model, videoPurpose]);
  const refsOver = (shots[selectedShot]?.assetIds.length ?? 0) > preset.maxReferences;

  const issues = useMemo(() => sceneCoverage.filter((s) => s.missingAssets.length || s.incompleteShots.length || s.warnings.length), [sceneCoverage]);
  const next = !analysis.assets.length ? { label: "Analyze a script in Story first", go: undefined as (() => void) | undefined }
    : audit.missingAssets.length ? { label: `Make and approve ${audit.missingAssets.length} reference sheet${audit.missingAssets.length === 1 ? "" : "s"}, starting with ${name(audit.missingAssets[0])}`, go: () => openAsset(audit.missingAssets[0]) }
    : audit.incompleteShots.length ? { label: `Finish ${audit.incompleteShots.length} storyboard frame${audit.incompleteShots.length === 1 ? "" : "s"}, starting with ${shotName(audit.incompleteShots[0])}`, go: () => openShot(audit.incompleteShots[0]) }
    : { label: "Everything is approved: export the verified package", go: onBuild };

  const copy = async () => { try { await navigator.clipboard.writeText(prompt); notify("Prompt copied."); } catch { notify("Could not copy. Select the text and copy it."); } };

  return (
    <section className="dc" aria-label="Delivery">
      <div className="dc-summary">
        <div className={`dc-ready ${audit.ready ? "ok" : "todo"}`}>
          <span className="eyebrow">Production readiness</span>
          <b>{percent}%</b>
          <small>{audit.ready ? "Ready to package" : "Action required"}</small>
          <i className="dc-bar"><u style={{ width: `${percent}%` }} /></i>
        </div>
        <dl className="dc-stats">
          <div><dt>Missing assets</dt><dd>{audit.missingAssets.length}</dd></div>
          <div><dt>Incomplete shots</dt><dd>{audit.incompleteShots.length}</dd></div>
          <div><dt>Active jobs</dt><dd>{active}</dd></div>
          <div><dt>Failed jobs</dt><dd className={failed.length ? "bad" : ""}>{failed.length}</dd></div>
          <div><dt>Needs review</dt><dd className={needsReview ? "warn" : ""}>{needsReview}</dd></div>
          <div><dt>Recorded spend</dt><dd>{queue.perImageUsd === null ? "Unknown" : `$${committedUsd(queue).toFixed(2)}`}</dd></div>
        </dl>
        <div className="dc-next">
          <span className="eyebrow">Next recommended action</span>
          <p>{next.label}</p>
          {next.go && <button className="primary" onClick={next.go}>{audit.ready ? <PackageCheck size={15} /> : <ArrowRight size={15} />} {audit.ready ? "Build the package" : "Take me there"}</button>}
        </div>
      </div>

      <AgentDepartmentBoard analysis={analysis} queue={queue} audit={audit} styleLocked={styleLocked} notify={notify} />

      <div className="dc-cols">
        <div className="panel dc-issues">
          <h3>What still needs work</h3>
          {failed.length > 0 && (
            <div className="dc-group">
              <h4><AlertTriangle size={15} /> Failed jobs <small>{failed.length}</small></h4>
              <ul>{failed.slice(0, 8).map((j) => (
                <li key={j.id}><span><b>{j.label}</b><small>{j.error ?? "The provider returned an error."}</small></span><button className="secondary" onClick={() => setQueue((q) => retry(q, j.id))}><RotateCcw size={13} /> Retry</button></li>
              ))}</ul>
            </div>
          )}
          {issues.length === 0 && failed.length === 0 && <p className="helper">Nothing is blocking delivery.</p>}
          {issues.map((s) => (
            <div className="dc-group" key={s.sceneId}>
              <h4>{sceneName(s.sceneId)} <small>{s.videoReady ? "video ready" : `${s.verifiedAssets.length}/${s.requiredAssets.length} references · ${s.plannedShots.length} shots`}</small></h4>
              <ul>
                {s.missingAssets.map((id) => (
                  <li key={id} title={id}><span><b>{name(id)}</b><small>{kind(id)} · no approved sheet yet</small></span><button className="secondary" onClick={() => openAsset(id)}>Open sheet</button></li>
                ))}
                {s.incompleteShots.map((id) => (
                  <li key={id} title={id}><span><b>{shotName(id)}</b><small>storyboard frame not approved</small></span><button className="secondary" onClick={() => openShot(id)}>Review shot</button></li>
                ))}
                {s.warnings.map((w) => <li key={w} className="warn"><span><small>{w}</small></span></li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="panel dc-compiler">
          <h3>Shot compiler</h3>
          <div className="dc-two">
            <label><span>Shot</span>
              <select value={selectedShot} onChange={(e) => setSelectedShot(Number(e.target.value))}>
                {shots.length === 0 && <option value={0}>No shots planned</option>}
                {shots.map((s, i) => <option key={s.id} value={i}>{i + 1}. {s.title ?? s.id}</option>)}
              </select></label>
            <label><span>Video model · motion tests and shot delivery</span>
              <select value={model} onChange={(e) => setModel(e.target.value as VideoModel)}>{Object.keys(videoPresets).map((m) => <option key={m}>{m}</option>)}</select></label>
            <label><span>Video purpose</span>
              <select aria-label="Choose video purpose" value={videoPurpose} onChange={(e) => setVideoPurpose(e.target.value as VideoPurpose)}>{Object.entries(videoPurposes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          </div>
          <div className="video-model-card"><b>{preset.provider} · {preset.model}</b><span>{preset.tasks.join(' · ')}</span><small>{preset.note}</small></div>
          <ul className="dc-caps">
            <li className={refsOver ? "bad" : "ok"}>{refsOver ? <AlertTriangle size={14} /> : <Check size={14} />} {compiled.references.length} of {preset.maxReferences} references</li>
            <li className="ok"><Check size={14} /> {preset.supportsAudio ? "Model audio" : "Audio added in post"}</li>
            <li className="ok"><Check size={14} /> {preset.supportsFirstLastFrame ? "First and last frames" : "Single frame"}</li>
            <li className={preset.verified ? "ok" : "bad"}>{preset.verified ? <Check size={14} /> : <AlertTriangle size={14} />} {preset.verified ? "Limits verified" : "Export only: limits not verified"}</li>
          </ul>
          <label className="dc-prompt"><span>Compiled prompt {edited && <em>edited</em>}</span>
            <textarea value={prompt} rows={9} onChange={(e) => { setPrompt(e.target.value); setEdited(true); }} />
          </label>
          <div className="dc-row">
            <button className="secondary" onClick={() => void copy()}><Copy size={14} /> Copy prompt</button>
            {edited && <button className="tertiary" onClick={() => { setPrompt(compiled.prompt); setEdited(false); }}>Reset</button>}
            <button className="secondary" onClick={onExportShot}><Download size={14} /> Export shot package</button>
          </div>
          {compiled.warnings.length > 0 && (
            <Fold title="Warnings" hint={`${compiled.warnings.length}`} defaultOpen>
              <ul className="dc-warns">{compiled.warnings.map((w) => <li key={w}><AlertTriangle size={14} /> {w}</li>)}</ul>
            </Fold>
          )}
          <Fold title="References in this shot" hint={`${compiled.references.length}`}>
            <ul className="dc-refs">{compiled.references.map((id) => <li key={id} title={id}>{name(id)} <small>{kind(id)}</small></li>)}{compiled.references.length === 0 && <li>None linked yet.</li>}</ul>
          </Fold>
        </div>

        <div className="panel dc-export">
          <h3>Hand it on</h3>
          <div className="dc-option">
            <button className="primary" disabled={!audit.ready} onClick={onBuild}><PackageCheck size={15} /> Export verified package</button>
            <small>{audit.ready ? "Every sheet and frame is approved." : `Needs ${audit.missingAssets.length} approved sheet${audit.missingAssets.length === 1 ? "" : "s"} and ${audit.incompleteShots.length} approved frame${audit.incompleteShots.length === 1 ? "" : "s"}.`}</small>
          </div>
          <div className="dc-option">
            <button className="secondary" onClick={onBuild}><Download size={15} /> Export draft package</button>
            <small>Clearly marked as a draft. Includes what exists now, with warnings for what does not.</small>
          </div>
          <div className="dc-option">
            <button className="secondary" disabled={!kieConfigured || model !== "Seedance 2.0" || submitting} onClick={onDirect}><Play size={15} /> {submitting ? "Submitting…" : "Generate directly with Kie.ai"}</button>
            <small>{!kieConfigured ? "Add a Kie.ai key in Providers first." : model !== "Seedance 2.0" ? "Direct generation is available for Seedance 2.0." : "Sends this shot to Kie.ai and uses credits."}</small>
          </div>
          <p className="helper">Packages keep stable IDs, dialogue, acting and audio direction, original references, the style bible, the revision ledger, the model record and warnings.</p>
        </div>
      </div>
    </section>
  );
}
