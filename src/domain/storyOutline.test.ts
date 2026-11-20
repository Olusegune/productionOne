import { describe, expect, it } from 'vitest'
import { planCoverage } from './direct'
import { analyzeScript, mergeAnalysis, type AnalysisResult, type ExtractedAsset } from './productionStudio'
import { looksLikeOutline, outlineToScript } from './storyOutline'

const a = (id: string, name: string, type: ExtractedAsset['type']): ExtractedAsset => ({ id, name, type, sceneIds: ['SCENE-001'], status: 'approved' })
// What the person has after attaching their own pictures: items with no scenes and no script.
const fromPictures: AnalysisResult = { scenes: [], assets: [a('MANU-CHAR-001-AAAA', 'Marcus', 'character'), a('MANU-CHAR-002-BBBB', 'Amina', 'character'), a('MANU-SET-003-CCCC', 'Old Harbour', 'set'), a('MANU-PROP-004-DDDD', 'Lantern', 'prop')] }
const outline = ['Marcus finds the lantern on the Old Harbour pier at dusk.', 'Amina: You should not be out here.', 'Marcus: I am fine. Look at the light.', 'The next morning Amina walks the Old Harbour alone.'].join('\n')

describe('story outline to script', () => {
  it('recognises an outline: several lines, or a story: prefix', () => {
    expect(looksLikeOutline(outline)).toBe(true)
    expect(looksLikeOutline('Story: Marcus finds a lantern.')).toBe(true)
    expect(looksLikeOutline('A film about a lighthouse')).toBe(false)
  })
  it('makes scene headings, capitalises known names and turns Name: words into dialogue', () => {
    const r = outlineToScript(outline, fromPictures.assets)
    expect(r.scenes).toBe(2)
    expect(r.beats).toBe(4)
    expect(r.script).toMatch(/^EXT\. OLD HARBOUR - DUSK/)
    expect(r.script).toMatch(/MARCUS finds the LANTERN on the OLD HARBOUR pier at dusk\./)
    expect(r.script).toMatch(/AMINA\nYou should not be out here\./)
    expect(r.script).toMatch(/\nEXT\. OLD HARBOUR - MORNING\n/)
    expect(r.script).not.toMatch(/marcus/)
  })
  it('keeps every sentence as the person wrote it (nothing invented)', () => {
    const r = outlineToScript(outline, fromPictures.assets)
    for (const sentence of ['finds the', 'pier at dusk', 'You should not be out here.', 'I am fine. Look at the light.', 'walks the']) expect(r.script.toLowerCase()).toContain(sentence.toLowerCase())
  })
  it('ends in a project with scenes, the picture items kept with their pictures, and shots that can be planned', () => {
    const r = outlineToScript(outline, fromPictures.assets)
    const merged = mergeAnalysis(fromPictures, analyzeScript(r.script))
    expect(merged.scenes.length).toBe(2)
    const names = merged.assets.map((x) => x.name.toLowerCase())
    expect(names).toEqual(expect.arrayContaining(['marcus', 'amina', 'old harbour', 'lantern']))
    const marcus = merged.assets.find((x) => x.name.toLowerCase() === 'marcus')!
    expect(marcus.id).toBe('MANU-CHAR-001-AAAA')
    expect(marcus.status).toBe('approved')
    const shots = planCoverage(merged)
    expect(shots.length).toBeGreaterThan(2)
    expect(shots.some((s) => s.assetIds.includes('MANU-CHAR-001-AAAA'))).toBe(true)
    expect(shots.some((s) => s.assetIds.includes('MANU-CHAR-002-BBBB'))).toBe(true)
  })
  it('reading a script never removes an item the person made from their own picture', () => {
    const merged = mergeAnalysis(fromPictures, analyzeScript('EXT. PIER - DAY\n\nTOM waits.\n\nTOM\nWell?\n'))
    const names = merged.assets.map((x) => x.name.toLowerCase())
    expect(names).toEqual(expect.arrayContaining(['marcus', 'amina', 'old harbour', 'lantern', 'tom']))
    expect(merged.assets.filter((x) => x.name.toLowerCase() === 'marcus')).toHaveLength(1)
  })
  it('without places it says so, uses LOCATION, and tells you about beats that name nobody', () => {
    const r = outlineToScript('Marcus waits.\nSomething drifts by.', [a('M', 'Marcus', 'character')])
    expect(r.script).toMatch(/^INT\. LOCATION - DAY/)
    expect(r.notes.join(' ')).toMatch(/no places in the project/)
    expect(r.notes.join(' ')).toMatch(/Beat 2 names nobody/)
  })
  it('handles bullets and numbers, empty text, and names with punctuation safely', () => {
    expect(outlineToScript('', fromPictures.assets).scenes).toBe(0)
    const r = outlineToScript('1. Marcus (the pilot) waits.\n- Amina arrives.', [a('M', 'Marcus (the pilot)', 'character'), a('A', 'Amina', 'character')])
    expect(r.beats).toBe(2)
    expect(r.script).toMatch(/MARCUS \(THE PILOT\) waits\./)
    expect(r.script).toMatch(/AMINA arrives\./)
  })
})
