import { describe, expect, it } from 'vitest'
import { addRevision, approveRevision, createEntity, emptyVariations, type AgeSpec, type Ref, type RelationshipSpec, type VariationState } from './variations'
import { addRelationship, applyRelationships, approvedRelationships, checkRelationship, describeRelationship, proposeFromScene, readRelationshipSpec, relationshipConflicts, relationshipProblems, relationshipsFor, relationshipViews } from './relationships'
import { staleRevisions, stalenessOf, dependentsOf, validateVariations } from './variationGraph'
import { addThing, emptySceneState, seat, shapeThing, worldIssues, readSceneStates, type World } from './sceneState'
import { deriveFromLegacy, readVariations, variationsOf } from './variationMigration'

const NOW = '2026-11-27T00:00:00.000Z'
const names: Record<string, string> = { 'CHAR-VEN': 'Venomspur', 'CHAR-RAP': 'the rapper', 'PROP-CHAIR': 'VIP chair', 'PROP-DESK': 'the desk' }
const nameOf = (id: string) => names[id] ?? id

const own = (a: string, b: string, extra: Partial<RelationshipSpec> = {}): RelationshipSpec => ({ relation: 'ownership', a: { asset: a }, b: { asset: b }, exclusive: true, basis: 'declared', ...extra })

function approved(state: VariationState, spec: RelationshipSpec): { state: VariationState; ref: Ref } {
  const made = addRelationship(state, spec, nameOf, NOW)
  if ('error' in made) throw new Error(made.error)
  return { state: approveRevision(made.state, made.ref), ref: made.ref }
}

