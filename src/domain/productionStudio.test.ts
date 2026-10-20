import { describe, expect, it } from 'vitest'
import { analyzeScript, compileAssetPrompt, compileShotPackage, coverageAudit, type ShotRecord } from './productionStudio'

const shot: ShotRecord = { id:'SHOT-001', sceneId:'SCENE-001', order:1, duration:5, assetIds:['CHAR-AMINA-001','PROP-COMPASS-002'], action:'Amina raises the compass', dialogue:'We are close.', speaker:'AMINA', emotionalObjective:'quiet resolve', facialActing:'focused eyes', bodyLanguage:'steady posture', microAnimation:'one blink and slow breath', cameraFraming:'medium close-up', cameraMovement:'slow push in', lighting:'warm dusk edge light', soundEffects:'cloth movement', ambience:'savanna wind', music:'low strings', transition:'cut', storyboardStatus:'approved' }

describe('release production pipeline', () => {
  it('extracts scenes, source dialogue, characters, sets and props', () => {
    const result = analyzeScript('EXT. SAVANNA - DUSK\nAMINA\nWe are close.\nShe holds the compass.')
    expect(result.scenes[0].dialogue[0]).toMatchObject({ speaker:'AMINA', source:'script' })
    expect(result.assets.map((asset) => asset.type)).toEqual(expect.arrayContaining(['set','character','prop']))
    expect(result.assets.find((asset) => asset.type === 'prop')?.name).toBe('compass')
  })
  it('compiles portable prompts without asking the model to draw labels', () => expect(compileAssetPrompt({id:'A',name:'Amina',type:'character',sceneIds:['S'],status:'planned'},'cinematic realism').universal).toContain('no embedded text'))
  it('compiles model-aware shot packages and reports unverified limits', () => {
    const result = compileShotPackage(shot, 'Kling 2.0', ['CHAR-AMINA-001'])
    expect(result.references).toEqual(['CHAR-AMINA-001'])
    expect(result.warnings.join(' ')).toContain('Missing references')
    expect(result.warnings.join(' ')).toContain('postproduction')
  })
  it('does not report production ready with unapproved assets', () => expect(coverageAudit([{id:'A',name:'A',type:'prop',sceneIds:['S'],status:'planned'}], [shot]).ready).toBe(false))
})
