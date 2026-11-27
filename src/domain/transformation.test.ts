import { describe, expect, it } from 'vitest'
import { emptyQueue, enqueue, type ImageJob } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import { defaultStyleBible } from './visualDevelopment'
import { styleByName } from './demo2d'
import { staleRevisions } from './variationGraph'
import { addRevision, approveRevision, emptyVariations, findRevision, type FitSpec, type LookSpec, type TransformationSpec, type VariationState } from './variations'
import { syncWardrobe, startFit } from './wardrobeFlow'
import { anatomyRules, checkTransformation, parseExpectedAnatomy, transformationCapability, transformationForJob, transformationPresets, transformationPrompt, transformationRequests, transformationViews, visionAnatomyRules } from './transformation'
import { lastApprovedStage, newStage, stageLines, stageLookName, stagePicture } from './transformationFlow'
import { garmentRequests } from './wardrobe'
import { garmentAssetId, newGarment } from './wardrobeFlow'
import { reconcileWithQueue } from './variationSync'

const T = '2026-11-27T00:00:00.000Z'
const style3d = defaultStyleBible
const style2d = styleByName('Clean digital cel animation')
const kael: ExtractedAsset = { id: 'CHAR-KAEL', name: 'KAEL', type: 'character', sceneIds: [], status: 'approved', age: '40-45', gender: 'male', role: 'cosmic engineer', never: 'no beard', description: 'Kael in a slate-blue tunic.' }
const anchors = ['the tired kind eyes', 'the lean build', 'the dark tousled hair']

const subtle = { kind: 'infected', stage: 'Subtle symptoms', intensity: 1, recognisability: 5, anchors, costume: 'keep' as const, audience: 'teen' as const, details: { surface: 'faint dark veins at the wrists', differences: 'a few veins at the wrists' } }
const partial = { kind: 'infected', stage: 'Partial transformation', intensity: 3, recognisability: 4, anchors, costume: 'adapt' as const, audience: 'teen' as const, symmetry: 'asymmetric' as const, details: { anatomy: 'the left arm longer and thinner', surface: 'grey waxy skin spreading from the left hand', features: 'clouded left eye', differences: 'the veins spread to the neck, the left arm and hand change' }, expectedAnatomy: ['fingers: six on the left hand, five on the right'] }
const full = { kind: 'infected', stage: 'Full form', intensity: 5, recognisability: 3, anchors, costume: 'damage' as const, audience: 'teen' as const, symmetry: 'mixed' as const, details: { anatomy: 'hunched, limbs too long', surface: 'grey waxy skin all over', features: 'both eyes clouded', differences: 'the change reaches the whole body' }, expectedAnatomy: ['fingers: six on each hand', 'arms: two, the left a hand longer'] }

const done = (jobs: ImageJob[], patch: (j: ImageJob, i: number) => Partial<ImageJob>): ImageJob[] => jobs.map((j, i) => ({ ...j, status: 'needs-review' as const, outputPath: `C:/out/${j.id}.jpg`, ...patch(j, i) }))

/** Makes a stage and approves its first picture, the way the screen and the queue do together. */
function approvedStage(state: VariationState, spec: typeof subtle, from?: ReturnType<typeof newStage>['ref'], source = 'C:/kael/front.jpg', style = style3d) {
  const made = newStage(state, { character: kael, spec, from, now: T })
  const saved = findRevision(made.variations, made.ref)!.spec as TransformationSpec
  const prev = from ? { stage: (findRevision(state, from)!.spec as TransformationSpec).stage } : 'base' as const
  const reqs = transformationRequests({ style, provider: 'kie', model: 'google/nanobanana-2-1', character: kael, lookName: made.variant, stage: made.ref, spec: saved, source: { path: source, of: prev, ref: from } })
  const jobs = done(enqueue(emptyQueue(), reqs, 1).state.jobs, (_j, i) => ({ approved: i === 0 }))
  return { ...made, reqs, jobs, state: syncWardrobe(made.variations, jobs, T) }
}

describe('presets are starting points', () => {
  it('offers the kinds in the brief, and Custom starts empty', () => {
    expect(transformationPresets.map((p) => p.label)).toEqual(['Zombie or infected', 'Monster', 'Supernatural form', 'Robotic or cybernetic', 'Animal or creature hybrid', 'Elemental form', 'Custom'])
    const custom = transformationPresets.find((p) => p.key === 'custom')!
    expect([custom.anatomy, custom.surface, custom.features]).toEqual(['', '', ''])
    expect(transformationPresets.filter((p) => p.key !== 'custom').every((p) => p.anatomy && p.surface && p.features)).toBe(true)
  })
})

