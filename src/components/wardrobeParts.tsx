import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageJob } from "../domain/generationQueue";

/** A picture of a job, or a plain sentence about why there is not one yet. */
export function Picture({ job, label }: { job?: ImageJob; label: string }) {
  if (job?.outputPath) return <img src={convertFileSrc(job.outputPath)} alt={label} />;
  const busy = job && (job.status === "queued" || job.status === "pending" || job.status === "generating" || job.status === "validating");
  return <div className="wd-empty">{busy ? "Making it…" : job?.status === "failed" ? "Failed. See the queue." : "No picture yet"}</div>;
}
