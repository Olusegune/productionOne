import { useMemo, useState } from "react";
import { AlertTriangle, Check, MessageSquareWarning, Undo2, X } from "lucide-react";
import { RealImage } from "../components/RealImage";
import { approve, reconsider, reject, type ImageJob, type QueueState } from "../domain/generationQueue";
import type { AnalysisResult, ShotRecord } from "../domain/productionStudio";
import type { StyleBible } from "../domain/visualDevelopment";
import type { ProportionProfile } from "../domain/proportions";
import type { FitRule } from "../domain/fit";
import type { SceneState } from "../domain/sceneState";
import type { Reviews } from "../domain/visualReview";
import type { Ledgers } from "../domain/correction";
import { VisualReviewPanel } from "../components/VisualReviewPanel";
import { localVision } from "../data/visionReview";
import { useLocalAi } from "../data/localAi";
import { approvedPictures, approvedReference, awaitingReview, defaultCompareTarget, keepRevision, otherRevisions, turnedDown } from "../domain/review";
import { primaryViewKeys } from "../domain/sheetSpecs";
import { ZoomImage, ZoomToolbar, useZoomSync } from "../components/ZoomCompare";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Filter = "waiting" | "turned-down" | "approved";
type CompareMode = "reference" | "revisions";

/**
 * Review: one picture at a time, large, next to the approved reference it has to match. Technical checks are shown separately from the creative decision.
 * Nothing here starts paid work: "Request changes" turns the picture down and opens its sheet, where changes are made and generation is a separate, deliberate step.
 */
