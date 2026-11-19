import { describe, expect, it } from 'vitest'
import { AGENT_TOOLS, describeStatus, isTool, parseStart } from './agentTools'

describe('what a connected agent may start', () => {
  const ok = { confirm: true, pricePerImageUsd: 0.1, budgetUsd: 3 }
  it('refuses unless the person allowed agents to start runs', () => {
    const r = parseStart(ok, false, 5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/not allowed connected agents to start runs/)
  })
  it('refuses without an explicit confirm, a price or a budget', () => {
    expect(parseStart({ ...ok, confirm: undefined }, true, 5)).toMatchObject({ ok: false })
    expect((parseStart({ ...ok, confirm: 'yes' }, true, 5) as { error: string }).error).toMatch(/confirm: true/)
    expect((parseStart({ confirm: true, budgetUsd: 3 }, true, 5) as { error: string }).error).toMatch(/pricePerImageUsd/)
    expect((parseStart({ confirm: true, pricePerImageUsd: 0.1 }, true, 5) as { error: string }).error).toMatch(/budgetUsd/)
    expect((parseStart({ ...ok, budgetUsd: 0 }, true, 5) as { error: string }).error).toMatch(/budgetUsd/)
    expect((parseStart({ ...ok, pricePerImageUsd: -1 }, true, 5) as { error: string }).error).toMatch(/pricePerImageUsd/)
  })
  it('refuses a budget over the limit the person set', () => {
    const r = parseStart({ ...ok, budgetUsd: 20 }, true, 5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/at most \$5\.00.*\$20\.00/)
    expect(parseStart({ ...ok, budgetUsd: 5 }, true, 5).ok).toBe(true)
    expect(parseStart(ok, true, 0).ok).toBe(false)
  })
  it('starts with safe defaults: standard depth, no frames, stop after the concepts', () => {
    expect(parseStart(ok, true, 5)).toEqual({ ok: true, start: { depth: 'standard', includeFrames: false, stopAfterConcepts: true, perImageUsd: 0.1, budgetUsd: 3 } })
    expect(parseStart({ ...ok, depth: 'quick', includeFrames: true, stopAfterConcepts: false }, true, 5)).toEqual({ ok: true, start: { depth: 'quick', includeFrames: true, stopAfterConcepts: false, perImageUsd: 0.1, budgetUsd: 3 } })
    expect(parseStart({ confirm: true, pricePerImageUsd: '0.2', budgetUsd: '2' }, true, 5)).toMatchObject({ ok: true, start: { perImageUsd: 0.2, budgetUsd: 2 } })
  })
  it('knows its tools', () => {
    expect(AGENT_TOOLS).toEqual(['get_status', 'list_items', 'read_script', 'get_plan', 'start_run', 'continue_run', 'stop_run', 'get_report'])
    expect(isTool('start_run')).toBe(true)
    expect(isTool('delete_everything')).toBe(false)
    expect(isTool(5)).toBe(false)
  })
  it('describes a run in plain fields', () => {
    expect(describeStatus({ phase: 'checkpoint', note: 'n', items: 3, made: 3, inProgress: 0, failed: 1, waitingForDecision: 2, spentUsd: 0.3, budgetUsd: 3 })).toEqual({ phase: 'checkpoint', note: 'n', items: 3, pictures: { made: 3, inProgress: 0, failed: 1, waitingForDecision: 2 }, spentUsdEstimate: 0.3, budgetUsd: 3, atCheckpoint: true })
  })
})
