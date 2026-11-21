import { isSuperseded, type ImageJob, type QueueState } from './generationQueue'

export type Cause = 'gone' | 'model-unavailable' | 'credits' | 'key' | 'rate-limit' | 'network' | 'server' | 'content' | 'other'
/** What a person can do about a cause. Retrying only helps when the cause was temporary. */
export type FixKind = 'open-design' | 'find-files' | 'refresh-models' | 'choose-model' | 'retry' | 'open-providers'

interface CauseInfo { label: string; advice: string; fixes: FixKind[] }

export const causeInfo: Record<Cause, CauseInfo> = {
  gone: { label: 'The picture is not on this computer', advice: 'The project points at a picture that is not here, for example because it was opened on another computer. Retrying cannot bring it back: open the view and press Generate to make it again, or add your own picture with Use my image. If you still have the file, Find the files looks for it in a folder you choose.', fixes: ['find-files', 'open-design'] },
  'model-unavailable': { label: 'The model is not available', advice: 'The provider no longer lists this model, or has not published how to call it. Refreshing the model list or choosing another model fixes it; retrying alone will not.', fixes: ['refresh-models', 'choose-model', 'retry'] },
  credits: { label: 'Not enough credits', advice: 'The provider says the account is out of credits. Add credits at the provider, then retry.', fixes: ['open-providers', 'retry'] },
  key: { label: 'The key was missing or rejected', advice: 'Check the key in Provider Settings, then retry.', fixes: ['open-providers', 'retry'] },
  'rate-limit': { label: 'The provider is rate limiting', advice: 'Too many requests at once. Wait a minute, then retry.', fixes: ['retry'] },
  network: { label: 'The connection failed', advice: 'The provider could not be reached or timed out. Retry when the connection is back.', fixes: ['retry'] },
  server: { label: 'The provider had an error', advice: 'A server error on the provider side, often temporary. Retry later.', fixes: ['retry', 'choose-model'] },
  content: { label: 'The request was refused', advice: 'The provider refused the prompt or the picture. Change the notes on the sheet, or choose another model.', fixes: ['choose-model'] },
  other: { label: 'The request was not accepted', advice: 'See the provider message under Details, then change the model or the prompt.', fixes: ['choose-model', 'retry'] },
}

/** Sorts one error message into the cause it shares with other failures. The first matching rule wins, most specific first. */
export function causeOf(message: string): Cause {
  const m = message || ''
  if (/no longer on this computer/i.test(m)) return 'gone'
  // Providers write the status as "(402)", "(500 Internal Server Error)" or "answered 404 Not Found".
  const code = /(?:\(|answered )([1-5]\d{2})\b/.exec(m)?.[1]
  if (/no model page|not published a readable request schema|model (is )?(not found|not available|unavailable)|unknown model|invalid model|no longer available|does not exist/i.test(m)) return 'model-unavailable'
  if (code === '402' || /insufficient|out of credits|not enough credits|credit balance|billing|payment required|quota exceeded/i.test(m)) return 'credits'
  if (code === '401' || code === '403' || /No .* key is saved|invalid api key|unauthori[sz]ed|forbidden/i.test(m)) return 'key'
  if (code === '429' || /rate limit|too many requests/i.test(m)) return 'rate-limit'
  if (/timed out|timeout|could not be reached|connection (reset|refused|closed)|dns/i.test(m)) return 'network'
  if (/safety|moderation|content polic|nsfw|flagged|violat|refused/i.test(m)) return 'content'
  if (code && Number(code) >= 500) return 'server'
  return 'other'
}

export interface FailureGroup {
  cause: Cause
  label: string
  advice: string
  fixes: FixKind[]
  /** Failed views that have not been replaced by a newer attempt. */
  jobs: ImageJob[]
  /** The models these views were sent to. */
  models: string[]
}

/** Failures that are still open, grouped by shared cause, biggest group first. A view that was retried and replaced is not counted. */
export function groupFailures(queue: QueueState): FailureGroup[] {
  const open = queue.jobs.filter((j) => j.status === 'failed' && !isSuperseded(queue, j))
  const byCause = new Map<Cause, ImageJob[]>()
  for (const job of open) {
    const cause = causeOf(job.error ?? '')
    byCause.set(cause, [...(byCause.get(cause) ?? []), job])
  }
  return [...byCause.entries()]
    .map(([cause, jobs]) => ({ cause, ...causeInfo[cause], jobs, models: [...new Set(jobs.map((j) => j.model))] }))
    .sort((a, b) => b.jobs.length - a.jobs.length)
}
