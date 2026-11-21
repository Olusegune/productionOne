import { MISSING_FILE_ERROR, type ImageJob, type QueueState } from './generationQueue'

/**
 * Relinking pictures that are not on this computer. The files are looked for by name in a folder the person chooses. A picture that is found is pointed at again;
 * if the project remembers what you had decided about it, that comes back too, otherwise it returns to "waiting for your decision". Nothing is generated, copied
 * or deleted, and a picture that is not found is left exactly as it was.
 */

/** The file name a picture was saved under (the app saves it with this stem plus an image extension). */
export const savedStem = (outputName: string): string => outputName.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^_+|_+$/g, '')

const isGone = (j: ImageJob) => j.status === 'failed' && j.error === MISSING_FILE_ERROR

/** Every take whose file is gone, newest revision of a view only if it is the one still standing. */
export function missingTakes(queue: QueueState): ImageJob[] {
  return queue.jobs.filter(isGone)
}

/** The file-name stems to look for (without repeats), and how many takes are missing. */
export function wantedStems(queue: QueueState): { stems: string[]; takes: number } {
  const takes = missingTakes(queue)
  return { stems: [...new Set(takes.map((j) => savedStem(j.outputName)).filter(Boolean))], takes: takes.length }
}

export interface RelinkResult {
  state: QueueState
  /** The takes that now have their picture again. */
  relinked: ImageJob[]
  /** Missing takes whose file was not in the folder. */
  stillMissing: number
}

/** `found` maps a lower-case file-name stem to the full path of the picture found for it. */
export function applyRelink(queue: QueueState, found: Record<string, string>, now = Date.now()): RelinkResult {
  const lookup = new Map(Object.entries(found).map(([k, v]) => [k.toLowerCase(), v]))
  const relinked: ImageJob[] = []
  let stillMissing = 0
  const jobs = queue.jobs.map((j) => {
    if (!isGone(j)) return j
    const path = lookup.get(savedStem(j.outputName).toLowerCase())
    if (!path) { stillMissing++; return j }
    const kept = j.lost?.approved ? 'approved' : j.lost?.rejected ? 'rejected' : 'waiting'
    const { lost: _lost, error: _error, ...rest } = j
    const back: ImageJob = { ...rest, outputPath: path, status: kept === 'waiting' ? 'needs-review' : 'completed', approved: kept === 'approved', rejected: kept === 'rejected', updatedAt: now }
    relinked.push(back)
    return back
  })
  return { state: relinked.length ? { ...queue, jobs } : queue, relinked, stillMissing }
}

export const relinkSummary = (r: { relinked: number; stillMissing: number }): string =>
  r.relinked === 0
    ? 'None of the missing pictures were in that folder. Check that it is the folder the pictures were saved in (a folder inside it is searched too).'
    : `Found ${r.relinked} picture${r.relinked === 1 ? '' : 's'} and linked ${r.relinked === 1 ? 'it' : 'them'} back.${r.stillMissing ? ` ${r.stillMissing} ${r.stillMissing === 1 ? 'is' : 'are'} still missing.` : ''} Nothing was copied or generated.`
