import { useMemo, useState } from "react";
import { ScanEye } from "lucide-react";
import { useLocalAi } from "../data/localAi";
import { localVision } from "../data/visionReview";
import type { ImageJob } from "../domain/generationQueue";
import type { StyleBible } from "../domain/visualDevelopment";
import { variationDeterministic } from "../domain/variationReview";
import { probesFor, runProbes } from "../domain/visionProbes";
import { allFindings, categoryLabels, outputStatus, recordReview, setFindingStatus, type Finding, type Region, type Reviews } from "../domain/visualReview";
import type { VariationState } from "../domain/variations";
import { plainNote } from "../domain/plainNote";

export interface CandidateVisionProps {
  /** The pictures of one candidate (its views). */
  jobs: ImageJob[];
  /** Every picture in the project, so a view can be compared with the others of the same record. */
  allJobs: ImageJob[];
  variations: VariationState;
  reviews: Reviews;
  setReviews: (update: (r: Reviews) => Reviews) => void;
  style: StyleBible;
  desktop: boolean;
  notify: (message: string) => void;
  /** Where fixes are made (the Review screen). */
  onOpenReview?: () => void;
}

const STATUS = { passed: "Passed for the checks performed", "needs-review": "Needs a look", "not-checked": "Not checked", "unable-to-assess": "Unable to assess" } as const;

/** Where a region is, in words, so the suggestion can be found in the picture without an overlay. */
export function regionWords(r: Region | undefined): string {
  if (!r) return "";
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const h = cx < 0.4 ? "left" : cx > 0.6 ? "right" : "middle";
  const v = cy < 0.4 ? "upper" : cy > 0.6 ? "lower" : "middle";
  return v === "middle" && h === "middle" ? "the middle of the picture" : `the ${v === "middle" ? "" : `${v} `}${h === "middle" ? "middle" : h} of the picture`.replace("  ", " ");
}

/**
 * Looks at a candidate's pictures against what they were made from. Two kinds of result, never mixed and always labelled: facts about the records
 * (free, instant) and suggestions from a vision model that runs on this computer (free, opt-in). A suggestion is something to look at, not a verdict.
 */
export function CandidateVision(props: CandidateVisionProps) {
  const { jobs, variations, reviews, setReviews, desktop, notify } = props;
  const local = useLocalAi(desktop, false);
  const vision = useMemo(() => localVision(local.config), [local.config]);
  const [busy, setBusy] = useState(false);
  /** Why a picture could not be assessed, by picture. */
  const [why, setWhy] = useState<Record<string, string>>({});
  const pictured = jobs.filter((j) => j.outputPath && j.variation);
  if (pictured.length === 0) return null;

  const run = async () => {
    setBusy(true);
    let next = reviews;
    let asked = 0;
    const reasons: Record<string, string> = {};
    // Facts about the records first: free, and they never claim anything about the picture.
    for (const job of pictured) next = recordReview(next, job.id, "deterministic", variationDeterministic(variations, job), []);
    if (vision.ok) {
      for (const job of pictured) {
        const probes = probesFor(variations, job);
        if (probes.length === 0) continue;
        const r = await runProbes(vision.provider, job, probes);
        next = recordReview(next, job.id, "vision", r.findings, r.checked, r.unable);
        if (r.unable) reasons[job.id] = r.error ? plainNote(r.error) : "The model's answers did not agree or could not be read, so nothing is claimed.";
        asked++;
      }
    }
    setReviews(() => next);
    setWhy(reasons);
    setBusy(false);
    notify(vision.ok ? `Checked ${pictured.length} picture${pictured.length === 1 ? "" : "s"}: the records, and ${asked} asked of ${vision.model} on this computer. Its findings are suggestions to look at.` : `Checked the records behind ${pictured.length} picture${pictured.length === 1 ? "" : "s"}. The vision model was not asked: ${vision.why}`);
  };

  const decide = (f: Finding, status: "dismissed" | "accepted") => setReviews((r) => setFindingStatus(r, f.id, status));

  return (
    <section className="wd-vision" aria-label="Check against what it was made from">
      <div className="wd-actions">
        <button onClick={() => void run()} disabled={busy}><ScanEye size={15} aria-hidden="true" /> {busy ? "Looking…" : "Check against what it was made from"}</button>
        <span className="helper">{vision.ok ? `Facts about the records, plus simple questions put to ${vision.model} on this computer (which side, same person, worn or not). Free; nothing leaves it.` : `Facts about the records. For suggestions about the picture itself: ${vision.why}`}</span>
      </div>
      <ul className="wd-vision-list">
        {pictured.map((job) => {
          const st = outputStatus(reviews, job.id);
          const mine = allFindings(reviews).filter((f) => f.outputJobId === job.id && f.status === "open");
          return (
            <li key={job.id}>
              <b>{job.label}</b> <span className={`vr-badge ${st.status}`}>{STATUS[st.status]}</span>
              {st.status === "unable-to-assess" && why[job.id] && <small className="wd-why"> {why[job.id]}</small>}
              {st.checkedCategories.length > 0 && <small> Looked at: {st.checkedCategories.map((c) => categoryLabels[c]).join(", ")}.</small>}
              {mine.length > 0 && (
                <ul>
                  {mine.map((f) => (
                    <li key={f.id} className={`wd-find ${f.source}`}>
                      <span className="wd-tag">{f.source === "vision" ? `Suggestion · ${Math.round(f.confidence * 100)}% sure` : "Record fact"}</span> <b>{categoryLabels[f.category]}</b> ({f.severity})
                      <div>{f.observed}</div>
                      {f.expected && <small>It should be: {f.expected}</small>}
                      {f.region && <small>Where: {regionWords(f.region)}.</small>}
                      <small>{f.suggestedAction}</small>
                      <span className="wd-actions">
                        <button onClick={() => decide(f, "accepted")}>It is right, I will fix it</button>
                        <button onClick={() => decide(f, "dismissed")}>Dismiss</button>
                        {props.onOpenReview && <button onClick={props.onOpenReview}>Open in Review</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
