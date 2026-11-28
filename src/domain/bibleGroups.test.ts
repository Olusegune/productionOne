import { describe, expect, it } from 'vitest'
import { bibleOverview, groupCounts, groupOf, startingGroup } from './bibleGroups'
import { approveRevision, createEntity, emptyVariations, addRevision, type AgeSpec } from './variations'
import { addRelationship } from './relationships'
import { recordProfile } from './profiles'
import { freezeScene, branchScene } from './sceneContinuity'
import type { ExtractedAsset } from './productionStudio'

const a = (id: string, name: string, type: ExtractedAsset['type'], status: ExtractedAsset['status'] = 'planned') => ({ id, name, type, status, sceneIds: [] }) as ExtractedAsset
const assets = [a('C1', 'Mara', 'character', 'approved'), a('C2', 'Bo', 'character'), a('K1', 'Field jacket', 'costume', 'approved'), a('P1', 'Staff', 'prop'), a('S1', 'Kitchen', 'set'), a('E1', 'Concourse', 'environment', 'approved')]

describe('the bible is grouped for browsing', () => {
  it('puts costumes and props under Assets, sets and environments under Worlds, and counts what is approved', () => {
    expect(groupOf('character')).toBe('characters')
    expect(groupOf('costume')).toBe('assets')
    expect(groupOf('prop')).toBe('assets')
    expect(groupOf('set')).toBe('worlds')
    expect(groupOf('environment')).toBe('worlds')
    expect(groupCounts(assets)).toEqual({ characters: { total: 2, approved: 1 }, assets: { total: 2, approved: 1 }, worlds: { total: 2, approved: 1 } })
  })

  it('opens on the group holding the selected asset, else the first group that has anything', () => {
    expect(startingGroup(assets, 3)).toBe('assets')
    expect(startingGroup(assets, 4)).toBe('worlds')
    expect(startingGroup([a('K1', 'Jacket', 'costume')], 9)).toBe('assets')
    expect(startingGroup([], 0)).toBe('characters')
  })
})

describe('the overview is read from the records', () => {
  const nameOf = (id: string) => assets.find((x) => x.id === id)?.name ?? id
  it('says "nothing is out of date" for a quiet project and names the style', () => {
    const o = bibleOverview({ assets, variations: emptyVariations(), styleName: ' Ink and watercolour ' })
    expect(o.style).toBe('Ink and watercolour')
    expect(o.attention).toEqual([])
    expect(o.relationships).toEqual({ total: 0, approved: 0, needLook: [], conflicts: [] })
    expect(o.frozen).toEqual({ scenes: 0, snapshots: 0, branches: 0 })
    expect(bibleOverview({ assets, variations: emptyVariations() }).style).toBe('No style chosen yet')
  })

  it('shows profiles with member names, relationships that need a look, conflicts and frozen scenes', () => {
    const age: AgeSpec = { characterId: 'C1', mode: 'same-person', targetAge: '40' }
    const ag = createEntity(emptyVariations(), 'age', { name: 'Mara at 40', characterId: 'C1', spec: age, now: 'x' })
    let s = approveRevision(ag.state, ag.ref)
    const rel = addRelationship(s, { relation: 'scale', a: { asset: 'C1', pin: ag.ref }, b: { asset: 'C2' }, ratio: 1.2, basis: 'declared' }, nameOf, 'x')
    if ('error' in rel) throw new Error(rel.error)
    s = approveRevision(rel.state, rel.ref)
    const own = (owner: string) => { const r = createEntity(s, 'relationship', { name: owner, spec: { relation: 'ownership', a: { asset: owner }, b: { asset: 'P1' }, exclusive: true, basis: 'declared' }, now: 'x' }); s = approveRevision(r.state, r.ref) }
    own('C1'); own('C2')
    const prof = recordProfile(s, { level: 'species', name: 'Venari', members: ['C1', 'C2'], intentional: [], never: [], traits: {}, exceptions: {} }, 'x')
    if ('error' in prof) throw new Error()
    s = approveRevision(prof.state, prof.ref)
    const look = createEntity(s, 'look', { name: 'Mara look', characterId: 'C1', spec: { characterId: 'C1' }, now: 'x' }); s = approveRevision(look.state, look.ref)
    const frozen = freezeScene(s, 'SC-1', [{ assetId: 'C1', look: look.ref }], { now: 'x' }); if ('error' in frozen) throw new Error(frozen.error)
    const br = branchScene(frozen.state, 'SC-1', 'main', 'night', 'x'); if ('error' in br) throw new Error()
    // The age gets a newer approved version, so the scale relationship needs a look.
    const next = addRevision(br.state, ag.ref.id, { spec: { ...age, targetAge: '41' }, now: 'y' })
    const o = bibleOverview({ assets, variations: approveRevision(next.state, next.ref) })
    expect(o.profiles).toEqual([{ name: 'Venari', level: 'species', members: ['Mara', 'Bo'] }])
    expect(o.relationships.total).toBe(3)
    expect(o.relationships.needLook).toHaveLength(1)
    expect(o.relationships.conflicts[0]).toMatch(/Staff is assigned to Mara and Bo, but only one can own it/)
    expect(o.frozen).toEqual({ scenes: 1, snapshots: 2, branches: 2 })
    expect(o.attention.length).toBeGreaterThan(0)
  })
})
