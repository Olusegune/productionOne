import { describe, expect, it } from 'vitest'
import { emptyQueue } from './generationQueue'
import { readVariations } from './variationMigration'
import { staleRevisions, validateVariations } from './variationGraph'
import { regenerationPlan } from './regeneration'
import { variationManifest } from './variationManifest'
import { checkComposition } from './lookComposer'
import { variationFiles } from './variationSync'
import { world } from './variationWorld.fixture'

const good = () => world().s

describe('a project file that is damaged or edited by hand cannot break opening it', () => {
  it('drops a revision with no settings, a bad number, an unknown decision or no picture list', () => {
    const s = good()
    const broken = structuredClone(s) as unknown as { entities: Array<{ revisions: Array<Record<string, unknown>> }> }
    broken.entities[0].revisions.push({ n: 9, status: 'approved', media: [] } as never)                       // no spec
    broken.entities[0].revisions.push({ n: 'x', status: 'approved', spec: {}, media: [] } as never)          // bad number
    broken.entities[0].revisions.push({ n: 10, status: 'banana', spec: {}, media: [] } as never)             // unknown decision
    broken.entities[0].revisions.push({ n: 11, status: 'approved', spec: {} } as never)                      // no media list
    broken.entities[0].revisions.push({ n: 12, status: 'approved', spec: null, media: [] } as never)         // null spec
    const got = readVariations(broken)!
    expect(got.entities[0].revisions.map((r) => r.n)).toEqual(s.entities[0].revisions.map((r) => r.n))
  })

  it('drops a record with an unknown kind or no valid revision, and a picture entry without a path', () => {
    const s = good()
    const broken = structuredClone(s) as unknown as { entities: Array<Record<string, unknown>> }
    broken.entities.push({ id: 'ZZZ-1', kind: 'spaceship', name: 'x', revisions: [{ n: 1, status: 'approved', spec: {}, media: [] }] })
    broken.entities.push({ id: 'GAR-900', kind: 'garment', name: 'x', revisions: [{ n: 1, status: 'approved', spec: null, media: [] }] })
    const withBadMedia = structuredClone(s) as unknown as { entities: Array<{ revisions: Array<{ media: unknown[] }> }> }
    withBadMedia.entities[0].revisions[0].media.push({ role: 'x' }, 5, null)
    expect(readVariations(broken)!.entities).toHaveLength(s.entities.length)
    expect(readVariations(withBadMedia)!.entities[0].revisions[0].media).toHaveLength(s.entities[0].revisions[0].media.length)
  })

  it('keeps only numeric counters', () => {
    expect(readVariations({ schema: 1, entities: [], counters: { GAR: 3, FIT: 'x', LOOK: Number.NaN, AGE: null } })?.counters).toEqual({ GAR: 3 })
  })

  it('everything that reads the records keeps working on what is left of a badly damaged file', () => {
    const s = good()
    const mangled = structuredClone(s) as unknown as { entities: Array<{ revisions: Array<Record<string, unknown>> }> }
    mangled.entities.push({ id: 'FIT-777', kind: 'fit', name: 'orphan', characterId: 'C', revisions: [{ n: 1, status: 'approved', createdAt: 'x', spec: { garment: { id: 'GAR-NOPE', revision: 4 } }, media: [] }] } as never)
    mangled.entities.push({ id: 'LOOK-777', kind: 'look', name: 'half', revisions: [{ n: 1, status: 'approved', createdAt: 'x', spec: {}, media: [] }] } as never)
    const got = readVariations(mangled)!
    expect(() => staleRevisions(got)).not.toThrow()
    expect(() => validateVariations(got)).not.toThrow()
    expect(() => regenerationPlan(got)).not.toThrow()
    expect(() => variationManifest(got, emptyQueue())).not.toThrow()
    expect(() => variationFiles(got, [])).not.toThrow()
    expect(() => checkComposition(got, { characterId: 'C', name: 'x', fit: { id: 'FIT-777', revision: 1 } })).not.toThrow()
    expect(regenerationPlan(got).steps.some((p) => p.name === 'orphan')).toBe(true)
  })
})