describe('a stage of a transformation, with the character kept recognisable (scenario 10)', () => {
  it('names the reference by role, says it is the same character, and lists what must stay recognisable', () => {
    const p = transformationPrompt({ style: style3d, character: kael, spec: { ...partial, characterId: kael.id }, view: transformationViews[0], source: { stage: 'Subtle symptoms' } })
    expect(p).toMatch(/Reference image 1 is the approved earlier stage \(Subtle symptoms\)\. It fixes who this is/)
    expect(p).toMatch(/the SAME character part-way through a change, not a new character/)
    expect(p).toMatch(/What must stay recognisable: the tired kind eyes; the lean build; the dark tousled hair\. The character should remain strongly recognisable\./)
    expect(p).toMatch(/to a clear degree/)
  })

  it('writes what changes from the earlier stage, and the anatomy, surface and features', () => {
    const p = transformationPrompt({ style: style3d, character: kael, spec: { ...partial, characterId: kael.id }, view: transformationViews[0], source: { stage: 'Subtle symptoms' } })
    expect(p).toMatch(/What changes from the earlier stage: the veins spread to the neck, the left arm and hand change/)
    expect(p).toMatch(/Anatomy and silhouette: the left arm longer and thinner\./)
    expect(p).toMatch(/Skin and surface: grey waxy skin spreading from the left hand\./)
    expect(p).toMatch(/Features: clouded left eye\./)
    expect(p).toMatch(/The change is asymmetric/)
  })

  it('starts the first stage from the character’s own picture and later stages from the approved stage before', () => {
    const first = approvedStage(emptyVariations(), subtle)
    expect(first.reqs.every((r) => r.references.length === 1 && r.references[0] === 'C:/kael/front.jpg')).toBe(true)
    expect(first.reqs[0].prompt).toMatch(/Reference image 1 is the approved character, before any change/)
    expect(first.reqs[0].variation?.uses?.[0].role).toBe('reference-1-character')
    const second = approvedStage(first.state, partial, first.ref, stagePicture(first.state, first.ref.id)!.path)
    expect(second.reqs[0].references[0]).toBe(`C:/out/${first.jobs[0].id}.jpg`)
    expect(second.reqs[0].variation?.uses?.[0]).toMatchObject({ id: first.ref.id, role: 'reference-1-earlier-stage' })
  })

  it('carries the protected anchors into every stage, partial and full', () => {
    const first = approvedStage(emptyVariations(), subtle)
    const second = approvedStage(first.state, partial, first.ref)
    const third = approvedStage(second.state, full, second.ref)
    for (const s of [first, second, third]) for (const r of s.reqs) expect(r.prompt).toMatch(/What must stay recognisable: the tired kind eyes; the lean build; the dark tousled hair\./)
    expect(third.reqs[0].prompt).toMatch(/to a complete degree/)
    expect(third.reqs[0].prompt).toMatch(/should remain clearly recognisable/)
  })

  it('does not reset the art style: a 2D style stays drawn, a rendered style stays rendered', () => {
    const flat = transformationPrompt({ style: style2d, character: kael, spec: { ...full, characterId: kael.id }, view: transformationViews[0], source: { stage: 'Partial transformation' } })
    expect(flat).toMatch(/flat 2D drawing\. Show the change through drawn line, shape and colour\. Do not introduce photographic or 3D rendering/)
    expect(flat).toContain(style2d.name)
    const rendered = transformationPrompt({ style: style3d, character: kael, spec: { ...full, characterId: kael.id }, view: transformationViews[0], source: 'base' })
    expect(rendered).not.toMatch(/flat 2D drawing/)
    expect(rendered).toMatch(/do not switch to photographic skin or a different style/)
    expect(rendered).toContain(style3d.name)
  })

  it('handles the costume as chosen: kept, adapted or damaged', () => {
    const text = (costume: 'keep' | 'adapt' | 'damage') => transformationPrompt({ style: style3d, character: kael, spec: { ...full, costume, characterId: kael.id }, view: transformationViews[0], source: 'base' })
    expect(text('keep')).toMatch(/Keep the costume exactly as it is/)
    expect(text('adapt')).toMatch(/adapt it to the changed body/)
    expect(text('damage')).toMatch(/The change damages the costume/)
  })

  it('keeps the strength to the audience chosen', () => {
    const text = (audience: 'family' | 'teen' | 'mature') => transformationPrompt({ style: style3d, character: kael, spec: { ...full, audience, characterId: kael.id }, view: transformationViews[0], source: 'base' })
    expect(text('family')).toMatch(/family audience: no gore/)
    expect(text('teen')).toMatch(/teen audience/)
    expect(text('mature')).toMatch(/mature audience/)
  })

  it('refuses a model that cannot see pictures, and says why', () => {
    expect(transformationCapability(true)).toEqual({ ok: true })
    const no = transformationCapability(false)
    expect(!no.ok && no.message).toMatch(/would not be the same character/)
  })
})

