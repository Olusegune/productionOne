import { describe, expect, it } from 'vitest'
import { addRevision, approveRevision, createEntity, emptyVariations, type AgeSpec, type LookSpec, type RelationshipSpec, type VariationState } from './variations'
import { addRelationship, approvedRelationships, applyRelationships, proposeFromScene, relationshipConflicts, relationshipViews, relationshipProblems } from './relationships'
import { recordCreature, approvedCreature } from './creatureLab'
import { recordMachine, approvedMachine } from './machineLab'
import { recordAbility, approvedAbilities } from './abilityLab'
import { recordPropSize, approvedPropSize } from './propFit'
import { recordVehicle, approvedVehicle, vehicleOccupancyIssues } from './vehicleLab'
import { startSkinRefinement, refinementCost } from './skinRefine'
import { recordSkin, approvedSkin, skinPromptFor, newSkin, withPreset } from './skin'
import { recordProfile, approvedProfiles, proposals, inheritedFor, profilesOf } from './profiles'
import { freezeScene, branchScene, resolveSnapshot, driftSince, latestSnapshot } from './sceneContinuity'
import { readVariations } from './variationMigration'
import { staleRevisions, validateVariations, dependentsOf } from './variationGraph'
import { regenerationPlan } from './regeneration'
import { variationManifest } from './variationManifest'
import { bibleOverview } from './bibleGroups'
import { emptyQueue } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'

/** A small seeded random generator, so a failure can be reproduced from its seed. */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

function rich(): VariationState {
  const N = 'x'
  let s = emptyVariations()
  const age = createEntity(s, 'age', { name: 'Mara at 40', characterId: 'C1', spec: { characterId: 'C1', mode: 'same-person', targetAge: '40' } as AgeSpec, now: N }); s = approveRevision(age.state, age.ref)
  const look = createEntity(s, 'look', { name: 'Mara look', characterId: 'C1', spec: { characterId: 'C1', age: age.ref, sceneIds: ['SC-1'] } as LookSpec, now: N }); s = approveRevision(look.state, look.ref)
  const rel: RelationshipSpec = { relation: 'ownership', a: { asset: 'C1', pin: age.ref }, b: { asset: 'P1' }, exclusive: true, basis: 'declared', sceneIds: ['SC-1'] }
  const r = addRelationship(s, rel, (id) => id, N); if ('error' in r) throw new Error(r.error); s = approveRevision(r.state, r.ref)
  for (const make of [
    () => recordCreature(s, { assetId: 'C1', bodyPlan: 'humanoid', limbs: [{ name: 'arm', count: 2, digits: 5 }], eyes: 2, symmetry: 'symmetric', intentional: ['a scar'], never: ['wings'], role: 'hero' }, 'Mara', N),
    () => recordMachine(s, { assetId: 'C2', kind: 'robot', joints: [{ name: 'elbow', count: 2, views: ['front'] }], sensors: [], panels: [], intentional: [], never: [] }, 'R1', N),
    () => recordAbility(s, { assetId: 'C1', name: 'Surge', language: { colour: 'gold', shape: 'sparks' }, states: { peak: 'big' }, transparency: 'alpha-required' }, 'Mara', N),
    () => recordPropSize(s, { assetId: 'P1', lengthM: 0.5, gripM: 0.04, grip: 'one-hand' }, 'Staff', N),
    () => recordVehicle(s, { assetId: 'P2', kind: 'car', seats: 2, entrances: [{ name: 'door', count: 2, views: ['side'] }], features: [], intentional: [], never: [] }, 'Car', N),
    () => recordSkin(s, { ...withPreset(newSkin('C1'), 'weathered'), complexion: 'warm', marks: [{ what: 'a scar', where: 'chin' }], regions: { forehead: { texture: 'subtle' } }, conditions: ['sweat'] }, 'Mara', N),
    () => recordProfile(s, { level: 'species', name: 'Venari', members: ['C1', 'C2'], bodyPlan: 'serpentine', eyes: 3, intentional: [], never: ['halo'], traits: { palette: 'ash' }, exceptions: { C2: ['eyes'] } }, N),
  ]) { const m = make(); if ('error' in m) throw new Error(m.error); s = approveRevision(m.state, m.ref) }
  const f = freezeScene(s, 'SC-1', [{ assetId: 'C1', look: look.ref }], { now: N }); if ('error' in f) throw new Error(f.error); s = f.state
  const b = branchScene(s, 'SC-1', 'main', 'night', N); if ('error' in b) throw new Error(b.error); s = b.state
  const more = addRevision(s, age.ref.id, { spec: { characterId: 'C1', mode: 'same-person', targetAge: '41' } as AgeSpec, now: N }); return approveRevision(more.state, more.ref)
}

