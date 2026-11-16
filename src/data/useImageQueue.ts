import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import {
  markFailed,
  markGenerating,
  markValidated,
  markValidating,
  anchorFor,
  dropMissing,
  startable,
  type ImageJob,
  type QueueState,
} from "../domain/generationQueue";

interface Generated {
  path: string;
  inspection: { width: number; height: number; warnings: string[] };
}
interface Qa {
  notes: string[];
}

const ratio = (aspect: string) => {
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
};

/** Deterministic checks on a finished image. Anything noted goes to a person: nothing here approves an image. */
export async function validateJob(job: ImageJob, generated: Generated): Promise<string[]> {
  const notes = [...generated.inspection.warnings];
  const { width, height } = generated.inspection;
  if (Math.max(width, height) < 1024) notes.push(`Resolution ${width}x${height} is below 1024 on the long edge.`);
  if (Math.abs(width / height / ratio(job.aspect) - 1) > 0.15) notes.push(`Shape ${width}x${height} does not match the requested ${job.aspect}.`);
  try {
    const qa = await invoke<Qa>("qa_image", { path: generated.path, fullBody: job.fullBody });
    notes.push(...qa.notes);
  } catch (error) {
    notes.push(`Automatic checks could not run: ${String(error)}`);
  }
  return notes;
}

/**
 * Runs the durable queue. State lives in the project (autosaved), so a crash or restart loses nothing: on load the queue is recovered and paused.
 * Each job is started once (in-flight guard) and its result is written to state immediately.
 */
export function useImageQueue(
  queue: QueueState,
  setQueue: (update: (q: QueueState) => QueueState) => void,
  enabled: boolean,
  onMissing?: (count: number) => void,
) {
  const inFlight = useRef(new Set<string>());
  // Pictures the project points at but this computer does not have: found whenever the set of files changes, and turned into takes that can be remade.
  const fileKey = queue.jobs.filter((j) => j.outputPath && (j.status === "completed" || j.status === "needs-review")).map((j) => j.outputPath).sort().join("|");
  useEffect(() => {
    if (!enabled || !fileKey) return;
    let cancelled = false;
    void invoke<string[]>("missing_files", { paths: fileKey.split("|") }).then((missing) => {
      if (cancelled || !missing.length) return;
      const dropped = dropMissing(queue, missing).dropped;
      if (!dropped) return;
      setQueue((q) => dropMissing(q, missing).state);
      onMissing?.(dropped);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey, enabled]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    for (const job of startable(queue, now)) {
      if (inFlight.current.has(job.id)) continue;
      inFlight.current.add(job.id);
      setQueue((q) => markGenerating(q, job.id));
      void (async () => {
        try {
          const generated = await invoke<Generated>("generate_image", {
            provider: job.provider,
            model: job.model,
            prompt: job.prompt,
            aspect: job.aspect,
            quality: queue.quality,
            references: [...new Set([...(job.useAnchor ? [anchorFor(queue, job)] : []), ...job.references].filter((p): p is string => !!p))].slice(0, 8),
            outputName: job.outputName,
          });
          setQueue((q) => markValidating(q, job.id, { path: generated.path, width: generated.inspection.width, height: generated.inspection.height }));
          const notes = await validateJob(job, generated);
          setQueue((q) => markValidated(q, job.id, notes));
        } catch (error) {
          setQueue((q) => markFailed(q, job.id, String(error)));
        } finally {
          inFlight.current.delete(job.id);
        }
      })();
    }
    const waits = queue.jobs.filter((j) => j.status === "queued" && (j.notBefore ?? 0) > now).map((j) => j.notBefore! - now);
    if (!queue.paused && waits.length) {
      const timer = window.setTimeout(() => setTick((t) => t + 1), Math.min(...waits) + 50);
      return () => window.clearTimeout(timer);
    }
  }, [queue, enabled, tick, setQueue]);
}