describe('stages are one character changing', () => {
  it('only continues from an approved stage of the same character and the same kind', () => {
    const first = approvedStage(emptyVariations(), subtle)
    const candidate = newStage(first.state, { character: kael, spec: partial, from: first.ref, now: T })
    expect(() => newStage(candidate.variations, { character: kael, spec: full, from: candidate.ref, now: T })).toThrow(/approved stage/)
    expect(() => newStage(first.state, { character: kael, spec: { ...partial, kind: 'robotic' }, from: first.ref, now: T })).toThrow(/same kind/)
    expect(() => newStage(first.state, { character: { ...kael, id: 'CHAR-OTHER' }, spec: partial, from: first.ref, now: T })).toThrow(/same character/)
    expect(() => newStage(first.state, { character: kael, spec: partial, from: { id: 'TRN-099', revision: 1 }, now: T })).toThrow(/not in this project/)
  })

  it('reads the stages as a line, in order, and a second kind is a second line', () => {
    const first = approvedStage(emptyVariations(), subtle)
    const second = approvedStage(first.state, partial, first.ref)
    const third = approvedStage(second.state, full, second.ref)
    const robotic = newStage(third.state, { character: kael, spec: { ...subtle, kind: 'robotic' }, now: T })
    const lines = stageLines(robotic.variations, kael.id)
    expect(lines.map((l) => l.kind)).toEqual(['infected', 'robotic'])
    expect(lines[0].stages.map((s) => s.stage)).toEqual(['Subtle symptoms', 'Partial transformation', 'Full form'])
    expect(lines[0].stages.map((s) => s.intensity)).toEqual([1, 3, 5])
    expect(lastApprovedStage(third.state, kael.id, 'infected')?.stage).toBe('Full form')
    expect(lastApprovedStage(third.state, kael.id, 'robotic')).toBeUndefined()
  })

  it('a second try at a stage is a new revision, and the character’s own record is untouched', () => {
    const before = JSON.stringify(kael)
    const first = newStage(emptyVariations(), { character: kael, spec: subtle, now: T })
    const again = newStage(first.variations, { character: kael, spec: { ...subtle, intensity: 2 }, now: T })
    expect(again.ref).toEqual({ id: first.ref.id, revision: 2 })
    expect(first.variant).toBe('KAEL · infected · subtle symptoms')
    expect(stageLookName('KAEL', ' infected ', 'Full form')).toBe('KAEL · infected · full form')
    expect(JSON.stringify(kael)).toBe(before)
  })

  it('approving a stage makes a look of the character in that stage, once', () => {
    const first = approvedStage(emptyVariations(), subtle)
    const looks = first.state.entities.filter((e) => e.kind === 'look')
    expect(looks).toHaveLength(1)
    expect(looks[0].revisions[0].spec as LookSpec).toMatchObject({ transformation: first.ref, queueVariant: 'KAEL · infected · subtle symptoms' })
    expect(syncWardrobe(first.state, first.jobs, T)).toBe(first.state)
  })

  it('marks the later stages stale when an earlier stage is replaced by a newer approved version', () => {
    const first = approvedStage(emptyVariations(), subtle)
    const second = approvedStage(first.state, partial, first.ref)
    const newer = approveRevision(addRevision(second.state, first.ref.id, { spec: { ...(findRevision(second.state, first.ref)!.spec as TransformationSpec), intensity: 2 }, now: T }).state, { id: first.ref.id, revision: 2 })
    expect(staleRevisions(newer).map((s) => s.ref.id)).toContain(second.ref.id)
  })
})

