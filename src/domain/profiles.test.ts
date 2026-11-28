import { describe, expect, it } from 'vitest'
import { approveRevision, emptyVariations, findEntity, latestApproved, type CreatureSpec, type ProfileSpec, type VariationState } from './variations'
import { recordCreature, approvedCreature } from './creatureLab'
import { acceptProposal, approvedProfiles, exemptFrom, inheritedFor, proposals, readProfileSpec, recordProfile } from './profiles'
import { staleRevisions } from './variationGraph'
import { readVariations } from './variationMigration'

const creature = (assetId: string, over: Partial<CreatureSpec> = {}): CreatureSpec => ({ assetId, bodyPlan: 'humanoid', limbs: [{ name: 'arm', count: 2, digits: 5 }], symmetry: 'symmetric', intentional: [], never: [], ...over })
const profile = (over: Partial<ProfileSpec>): ProfileSpec => ({ level: 'species', name: 'Venari', members: [], intentional: [], never: [], traits: {}, exceptions: {}, ...over })

function withCreatures(entries: CreatureSpec[]): VariationState {
  let s = emptyVariations()
  for (const c of entries) { const r = recordCreature(s, c, c.assetId, 'a'); if ('error' in r) throw new Error(r.error); s = approveRevision(r.state, r.ref) }
  return s
}
function addProfile(s: VariationState, spec: ProfileSpec): { state: VariationState; id: string } {
  const r = recordProfile(s, spec, 'p')
  if ('error' in r) throw new Error(r.error)
  return { state: approveRevision(r.state, r.ref), id: r.ref.id }
}

describe('scenario 9: world rules become proposals and never overwrite an approved record', () => {
  const base = () => withCreatures([creature('CHAR-A'), creature('CHAR-B', { bodyPlan: 'serpentine', eyes: 3 })])

  it('lists the differences between a species and its members, and changes nothing', () => {
    const { state } = addProfile(base(), profile({ members: ['CHAR-A', 'CHAR-B'], bodyPlan: 'serpentine', eyes: 3, never: ['wings'] }))
    const found = proposals(state)
    expect(found.map((p) => `${p.assetId}:${p.field}`).sort()).toEqual(['CHAR-A:bodyPlan', 'CHAR-A:eyes', 'CHAR-A:never', 'CHAR-B:never'])
    expect(found.find((p) => p.assetId === 'CHAR-A' && p.field === 'bodyPlan')?.message).toBe('species Venari has a serpentine body; this being is recorded as humanoid.')
    // The approved records are exactly as they were.
    expect(approvedCreature(state, 'CHAR-A')?.spec.bodyPlan).toBe('humanoid')
    expect(approvedCreature(state, 'CHAR-B')?.spec.never).toEqual([])
  })

  it('accepting a proposal makes a candidate revision with that one change; the approved record stays until approved', () => {
    const { state } = addProfile(base(), profile({ members: ['CHAR-A'], bodyPlan: 'serpentine' }))
    const p = proposals(state)[0]
    const r = acceptProposal(state, p, 'A', 'x')
    if ('error' in r) throw new Error(r.error)
    expect(approvedCreature(r.state, 'CHAR-A')?.spec.bodyPlan).toBe('humanoid')
    const entity = findEntity(r.state, r.ref.id)!
    expect(entity.revisions[entity.revisions.length - 1]).toMatchObject({ status: 'candidate', spec: { bodyPlan: 'serpentine', limbs: [{ name: 'arm', count: 2, digits: 5 }] } })
    const approved = approveRevision(r.state, r.ref)
    expect(proposals(approved).filter((x) => x.field === 'bodyPlan')).toEqual([])
  })

  it('a being with no approved anatomy is not judged, and an unrelated being is untouched', () => {
    const { state } = addProfile(withCreatures([creature('CHAR-C')]), profile({ members: ['CHAR-A', 'CHAR-C'], bodyPlan: 'avian' }))
    expect(proposals(state).map((p) => p.assetId)).toEqual(['CHAR-C'])
    expect('error' in acceptProposal(state, { ...proposals(state)[0], assetId: 'CHAR-A' }, 'A', 'x')).toBe(true)
  })
})

