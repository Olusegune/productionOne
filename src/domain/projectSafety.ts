import type { AnalysisResult } from "./productionStudio";
import type { QueueState } from "./generationQueue";

/** Does the open production hold anything a person would be sorry to lose? An empty "Untitled production" does not. */
export function hasWork(p: { script: string; analysis: AnalysisResult; queue: QueueState }): boolean {
  return p.script.trim().length > 0 || p.analysis.assets.length > 0 || p.queue.jobs.length > 0;
}

/**
 * Replacing the open production (New, Open) overwrites the single autosave slot. A production that was saved to a file and has no unsaved edits is already safe on disk;
 * anything else with work in it gets a backup copy first.
 */
export function needsBackup(p: { hasWork: boolean; filePath: string | null; dirty: boolean }): boolean {
  if (!p.hasWork) return false;
  return p.filePath === null || p.dirty;
}
