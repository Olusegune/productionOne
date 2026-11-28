import { describe, expect, it } from 'vitest'
import { approveRevision, createEntity, emptyVariations, type AgeSpec, type LookSpec, type RelationshipSpec, type VariationState } from './variations'
import { addRelationship, relationshipViews, relationshipConflicts } from './relationships'
import { staleRevisions } from './variationGraph'
import { regenerationPlan } from './regeneration'
import { bibleOverview } from './bibleGroups'
import { variationManifest } from './variationManifest'
import { emptyQueue } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'

/** A large production: 60 characters, each with 4 ages, 6 looks and 4 relationships (about 840 records and 2,500 revisions after edits). */
function big(): VariationState {
  let s = emptyVariations()
  for (let c = 0; c < 60; c++) {
    const cid = `C${c}`
    const ages: Array<{ id: string; revision: number }> = []
    for (let a = 0; a < 4; a++) { const m = createEntity(s, 'age', { name: `${cid} age ${a}`, characterId: cid, spec: { characterId: cid, mode: 'same-person', targetAge: String(20 + a * 10) } as AgeSpec, now: 'x' }); s = approveRevision(m.state, m.ref); ages.push(m.ref) }
    for (let l = 0; l < 6; l++) { const m = createEntity(s, 'look', { name: `${cid} look ${l}`, characterId: cid, spec: { characterId: cid, age: ages[l % 4], sceneIds: [`SC-${l}`] } as LookSpec, now: 'x' }); s = approveRevision(m.state, m.ref) }
    for (let r = 0; r < 4; r++) { const spec: RelationshipSpec = { relation: 'scale', a: { asset: cid, pin: ages[r] }, b: { asset: `C${(c + r + 1) % 60}` }, ratio: 1 + r / 10, basis: 'declared' }; const m = addRelationship(s, spec, (id) => id, 'x'); if ('error' in m) throw new Error(m.error); s = approveRevision(m.state, m.ref) }
  }
  return s
}

describe('a large production stays responsive', () => {
  it('the screens that summarise everything finish quickly', () => {
    const s = big()
    const assets = Array.from({ length: 60 }, (_, i) => ({ id: `C${i}`, name: `Char ${i}`, type: 'character', status: 'approved', sceneIds: [] })) as ExtractedAsset[]
    const time = (f: () => unknown) => { const t = performance.now(); f(); return performance.now() - t }
    const t = {
      views: time(() => relationshipViews(s)), conflicts: time(() => relationshipConflicts(s)), stale: time(() => staleRevisions(s)),
      plan: time(() => regenerationPlan(s)), overview: time(() => bibleOverview({ assets, variations: s })), manifest: time(() => variationManifest(s, emptyQueue())),
    }
    console.log('timings (ms):', JSON.stringify(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v)]))))
    for (const [name, ms] of Object.entries(t)) expect(ms, name).toBeLessThan(1500)
  })
})
