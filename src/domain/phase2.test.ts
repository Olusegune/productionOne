import { describe, expect, it } from 'vitest'
import { conceptRequests, sheetRequests, type AutopilotOptions } from './autopilot'
import { identityLayer, layersOf, madeWithEarlierProportions, proportionWords, provenanceFor, withProfile, withStyle } from './characterLayers'
import { demoAssets2D, styleByName } from './demo2d'
import { buildShotPrompt } from './direct'
import { approvedRulesText, bodyMetres, decide, mergeProposals, proposeFitRules, readFitRules, scaleFitSheet, setIntent } from './fit'
import { approve, emptyQueue, enqueue, type JobRequest, type QueueState } from './generationQueue'
import type { AnalysisResult, ExtractedAsset, ShotRecord } from './productionStudio'
import { addException, createProfile, fingerprint, readProfile, setControl, setHeightM, setPreset, setStylization } from './proportions'
import { WARP_LABEL, compare, confirmLandmark, estimateLandmarks, redesignRequest, uncertain, warpBands } from './redesign'
import { buildViewPrompt, sheetTypesFor, viewsFor } from './sheetSpecs'

const style = styleByName('Clean digital cel animation')
const assets = demoAssets2D()
const character = assets.find((a) => a.type === 'character') as ExtractedAsset
const profile = createProfile(character.id, 'large-headed')

describe('three layers stay separate', () => {
  it('changing the style does not touch the proportions or the identity', () => {
    const profiles = { [character.id]: profile }
    const before = JSON.stringify([identityLayer(character), profiles])
    const restyled = withStyle(character, styleByName('Flat vector'))
    expect(restyled.style?.name).toBe('Flat vector')
    expect(JSON.stringify([identityLayer(restyled), profiles])).toBe(before)
    expect(withStyle(restyled, undefined).style).toBeUndefined()
  })
  it('changing the proportions does not replace the identity or the style', () => {
    const withStyled = withStyle(character, styleByName('Flat vector'))
    const next = withProfile({}, character.id, setControl(profile, 'armLength', 3.9))
    expect(withStyled.name).toBe(character.name)
    expect(layersOf(withStyled, next).style?.name).toBe('Flat vector')
    expect(layersOf(withStyled, next).identity).toEqual(identityLayer(withStyled))
    expect(Object.keys(withProfile(next, character.id, undefined))).toEqual([])
  })
  it('an intentionally large eye or long arm is kept, not pulled toward a human baseline', () => {
    let p = setControl(setControl(createProfile('x'), 'eyeSize', 0.4), 'armLength', 4.4)
    p = addException(addException(p, 'eyeSize', 'Huge eyes are the design'), 'armLength', 'Long arms on purpose')
    const again = readProfile(JSON.parse(JSON.stringify(setStylization(setPreset(p, 'natural'), 30))), 'x')
    expect(again.controls.eyeSize).toMatchObject({ value: 0.4, source: 'override' })
    expect(again.controls.armLength).toMatchObject({ value: 4.4, source: 'override' })
    expect(proportionWords(again)).toMatch(/large eyes/)
    expect(proportionWords(again)).toMatch(/long arms/)
    // the fit rules use the long arm as it is, not a typical one
    const reachLong = proposeFitRules(p).find((r) => r.key === 'reach-height')!.valueM!
    const reachNatural = proposeFitRules(createProfile('x')).find((r) => r.key === 'reach-height')!.valueM!
    expect(reachLong).toBeGreaterThan(reachNatural)
  })
})

