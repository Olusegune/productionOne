import { describe, expect, it } from 'vitest'
import { advance, conceptRequests, conceptView, frameRequests, initialState, report, sheetPlan, sheetRequests, summarize, withBudget, type AutopilotOptions, type AutopilotState } from './autopilot'
import { demoAssets2D, styleByName } from './demo2d'
import { planCoverage } from './direct'
import { approve, emptyQueue, enqueue, type QueueState } from './generationQueue'
import { analyzeScript, type AnalysisResult } from './productionStudio'

const style = styleByName('Clean digital cel animation')
const analysis: AnalysisResult = { scenes: [], assets: demoAssets2D() }
const opts = (patch: Partial<AutopilotOptions> = {}): AutopilotOptions => ({ depth: 'standard', includeFrames: false, stopAfterConcepts: true, perImageUsd: 0.1, budgetUsd: 10, provider: 'kie', model: 'google/pro-image-to-image', takesReferences: true, aspect: '16:9', ...patch })

/** A stand-in for the image model: everything queued comes back as a finished picture waiting for review. */
const generate = (q: QueueState): QueueState => ({ ...q, jobs: q.jobs.map((j) => (['queued', 'pending'].includes(j.status) ? { ...j, status: 'needs-review' as const, outputPath: `C:/assets/${j.outputName}.png` } : j)) })

describe('what the plan says it will do', () => {
  it('counts the pictures for a character, a prop and a place, and prices them', () => {
    const s = summarize(analysis, [], style, emptyQueue(), {}, opts())
    expect(s.concepts).toBe(3)
    expect(s.sheets).toBe(32)
    expect(s.images).toBe(35)
    expect(s.costUsd).toBeCloseTo(3.5, 5)
    expect(s.needsAttention).toBe(false)
    expect(s.steps.length).toBeGreaterThanOrEqual(4)
    expect(s.steps.join(' ')).toMatch(/budget/)
  })
  it('a quick plan is one sheet each', () => {
    const s = summarize(analysis, [], style, emptyQueue(), {}, opts({ depth: 'quick' }))
    expect(s.concepts).toBe(3)
    expect(s.images).toBe(5 + 4 + 2)
    expect(sheetPlan('quick').character).toEqual(['Turnaround'])
  })
  it('refuses to run without a price and a budget, or when the plan costs more than the budget', () => {
    expect(summarize(analysis, [], style, emptyQueue(), {}, opts({ perImageUsd: null })).needsAttention).toBe(true)
    expect(summarize(analysis, [], style, emptyQueue(), {}, opts({ budgetUsd: null })).reason).toMatch(/Set a budget/)
    const over = summarize(analysis, [], style, emptyQueue(), {}, opts({ budgetUsd: 2 }))
    expect(over.needsAttention).toBe(true)
    expect(over.reason).toMatch(/\$3\.50.*\$2\.00/)
  })
  it('does not count pictures that already exist', () => {
    const q = approve({ ...emptyQueue(), jobs: [] }, 'none')
    const made = { ...q, jobs: [{ id: 'x', key: 'k', assetId: 'DEMO-CHAR-001', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: '', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false, outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, outputPath: 'C:/a.png', qaNotes: [], approved: true, rejected: false, submissionState: 'not-submitted', createdAt: 1, updatedAt: 1 }] } as unknown as QueueState
    const s = summarize(analysis, [], style, made, {}, opts())
    expect(s.concepts).toBe(2)
    expect(s.images).toBe(34)
  })
  it('puts the spending guard on at the price and budget the person gave', () => {
    const q = withBudget(emptyQueue(), { perImageUsd: 0.2, budgetUsd: 4 })
    expect(q).toMatchObject({ guard: true, perImageUsd: 0.2, totalCeilingUsd: 4 })
  })
})

