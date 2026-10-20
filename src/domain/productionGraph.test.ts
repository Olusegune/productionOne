import { describe, expect, it } from 'vitest'
import { demoGraph } from './demoGraph'
import { dependentsOf, reviseNode, stableId } from './productionGraph'

describe('Production Graph', () => {
  it('creates readable stable identifiers', () => expect(stableId('asset', 'Solar Compass', 7)).toBe('ASSE-SOLAR-COMPASS-007'))
  it('finds transitive dependencies', () => expect(dependentsOf(demoGraph, 'ASSE-AMINA-001').map((n) => n.id)).toEqual(expect.arrayContaining(['STOR-AMINA-DUST-001','SHEE-AMINA-TURN-001','REVI-AMINA-TURN-001','SHOT-RETURN-004'])))
  it('increments the source revision and marks downstream nodes stale', () => {
    const next = reviseNode(demoGraph, 'ASSE-AMINA-001', '2026-10-20T13:00:00.000Z')
    expect(next.nodes.find((n) => n.id === 'ASSE-AMINA-001')?.revision).toBe(2)
    expect(next.nodes.find((n) => n.id === 'SHOT-RETURN-004')?.status).toBe('stale')
    expect(demoGraph.nodes.find((n) => n.id === 'SHOT-RETURN-004')?.status).toBe('draft')
  })
})