describe('the approved proportions reach every kind of output', () => {
  it('every character sheet view carries them, and a character without a profile is unchanged', () => {
    const words = proportionWords(profile)
    expect(words).toMatch(/Body and face proportions/)
    let views = 0
    for (const sheet of sheetTypesFor('character')) for (const view of viewsFor('character', sheet)) {
      views++
      const withIt = buildViewPrompt({ style, asset: character, variant: 'Canonical', sheetType: sheet, view, backdrop: 'gray', proportions: words })
      const without = buildViewPrompt({ style, asset: character, variant: 'Canonical', sheetType: sheet, view, backdrop: 'gray' })
      expect(withIt).toContain(words)
      expect(without).not.toContain('Body and face proportions')
      expect(withIt.replace(words + '\n', '')).toBe(without)
    }
    expect(views).toBeGreaterThan(10)
  })
  it('a prop or a place never gets a character proportion line', () => {
    const prop = assets.find((a) => a.type === 'prop') as ExtractedAsset
    const view = viewsFor('prop', sheetTypesFor('prop')[0])[0]
    expect(buildViewPrompt({ style, asset: prop, variant: 'Canonical', sheetType: sheetTypesFor('prop')[0], view, proportions: proportionWords(profile) })).not.toContain('Body and face proportions')
  })
  it('storyboard frames carry the proportions of the characters in the frame', () => {
    const shot = { id: 'S1', sceneId: 'SC-1', order: 1, duration: 4, assetIds: [character.id], action: 'x', dialogue: '', speaker: '', emotionalObjective: '', facialActing: '', bodyLanguage: '', microAnimation: '', cameraFraming: '', cameraMovement: '', lighting: 'Day', soundEffects: '', ambience: '', music: '', transition: 'Cut', storyboardStatus: 'planned', size: 'MS', angle: 'eye-level', lens: 40, movement: 'static' } as ShotRecord
    const analysis: AnalysisResult = { scenes: [], assets }
    expect(buildShotPrompt(shot, analysis, style, [], '16:9', '', { [character.id]: profile })).toMatch(/Body proportions \(target, keep exactly as in their references\): .*large head on a small body/)
    expect(buildShotPrompt(shot, analysis, style, [], '16:9', '')).not.toMatch(/Body proportions/)
  })
  it('the Assistant (autopilot) uses them for concepts and sheets and records what it used', () => {
    const o: AutopilotOptions = { depth: 'standard', includeFrames: false, stopAfterConcepts: true, perImageUsd: null, budgetUsd: null, provider: 'kie', model: 'm', takesReferences: false, aspect: '16:9', proportions: { [character.id]: profile } }
    const analysis: AnalysisResult = { scenes: [], assets }
    const concept = conceptRequests(analysis, style, emptyQueue(), {}, o).find((r) => r.assetId === character.id)!
    expect(concept.prompt).toMatch(/Body and face proportions/)
    expect(concept.provenance?.proportionFp).toBe(fingerprint(profile))
    expect(concept.provenance?.proportionProfile).toEqual(profile)
    const none = conceptRequests(analysis, style, emptyQueue(), {}, { ...o, proportions: undefined }).find((r) => r.assetId === character.id)!
    expect(none.prompt).not.toMatch(/Body and face proportions/)
    expect(none.provenance?.proportionFp).toBeUndefined()
    expect(Array.isArray(sheetRequests(analysis, style, emptyQueue(), {}, o))).toBe(true)
  })
})

const request = (viewKey: string, prov = provenanceFor(profile, [{ path: 'C:/refs/front.png', jobId: 'J0', revision: 2 }])): JobRequest => ({ assetId: character.id, variant: 'Canonical', sheetType: 'Turnaround', viewKey, label: viewKey, prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], provenance: prov, outputName: (r) => `${viewKey}_v${r}` })
const finished = (q: QueueState): QueueState => ({ ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'needs-review', outputPath: `C:/out/${j.viewKey}.png` })) })