describe('the requests it makes', () => {
  it('starts with one concept per item: the front, the front, the establishing view', () => {
    const reqs = conceptRequests(analysis, style, emptyQueue(), {}, opts())
    expect(reqs.map((r) => `${r.assetId}:${r.sheetType}:${r.viewKey}`)).toEqual(['DEMO-CHAR-001:Turnaround:front', 'DEMO-PROP-001:Multi-view:front', 'DEMO-SET-001:Establishing:establishing'])
    expect(conceptView(analysis.assets[2], 'standard').view.key).toBe('establishing')
    for (const r of reqs) { expect(r.prompt).toContain('2D art style "Clean digital cel animation"'); expect(r.styleName).toBe(style.name); expect(r.styleFp).toBeTruthy(); expect(r.provider).toBe('kie') }
  })
  it('uses an asset\'s own style where it has one', () => {
    const own = { ...analysis, assets: analysis.assets.map((a, i) => (i === 0 ? { ...a, style: { ...styleByName('Flat vector'), locked: false } } : a)) }
    const reqs = conceptRequests(own, style, emptyQueue(), {}, opts())
    expect(reqs[0].styleName).toBe('Flat vector')
    expect(reqs[1].styleName).toBe('Clean digital cel animation')
  })
  it('makes no sheet pictures until an item\'s first picture is approved', () => {
    expect(sheetRequests(analysis, style, emptyQueue(), {}, opts())).toEqual([])
  })
  it('asks for no reference images from a model that cannot take them, and anchors the rest to the approved concept otherwise', () => {
    const plain = conceptRequests(analysis, style, emptyQueue(), { 'DEMO-CHAR-001': ['C:/photo.png'] }, opts({ takesReferences: false }))
    expect(plain.every((r) => r.references.length === 0 && !r.useAnchor)).toBe(true)
    const withRefs = conceptRequests(analysis, style, emptyQueue(), { 'DEMO-CHAR-001': ['C:/photo.png'] }, opts())
    expect(withRefs[0].references).toEqual(['C:/photo.png'])
    expect(withRefs[0].prompt).toMatch(/IDENTITY references only/)
  })
  it('makes one storyboard frame per planned shot in the project shape', () => {
    const story = analyzeScript(['Title: T', '', 'INT. HARBOUR OFFICE - DAY', '', 'MIRA, a pilot, holds the lantern.', '', 'MIRA', 'We sail at dawn.'].join('\n'))
    const shots = planCoverage(story)
    const reqs = frameRequests(story, shots, style, emptyQueue(), {}, opts({ aspect: '9:16' }))
    expect(reqs.length).toBe(shots.length)
    expect(reqs.every((r) => r.aspect === '9:16' && r.sheetType === 'Storyboard')).toBe(true)
  })
})

