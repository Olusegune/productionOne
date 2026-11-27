import { describe, expect, it } from 'vitest'
import { addRevision, approveRevision, approveWithPicture, attachMedia, createEntity, emptyVariations, findRevision, rejectRevision, type ConditionSpec, type VariationState } from './variations'
import { stalenessOf, validateVariations } from './variationGraph'
import { regenerationPlan } from './regeneration'
import { queueVariantOf, readVariations } from './variationMigration'
import { checkCondition } from './conditionChecks'
import { lookNamesFor } from './wardrobeFlow'
import { variationFiles } from './variationSync'
import { T, approveVia, mara, robe, world } from './variationWorld.fixture'
import { newCondition } from './conditions'
import { newGarment } from './wardrobeFlow'

describe('stale reasons are written in plain words', () => {
  const g = (s: VariationState, name: string) => createEntity(s, 'garment', { name, spec: { description: name }, now: T })

  it('a part that is no longer in the project', () => {
    const w = world()
    const broken: VariationState = { ...w.s, entities: w.s.entities.filter((e) => e.id !== w.robeRef.id) }
    const plan = regenerationPlan(broken)
    expect(plan.steps.some((s) => s.because.some((b) => /is no longer in the project/.test(b)))).toBe(true)
  })

  it('a part that is not approved', () => {
    const a = g(emptyVariations(), 'Coat')
    const approved = approveRevision(a.state, a.ref)
    const fit = createEntity(approved, 'fit', { name: 'Fit', characterId: 'C', spec: { garment: a.ref, characterId: 'C' }, now: T })
    const fitApproved = approveRevision(fit.state, fit.ref)
    // Replace the garment's approval by turning a second, unapproved revision into the pinned one.
    const v2 = addRevision(fitApproved, a.ref.id, { spec: { description: 'v2' }, now: T })
    const pinned = createEntity(v2.state, 'fit', { name: 'Fit2', characterId: 'C', spec: { garment: v2.ref, characterId: 'C' }, now: T })
    const result = stalenessOf(approveRevision(pinned.state, pinned.ref), pinned.ref)
    expect(result.reasons).toEqual([{ kind: 'not-approved', dependsOn: v2.ref, role: 'garment' }])
  })

  it('a part of the wrong kind', () => {
    const a = g(emptyVariations(), 'Coat')
    const approved = approveRevision(a.state, a.ref)
    const look = createEntity(approved, 'look', { name: 'Bad', characterId: 'C', spec: { characterId: 'C', fit: a.ref }, now: T })
    const r = stalenessOf(approveRevision(look.state, look.ref), look.ref)
    expect(r.reasons[0]).toMatchObject({ kind: 'wrong-kind', found: 'garment', role: 'outfit fit' })
    expect(regenerationPlan(approveRevision(look.state, look.ref)).steps[0].because[0]).toMatch(/is a garment, which does not belong there/)
  })

  it('a part that is itself out of date, and a part that points back at the item', () => {
    const w = world()
    const v2 = approveRevision(addRevision(w.s, w.robeRef.id, { spec: { ...robe, description: 'new' }, now: T }).state, { id: w.robeRef.id, revision: 2 })
    const look = createEntity(v2, 'look', { name: 'On a stale fit', characterId: mara.id, spec: { characterId: mara.id, fit: w.fitBase }, now: T })
    const r = stalenessOf(approveRevision(look.state, look.ref), look.ref)
    expect(r.reasons[0]).toMatchObject({ kind: 'upstream-stale' })
    expect(regenerationPlan(approveRevision(look.state, look.ref)).steps.find((s) => s.name === 'On a stale fit')?.because[0]).toMatch(/is itself out of date/)
  })
})

describe('structural checks on the records', () => {
  it('finds a duplicated id and revisions out of order', () => {
    const a = createEntity(emptyVariations(), 'garment', { name: 'A', spec: { description: 'a' }, now: T })
    const dup: VariationState = { ...a.state, entities: [...a.state.entities, a.state.entities[0]] }
    expect(validateVariations(dup).some((p) => /is used twice/.test(p.message))).toBe(true)
    const e = a.state.entities[0]
    const twice: VariationState = { ...a.state, entities: [{ ...e, revisions: [e.revisions[0], { ...e.revisions[0] }] } as typeof e] }
    expect(validateVariations(twice).map((p) => p.message).join(' ')).toMatch(/two revisions with the same number/)
    const unordered: VariationState = { ...a.state, entities: [{ ...e, revisions: [{ ...e.revisions[0], n: 2 }, { ...e.revisions[0], n: 1 }] } as typeof e] }
    expect(validateVariations(unordered).map((p) => p.message).join(' ')).toMatch(/out of order/)
  })
})

