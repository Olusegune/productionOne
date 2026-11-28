import { useState } from "react";
import { CircleCheck, CircleHelp, CircleX, ScanSearch, TriangleAlert } from "lucide-react";
import { measureSkin } from "../data/skinMetrics";
import type { ImageJob } from "../domain/generationQueue";
import type { LightingRecord } from "../domain/lighting";
import { plainNote } from "../domain/plainNote";
import { SKIN_CHECKER, SKIN_QA_LABELS, skinSurfaceReport, toReviewFindings, type Applicability, type SkinQaReport } from "../domain/skinQa";
import { recordReview, type Reviews } from "../domain/visualReview";
import "../wardrobe.css";

export interface SkinSurfaceCheckProps {
  /** The approved picture the candidate is compared with. */
  original?: string;
  candidate?: ImageJob;
  /** The lighting of a lighting-test picture, so a colour difference the light explains is said so. */
  light?: LightingRecord;
  applicability: Applicability;
  reviews?: Reviews;
  setReviews?: (update: (r: Reviews) => Reviews) => void;
  notify: (message: string) => void;
}

const ICON = { "not-checked": CircleHelp, "needs-review": TriangleAlert, passed: CircleCheck, unable: CircleX } as const;

/**
 * An advisory check of the skin surface of one candidate against its approved original, from real measurements made on this computer. It is free. It can notice
 * much smoother, much rougher, shinier or a different average colour; it cannot judge identity, aging, marks or makeup, and says so. Findings go to the Review screen
 * as open items and are never resolved automatically.
 */
export function SkinSurfaceCheck({ original, candidate, light, applicability, reviews, setReviews, notify }: SkinSurfaceCheckProps) {
  const [report, setReport] = useState<SkinQaReport | null>(null);
  const [busy, setBusy] = useState(false);

  if (!applicability.applies) return <p className="helper" role="note">Skin surface check: not applicable. {applicability.reason}</p>;
  const ready = !!original && !!candidate?.outputPath;
  const state = report?.state ?? "not-checked";
  const Icon = ICON[state];

  const run = async () => {
    if (!original || !candidate?.outputPath) return;
    setBusy(true);
    const { measurement, error } = await measureSkin(original, candidate.outputPath);
    const next = skinSurfaceReport({ measurement, light, error: error ? plainNote(error) : undefined });
    setReport(next);
    if (setReviews && next.state !== "unable") setReviews((r) => recordReview(r, candidate.id, "deterministic", toReviewFindings(next, candidate), ["L"]));
    setBusy(false);
    notify(next.state === "unable" ? next.note : next.findings.length ? `${next.findings.length} thing${next.findings.length === 1 ? "" : "s"} to look at in the skin surface.` : "No skin surface differences found by these checks. Compare the close-ups yourself.");
  };

  return (
    <div className="sq-check" aria-label="Skin surface check">
      <div className="wd-actions">
        <button onClick={run} disabled={!ready || busy}><ScanSearch size={14} aria-hidden="true" /> {busy ? "Measuring…" : "Check skin surface (advisory)"}</button>
        <span className={`st ${state === "passed" ? "ok" : state === "needs-review" ? "warn" : state === "unable" ? "off" : "wait"}`}><Icon size={13} aria-hidden="true" />{SKIN_QA_LABELS[state]}</span>
        <span className="helper">Free, on this computer. Works best on the head-and-shoulders picture.</span>
      </div>
      {!ready && <p className="helper">There is no finished candidate and approved original to compare yet.</p>}
      {report && (
        <div>
          {report.note && <p className="helper warn">{report.note}</p>}
          {report.findings.length > 0 && (
            <ul className="sq-findings">
              {report.findings.map((f) => (
                <li key={f.kind}>
                  <b>{f.title}</b> <small>({f.severity})</small>
                  <div>Evidence: {f.evidence}</div>
                  <div className="helper">{f.uncertainty}</div>
                  <div>What to do: {f.action}</div>
                  <small>Checker: {f.checker}</small>
                </li>
              ))}
            </ul>
          )}
          {report.state === "passed" && <p className="helper">Passed for the checks performed: {report.checked.join("; ")}. This does not mean the picture is right.</p>}
          <details><summary>What this check cannot see ({report.notChecked.length})</summary><ul>{report.notChecked.map((n) => <li key={n}>{n}: needs your review</li>)}</ul><small>{SKIN_CHECKER}</small></details>
        </div>
      )}
    </div>
  );
}