describe('the run, step by step', () => {
  const start = (o: AutopilotOptions): AutopilotState => ({ ...initialState(), phase: 'concepts' })
  const run = (state: AutopilotState, queue: QueueState, o: AutopilotOptions, rounds = 12) => {
    let s = state; let q = queue
    for (let i = 0; i < rounds; i++) {
      const step = advance(s, analysis, [], style, q, {}, o)
      s = step.state; q = generate(step.queue)
      if (['done', 'checkpoint', 'stopped'].includes(s.phase) && i > 0) break
    }
    return { s, q }
  }
  it('does nothing until it is started', () => {
    const step = advance(initialState(), analysis, [], style, emptyQueue(), {}, opts())
    expect(step.queue.jobs).toHaveLength(0)
    expect(step.state.phase).toBe('idle')
  })
  it('makes the concepts, then stops for the person to decide, and approves nothing itself', () => {
    const o = opts()
    const { s, q } = run(start(o), emptyQueue(), o)
    expect(s.phase).toBe('checkpoint')
    expect(s.note).toMatch(/3 concepts waiting for you/)
    expect(q.jobs).toHaveLength(3)
    expect(q.jobs.some((j) => j.approved)).toBe(false)
    expect(s.autoApproved).toEqual([])
    const again = advance(s, analysis, [], style, q, {}, o)
    expect(again.state.phase).toBe('checkpoint')
    expect(again.queue.jobs).toHaveLength(3)
  })
  it('carries on to the sheets once the person has approved the concepts and pressed Continue', () => {
    const o = opts()
    let { s, q } = run(start(o), emptyQueue(), o)
    for (const j of q.jobs) q = approve(q, j.id)
    s = { ...s, continued: true }
    const go = run(s, q, o, 8)
    expect(go.s.phase).toBe('done')
    expect(go.q.jobs.length).toBe(35)
    const char = go.q.jobs.filter((j) => j.assetId === 'DEMO-CHAR-001')
    expect(char.map((j) => j.sheetType).filter((v, i, a) => a.indexOf(v) === i)).toEqual(['Turnaround', 'Expressions', 'Poses', 'Wardrobe'])
    expect(go.q.jobs.filter((j) => j.assetId === 'DEMO-SET-001')).toHaveLength(4)
  })
  it('waits at the checkpoint until Continue is pressed, even when everything is approved', () => {
    const o = opts()
    let { s, q } = run(start(o), emptyQueue(), o)
    for (const j of q.jobs) q = approve(q, j.id)
    const step = advance(s, analysis, [], style, q, {}, o)
    expect(step.state.phase).toBe('checkpoint')
    expect(step.queue.jobs).toHaveLength(3)
  })
  it('can approve a clean concept by itself when asked, and keeps a record of it; a concept with quality notes still waits', () => {
    const o = opts({ stopAfterConcepts: false })
    let q = emptyQueue()
    let step = advance(start(o), analysis, [], style, q, {}, o)
    q = generate(step.queue)
    q = { ...q, jobs: q.jobs.map((j, i) => (i === 1 ? { ...j, qaNotes: ['Resolution is below 1024 on the long edge.'] } : j)) }
    step = advance(step.state, analysis, [], style, q, {}, o)
    expect(step.approvedNow).toHaveLength(2)
    expect(step.state.autoApproved).toHaveLength(2)
    expect(step.state.phase).toBe('checkpoint')
    expect(step.state.note).toMatch(/1 concept waiting/)
    expect(step.queue.jobs.filter((j) => j.approved)).toHaveLength(2)
  })
  it('skips frames when they are off, and makes them in the project shape when on', () => {
    const story = analyzeScript(['Title: T', '', 'INT. HARBOUR OFFICE - DAY', '', 'MIRA, a pilot, holds the lantern.', '', 'MIRA', 'We sail at dawn.'].join('\n'))
    const shots = planCoverage(story)
    const o = opts({ includeFrames: true, aspect: '9:16' })
    let q = emptyQueue()
    const a2: AnalysisResult = { ...story, assets: story.assets }
    let s: AutopilotState = { ...initialState(), phase: 'frames', conceptsSent: true, sheetsSent: true }
    let step = advance(s, a2, shots, style, q, {}, o)
    expect(step.queue.jobs.filter((j) => j.sheetType === 'Storyboard')).toHaveLength(shots.length)
    expect(step.queue.jobs.every((j) => j.aspect === '9:16')).toBe(true)
    q = generate(step.queue)
    step = advance(step.state, a2, shots, style, q, {}, o)
    expect(step.state.phase).toBe('done')
  })
  it('waits while pictures are still being made', () => {
    const o = opts()
    const first = advance(start(o), analysis, [], style, emptyQueue(), {}, o)
    const step = advance(first.state, analysis, [], style, first.queue, {}, o)
    expect(step.state.phase).toBe('concepts')
    expect(step.state.note).toMatch(/Waiting/)
    expect(step.queue.jobs).toHaveLength(3)
  })
})

describe('the report', () => {
  it('says what was made, what waits, what failed and why, and what it spent', () => {
    const q0 = enqueue(emptyQueue(), conceptRequests(analysis, style, emptyQueue(), {}, opts())).state
    const q: QueueState = { ...withBudget(q0, { perImageUsd: 0.1, budgetUsd: 5 }), jobs: q0.jobs.map((j, i) => (i === 0 ? { ...j, status: 'needs-review' as const, outputPath: 'C:/a.png', attempts: 1 } : i === 1 ? { ...j, status: 'failed' as const, error: 'Kie 403', attempts: 3 } : j)) }
    const r = report(q, analysis, { ...initialState(), autoApproved: ['x'] })
    expect(r).toMatchObject({ made: 1, needsReview: 1, approved: 0, skippedForBudget: 1, autoApproved: 1 })
    expect(r.failed).toEqual([{ label: 'Front', asset: 'Brass lantern', error: 'Kie 403' }])
    expect(r.spentUsd).toBeCloseTo(0.4, 5)
    const restored = report({ ...q, guard: false, perImageUsd: null, totalCeilingUsd: null }, analysis, initialState(), 0.1)
    expect(restored.spentUsd).toBeCloseTo(0.4, 5)
    expect(report({ ...q, perImageUsd: null }, analysis, initialState()).spentUsd).toBeNull()
  })
})