describe('reading a saved project that may be damaged', () => {
  it('ignores anything that is not a recognisable record set', () => {
    for (const bad of [undefined, null, 'x', 5, {}, { schema: 2, entities: [] }, { schema: 1 }, { schema: 1, entities: 'no' }]) expect(readVariations(bad)).toBeUndefined()
  })

  it('keeps a valid set, drops malformed entries, and fills in missing counters', () => {
    const w = world()
    const got = readVariations({ schema: 1, entities: [...w.s.entities, { id: 5 }, null, { id: 'X', kind: 'garment' }] })
    expect(got?.entities).toHaveLength(w.s.entities.length)
    expect(got?.counters).toEqual({})
    expect(readVariations(w.s)).toEqual(w.s)
  })

  it('names the queue variant a look files its pictures under, and falls back to Canonical', () => {
    const w = world()
    const look = w.s.entities.find((e) => e.kind === 'look')!
    expect(queueVariantOf(look as never, 1)).toBeTruthy()
    expect(queueVariantOf({ revisions: [] }, 1)).toBe('Canonical')
  })
})

describe('records that decide and change', () => {
  it('refuses to change what is not there', () => {
    expect(() => addRevision(emptyVariations(), 'GAR-099', { spec: { description: 'x' }, now: T })).toThrow(/There is no GAR-099/)
    const a = createEntity(emptyVariations(), 'garment', { name: 'A', spec: { description: 'a' }, now: T })
    expect(() => approveRevision(a.state, { id: 'GAR-099', revision: 1 })).toThrow(/no revision 1 of GAR-099/)
    expect(() => attachMedia(a.state, { id: a.ref.id, revision: 9 }, { path: 'p', role: 'r' })).toThrow(/no revision 9/)
    expect(() => approveWithPicture(a.state, a.ref, 'JOB-NOPE')).toThrow(/has no picture from job JOB-NOPE/)
    expect(rejectRevision(a.state, a.ref)).not.toBe(a.state)
  })
})

describe('a condition’s history is checked', () => {
  it('flags an earlier condition that is missing, belongs to another garment, or is not approved', () => {
    const w = world()
    const robe2 = newGarment(w.s, [mara], { name: 'Second coat', spec: { description: 'coat' }, now: T })
    const second = approveRevision(robe2.variations, robe2.ref)
    const other = approveRevision(newCondition(second, { name: 'Dusty coat', garment: robe2.ref, kind: 'dirt', regions: [], now: T }).variations, { id: 'CND-002', revision: 1 })
    const mismatched = (spec: ConditionSpec) => { const e = createEntity(other, 'condition', { name: 'Mismatch', spec, now: T }); return { state: approveRevision(e.state, e.ref), ref: e.ref } }
    const wrongGarment = mismatched({ garment: w.robeRef, kind: 'tear', regions: [], from: { id: 'CND-002', revision: 1 } })
    const r1 = checkCondition(wrongGarment.state, wrongGarment.ref)
    expect(r1.checks.find((c) => c.id === 'history-same-garment')).toMatchObject({ result: 'fail', detail: expect.stringMatching(/different garment/) })
    const missing = mismatched({ garment: w.robeRef, kind: 'tear', regions: [], from: { id: 'CND-099', revision: 1 } })
    expect(checkCondition(missing.state, missing.ref).checks.find((c) => c.id === 'history-same-garment')?.detail).toMatch(/missing/)
    expect(checkCondition(missing.state, missing.ref).checks.find((c) => c.id === 'history-approved')?.result).toBe('fail')
  })
})

describe('naming looks and listing files', () => {
  it('lists the outfit and body looks apart from Canonical, once each, in the order made', () => {
    const w = world()
    const names = lookNamesFor(w.s, mara.id)
    expect(names).toEqual(expect.arrayContaining(['MARA in Travel robe', 'MARA at 65']))
    expect(names).not.toContain('Canonical')
    expect(new Set(names).size).toBe(names.length)
    expect(lookNamesFor(w.s, undefined)).toEqual([])
    expect(lookNamesFor(w.s, 'CHAR-NOBODY')).toEqual([])
  })

  it('lists files from the queue when there is a job id, and by role when there is not', () => {
    const w = world()
    const files = variationFiles(w.s, w.jobs)
    expect(files.every((f) => f.id && f.absolutePath)).toBe(true)
    const bare: VariationState = createEntity(emptyVariations(), 'garment', { name: 'x', spec: { description: 'x' }, now: T, media: [{ path: 'C:/loose.jpg', role: 'reference' }] }).state
    expect(variationFiles(bare, [])).toEqual([{ id: 'GAR-001@1:reference', absolutePath: 'C:/loose.jpg' }])
    const proof = approveVia(emptyVariations(), [])
    expect(findRevision(proof.state, { id: 'x', revision: 1 })).toBeUndefined()
  })
})
