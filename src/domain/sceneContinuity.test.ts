import { describe, expect, it } from 'vitest'
import { addRevision, approveRevision, createEntity, emptyVariations, type LookSpec, type Ref, type RelationshipSpec, type VariationState } from './variations'
import { addRelationship } from './relationships'
import { branchScene, branchesOf, driftSince, freezeScene, latestSnapshot, readContinuity, resolveSnapshot, snapshotsOf } from './sceneContinuity'
import { readVariations, deriveFromLegacy, variationsOf } from './variationMigration'
import { variationManifest } from './variationManifest'
import { recordCreature } from './creatureLab'
import { recordPropSize } from './propFit'
import { recordProfile } from './profiles'
import { emptyQueue } from './generationQueue'

const NOW = '2026-11-27T00:00:00.000Z'
const look = (characterId: string, queueVariant: string): LookSpec => ({ characterId, queueVariant })

function approvedLook(s: VariationState, characterId: string, name: string): { state: VariationState; ref: Ref } {
  const made = createEntity(s, 'look', { name, characterId, spec: look(characterId, name), now: NOW })
  return { state: approveRevision(made.state, made.ref), ref: made.ref }
}

function world() {
  let s = emptyVariations()
  const a = approvedLook(s, 'CHAR-A', 'Ash in the jacket'); s = a.state
  const b = approvedLook(s, 'CHAR-B', 'Bo in the robe'); s = b.state
  const rel: RelationshipSpec = { relation: 'ownership', a: { asset: 'CHAR-A' }, b: { asset: 'CHAR-B' }, exclusive: true, basis: 'declared' }
  const r = addRelationship(s, rel, (id) => id, NOW)
  if ('error' in r) throw new Error(r.error)
  s = approveRevision(r.state, r.ref)
  return { s, a: a.ref, b: b.ref, rel: r.ref }
}

describe('scenario 11: historical scene states keep the revisions they were made with', () => {
  it('a snapshot pins exact look and relationship revisions, and a newer approved look never replaces them', () => {
    const w = world()
    const frozen = freezeScene(w.s, 'SC-1', [{ assetId: 'CHAR-A', look: w.a }, { assetId: 'CHAR-B', look: w.b }], { now: NOW, note: 'locked picture' })
    if ('error' in frozen) throw new Error(frozen.error)
    expect(frozen.snapshot).toMatchObject({ n: 1, branch: 'main' })
    expect(frozen.snapshot.cast[0].look).toEqual(w.a)
    expect(frozen.snapshot.cast.flatMap((c) => c.relationships)).toEqual([w.rel, w.rel]) // each side of the ownership records it
    const before = structuredClone(frozen.state.continuity)

    // The look is revised and approved afterwards.
    const next = addRevision(frozen.state, w.a.id, { spec: look('CHAR-A', 'Ash in the new jacket'), now: NOW })
    const s2 = approveRevision(next.state, next.ref)
    const resolved = resolveSnapshot(s2, snapshotsOf(s2, 'SC-1')[0])
    expect(resolved[0].look?.ref).toEqual(w.a)
    expect(resolved[0].look?.spec.queueVariant).toBe('Ash in the jacket')
    expect(resolved[0].newerLook).toBe(2)
    expect(driftSince(s2, snapshotsOf(s2, 'SC-1')[0], (id) => (id === 'CHAR-A' ? 'Ash' : id))).toEqual(['Ash: Ash in the jacket has a newer approved version (2); this scene was frozen with version 1.'])
    expect(s2.continuity).toEqual(before) // nothing in the history moved
  })

  it('refuses a look that is not approved, a missing look, an empty scene, a repeated person', () => {
    const w = world()
    const cand = createEntity(w.s, 'look', { name: 'Draft', characterId: 'CHAR-A', spec: look('CHAR-A', 'Draft'), now: NOW })
    expect((freezeScene(cand.state, 'SC-1', [{ assetId: 'CHAR-A', look: cand.ref }], { now: NOW }) as { error: string }).error).toMatch(/not approved/)
    expect((freezeScene(w.s, 'SC-1', [{ assetId: 'CHAR-A', look: { id: 'LOOK-404', revision: 1 } }], { now: NOW }) as { error: string }).error).toMatch(/not in this project/)
    expect((freezeScene(w.s, 'SC-1', [], { now: NOW }) as { error: string }).error).toMatch(/at least one person/)
    expect((freezeScene(w.s, 'SC-1', [{ assetId: 'CHAR-A' }, { assetId: 'CHAR-A' }], { now: NOW }) as { error: string }).error).toMatch(/twice/)
  })

  it('a branch copies the exact references, both keep their own history, and snapshots only ever number up', () => {
    const w = world()
    let r = freezeScene(w.s, 'SC-1', [{ assetId: 'CHAR-A', look: w.a }, { assetId: 'CHAR-B', look: w.b }], { now: NOW })
    if ('error' in r) throw new Error(r.error)
    r = freezeScene(r.state, 'SC-1', [{ assetId: 'CHAR-A', look: w.a }], { now: NOW }) as typeof r
    const night = branchScene(r.state, 'SC-1', 'main', 'night version', NOW)
    if ('error' in night) throw new Error(night.error)
    expect(night.snapshot).toMatchObject({ n: 1, branch: 'night version', fromBranch: { branch: 'main', n: 2 } })
    expect(night.snapshot.cast).toEqual(latestSnapshot(r.state, 'SC-1')!.cast)
    expect(branchesOf(night.state, 'SC-1')).toEqual(['main', 'night version'])
    const more = freezeScene(night.state, 'SC-1', [{ assetId: 'CHAR-B', look: w.b }], { now: NOW, branch: 'night version' })
    if ('error' in more) throw new Error(more.error)
    expect(snapshotsOf(more.state, 'SC-1', 'night version').map((s) => s.n)).toEqual([1, 2])
    expect(snapshotsOf(more.state, 'SC-1', 'main').map((s) => s.n)).toEqual([1, 2])
    expect((freezeScene(w.s, 'SC-1', [{ assetId: 'CHAR-A' }], { now: NOW, branch: 'ghost' }) as { error: string }).error).toMatch(/Make the branch first/)
    expect((branchScene(night.state, 'SC-1', 'main', 'NIGHT version', NOW) as { error: string }).error).toMatch(/already a branch/)
    expect((branchScene(w.s, 'SC-9', 'main', 'x', NOW) as { error: string }).error).toMatch(/Freeze the "main" branch first/)
  })
})