describe('outputs record the exact proportions and references used', () => {
  it('the queue keeps the profile and reference revisions on each job', () => {
    const q = enqueue(emptyQueue(), [request('front')], 1, false).state
    expect(q.jobs[0].provenance?.proportionProfile).toEqual(profile)
    expect(q.jobs[0].provenance?.proportionFp).toBe(fingerprint(profile))
    expect(q.jobs[0].provenance?.references).toEqual([{ path: 'C:/refs/front.png', jobId: 'J0', revision: 2 }])
  })
  it('a profile snapshot is a copy: editing the profile later does not rewrite history', () => {
    const prov = provenanceFor(profile, [])
    const edited = setControl(profile, 'eyeSize', 0.1)
    expect(prov.proportionProfile).toEqual(profile)
    expect(prov.proportionProfile).not.toEqual(edited)
  })
  it('notices output made with earlier proportions, and leaves old and profile-less output alone', () => {
    const prov = provenanceFor(profile, [])
    expect(madeWithEarlierProportions(prov, profile)).toBe(false)
    expect(madeWithEarlierProportions(prov, setControl(profile, 'eyeSize', 0.1))).toBe(true)
    expect(madeWithEarlierProportions(undefined, profile)).toBe(false)
    expect(madeWithEarlierProportions(provenanceFor(undefined, []), undefined)).toBe(false)
  })
  it('the fingerprint depends on content, not identity', () => {
    expect(fingerprint(createProfile('a'))).toBe(fingerprint(createProfile('b')))
    expect(fingerprint(createProfile('a'))).not.toBe(fingerprint(setHeightM(createProfile('a'), 1.2)))
    expect(fingerprint(createProfile('a'))).toMatch(/^pp1-[0-9a-f]{8}$/)
  })
})

describe('each view is reviewed on its own', () => {
  it('approving one view leaves the others unapproved', () => {
    let q = finished(enqueue(emptyQueue(), [request('front'), request('side'), request('back')], 1, false).state)
    q = approve(q, q.jobs[1].id)
    expect(q.jobs.map((j) => j.approved)).toEqual([false, true, false])
  })
})

describe('fit rules are proposals', () => {
  const rules = proposeFitRules(createProfile('A'))
  it('every rule starts as a proposal, in three kinds, and nothing is applied', () => {
    expect(rules.every((r) => r.status === 'proposed' && r.intent === 'fit')).toBe(true)
    expect(new Set(rules.map((r) => r.category))).toEqual(new Set(['functional', 'spatial', 'visual']))
    expect(approvedRulesText(rules)).toBe('')
  })
  it('only an approved "fit" rule reaches a prompt; rejected and intentionally cramped or oversized ones do not', () => {
    const seat = rules.find((r) => r.key === 'seat-height')!
    const door = rules.find((r) => r.key === 'doorway-clearance')!
    const desk = rules.find((r) => r.key === 'desk-height')!
    const text = approvedRulesText([decide(seat, 'approved'), decide(door, 'rejected'), setIntent(desk, 'cramped')])
    expect(text).toContain('Sized for the character (approved)')
    expect(text).toContain(seat.text)
    expect(text).not.toContain(door.text)
    expect(text).not.toContain(desk.text)
    expect(setIntent(desk, 'oversized')).toMatchObject({ intent: 'oversized', status: 'approved' })
  })
  it('numbers follow the proportions and the height: a taller or longer-legged character gets bigger seats', () => {
    const tall = proposeFitRules(setHeightM(createProfile('T'), 2.1)).find((r) => r.key === 'seat-height')!.valueM!
    const base = rules.find((r) => r.key === 'seat-height')!.valueM!
    expect(tall).toBeGreaterThan(base)
    const m = bodyMetres(createProfile('A'))
    expect(m.heightM).toBe(1.75)
    expect(m.headM).toBeCloseTo(1.75 / 7.5, 2)
    expect(m.shoulderHeightM).toBeCloseTo(m.legM + m.torsoM, 2)
  })
  it('a decided rule is never replaced by a newer proposal; it only notes the new value', () => {
    const approved = decide(rules.find((r) => r.key === 'seat-height')!, 'approved')
    const bigger = proposeFitRules(setHeightM(createProfile('A'), 2.1))
    const merged = mergeProposals([approved], bigger)
    const seat = merged.find((r) => r.key === 'seat-height')!
    expect(seat.status).toBe('approved')
    expect(seat.valueM).toBe(approved.valueM)
    expect(seat.newerValueM).toBe(bigger.find((r) => r.key === 'seat-height')!.valueM)
    expect(merged.find((r) => r.key === 'desk-height')!.status).toBe('proposed')
  })
  it('reads saved rules safely: damage is dropped and an unknown status is never "approved"', () => {
    const read = readFitRules({ A: [{ key: 'k', label: 'L', text: 'T', status: 'maybe', intent: 'weird', category: 'nope', valueM: 'x' }, { key: 1 }, 'junk'], B: 'no' })
    expect(read.A).toHaveLength(1)
    expect(read.A[0]).toMatchObject({ status: 'proposed', intent: 'fit', category: 'functional' })
    expect(read.B).toBeUndefined()
    expect(readFitRules(undefined)).toEqual({})
  })
})