describe('recording a relationship', () => {
  it('makes a candidate with a plain-words name, and nothing holds until it is approved', () => {
    const made = addRelationship(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR'), nameOf, NOW)
    if ('error' in made) throw new Error(made.error)
    expect(made.state.entities[0].name).toBe('VIP chair belongs to Venomspur alone')
    expect(made.ref).toEqual({ id: 'REL-001', revision: 1 })
    expect(approvedRelationships(made.state)).toHaveLength(0)
    expect(relationshipViews(made.state)[0].status).toBe('candidate')
  })

  it('refuses a relationship with itself, a scale with no size, and an interaction with no verb, in plain words', () => {
    expect(checkRelationship(own('CHAR-VEN', 'CHAR-VEN'))).toMatch(/itself/)
    expect(checkRelationship({ relation: 'scale', a: { asset: 'A' }, b: { asset: 'B' }, basis: 'declared' })).toMatch(/number greater than zero/)
    expect(checkRelationship({ relation: 'scale', a: { asset: 'A' }, b: { asset: 'B' }, ratio: -2, basis: 'declared' })).toMatch(/number greater than zero/)
    expect(checkRelationship({ relation: 'interaction', a: { asset: 'A' }, b: { asset: 'B' }, basis: 'declared' })).toMatch(/sit, hold/)
    const refused = addRelationship(emptyVariations(), own('A', 'A'), nameOf, NOW)
    expect('error' in refused).toBe(true)
  })

  it('does not record the same relationship twice, but allows it again after it was turned down', () => {
    const one = addRelationship(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR'), nameOf, NOW)
    if ('error' in one) throw new Error()
    const again = addRelationship(one.state, own('CHAR-VEN', 'PROP-CHAIR'), nameOf, NOW)
    expect('error' in again && again.error).toMatch(/already exists/)
    const rejected = { ...one.state, entities: one.state.entities.map((e) => ({ ...e, revisions: e.revisions.map((r) => ({ ...r, status: 'rejected' as const })) })) } as VariationState
    expect('error' in addRelationship(rejected, own('CHAR-VEN', 'PROP-CHAIR'), nameOf, NOW)).toBe(false)
  })

  it('says each kind in plain words', () => {
    expect(describeRelationship({ relation: 'interaction', a: { asset: 'CHAR-RAP' }, b: { asset: 'PROP-CHAIR' }, verb: 'sit', basis: 'declared' }, nameOf)).toBe('the rapper sits on VIP chair')
    expect(describeRelationship({ relation: 'scale', a: { asset: 'CHAR-VEN' }, b: { asset: 'CHAR-RAP' }, ratio: 1.4, basis: 'declared' }, nameOf)).toBe('Venomspur is 1.4 times the height of the rapper')
    expect(describeRelationship({ relation: 'scale', a: { asset: 'CHAR-RAP' }, b: { asset: 'CHAR-VEN' }, ratio: 0.5, basis: 'declared' }, nameOf)).toBe('the rapper is 2 times shorter than Venomspur')
  })
})

describe('regression: the VIP chair and the desk', () => {
  const world = (): World => {
    let s = emptySceneState('SC-1')
    s = addThing(s, { id: 'CHAR-VEN', kind: 'character', name: 'Venomspur', x: 0, y: -1, facing: 180 })
    s = addThing(s, { id: 'CHAR-RAP', kind: 'character', name: 'the rapper', x: 3, y: 2, facing: 0, posture: 'standing' })
    s = addThing(s, { id: 'PROP-CHAIR', kind: 'furniture', name: 'VIP chair', x: 0, y: -1, facing: 180 })
    s = addThing(s, { id: 'PROP-DESK', kind: 'furniture', name: 'the desk', x: 0, y: 0, facing: 180, size: { w: 2, d: 1 } })
    return s.world
  }
  const withOwner = () => approved(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR')).state

  it('an approved ownership makes the rapper sitting in Venomspur\'s chair a problem, even when the scene never said who owns it', () => {
    const w = world()
    w.things = w.things.map((t) => (t.id === 'CHAR-RAP' ? { ...t, occupies: 'PROP-CHAIR', posture: 'seated' as const, x: 0, y: -1 } : t))
    expect(worldIssues(w).some((i) => i.kind === 'chair-not-owned')).toBe(false) // the scene alone does not know
    const issues = worldIssues(applyRelationships(w, withOwner(), 'SC-1'))
    expect(issues.map((i) => i.kind)).toContain('chair-not-owned')
    expect(issues.find((i) => i.kind === 'chair-not-owned')?.message).toMatch(/the rapper sits in VIP chair, which is assigned to Venomspur/)
  })

  it('Venomspur in his own chair is fine, and so is the rapper on another seat', () => {
    const w = world()
    w.things = w.things.map((t) => (t.id === 'CHAR-VEN' ? { ...t, occupies: 'PROP-CHAIR', posture: 'seated' as const } : t))
    expect(worldIssues(applyRelationships(w, withOwner(), 'SC-1'))).toEqual([])
  })

  it('a candidate (not yet approved) ownership is not enforced', () => {
    const made = addRelationship(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR'), nameOf, NOW)
    if ('error' in made) throw new Error()
    const w = world()
    w.things = w.things.map((t) => (t.id === 'CHAR-RAP' ? { ...t, occupies: 'PROP-CHAIR', posture: 'seated' as const, x: 0, y: -1 } : t))
    expect(worldIssues(applyRelationships(w, made.state, 'SC-1')).some((i) => i.kind === 'chair-not-owned')).toBe(false)
  })

  it('the rapper cannot stand through the desk, but can stand beside it, and a seated person is placed at the chair', () => {
    const through = world()
    through.things = through.things.map((t) => (t.id === 'CHAR-RAP' ? { ...t, x: 0.4, y: 0.1 } : t))
    expect(worldIssues(through).find((i) => i.kind === 'intersects')?.message).toBe('the rapper is standing inside the desk.')
    const beside = world()
    beside.things = beside.things.map((t) => (t.id === 'CHAR-RAP' ? { ...t, x: 1.5, y: 0 } : t))
    expect(worldIssues(beside)).toEqual([])
    expect(worldIssues(world())).toEqual([]) // Venomspur sits at the chair, behind the desk, not inside it
  })

  it('seating still refuses two people on one chair (existing rule kept)', () => {
    let s = emptySceneState('SC-1')
    s = addThing(s, { id: 'CHAR-VEN', kind: 'character', name: 'Venomspur', x: 0, y: 0, facing: 0 })
    s = addThing(s, { id: 'CHAR-RAP', kind: 'character', name: 'the rapper', x: 3, y: 3, facing: 0 })
    s = addThing(s, { id: 'PROP-CHAIR', kind: 'furniture', name: 'VIP chair', x: 0, y: 0, facing: 0 })
    const a = seat(s, 'CHAR-VEN', 'PROP-CHAIR')
    if (!a.ok) throw new Error()
    expect(seat(a.state, 'CHAR-RAP', 'PROP-CHAIR').ok).toBe(false)
  })

  it('an ownership only applies in the scenes it names', () => {
    const state = approved(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR', { sceneIds: ['SC-2'] })).state
    expect(applyRelationships(world(), state, 'SC-1').things.find((t) => t.id === 'PROP-CHAIR')?.ownedBy).toBeUndefined()
    expect(applyRelationships(world(), state, 'SC-2').things.find((t) => t.id === 'PROP-CHAIR')?.ownedBy).toBe('CHAR-VEN')
  })
})

describe('relationships depend on what they were agreed for', () => {
  const body = (): { state: VariationState; ref: Ref } => {
    const spec: AgeSpec = { characterId: 'CHAR-VEN', mode: 'same-person', targetAge: '40' }
    const made = createEntity(emptyVariations(), 'age', { name: 'Venomspur at 40', characterId: 'CHAR-VEN', spec, now: NOW })
    return { state: approveRevision(made.state, made.ref), ref: made.ref }
  }

  it('is flagged when the body it was pinned to gets a newer approved version, and nothing else is touched', () => {
    const b = body()
    const scale: RelationshipSpec = { relation: 'scale', a: { asset: 'CHAR-VEN', pin: b.ref }, b: { asset: 'CHAR-RAP' }, ratio: 1.4, basis: 'declared' }
    const unrelated = approved(b.state, own('CHAR-RAP', 'PROP-DESK'))
    const rel = approved(unrelated.state, scale)
    expect(stalenessOf(rel.state, rel.ref).stale).toBe(false)
    expect(dependentsOf(rel.state, b.ref)).toEqual([rel.ref])
    const next = addRevision(rel.state, b.ref.id, { spec: { characterId: 'CHAR-VEN', mode: 'same-person', targetAge: '41' } as AgeSpec, now: NOW })
    const s2 = approveRevision(next.state, next.ref)
    const stale = staleRevisions(s2)
    expect(stale.map((x) => x.ref)).toEqual([rel.ref])
    expect(stale[0].reasons[0].kind).toBe('newer')
    expect(stalenessOf(s2, unrelated.ref).stale).toBe(false)
    expect(relationshipViews(s2).find((v) => v.ref.id === rel.ref.id)?.stale).toBe(true)
    // The approved relationship still says what was agreed.
    expect(approvedRelationships(s2).find((r) => r.ref.id === rel.ref.id)?.spec.ratio).toBe(1.4)
  })

  it('is flagged when what it was pinned to is gone, and the problem list says so in words', () => {
    const rel = approved(emptyVariations(), { relation: 'scale', a: { asset: 'CHAR-VEN', pin: { id: 'AGE-099', revision: 1 } }, b: { asset: 'CHAR-RAP' }, ratio: 1.4, basis: 'declared' })
    expect(stalenessOf(rel.state, rel.ref).reasons[0].kind).toBe('missing')
    expect(validateVariations(rel.state).some((p) => /AGE-099@1/.test(p.message))).toBe(true)
    expect(relationshipProblems(rel.state, new Set(['CHAR-VEN']), nameOf).join(' ')).toMatch(/CHAR-RAP is not in this project/)
  })

  it('pinning to another relationship is flagged as the wrong kind', () => {
    const one = approved(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR'))
    const bad = approved(one.state, { relation: 'scale', a: { asset: 'CHAR-VEN', pin: one.ref }, b: { asset: 'CHAR-RAP' }, ratio: 1, basis: 'declared' })
    expect(stalenessOf(bad.state, bad.ref).reasons[0].kind).toBe('wrong-kind')
  })
})

describe('conflicts and proposals', () => {
  it('two exclusive owners of one thing, or two different sizes for one pair, are conflicts; a repeated size is not', () => {
    let s = approved(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR')).state
    s = approved(s, own('CHAR-RAP', 'PROP-CHAIR')).state
    expect(relationshipConflicts(s, nameOf)[0]).toMatchObject({ kind: 'two-owners' })
    expect(relationshipConflicts(s, nameOf)[0].message).toMatch(/only one can own it/)
    const size = (a: string, b: string, ratio: number): RelationshipSpec => ({ relation: 'scale', a: { asset: a }, b: { asset: b }, ratio, basis: 'declared' })
    let t = approved(emptyVariations(), size('CHAR-VEN', 'CHAR-RAP', 1.4)).state
    expect(relationshipConflicts(t, nameOf)).toEqual([])
    t = approved(t, size('CHAR-RAP', 'CHAR-VEN', 1 / 1.4 + 0.001)).state // the same fact said the other way round
    expect(relationshipConflicts(t, nameOf)).toEqual([])
    // The add function refuses a second size for the same direction, so a disagreement can only come from a file edited by hand or merged from another project.
    const hand = createEntity(t, 'relationship', { name: 'hand edited', spec: size('CHAR-VEN', 'CHAR-RAP', 2), now: NOW })
    t = approveRevision(hand.state, hand.ref)
    expect(relationshipConflicts(t, nameOf).map((c) => c.kind)).toContain('scale-disagrees')
  })

  it('proposes what a scene already says, once, and not what is already recorded', () => {
    let sc = emptySceneState('SC-1')
    sc = addThing(sc, { id: 'CHAR-VEN', kind: 'character', name: 'Venomspur', x: 0, y: 0, facing: 0, occupies: 'PROP-CHAIR' })
    sc = addThing(sc, { id: 'PROP-CHAIR', kind: 'furniture', name: 'VIP chair', x: 0, y: 0, facing: 0, ownedBy: 'CHAR-VEN' })
    const first = proposeFromScene(sc.world, emptyVariations(), 'SC-1')
    expect(first.map((p) => `${p.relation}:${p.a.asset}>${p.b.asset}`)).toEqual(['interaction:CHAR-VEN>PROP-CHAIR', 'ownership:CHAR-VEN>PROP-CHAIR'])
    const recorded = approved(emptyVariations(), first[1]).state
    expect(proposeFromScene(sc.world, recorded, 'SC-1').map((p) => p.relation)).toEqual(['interaction'])
  })

  it('lists what mentions an asset, either side', () => {
    const s = approved(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR')).state
    expect(relationshipsFor(s, 'PROP-CHAIR')).toHaveLength(1)
    expect(relationshipsFor(s, 'CHAR-VEN')).toHaveLength(1)
    expect(relationshipsFor(s, 'CHAR-RAP')).toHaveLength(0)
  })
})

describe('older and damaged projects', () => {
  it('a project saved before relationships has none, and opening it adds nothing', () => {
    const legacy = deriveFromLegacy({ analysis: { assets: [] } })
    expect(legacy.entities.filter((e) => e.kind === 'relationship')).toHaveLength(0)
    expect(variationsOf({ analysis: { assets: [] }, variations: undefined })).toEqual(legacy)
  })

  it('relationships survive a save and a reload exactly', () => {
    const s = approved(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR', { note: 'VIP only' })).state
    expect(readVariations(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('a damaged relationship is dropped without breaking the rest', () => {
    const s = approved(emptyVariations(), own('CHAR-VEN', 'PROP-CHAIR')).state
    const raw = JSON.parse(JSON.stringify(s))
    const good = raw.entities[0]
    const bad = (spec: unknown) => ({ ...good, id: `REL-${Math.random()}`, revisions: [{ ...good.revisions[0], spec }] })
    raw.entities.push(bad({ relation: 'ownership', a: 'x', b: { asset: 'y' }, basis: 'declared' }), bad({ relation: 'teleport', a: { asset: 'x' }, b: { asset: 'y' } }), bad({ relation: 'scale', a: { asset: 'x' }, b: { asset: 'y' }, ratio: 'big' }), bad({ relation: 'ownership', a: { asset: 'x' }, b: { asset: 'x' } }), bad(null))
    expect(readVariations(raw)?.entities).toHaveLength(1)
  })

  it('reading cleans a relationship into a known shape and caps the long text', () => {
    const spec = readRelationshipSpec({ relation: 'ownership', a: { asset: 'A', pin: { id: 'AGE-001', revision: 1.5 } }, b: { asset: 'B' }, note: 'x'.repeat(900), extra: 'ignored', basis: 'weird' })
    expect(spec?.a.pin).toBeUndefined()
    expect(spec?.note).toHaveLength(300)
    expect(spec?.basis).toBe('declared')
    expect(spec?.exclusive).toBe(true)
    expect(spec).not.toHaveProperty('extra')
  })

  it('scene states keep a footprint only when it is a real size', () => {
    const raw = { 'SC-1': { sceneId: 'SC-1', revision: 1, world: { things: [{ id: 'D', name: 'Desk', kind: 'furniture', x: 0, y: 0, facing: 0, size: { w: 2, d: 1 } }, { id: 'E', name: 'Bad', kind: 'furniture', x: 0, y: 0, facing: 0, size: { w: -2, d: 'x' } }], relationships: [] }, changes: [], cameras: {} } }
    const things = readSceneStates(raw)['SC-1'].world.things
    expect(things[0].size).toEqual({ w: 2, d: 1 })
    expect(things[1].size).toBeUndefined()
  })
})

describe('giving a prop a footprint and making it furniture', () => {
  it('turns a prop into furniture with a size, so it can be sat on, owned and walked through; and refuses nonsense', () => {
    let s = emptySceneState('SC-1')
    s = addThing(s, { id: 'PROP-CHAIR', kind: 'prop', name: 'VIP chair', x: 1, y: 1, facing: 0 })
    s = addThing(s, { id: 'CHAR-RAP', kind: 'character', name: 'the rapper', x: 1, y: 1, facing: 0 })
    const made = shapeThing(s, 'PROP-CHAIR', { kind: 'furniture', size: { w: 0.7, d: 0.7 } })
    expect(made.world.things.find((t) => t.id === 'PROP-CHAIR')).toMatchObject({ kind: 'furniture', size: { w: 0.7, d: 0.7 } })
    expect(seat(made, 'CHAR-RAP', 'PROP-CHAIR').ok).toBe(true)
    expect(shapeThing(made, 'PROP-CHAIR', { size: null }).world.things[0].size).toBeUndefined()
    expect(shapeThing(made, 'PROP-CHAIR', { size: { w: -1, d: 2 } }).world.things[0].size).toEqual({ w: 0.7, d: 0.7 })
    expect(shapeThing(made, 'CHAR-RAP', { kind: 'furniture' })).toBe(made) // a character cannot be turned into furniture
    expect(shapeThing(made, 'NOPE', { kind: 'furniture' })).toBe(made)
  })
})