describe('intentional anatomy is judged as intended (scenario 11)', () => {
  it('a plain character is judged against a normal body', () => {
    expect(anatomyRules().map((r) => r.rule)).toEqual(['five fingers on each hand', 'two arms', 'two legs', 'two eyes', 'one head'])
    expect(anatomyRules().every((r) => r.source === 'human-default')).toBe(true)
  })

  it('a declared six-finger hand replaces the five-finger rule for the fingers, and the rest stay', () => {
    const rules = anatomyRules({ ...full, characterId: kael.id })
    expect(rules.find((r) => r.part === 'fingers')).toMatchObject({ rule: 'fingers: six on each hand', source: 'declared' })
    expect(rules.some((r) => r.rule === 'five fingers on each hand')).toBe(false)
    expect(rules.find((r) => r.part === 'legs')?.source).toBe('human-default')
    expect(rules.find((r) => r.part === 'arms')?.rule).toBe('arms: two, the left a hand longer')
  })

  it('understands "hands" as the fingers, and keeps free statements', () => {
    expect(parseExpectedAnatomy(['hands: six fingers', 'a tail as long as the legs', ''])).toEqual([{ part: 'fingers', statement: 'six fingers' }, { part: '', statement: 'a tail as long as the legs' }])
    expect(anatomyRules({ ...full, characterId: kael.id, expectedAnatomy: ['hands: six fingers', 'a tail as long as the legs'] }).some((r) => r.rule === 'a tail as long as the legs' && r.source === 'declared')).toBe(true)
  })

  it('puts the declared anatomy in the generation prompt as deliberate, not to be corrected', () => {
    const p = transformationPrompt({ style: style3d, character: kael, spec: { ...full, characterId: kael.id }, view: transformationViews[0], source: { stage: 'Partial transformation' } })
    expect(p).toMatch(/intentionally designed to have: fingers: six on each hand; arms: two, the left a hand longer\. These are deliberate: draw them exactly, and do not correct them to a normal human body/)
  })

  it('gives the vision review the declared anatomy, so a six-finger hand is not reported as a mistake', () => {
    const first = approvedStage(emptyVariations(), subtle)
    const second = approvedStage(first.state, full, first.ref)
    const job = { assetId: kael.id, variant: 'KAEL · infected · full form', variation: { id: second.ref.id, revision: 1, role: 'transformation-candidate' } }
    const rules = visionAnatomyRules(second.state, job)
    expect(rules[0]).toMatch(/intentionally transformed \(Full form\)\. The body is meant to have: fingers: six on each hand; arms: two, the left a hand longer\. Do not report these as mistakes/)
    expect(rules.join(' ')).toMatch(/For everything not listed, a normal body applies: two legs; two eyes; one head/)
    expect(rules.join(' ')).not.toMatch(/five fingers/)
    expect(rules[rules.length - 1]).toMatch(/Do report anything else that looks wrong/)
  })

  it('finds the transformation for a picture made later from the stage’s look, and nothing for the plain character', () => {
    const first = approvedStage(emptyVariations(), full)
    const later = { assetId: kael.id, variant: 'KAEL · infected · full form' }
    expect(transformationForJob(first.state, later)?.spec.stage).toBe('Full form')
    expect(visionAnatomyRules(first.state, later).length).toBeGreaterThan(0)
    expect(visionAnatomyRules(first.state, { assetId: kael.id, variant: 'Canonical' })).toEqual([])
    expect(visionAnatomyRules(emptyVariations(), later)).toEqual([])
  })
})

describe('checks on the settings', () => {
  it('passes the setting checks when anchors, target and the change are set, and says what was not checked', () => {
    const r = checkTransformation({ ...partial, characterId: kael.id }, { ...subtle, characterId: kael.id })
    expect(r.state).toBe('passed-for-checks-performed')
    expect(r.checks.filter((c) => c.result === 'fail')).toEqual([])
    expect(r.checks.find((c) => c.id === 'identity-in-picture')?.result).toBe('not-checked')
    expect(r.checks.find((c) => c.id === 'anatomy-in-picture')?.result).toBe('not-checked')
    expect(r.summary).toMatch(/Recognisability and the picture’s anatomy were not checked/)
  })

  it('asks for review without anchors, without a target, or when the anatomy changes but is not declared', () => {
    const bare = checkTransformation({ kind: 'infected', stage: 'Partial', characterId: kael.id, details: { anatomy: 'longer arms' } })
    expect(bare.state).toBe('needs-review')
    for (const id of ['anchors', 'recognisability', 'expected-anatomy']) expect(bare.checks.find((c) => c.id === id)?.result).toBe('fail')
    expect(bare.checks.find((c) => c.id === 'expected-anatomy')?.detail).toMatch(/a deliberate feature could be reported as a mistake/)
  })

  it('asks for a later stage to go further than the stage before and to say what changed', () => {
    const r = checkTransformation({ ...subtle, characterId: kael.id, details: { surface: 'veins' } }, { ...partial, characterId: kael.id })
    expect(r.checks.find((c) => c.id === 'progression')?.result).toBe('fail')
    expect(r.checks.find((c) => c.id === 'differences')?.result).toBe('fail')
  })

  it('does not turn recognisability into a score', () => {
    const r = checkTransformation({ ...full, characterId: kael.id })
    expect(r.checks.find((c) => c.id === 'recognisability')?.detail).toMatch(/creative target for a person to judge, not a measured score/)
  })
})