const JUNK: unknown[] = [null, undefined, 0, -1, 1.5, NaN, Infinity, '', 'x', 'y'.repeat(5000), [], {}, [null], [1, 'a'], { a: 1 }, true, false, '__proto__', { id: 1 }, [{}], -0]

/** Replaces, deletes or damages one random place anywhere in a copy of the data. */
function mutate(value: unknown, rand: () => number): unknown {
  const copy = JSON.parse(JSON.stringify(value))
  const paths: Array<Array<string | number>> = []
  const walk = (v: unknown, path: Array<string | number>) => { paths.push(path); if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i])); else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], [...path, k]) }
  walk(copy, [])
  const path = paths[Math.floor(rand() * paths.length)]
  if (path.length === 0) return JUNK[Math.floor(rand() * JUNK.length)]
  let parent: any = copy
  for (const p of path.slice(0, -1)) parent = parent[p]
  const last = path[path.length - 1]
  const roll = rand()
  if (roll < 0.35) delete parent[last]
  else if (roll < 0.45 && Array.isArray(parent)) parent.splice(Number(last), 1)
  else parent[last] = JUNK[Math.floor(rand() * JUNK.length)]
  return copy
}

const assets = [{ id: 'C1', name: 'Mara', type: 'character', status: 'approved', sceneIds: [] }, { id: 'C2', name: 'R1', type: 'character', status: 'planned', sceneIds: [] }, { id: 'P1', name: 'Staff', type: 'prop', status: 'planned', sceneIds: [] }] as ExtractedAsset[]

/** Everything a screen does with the records. None of it may throw, whatever the file held. */
function useEverything(state: VariationState) {
  validateVariations(state); staleRevisions(state); regenerationPlan(state)
  relationshipViews(state); approvedRelationships(state, 'SC-1'); relationshipConflicts(state, (id) => id, 'SC-1'); relationshipProblems(state, new Set(['C1']))
  applyRelationships({ things: [{ id: 'P1', kind: 'furniture', name: 'Chair', x: 0, y: 0, facing: 0, interactions: [], scale: 1 }], relationships: [] }, state, 'SC-1')
  proposeFromScene({ things: [], relationships: [] }, state, 'SC-1')
  for (const id of ['C1', 'C2', 'P1']) { approvedCreature(state, id); approvedMachine(state, id); approvedAbilities(state, id); approvedPropSize(state, id); approvedVehicle(state, id); approvedSkin(state, id); startSkinRefinement(state, { character: { id, name: 'X', type: 'character', sceneIds: [], status: 'approved' } as never, now: 'n' }); refinementCost({ ...emptyQueue(), jobs: [] }, 'SKN-001'); skinPromptFor(state, id, { family: 'Realistic 3D' }); inheritedFor(state, id); profilesOf(state, id) }
  approvedProfiles(state); proposals(state); vehicleOccupancyIssues(state)
  for (const e of state.entities) for (const r of e.revisions) dependentsOf(state, { id: e.id, revision: r.n })
  const snap = latestSnapshot(state, 'SC-1'); if (snap) { resolveSnapshot(state, snap); driftSince(state, snap) }
  bibleOverview({ assets, variations: state, styleName: 'x' })
  JSON.stringify(variationManifest(state, emptyQueue()))
}

describe('fuzz: a saved project damaged in any way never crashes the screens that read it', () => {
  it('the rich project itself works with every reader', () => { expect(() => useEverything(rich())).not.toThrow() })

  it('read, then use everything, after 1500 random mutations (seeded; the seed is in the failure)', () => {
    const base = JSON.parse(JSON.stringify(rich()))
    for (let seed = 1; seed <= 1500; seed++) {
      const rand = rng(seed)
      let doc: unknown = base
      const hits = 1 + Math.floor(rand() * 3)
      for (let i = 0; i < hits; i++) doc = mutate(doc, rand)
      try {
        const read = readVariations(doc)
        if (read) useEverything(read)
      } catch (e) { throw new Error(`seed ${seed}: ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`) }
    }
  })

  it('whatever is read back is itself stable: reading it again gives the same thing', () => {
    const base = JSON.parse(JSON.stringify(rich()))
    for (let seed = 1; seed <= 300; seed++) {
      const rand = rng(seed * 7)
      const once = readVariations(mutate(mutate(base, rand), rand))
      if (!once) continue
      const twice = readVariations(JSON.parse(JSON.stringify(once)))
      if (JSON.stringify(twice) !== JSON.stringify(once)) { const a = JSON.stringify(once), b = JSON.stringify(twice); let i = 0; while (a[i] === b?.[i]) i++; throw new Error(`seed ${seed * 7}: first difference near ${a.slice(Math.max(0, i - 120), i + 120)} ## ${b?.slice(Math.max(0, i - 120), i + 120)}`) }
    }
  })
})
