import { useMemo, useState } from "react";
import { AlertTriangle, Check, MessageSquareWarning, X } from "lucide-react";
import { RealImage } from "../components/RealImage";
import { approve, reject, type ImageJob, type QueueState } from "../domain/generationQueue";
import type { AnalysisResult } from "../domain/productionStudio";
import { approvedReference, awaitingReview, turnedDown } from "../domain/review";
import { primaryViewKeys } from "../domain/sheetSpecs";

type Filter = "waiting" | "turned-down";

/**
 * Review: one picture at a time, large, next to the approved reference it has to match. Technical checks are shown separately from the creative decision.
 * Nothing here starts paid work: "Request changes" turns the picture down and opens its sheet, where changes are made and generation is a separate, deliberate step.
 */
export function ReviewView(props: {
  analysis: AnalysisResult;
  queue: QueueState;
  setQueue: (update: (q: QueueState) => QueueState) => void;
  onApproved: (job: ImageJob, primary: boolean) => void;
  openAsset: (assetId: string, sheetType: string) => void;
  openDesign: () => void;
  notify: (message: string) => void;
}) {
  const { analysis, queue, setQueue, onApproved, openAsset, openDesign, notify } = props;
  const [filter, setFilter] = useState<Filter>("waiting");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const waiting = useMemo(() => awaitingReview(queue), [queue]);
  const down = useMemo(() => turnedDown(queue), [queue]);
  const list = filter === "waiting" ? waiting : down;
  const job = list.find((j) => j.id === pickedId) ?? list[0];
  const reference = job ? approvedReference(queue, job) : null;
  const assetName = (id: string) => analysis.assets.find((a) => a.id === id)?.name ?? id;

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
    notify(thenOpen ? `${j.label} turned down. Change the notes on the sheet, then generate again when you are ready.` : `${j.label} rejected. The file is kept; a new revision can be generated later.`);
    if (thenOpen) openAsset(j.assetId, j.sheetType); else decideNext(j);
  };

  return (
    <section className="rv" aria-label="Review">
      <header className="rv-head">
        <div><h2>Review pictures</h2><p>{waiting.length ? `${waiting.length} waiting for your decision` : "Nothing is waiting for your decision"}</p></div>
        <div className="rv-filter" role="group" aria-label="Show">
          <button className={filter === "waiting" ? "on" : ""} aria-pressed={filter === "waiting"} onClick={() => { setFilter("waiting"); setPickedId(null); }}>Waiting ({waiting.length})</button>
          <button className={filter === "turned-down" ? "on" : ""} aria-pressed={filter === "turned-down"} onClick={() => { setFilter("turned-down"); setPickedId(null); }}>Turned down ({down.length})</button>
        </div>
      </header>

      {!job ? (
        <div className="rv-empty">
          <p>{filter === "waiting" ? "All caught up. New pictures appear here as soon as they are made and checked." : "Nothing has been turned down."}</p>
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

          <div className="rv-compare" aria-label="Comparison">
            {reference && (
              <figure>
                <figcaption><span className="rv-tag ok">Approved reference</span><small>{reference.label} · revision {reference.revision}</small></figcaption>
                <div className="rv-image"><RealImage path={reference.outputPath} label={`Approved ${reference.label} of ${assetName(reference.assetId)}`} empty="No picture" /></div>
              </figure>
            )}
            <figure>
              <figcaption><span className="rv-tag">{filter === "waiting" ? `New · revision ${job.revision}` : `Turned down · revision ${job.revision}`}</span><small>{job.label}</small></figcaption>
              <div className="rv-image"><RealImage path={job.outputPath} label={`${job.label} of ${assetName(job.assetId)}, revision ${job.revision}`} empty="No picture" /></div>
            </figure>
            {!reference && <p className="rv-note">No approved reference exists for {assetName(job.assetId)} yet, so there is nothing to compare against.</p>}
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
              <button className="primary" disabled={job.approved || job.status === "failed"} onClick={() => doApprove(job)}><Check size={15} aria-hidden="true" /> Approve</button>
              <button className="secondary" disabled={job.rejected} onClick={() => doReject(job, true)} title="Turns this picture down and opens its sheet. Nothing is generated."><MessageSquareWarning size={15} aria-hidden="true" /> Request changes</button>
              <button className="secondary" disabled={job.rejected} onClick={() => doReject(job, false)}><X size={15} aria-hidden="true" /> Reject</button>
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
    </section>
  );
}
