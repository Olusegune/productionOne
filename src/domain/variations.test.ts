import { describe, expect, it } from 'vitest'
import { addRevision, approveRevision, attachMedia, createEntity, emptyVariations, findRevision, latestApproved, rejectRevision, VariationError, type AnySpec, type Ref, type VariationState } from './variations'
import { dependentsOf, depsOf, staleRevisions, stalenessOf, validateVariations } from './variationGraph'
import { commitDraft, editDraft, estimateCost, standingOf, startDraft } from './candidateFlow'

const T = '2026-11-27T00:00:00.000Z'
const jacket = { description: 'A waxed cotton field jacket with a corduroy collar and four patch pockets.', category: 'outerwear' }

/** A small working set: one garment (approved), a fit for Mara on it, a condition on it, and a look using both. */
function setup() {
  let s: VariationState = emptyVariations()
  const g = createEntity(s, 'garment', { name: 'Field jacket', spec: jacket, now: T }); s = approveRevision(g.state, g.ref)
  const fitMara = createEntity(s, 'fit', { name: 'Mara in field jacket', characterId: 'MARA', spec: { garment: g.ref, characterId: 'MARA', keep: ['face', 'hair'] }, now: T }); s = approveRevision(fitMara.state, fitMara.ref)
  const fitTom = createEntity(s, 'fit', { name: 'Tom in field jacket', characterId: 'TOM', spec: { garment: g.ref, characterId: 'TOM' }, now: T }); s = approveRevision(fitTom.state, fitTom.ref)
  const tear = createEntity(s, 'condition', { name: 'Left sleeve torn', spec: { garment: g.ref, kind: 'tear', regions: [{ component: 'sleeve', side: 'character-left', severity: 'moderate', description: 'torn at the elbow' }] }, now: T }); s = approveRevision(tear.state, tear.ref)
  const look = createEntity(s, 'look', { name: 'Mara · torn jacket', characterId: 'MARA', spec: { characterId: 'MARA', fit: fitMara.ref, condition: tear.ref }, now: T }); s = approveRevision(look.state, look.ref)
  const other = createEntity(s, 'garment', { name: 'Travel robe', spec: { description: 'A long wool travel robe.' }, now: T }); s = approveRevision(other.state, other.ref)
  const fitOther = createEntity(s, 'fit', { name: 'Mara in robe', characterId: 'MARA', spec: { garment: other.ref, characterId: 'MARA' }, now: T }); s = approveRevision(fitOther.state, fitOther.ref)
  const lookOther = createEntity(s, 'look', { name: 'Mara · robe', characterId: 'MARA', spec: { characterId: 'MARA', fit: fitOther.ref }, now: T }); s = approveRevision(lookOther.state, lookOther.ref)
  return { s, g: g.ref, fitMara: fitMara.ref, fitTom: fitTom.ref, tear: tear.ref, look: look.ref, other: other.ref, fitOther: fitOther.ref, lookOther: lookOther.ref }
}