export function ReviewView(props: {
  analysis: AnalysisResult;
  queue: QueueState;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  onApproved: (job: ImageJob, primary: boolean) => void;
  onUnapproved: (job: ImageJob) => void;
  openAsset: (assetId: string, sheetType: string) => void;
  openDesign: () => void;
  notify: (message: string) => void;
  shots?: ShotRecord[];
  style?: StyleBible;
  reviews?: Reviews;
  setReviews?: (update: (r: Reviews) => Reviews) => void;
  ledgers?: Ledgers;
  setLedgers?: (update: (l: Ledgers) => Ledgers) => void;
  proportions?: Record<string, ProportionProfile>;
  setProportions?: (update: (p: Record<string, ProportionProfile>) => Record<string, ProportionProfile>) => void;
  fitRules?: Record<string, FitRule[]>;
  sceneStates?: Record<string, SceneState>;
}) {
  const { analysis, queue, setQueue, onApproved, onUnapproved, openAsset, openDesign, notify } = props;
  const local = useLocalAi("__TAURI_INTERNALS__" in window);
  const vision = useMemo(() => localVision(local.config), [local.config]);
  const [filter, setFilter] = useState<Filter>("waiting");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const waiting = useMemo(() => awaitingReview(queue), [queue]);
  const down = useMemo(() => turnedDown(queue), [queue]);
  const approvedList = useMemo(() => approvedPictures(queue), [queue]);
  const list = filter === "waiting" ? waiting : filter === "approved" ? approvedList : down;
  const job = list.find((j) => j.id === pickedId) ?? list[0];
  const reference = job ? approvedReference(queue, job) : null;
  const others = useMemo(() => (job ? otherRevisions(queue, job) : []), [queue, job]);
  const [mode, setMode] = useState<CompareMode>("reference");
  const [takeId, setTakeId] = useState<string | null>(null);
  const take = others.find((j) => j.id === takeId) ?? (job ? defaultCompareTarget(queue, job) : null);
  const comparing = mode === "revisions" && !!take;
  const assetName = (id: string) => analysis.assets.find((a) => a.id === id)?.name ?? id;
  const zoom = useZoomSync(job?.id ?? "");
  const position = job ? list.findIndex((j) => j.id === job.id) : -1;
  const nextJob = position >= 0 ? list[position + 1] : undefined;
  const step = (delta: number) => { const to = list[position + delta]; if (to) setPickedId(to.id); };

  const decideNext = (from: ImageJob) => {
    const index = list.findIndex((j) => j.id === from.id);
    const next = list[index + 1] ?? list[index - 1];
    setPickedId(next && next.id !== from.id ? next.id : null);
  };
  const doApprove = (j: ImageJob) => {
    setQueue((q) => approve(q, j.id));
    onApproved(j, primaryViewKeys.includes(j.viewKey));
    notify(`${assetName(j.assetId)} · ${j.label} approved.`);
    decideNext(j);
  };
  const doReject = (j: ImageJob, thenOpen: boolean) => {
    setQueue((q) => reject(q, j.id));
    if (j.approved) onUnapproved(j);
    notify(thenOpen ? `${j.label} turned down. Change the notes on the sheet, then generate again when you are ready.` : `${j.label} rejected. The file is kept; a new revision can be generated later.`);
    if (thenOpen) openAsset(j.assetId, j.sheetType); else decideNext(j);
  };

  const doUndo = (j: ImageJob) => {
    setQueue((q) => reconsider(q, j.id));
    if (j.approved) onUnapproved(j);
    notify(`${assetName(j.assetId)} · ${j.label} is back to waiting for your decision.`);
    if (filter !== "waiting") setFilter("waiting");
    setPickedId(j.id);
  };

  const doKeep = (keep: ImageJob) => {
    if (!job) return;
    setQueue((q) => keepRevision(q, keep.id));
    onApproved(keep, primaryViewKeys.includes(keep.viewKey));
    notify(`${assetName(keep.assetId)} · ${keep.label}: kept revision ${keep.revision}. The other takes were turned down and their files are kept.`);
    decideNext(job);
  };

  return (
    <section className="rv" aria-label="Review">
      <header className="rv-head">
        <div><h2>Review pictures</h2><p>{waiting.length ? `${waiting.length} waiting for your decision` : "Nothing is waiting for your decision"}</p></div>
        <div className="rv-filter" role="group" aria-label="Show">
          <button className={filter === "waiting" ? "on" : ""} aria-pressed={filter === "waiting"} onClick={() => { setFilter("waiting"); setPickedId(null); }}>Waiting ({waiting.length})</button>
          <button className={filter === "turned-down" ? "on" : ""} aria-pressed={filter === "turned-down"} onClick={() => { setFilter("turned-down"); setPickedId(null); }}>Turned down ({down.length})</button>
          <button className={filter === "approved" ? "on" : ""} aria-pressed={filter === "approved"} onClick={() => { setFilter("approved"); setPickedId(null); }}>Approved ({approvedList.length})</button>
        </div>
      </header>

      {!job ? (
        <div className="rv-empty">
          <p>{filter === "waiting" ? "All caught up. New pictures appear here as soon as they are made and checked." : filter === "approved" ? "Nothing is approved yet." : "Nothing has been turned down."}</p>
          <button className="secondary" onClick={openDesign}>Open Design</button>
        </div>
      ) : (
        <div className="rv-body">
          <ul className="rv-list" aria-label="Pictures">
            {list.map((j) => (
              <li key={j.id}>
                <button className={j.id === job.id ? "on" : ""} aria-current={j.id === job.id ? "true" : undefined} onClick={() => setPickedId(j.id)}>
                  <span className="rv-thumb"><RealImage path={j.outputPath} label="" empty="No picture" /></span>
                  <span className="rv-meta"><b>{assetName(j.assetId)} · {j.label}</b><small>{j.sheetType} · revision {j.revision}</small></span>
                </button>
              </li>
            ))}
          </ul>

          <div className="rv-center">
            {others.length > 0 && (
              <div className="rv-mode" role="group" aria-label="Compare with">
                <button className={!comparing ? "on" : ""} aria-pressed={!comparing} onClick={() => setMode("reference")}>Approved reference</button>
                <button className={comparing ? "on" : ""} aria-pressed={comparing} onClick={() => setMode("revisions")}>Other takes ({others.length})</button>
                {comparing && (
                  <label className="rv-take"><span>Compare with</span>
                    <select value={take?.id} onChange={(e) => setTakeId(e.target.value)}>
                      {others.map((o) => <option key={o.id} value={o.id}>Revision {o.revision}{o.approved ? " (approved)" : o.rejected ? " (turned down)" : " (waiting)"}</option>)}
                    </select></label>
                )}
              </div>
            )}
            <ZoomToolbar z={zoom} />
            <div className="rv-compare" aria-label="Comparison">
              {comparing && take ? (
                <>
                  <figure>
                    <figcaption><span className={`rv-tag${take.approved ? " ok" : ""}`}>{take.approved ? "Approved" : take.rejected ? "Turned down" : "Waiting"} · revision {take.revision}</span><small>{take.label}</small></figcaption>
                    <ZoomImage z={zoom} index={0} path={take.outputPath} label={`${take.label} of ${assetName(take.assetId)}, revision ${take.revision}`} empty="No picture" />
                    <button className="secondary rv-keep" onClick={() => doKeep(take)}><Check size={15} aria-hidden="true" /> Keep revision {take.revision}</button>
                  </figure>
                  <figure>
                    <figcaption><span className="rv-tag">{filter === "waiting" ? `New · revision ${job.revision}` : filter === "approved" ? `Approved · revision ${job.revision}` : `Turned down · revision ${job.revision}`}</span><small>{job.label}</small></figcaption>
                    <ZoomImage z={zoom} index={1} path={job.outputPath} label={`${job.label} of ${assetName(job.assetId)}, revision ${job.revision}`} empty="No picture" />
                    <button className="secondary rv-keep" onClick={() => doKeep(job)}><Check size={15} aria-hidden="true" /> Keep revision {job.revision}</button>
                  </figure>
                  <p className="rv-note">Keeping one approves it and turns the other down. Nothing is deleted and nothing is generated.</p>
                </>
              ) : (
                <>
                  {reference && (
                    <figure>
                      <figcaption><span className="rv-tag ok">Approved reference</span><small>{reference.label} · revision {reference.revision}</small></figcaption>
                      <ZoomImage z={zoom} index={0} path={reference.outputPath} label={`Approved ${reference.label} of ${assetName(reference.assetId)}`} empty="No picture" />
                    </figure>
                  )}
                  <figure>
                    <figcaption><span className="rv-tag">{filter === "waiting" ? `New · revision ${job.revision}` : filter === "approved" ? `Approved · revision ${job.revision}` : `Turned down · revision ${job.revision}`}</span><small>{job.label}</small></figcaption>
                    <ZoomImage z={zoom} index={1} path={job.outputPath} label={`${job.label} of ${assetName(job.assetId)}, revision ${job.revision}`} empty="No picture" />
                  </figure>
                  {!reference && <p className="rv-note">No approved reference exists for {assetName(job.assetId)} yet, so there is nothing to compare against.</p>}
                </>
              )}
            </div>
            <div className="rv-summary" aria-label="Review summary">
              <b>Review summary</b>
              <span>{assetName(job.assetId)} · {job.label} · revision {job.revision}</span>
              <span className={`rv-chip${reference ? " ok" : ""}`}>Reference: {reference ? `approved, revision ${reference.revision}` : "none yet"}</span>
              <span className={`rv-chip${job.approved ? " ok" : job.rejected ? " warn" : ""}`}>This picture: {job.approved ? "approved" : job.rejected ? "turned down" : "awaiting your decision"}</span>
              <span className={`rv-chip${job.qaNotes.length ? " warn" : " ok"}`}>Technical checks: {job.qaNotes.length ? `${job.qaNotes.length} finding${job.qaNotes.length === 1 ? "" : "s"}` : "no findings"}</span>
            </div>
            <div className="rv-nav" role="group" aria-label="Move through the pictures">
              <span className="rv-count">{filter === "waiting" ? `${waiting.length} awaiting decision` : filter === "approved" ? `${approvedList.length} approved` : `${down.length} turned down`} · {position + 1} of {list.length}</span>
              {nextJob && <span className="rv-next">Next: <span className="rv-thumb"><RealImage path={nextJob.outputPath} label="" empty="" /></span> <b>{assetName(nextJob.assetId)} · {nextJob.label} · revision {nextJob.revision}</b></span>}
              <span className="rv-steps">
                <button type="button" className="secondary" onClick={() => step(-1)} disabled={position <= 0} aria-label="Previous picture"><ChevronLeft size={16} aria-hidden="true" /></button>
                <button type="button" className="secondary" onClick={() => step(1)} disabled={position < 0 || position >= list.length - 1} aria-label="Next picture"><ChevronRight size={16} aria-hidden="true" /></button>
              </span>
            </div>
          </div>

          <aside className="rv-side" aria-label="Decision">
            <h3>{assetName(job.assetId)} / {job.label}</h3>
            <p className="rv-status">{job.approved ? "Approved" : job.rejected ? "Turned down" : "Needs your decision"}</p>

            <h4>Technical checks</h4>
            {job.qaNotes.length === 0
              ? <p className="rv-ok"><Check size={14} aria-hidden="true" /> No automatic findings.</p>
              : <ul className="rv-findings">{job.qaNotes.map((n) => <li key={n}><AlertTriangle size={14} aria-hidden="true" /> {n}</li>)}</ul>}
            <p className="rv-hint">These are measurements, not a verdict. Whether the picture is right is your call.</p>

            <div className="rv-actions" role="group" aria-label="Decide">
              <button className="primary" disabled={job.approved || job.status === "failed" || !job.outputPath} onClick={() => doApprove(job)}><Check size={15} aria-hidden="true" /> Approve</button>
              <button className="secondary" disabled={job.rejected} onClick={() => doReject(job, true)} title="Turns this picture down and opens its sheet. Nothing is generated."><MessageSquareWarning size={15} aria-hidden="true" /> Request changes</button>
              <button className="secondary" disabled={job.rejected} onClick={() => doReject(job, false)}><X size={15} aria-hidden="true" /> Reject</button>
              {(job.approved || job.rejected) && <button className="tertiary" onClick={() => doUndo(job)} title="Takes back this decision. The picture goes back to waiting; nothing is generated or deleted."><Undo2 size={15} aria-hidden="true" /> {job.approved ? "Take back approval" : "Not decided"}</button>}
            </div>
            <p className="rv-hint">Request changes opens the sheet so you can adjust the notes. Generating again is a separate step and never happens from here.</p>

            <details className="rv-more"><summary>Generation details</summary>
              <dl>
                <div><dt>Provider</dt><dd>{job.provider}</dd></div>
                <div><dt>Model</dt><dd>{job.model}</dd></div>
                <div><dt>Source</dt><dd>{job.source ?? "generated"}</dd></div>
                <div><dt>Attempts</dt><dd>{job.attempts}</dd></div>
                <div><dt>Size</dt><dd>{job.width && job.height ? `${job.width} × ${job.height}` : "unknown"}</dd></div>
              </dl>
              <label className="rv-prompt"><span>Prompt</span><textarea readOnly rows={6} value={job.prompt} /></label>
            </details>
          </aside>
        </div>
      )}
      {props.reviews && props.setReviews && props.setLedgers && props.setProportions && props.style && (
      <VisualReviewPanel shots={props.shots ?? []} ledgers={props.ledgers ?? {}} proportions={props.proportions ?? {}} fitRules={props.fitRules ?? {}} sceneStates={props.sceneStates ?? {}} analysis={analysis} queue={queue} setQueue={setQueue} style={props.style} reviews={props.reviews} setReviews={props.setReviews} setLedgers={props.setLedgers} setProportions={props.setProportions} vision={vision} notify={notify} />
      )}
    </section>
  );
}
