import { goldenPath, type GoldenPathInput, type GoldenStep } from './goldenPath'

export interface HeroSummary {
  /** 0 to 100, from the Golden Path. */
  percent: number
  /** The step the one big button takes you to; null when every step is done. */
  next: GoldenStep | null
  /** What the button says. */
  button: string
  /** One line under the title: where the production stands, in words. */
  status: string
}

/** The Projects home at a glance: how far along the production is and what to do next. Uses only what the project already knows. */
export function heroSummary(input: GoldenPathInput): HeroSummary {
  const { next, progress } = goldenPath(input)
  const percent = Math.max(0, Math.min(100, Math.round(progress)))
  if (!input.hasScript) return { percent, next, button: next?.action ?? 'Open Story', status: 'No script yet. Paste or import one to begin.' }
  if (!next) return { percent: 100, next, button: 'Open Deliver', status: 'Every step is done. The package is ready to export.' }
  const approved = `${input.approvedCount} of ${input.assetCount} assets approved`
  const active = input.jobsActive > 0 ? ` · ${input.jobsActive} ${input.jobsActive === 1 ? 'request' : 'requests'} running` : ''
  return { percent, next, button: `Continue: ${next.action}`, status: `${approved}${active}` }
}