describe('scenario 12: the portable project carries the new records', () => {
  it('survives a save and reload exactly, and the manifest lists specs, relationships and snapshots', () => {
    const w = world()
    let s = w.s
    const c = recordCreature(s, { assetId: 'CHAR-A', bodyPlan: 'humanoid', limbs: [], symmetry: 'symmetric', intentional: [], never: [] }, 'Ash', NOW); if ('error' in c) throw new Error(); s = approveRevision(c.state, c.ref)
    const p = recordPropSize(s, { assetId: 'PROP-1', lengthM: 0.5, grip: 'one-hand' }, 'Staff', NOW); if ('error' in p) throw new Error(); s = approveRevision(p.state, p.ref)
    const f = recordProfile(s, { level: 'species', name: 'Venari', members: ['CHAR-A'], intentional: [], never: [], traits: {}, exceptions: {} }, NOW); if ('error' in f) throw new Error(); s = approveRevision(f.state, f.ref)
    const fr = freezeScene(s, 'SC-1', [{ assetId: 'CHAR-A', look: w.a }, { assetId: 'CHAR-B', look: w.b }], { now: NOW })
    if ('error' in fr) throw new Error(fr.error)
    expect(readVariations(JSON.parse(JSON.stringify(fr.state)))).toEqual(fr.state)
    const manifest = variationManifest(fr.state, emptyQueue()) as { entities: Array<{ kind: string }>; continuity: Record<string, Array<{ branch: string; cast: Array<{ look: string | null }> }>> }
    expect(manifest.entities.map((e) => e.kind).sort()).toEqual(['creature', 'look', 'look', 'profile', 'prop', 'relationship'])
    expect(manifest.continuity['SC-1'][0]).toMatchObject({ branch: 'main', cast: [{ look: `${w.a.id}@1` }, { look: `${w.b.id}@1` }] })
  })
})

describe('scenario 13: older projects still open', () => {
  it('a project with no continuity, or a damaged one, reads without it and nothing throws', () => {
    expect(variationsOf({ analysis: { assets: [] } }).continuity).toBeUndefined()
    expect(deriveFromLegacy({ analysis: { assets: [] } }).continuity).toBeUndefined()
    const s = readVariations({ schema: 1, entities: [], counters: {}, continuity: { 'SC-1': [{ branch: '', n: 1, createdAt: 'x', cast: [] }, { branch: 'main', n: 'one', createdAt: 'x', cast: [] }, 'junk', { branch: 'main', n: 1, createdAt: 'x', cast: [{ assetId: 'A', look: { id: 'L', revision: 0 }, relationships: [{ id: 'R', revision: 2 }, 5] }] }] } })!
    expect(s.continuity?.['SC-1']).toEqual([{ n: 1, branch: 'main', createdAt: 'x', cast: [{ assetId: 'A', relationships: [{ id: 'R', revision: 2 }] }] }])
    expect(readContinuity('nope')).toBeUndefined()
    expect(readVariations({ schema: 1, entities: [], counters: {}, continuity: 7 })?.continuity).toBeUndefined()
  })
})
