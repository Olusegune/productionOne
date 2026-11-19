import type { Depth } from './autopilot'

/**
 * What a connected agent (an MCP client, for example) may ask the app to do. The same rules apply as for a person:
 * a run needs a price, a budget and an explicit confirm, and it only starts if the person has switched on "let connected agents start runs" in the app
 * and the budget is not over the limit the person set there. Everything else is read-only or reversible.
 */
export const AGENT_TOOLS = ['get_status', 'list_items', 'read_script', 'get_plan', 'start_run', 'continue_run', 'stop_run', 'get_report'] as const
export type AgentTool = (typeof AGENT_TOOLS)[number]

export interface StartArgs { depth: Depth; includeFrames: boolean; stopAfterConcepts: boolean; perImageUsd: number; budgetUsd: number }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)

/** Turns an agent's request to start into the settings of a run, or says exactly why it may not start. */
export function parseStart(args: Record<string, unknown>, allowRuns: boolean, capUsd: number): { ok: true; start: StartArgs } | { ok: false; error: string } {
  if (!allowRuns) return { ok: false, error: 'The person has not allowed connected agents to start runs. They can turn this on in the Assistant screen under "Connected agents".' }
  if (args.confirm !== true) return { ok: false, error: 'Starting spends money. Call start_run again with confirm: true once you have shown the plan (get_plan) to the person.' }
  const price = num(args.pricePerImageUsd)
  const budget = num(args.budgetUsd)
  if (price === null || price < 0) return { ok: false, error: 'Give pricePerImageUsd: what one picture costs the person, in dollars.' }
  if (budget === null || budget <= 0) return { ok: false, error: 'Give budgetUsd: the most the person allows, in dollars. A run never starts without one.' }
  if (budget > capUsd + 1e-9) return { ok: false, error: `The person allows connected agents at most $${capUsd.toFixed(2)} per run, and you asked for $${budget.toFixed(2)}.` }
  const depth: Depth = args.depth === 'quick' ? 'quick' : 'standard'
  return { ok: true, start: { depth, includeFrames: args.includeFrames === true, stopAfterConcepts: args.stopAfterConcepts !== false, perImageUsd: price, budgetUsd: budget } }
}

export interface StatusInput { phase: string; note: string; items: number; made: number; inProgress: number; failed: number; waitingForDecision: number; spentUsd: number | null; budgetUsd: number | null }

export function describeStatus(s: StatusInput) {
  return { phase: s.phase, note: s.note, items: s.items, pictures: { made: s.made, inProgress: s.inProgress, failed: s.failed, waitingForDecision: s.waitingForDecision }, spentUsdEstimate: s.spentUsd, budgetUsd: s.budgetUsd, atCheckpoint: s.phase === 'checkpoint' }
}

export const isTool = (name: unknown): name is AgentTool => typeof name === 'string' && (AGENT_TOOLS as readonly string[]).includes(name)
