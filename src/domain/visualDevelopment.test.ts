import {describe,expect,it} from 'vitest'
import {defaultStyleBible,detectStoryVariants,planAssetSheets,recommendModels} from './visualDevelopment'

const scene={id:'SCENE-001',number:1,heading:'INT. HOME - DAY',setting:'HOME',timeOfDay:'DAY',body:'Young AMINA enters. AMINA wearing a weathered field jacket, holds a compass.',dialogue:[]}
const character={id:'CHAR-AMINA-001',name:'AMINA',type:'character' as const,sceneIds:['SCENE-001'],status:'planned' as const}

describe('visual development planning',()=>{
  it('keeps a revisioned user-editable style bible',()=>expect(defaultStyleBible).toMatchObject({locked:false,revision:1}))
  it('detects required age and wardrobe story variants',()=>expect(detectStoryVariants(character,[scene])).toEqual(expect.arrayContaining(['Canonical','Young','Weathered field jacket'])))
  it('creates individual required production sheets',()=>{const sheets=planAssetSheets([character],[scene]);expect(sheets.some(sheet=>sheet.type==='Turnaround'&&sheet.variant==='Young')).toBe(true);expect(new Set(sheets.map(sheet=>sheet.id)).size).toBe(sheets.length)})
  it('returns explainable scored model recommendations',()=>{const models=recommendModels(character,'Turnaround');expect(models[0].score).toBeGreaterThan(models.at(-1)!.score);expect(models[0].reason).toContain('reference support')})
})
