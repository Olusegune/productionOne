import { describe, expect, it } from 'vitest'
import { demoGraph } from './demoGraph'
import { dependentsOf, reviseNode, stableId, synchronizeProductionGraph } from './productionGraph'
import {analyzeScript} from './productionStudio'
import {planAssetSheets} from './visualDevelopment'

describe('Production Graph', () => {
  it('creates readable stable identifiers', () => expect(stableId('asset', 'Solar Compass', 7)).toBe('ASSE-SOLAR-COMPASS-007'))
  it('finds transitive dependencies', () => expect(dependentsOf(demoGraph, 'ASSE-AMINA-001').map((n) => n.id)).toEqual(expect.arrayContaining(['STOR-AMINA-DUST-001','SHEE-AMINA-TURN-001','REVI-AMINA-TURN-001','SHOT-RETURN-004'])))
  it('increments the source revision and marks downstream nodes stale', () => {
    const next = reviseNode(demoGraph, 'ASSE-AMINA-001', '2026-10-20T13:00:00.000Z')
    expect(next.nodes.find((n) => n.id === 'ASSE-AMINA-001')?.revision).toBe(2)
    expect(next.nodes.find((n) => n.id === 'SHOT-RETURN-004')?.status).toBe('stale')
    expect(demoGraph.nodes.find((n) => n.id === 'SHOT-RETURN-004')?.status).toBe('draft')
  })
  it('synchronizes real production records through revision nodes',()=>{
    const analysis=analyzeScript('EXT. SAVANNA - DUSK\nAMINA\nWe are close.\nShe holds the compass.')
    const sheets=planAssetSheets(analysis.assets,analysis.scenes)
    const shot={id:'SHOT-001',sceneId:'SCENE-001',order:1,duration:5,assetIds:analysis.assets.map(asset=>asset.id),action:'Amina studies the compass',dialogue:'We are close.',speaker:'AMINA',emotionalObjective:'resolve',facialActing:'focused',bodyLanguage:'still',microAnimation:'blink',cameraFraming:'medium',cameraMovement:'push',lighting:'dusk',soundEffects:'cloth',ambience:'wind',music:'none',transition:'cut',storyboardStatus:'approved' as const}
    const graph=synchronizeProductionGraph(demoGraph,analysis,[shot],sheets,{[analysis.assets[0].id]:'C:/verified.png'},'2026-10-20T00:00:00.000Z')
    expect(graph.nodes.some(node=>node.kind==='revision'&&node.metadata.path==='C:/verified.png')).toBe(true)
    expect(graph.edges.some(edge=>edge.from==='SHOT-001'&&edge.relation==='uses')).toBe(true)
  })
})
