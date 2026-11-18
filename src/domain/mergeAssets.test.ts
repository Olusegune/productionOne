import { describe, expect, it } from 'vitest'
import { analyzeScript } from './productionStudio'
import { planCoverage } from './direct'
import { mergeSets } from './mergeAssets'

const nl = String.fromCharCode(10)
const script = [
  'SCENE 1 — INT. VENOMSPUR\'S OFFICE — NIGHT', '', 'A desk.', '', 'FLEX', 'Okay.', '',
  'SCENE 2 — INT. HALL — LATER', '', 'FLEX', 'Right.', '',
  'SCENE 3 — INT. THE HALL — LATER', '', 'FLEX', 'Fine.',
].join(nl)

describe('merging two sets that are one place', () => {
  const analysis = analyzeScript(script)
  const shots = planCoverage(analysis)
  const sets = analysis.assets.filter((a) => a.type === 'set')
  it('the script has two sets for the hall', () => {
    expect(sets.map((s) => s.name)).toEqual(expect.arrayContaining(['HALL', 'THE HALL']))
  })
  const keep = sets.find((s) => s.name === 'HALL')!
  const drop = sets.find((s) => s.name === 'THE HALL')!
  const merged = mergeSets(analysis, shots, keep.id, drop.id)!
  it('removes the dropped set and gives the kept one its scenes', () => {
    expect(merged.analysis.assets.some((a) => a.id === drop.id)).toBe(false)
    expect(merged.analysis.assets.find((a) => a.id === keep.id)!.sceneIds).toEqual(expect.arrayContaining([...keep.sceneIds, ...drop.sceneIds]))
    expect(merged.analysis.scenes.every((s) => s.setting !== 'THE HALL')).toBe(true)
  })
  it('every shot that used the dropped set now uses the kept one, once', () => {
    expect(shots.some((s) => s.setAssetId === drop.id || s.assetIds.includes(drop.id))).toBe(true)
    expect(merged.shots.some((s) => s.setAssetId === drop.id || s.assetIds.includes(drop.id))).toBe(false)
    for (const s of merged.shots) expect(new Set(s.assetIds).size).toBe(s.assetIds.length)
  })
  it('refuses to merge a set into itself or a character into a set', () => {
    expect(mergeSets(analysis, shots, keep.id, keep.id)).toBeUndefined()
    const flex = analysis.assets.find((a) => a.type === 'character')!
    expect(mergeSets(analysis, shots, keep.id, flex.id)).toBeUndefined()
  })
})
