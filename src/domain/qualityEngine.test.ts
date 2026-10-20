import {describe,expect,it} from 'vitest'
import {labelLines,productionFilename,qaDecision} from './qualityEngine'

const record={assetName:'Amina',assetId:'CHAR-001',storyVariant:'Dust Worn',state:'Field Jacket',sheetType:'Turnaround',view:'Multi View',sceneReferences:['SCENE-001'],revision:2,projectStyle:'Cinematic Realism'}
describe('quality and labeling',()=>{
  it('creates deterministic production filenames',()=>expect(productionFilename(record)).toBe('CHAR_001_Amina_Dust_Worn_Turnaround_v02.png'))
  it('keeps story variants distinct from file revisions',()=>expect(labelLines(record)[0]).toContain('Dust Worn'))
  it('rejects low resolution inspection results',()=>expect(qaDecision({width:256,height:256,format:'Png',fileSize:200,valid:false,warnings:['Resolution is below minimum']}).passed).toBe(false))
})