describe('Scale and Fit sheet', () => {
  const people = [{ name: 'AMINA', profile: createProfile('A') }, { name: 'KOFI', profile: setHeightM(createProfile('K', 'compact'), 1.5) }]
  it('has the six items, one convention, and labels sizes illustrative', () => {
    const s = scaleFitSheet(people)
    expect(s.items.map((i) => i.id)).toEqual(['lineup', 'doorway', 'chair', 'desk', 'stair', 'prop'])
    expect(s.convention).toMatch(/Metres\. One ground line, one scale/)
    expect(s.measures.every((m) => m.basis === 'illustrative')).toBe(true)
    expect(s.basisNote).toMatch(/illustrative/)
    expect(s.prompt).toMatch(/AMINA \(1.75 m\), KOFI \(1.5 m\)/)
    expect(s.measures.find((m) => m.item === 'doorway')!.valueM).toBeCloseTo(1.9, 2)
  })
  it('a measurement is "verified" only when one is supplied', () => {
    const s = scaleFitSheet(people, { doorway: 2.03 })
    expect(s.measures.find((m) => m.item === 'doorway')).toMatchObject({ valueM: 2.03, basis: 'verified' })
    expect(s.measures.find((m) => m.item === 'chair')!.basis).toBe('illustrative')
    expect(s.basisNote).toMatch(/illustrative/)
  })
})

describe('redesigning an imported character', () => {
  const original = 'C:/imports/marcus.png'
  it('asks for a new candidate from the original and never writes over it', () => {
    const r = redesignRequest('CHAR-1', 'MARCUS', original, profile)
    expect(r.references).toEqual([original])
    expect(r.outputName(1)).not.toContain('marcus.png')
    expect(r.outputName(1)).toBe('CHAR-1_redesign-candidate_v01')
    expect(r.prompt).toMatch(/do not stretch, squash or warp/)
    expect(r.prompt).toMatch(/large head on a small body/)
  })
  it('marks every landmark an estimate until the person confirms it', () => {
    const marks = estimateLandmarks(createProfile('A'))
    expect(marks).toHaveLength(6)
    expect(marks.every((m) => m.certainty === 'estimated')).toBe(true)
    expect(uncertain(marks)).toHaveLength(6)
    const confirmed = confirmLandmark(marks[0], 0.52, 0.03)
    expect(confirmed.certainty).toBe('confirmed')
    expect(uncertain([confirmed, ...marks.slice(1)])).toHaveLength(5)
    expect(marks[0].certainty).toBe('estimated')
    expect(confirmLandmark(marks[0], 5, -1)).toMatchObject({ x: 1, y: 0 })
  })
  it('the stretched preview is labelled as a preview and is only a plan of bands', () => {
    expect(WARP_LABEL).toMatch(/Preview only/)
    expect(WARP_LABEL).toMatch(/not a redesign/)
    const bands = warpBands(createProfile('A'), profile)
    expect(bands).toHaveLength(5)
    expect(bands[0].to[1] - bands[0].to[0]).toBeGreaterThan(bands[0].from[1] - bands[0].from[0])
  })
  it('the comparison is ready only when a candidate exists', () => {
    expect(compare(original, undefined).ready).toBe(false)
    expect(compare(original, 'C:/out/c.png')).toEqual({ before: original, after: 'C:/out/c.png', ready: true })
  })
})