describe('fitting a garment to a transformed body', () => {
  const jacket = { description: 'A waxed cotton field jacket' }
  function worn() {
    const first = approvedStage(emptyVariations(), full)
    const g = newGarment(first.state, [kael], { name: 'Field jacket', spec: jacket, now: T })
    const gj = done(enqueue(emptyQueue(), garmentRequests({ style: style3d, provider: 'kie', model: 'm', assetId: garmentAssetId(g.ref.id), assetName: 'Field jacket', garment: g.ref, garmentName: 'Field jacket', spec: jacket }), 2).state.jobs, (_j, i) => ({ approved: i === 0 }))
    return { first, garment: g.ref, variations: reconcileWithQueue(g.variations, gj) }
  }

  it('files the fit under the stage, separate from the plain fit, and makes a transformation look', () => {
    const { first, garment, variations } = worn()
    const plain = startFit(variations, { character: kael, garment, garmentName: 'Field jacket', keep: ['face'], now: T })
    const body = { ref: first.ref, name: 'KAEL · infected · full form' }
    const fit = startFit(plain.variations, { character: kael, garment, garmentName: 'Field jacket', keep: ['face'], now: T, body })
    expect(fit.ref.id).not.toBe(plain.ref.id)
    expect(fit.variant).toBe('KAEL · infected · full form in Field jacket')
    expect((findRevision(fit.variations, fit.ref)?.spec as FitSpec).body).toEqual(first.ref)
    const fj = done(enqueue(emptyQueue(), [{ assetId: kael.id, variant: fit.variant, sheetType: 'Wardrobe', viewKey: 'costume-front', label: 'Costume front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], variation: { id: fit.ref.id, revision: 1, role: 'fit-candidate' }, outputName: () => 'o' }], 3).state.jobs, () => ({ approved: true }))
    const synced = syncWardrobe(fit.variations, fj, T)
    const look = synced.entities.filter((e) => e.kind === 'look').find((l) => (l.revisions[0].spec as LookSpec).fit)!
    expect(look.revisions[0].spec as LookSpec).toMatchObject({ transformation: first.ref, queueVariant: 'KAEL · infected · full form in Field jacket' })
    expect((look.revisions[0].spec as LookSpec).age).toBeUndefined()
  })

  it('marks that fit stale when the transformed body gets a newer approved version, but not the plain fit', () => {
    const { first, garment, variations } = worn()
    const plain = startFit(variations, { character: kael, garment, garmentName: 'Field jacket', keep: ['face'], now: T })
    const fit = startFit(plain.variations, { character: kael, garment, garmentName: 'Field jacket', keep: ['face'], now: T, body: { ref: first.ref, name: 'KAEL · infected · full form' } })
    const fj = done(enqueue(emptyQueue(), [
      { assetId: kael.id, variant: plain.variant, sheetType: 'Wardrobe', viewKey: 'costume-front', label: 'f', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], variation: { id: plain.ref.id, revision: 1, role: 'fit-candidate' }, outputName: () => 'a' },
      { assetId: kael.id, variant: fit.variant, sheetType: 'Wardrobe', viewKey: 'costume-front', label: 'f', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], variation: { id: fit.ref.id, revision: 1, role: 'fit-candidate' }, outputName: () => 'b' },
    ], 3).state.jobs, () => ({ approved: true }))
    const synced = syncWardrobe(fit.variations, fj, T)
    expect(staleRevisions(synced)).toEqual([])
    const newer = approveRevision(addRevision(synced, first.ref.id, { spec: { ...(findRevision(synced, first.ref)!.spec as TransformationSpec), intensity: 4 }, now: T }).state, { id: first.ref.id, revision: 2 })
    const stale = staleRevisions(newer).map((s) => s.ref.id)
    expect(stale).toContain(fit.ref.id)
    expect(stale).not.toContain(plain.ref.id)
  })
})