describe('scenario 10: faction exceptions', () => {
  it('a faction overrides the species for single values, lists add up, and an exempt being is skipped with the reason shown', () => {
    let s = withCreatures([creature('CHAR-A'), creature('CHAR-B')])
    const sp = addProfile(s, profile({ name: 'Venari', members: ['CHAR-A', 'CHAR-B'], bodyPlan: 'humanoid', eyes: 2, never: ['wings'] }))
    const fa = addProfile(sp.state, profile({ level: 'faction', name: 'Ashguard', members: ['CHAR-A', 'CHAR-B'], eyes: 3, never: ['robes'], intentional: ['scar over the left eye'] }))
    s = fa.state
    const eff = Object.fromEntries(inheritedFor(s, 'CHAR-A').map((e) => [e.field, e]))
    expect(eff.eyes).toMatchObject({ value: '3', from: 'faction Ashguard' })
    expect(eff.never).toMatchObject({ value: 'wings; robes', from: 'species Venari and faction Ashguard' })
    expect(eff.bodyPlan.from).toBe('species Venari')

    // The captain is the exception: she keeps her own eyes. Recording that is a candidate; it applies once approved.
    const ex = exemptFrom(s, fa.id, 'CHAR-B', 'eyes', 'e')
    if ('error' in ex) throw new Error(ex.error)
    expect(inheritedFor(ex.state, 'CHAR-B').find((e) => e.field === 'eyes')?.from).toBe('faction Ashguard')
    const approved = approveRevision(ex.state, ex.ref)
    expect(inheritedFor(approved, 'CHAR-B').find((e) => e.field === 'eyes')?.from).toBe('species Venari')
    expect(inheritedFor(approved, 'CHAR-A').find((e) => e.field === 'eyes')?.from).toBe('faction Ashguard')
    expect(proposals(approved).some((p) => p.assetId === 'CHAR-B' && p.field === 'eyes' && p.profileName === 'faction Ashguard')).toBe(false)
  })
})

describe('profiles are records with history and dependencies', () => {
  it('a faction tied to a species version is flagged when the species gets a newer approved version, and only then', () => {
    const sp = addProfile(emptyVariations(), profile({ members: ['CHAR-A'], eyes: 2 }))
    const fa = addProfile(sp.state, profile({ level: 'faction', name: 'Ashguard', members: ['CHAR-A'], parent: { id: sp.id, revision: 1 } }))
    expect(staleRevisions(fa.state)).toEqual([])
    const again = recordProfile(fa.state, profile({ members: ['CHAR-A'], eyes: 4 }), 'n')
    if ('error' in again) throw new Error(again.error)
    expect(again.ref).toEqual({ id: sp.id, revision: 2 })
    const s2 = approveRevision(again.state, again.ref)
    expect(staleRevisions(s2).map((x) => x.ref.id)).toEqual([fa.id])
    expect(latestApproved(findEntity(s2, sp.id)!)?.n).toBe(2)
  })

  it('refuses a clash, a nameless profile and a species under another profile, in plain words', () => {
    expect('error' in recordProfile(emptyVariations(), profile({ name: ' ' }), 'a')).toBe(true)
    const clash = recordProfile(emptyVariations(), profile({ intentional: ['Wings'], never: ['wings'] }), 'a')
    expect('error' in clash && clash.error).toMatch(/both intentional and never/)
    const under = recordProfile(emptyVariations(), profile({ parent: { id: 'PRF-001', revision: 1 } }), 'a')
    expect('error' in under && under.error).toMatch(/Only a faction/)
  })

  it('survives a reload, cleans damaged settings, and drops what cannot be read', () => {
    const { state } = addProfile(emptyVariations(), profile({ members: ['A', 'A', 'B'], exceptions: { A: ['eyes'] }, traits: { palette: 'ash grey' } }))
    const back = readVariations(JSON.parse(JSON.stringify(state)))!
    expect(approvedProfiles(back)[0].spec.members).toEqual(['A', 'B'])
    expect(approvedProfiles(back)[0].spec.exceptions).toEqual({ A: ['eyes'] })
    const cleaned = readProfileSpec({ level: 'faction', name: 'F', members: ['A'], exceptions: { A: ['eyes', 'teleport'], Z: ['eyes'] }, eyes: -3, bodyPlan: 'dragon', traits: { '': 'x', ok: 'y', bad: 5 } })!
    expect(cleaned.exceptions).toEqual({ A: ['eyes'] })
    expect(cleaned.eyes).toBeUndefined()
    expect(cleaned.bodyPlan).toBeUndefined()
    expect(cleaned.traits).toEqual({ ok: 'y' })
    expect(readProfileSpec({ level: 'tribe', name: 'F' })).toBeUndefined()
    expect(readProfileSpec({ level: 'species' })).toBeUndefined()
  })
})

describe('joining and leaving a profile', () => {
  it('adds and removes a member as a new approved version, keeps history, and drops the leaver\'s exceptions', async () => {
    const { setMembership } = await import('./profiles')
    const sp = addProfile(emptyVariations(), profile({ members: ['A'], exceptions: { A: ['eyes'] } }))
    const joined = setMembership(sp.state, sp.id, 'B', true, 'j')
    if ('error' in joined) throw new Error(joined.error)
    expect(approvedProfiles(joined.state)[0].spec.members).toEqual(['A', 'B'])
    expect(findEntity(joined.state, sp.id)!.revisions).toHaveLength(2)
    const left = setMembership(joined.state, sp.id, 'A', false, 'l')
    if ('error' in left) throw new Error(left.error)
    expect(approvedProfiles(left.state)[0].spec.members).toEqual(['B'])
    expect(approvedProfiles(left.state)[0].spec.exceptions).toEqual({})
    expect('error' in setMembership(left.state, sp.id, 'B', true, 'x')).toBe(true)
    expect('error' in setMembership(left.state, 'PRF-404', 'B', true, 'x')).toBe(true)
  })
})