describe('revisions are written once', () => {
  it('numbers revisions 1, 2, 3 and keeps earlier ones exactly as they were', () => {
    let s = emptyVariations()
    const a = createEntity(s, 'garment', { name: 'Coat', spec: { description: 'v1' }, now: T }); s = approveRevision(a.state, a.ref)
    const before = JSON.stringify(findRevision(s, a.ref))
    const b = addRevision(s, a.ref.id, { spec: { description: 'v2' }, now: T })
    expect(b.ref).toEqual({ id: a.ref.id, revision: 2 })
    expect(JSON.stringify(findRevision(b.state, a.ref))).toBe(before)
    expect(findRevision(b.state, b.ref)?.parent).toEqual(a.ref)
    expect(findRevision(b.state, b.ref)?.status).toBe('candidate')
  })

  it('never edits the state it was given', () => {
    const s = emptyVariations()
    const snapshot = JSON.stringify(s)
    createEntity(s, 'garment', { name: 'Coat', spec: { description: 'x' }, now: T })
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  it('copies the spec it is given, so editing the original later changes nothing', () => {
    const spec = { description: 'keep me', pieces: ['coat'] }
    const { state, ref } = createEntity(emptyVariations(), 'garment', { name: 'Coat', spec, now: T })
    spec.pieces.push('hat'); spec.description = 'changed'
    expect(findRevision(state, ref)?.spec).toEqual({ description: 'keep me', pieces: ['coat'] })
  })

  it('does not reuse ids', () => {
    let s = emptyVariations()
    const ids: string[] = []
    for (let i = 0; i < 3; i++) { const r = createEntity(s, 'garment', { name: `G${i}`, spec: { description: '' }, now: T }); s = r.state; ids.push(r.ref.id) }
    expect(ids).toEqual(['GAR-001', 'GAR-002', 'GAR-003'])
  })

  it('makes a decision once: an approved revision cannot be turned down or reopened', () => {
    const a = createEntity(emptyVariations(), 'garment', { name: 'Coat', spec: { description: 'x' }, now: T })
    const s = approveRevision(a.state, a.ref)
    expect(() => rejectRevision(s, a.ref)).toThrow(VariationError)
    expect(approveRevision(s, a.ref)).toBe(s)
    const r = rejectRevision(a.state, a.ref)
    expect(() => approveRevision(r, a.ref)).toThrow(VariationError)
  })

  it('closes the pictures of a decided revision', () => {
    const a = createEntity(emptyVariations(), 'garment', { name: 'Coat', spec: { description: 'x' }, now: T })
    const withPic = attachMedia(a.state, a.ref, { path: 'a.jpg', role: 'preview' })
    expect(findRevision(withPic, a.ref)?.media).toHaveLength(1)
    expect(() => attachMedia(approveRevision(withPic, a.ref), a.ref, { path: 'b.jpg', role: 'preview' })).toThrow(/closed/)
  })

  it('the newest approved revision is the current one, not the newest candidate', () => {
    let s = emptyVariations()
    const a = createEntity(s, 'garment', { name: 'Coat', spec: { description: 'v1' }, now: T }); s = approveRevision(a.state, a.ref)
    s = addRevision(s, a.ref.id, { spec: { description: 'v2 candidate' }, now: T }).state
    expect(latestApproved(s.entities[0])?.n).toBe(1)
  })
})

describe('what depends on what', () => {
  it('reads a look’s slots, a fit’s garment and a condition’s earlier condition', () => {
    const { s, look, fitMara, g, tear } = setup()
    const specOf = (r: Ref) => findRevision(s, r)?.spec as AnySpec
    expect(depsOf('look', specOf(look)).map((d) => d.ref)).toEqual([fitMara, tear])
    expect(depsOf('fit', specOf(fitMara)).map((d) => d.ref)).toEqual([g])
    expect(depsOf('garment', specOf(g))).toEqual([])
  })

  it('lists everything downstream of a garment revision, and nothing else', () => {
    const { s, g, fitMara, fitTom, tear, look, fitOther, lookOther } = setup()
    const down = dependentsOf(s, g).map((r) => `${r.id}@${r.revision}`).sort()
    expect(down).toEqual([fitMara, fitTom, tear, look].map((r) => `${r.id}@${r.revision}`).sort())
    expect(down).not.toContain(`${fitOther.id}@1`)
    expect(down).not.toContain(`${lookOther.id}@1`)
  })
})

describe('changing a base garment marks only what depends on it as stale', () => {
  it('is all current to begin with', () => {
    expect(staleRevisions(setup().s)).toEqual([])
  })

  it('marks the fits, the condition and the look built on the old revision, and keeps unrelated approvals', () => {
    const { s, g, fitMara, fitTom, tear, look, fitOther, lookOther, other } = setup()
    const next = addRevision(s, g.id, { spec: { ...jacket, description: `${jacket.description} Now with a storm flap.` }, now: T })
    const approved = approveRevision(next.state, next.ref)
    const stale = staleRevisions(approved).map((x) => `${x.ref.id}@${x.ref.revision}`).sort()
    expect(stale).toEqual([fitMara, fitTom, tear, look].map((r) => `${r.id}@${r.revision}`).sort())
    // The garment itself, an unrelated garment, its fit and its look keep their approval.
    for (const keep of [g, other, fitOther, lookOther]) expect(findRevision(approved, keep)?.status).toBe('approved')
    expect(stale).not.toContain(`${fitOther.id}@1`)
    expect(stale).not.toContain(`${lookOther.id}@1`)
  })

  it('says why: the garment has a newer approved revision', () => {
    const { s, g, fitMara } = setup()
    const next = addRevision(s, g.id, { spec: { ...jacket, description: 'changed' }, now: T })
    const result = stalenessOf(approveRevision(next.state, next.ref), fitMara)
    expect(result.reasons).toEqual([{ kind: 'newer', dependsOn: g, newer: 2, role: 'garment' }])
  })

  it('does not mark anything stale for a candidate that has not been approved', () => {
    const { s, g } = setup()
    const next = addRevision(s, g.id, { spec: { ...jacket, description: 'maybe' }, now: T })
    expect(staleRevisions(next.state)).toEqual([])
  })

  it('a look stays pinned to the revisions it was approved with', () => {
    const { s, g, look } = setup()
    const next = approveRevision(...(Object.values(addRevision(s, g.id, { spec: { ...jacket, description: 'v2' }, now: T })) as [VariationState, Ref]))
    expect(findRevision(next, look)?.spec).toEqual(findRevision(s, look)?.spec)
  })
})

describe('branching condition histories', () => {
  it('keeps pristine → dusty → torn → wet and a separate repaired branch without changing either', () => {
    let { s, g } = setup()
    const dusty = createEntity(s, 'condition', { name: 'Dusty', spec: { garment: g, kind: 'dust', regions: [] }, now: T }); s = approveRevision(dusty.state, dusty.ref)
    const torn = createEntity(s, 'condition', { name: 'Left sleeve torn (dusty)', spec: { garment: g, kind: 'tear', from: dusty.ref, regions: [{ component: 'sleeve', side: 'character-left', severity: 'moderate', description: 'torn' }] }, now: T }); s = approveRevision(torn.state, torn.ref)
    const wet = createEntity(s, 'condition', { name: 'Wet, same tear', spec: { garment: g, kind: 'wet', from: torn.ref, regions: [] }, now: T }); s = approveRevision(wet.state, wet.ref)
    const before = JSON.stringify([dusty.ref, torn.ref, wet.ref].map((r) => findRevision(s, r)))
    const repaired = createEntity(s, 'condition', { name: 'Repaired', spec: { garment: g, kind: 'repair', regions: [{ component: 'sleeve', side: 'character-left', severity: 'light', description: 'neat patch' }] }, now: T }); s = approveRevision(repaired.state, repaired.ref)
    const faded = createEntity(s, 'condition', { name: 'Repaired then faded', spec: { garment: g, kind: 'fade', from: repaired.ref, regions: [] }, now: T }); s = approveRevision(faded.state, faded.ref)
    expect(JSON.stringify([dusty.ref, torn.ref, wet.ref].map((r) => findRevision(s, r)))).toBe(before)
    expect(dependentsOf(s, torn.ref).map((r) => r.id)).toEqual([wet.ref.id])
    expect(dependentsOf(s, repaired.ref).map((r) => r.id)).toEqual([faded.ref.id])
    expect(staleRevisions(s)).toEqual([])
  })

  it('records the wearer’s side, not the picture’s side', () => {
    const { s, tear } = setup()
    const spec = findRevision(s, tear)?.spec as { regions: Array<{ side: string }> }
    expect(spec.regions[0].side).toBe('character-left')
  })
})

describe('checks on the records themselves', () => {
  it('finds a reference to something that is not in the project', () => {
    const { state } = createEntity(emptyVariations(), 'fit', { name: 'Orphan', characterId: 'MARA', spec: { garment: { id: 'GAR-099', revision: 1 }, characterId: 'MARA' }, now: T })
    expect(validateVariations(state).map((p) => p.message)).toEqual([expect.stringContaining('GAR-099@1')])
  })

  it('finds a reference of the wrong kind', () => {
    const g = createEntity(emptyVariations(), 'garment', { name: 'Coat', spec: { description: 'x' }, now: T })
    const { state } = createEntity(g.state, 'look', { name: 'Bad look', characterId: 'MARA', spec: { characterId: 'MARA', fit: g.ref }, now: T })
    expect(validateVariations(state)[0].message).toMatch(/is a garment, not a fit/)
  })

  it('finds a look that uses another character’s fit', () => {
    const { s, fitTom } = setup()
    const { state } = createEntity(s, 'look', { name: 'Mixed', characterId: 'MARA', spec: { characterId: 'MARA', fit: fitTom }, now: T })
    expect(validateVariations(state).map((p) => p.message).join(' ')).toMatch(/different character/)
  })

  it('a well-formed set has no problems', () => {
    expect(validateVariations(setup().s)).toEqual([])
  })

  it('does not loop forever on records that point at each other', () => {
    const a = createEntity(emptyVariations(), 'transformation', { name: 'Stage 1', characterId: 'MARA', spec: { characterId: 'MARA', stage: 'subtle', kind: 'infected' }, now: T })
    let s = approveRevision(a.state, a.ref)
    const b = createEntity(s, 'transformation', { name: 'Stage 2', characterId: 'MARA', spec: { characterId: 'MARA', stage: 'partial', kind: 'infected', from: a.ref }, now: T }); s = approveRevision(b.state, b.ref)
    // Point stage 1 back at stage 2 by adding a revision, creating a loop.
    const loop = addRevision(s, a.ref.id, { spec: { characterId: 'MARA', stage: 'subtle', kind: 'infected', from: b.ref }, now: T }); s = approveRevision(loop.state, loop.ref)
    expect(() => stalenessOf(s, loop.ref)).not.toThrow()
    expect(stalenessOf(s, loop.ref).reasons.some((r) => r.kind === 'cycle' || r.kind === 'newer' || r.kind === 'upstream-stale')).toBe(true)
  })
})

describe('the candidate workflow', () => {
  it('says where a revision stands and what to do next', () => {
    const { state, ref } = createEntity(emptyVariations(), 'garment', { name: 'Coat', spec: { description: 'x' }, now: T })
    const rev = () => findRevision(state, ref) as NonNullable<ReturnType<typeof findRevision>>
    expect(standingOf(rev(), { hasSource: false })).toMatchObject({ stage: 'preview', canApprove: false })
    const withPic = attachMedia(state, ref, { path: 'a.jpg', role: 'preview' })
    const picRev = findRevision(withPic, ref) as NonNullable<ReturnType<typeof findRevision>>
    expect(standingOf(picRev, { hasSource: false })).toMatchObject({ stage: 'approve', canApprove: true })
    expect(standingOf(picRev, { hasSource: true })).toMatchObject({ stage: 'compare', canApprove: true })
    expect(standingOf(findRevision(approveRevision(withPic, ref), ref) as never, { hasSource: true })).toMatchObject({ stage: 'sheets', canApprove: false })
    expect(standingOf(findRevision(rejectRevision(state, ref), ref) as never, { hasSource: true })).toMatchObject({ stage: 'configure' })
  })

  it('cannot be approved without a picture to look at, unless it was carried over from an older project', () => {
    const { state, ref } = createEntity(emptyVariations(), 'garment', { name: 'Coat', spec: { description: 'x' }, now: T })
    const bare = findRevision(state, ref) as NonNullable<ReturnType<typeof findRevision>>
    expect(standingOf(bare, { hasSource: false }).canApprove).toBe(false)
    expect(standingOf({ ...bare, legacy: { source: 'costume-asset' } }, { hasSource: false }).canApprove).toBe(true)
  })

  it('estimates a cost from the person’s own price, and says nothing when there is no price', () => {
    expect(estimateCost(3, 0.04)).toEqual({ requests: 3, usd: 0.12 })
    expect(estimateCost(3, null)).toEqual({ requests: 3, usd: null })
  })

  it('moving a slider edits only the local draft: no revision, no record, no request', () => {
    const { state, ref } = createEntity(emptyVariations(), 'age', { name: 'Mara older', characterId: 'MARA', spec: { characterId: 'MARA', mode: 'same-person', targetAge: '40' }, now: T })
    const before = JSON.stringify(state)
    let draft = startDraft('age', findRevision(state, ref)?.spec as never, ref)
    for (const age of ['45', '50', '55', '60', '65']) draft = editDraft(draft, { targetAge: age } as never)
    expect(draft.edits).toBe(5)
    expect((draft.spec as { targetAge: string }).targetAge).toBe('65')
    expect(JSON.stringify(state)).toBe(before)
  })

  it('turns a draft into a new candidate that continues from the revision it started from', () => {
    const first = createEntity(emptyVariations(), 'age', { name: 'Mara older', characterId: 'MARA', spec: { characterId: 'MARA', mode: 'same-person', targetAge: '40' }, now: T })
    const s = approveRevision(first.state, first.ref)
    const draft = editDraft(startDraft('age', findRevision(s, first.ref)?.spec as never, first.ref), { targetAge: '65' } as never)
    const made = commitDraft(s, draft, { entityId: first.ref.id }, T)
    expect(made.ref).toEqual({ id: first.ref.id, revision: 2 })
    expect(findRevision(made.state, made.ref)).toMatchObject({ status: 'candidate', parent: first.ref })
    expect((findRevision(made.state, first.ref)?.spec as { targetAge: string }).targetAge).toBe('40')
    const fresh = commitDraft(s, draft, { name: 'Mara at 65', characterId: 'MARA' }, T)
    expect(fresh.ref).toEqual({ id: 'AGE-002', revision: 1 })
  })
})
