import { describe, expect, it } from 'vitest'
import { analyzeScript } from '../domain/productionStudio'
import { buildShotPrompt, planCoverage, shotReferences } from '../domain/direct'
import { buildViewPrompt } from '../domain/sheetSpecs'
import { defaultStyleBible } from '../domain/visualDevelopment'

const nl = String.fromCharCode(10)
const script = [
  'SCENE 1 — EXT. PLATFORM — NIGHT', '',
  'A queue machine hums on a crowded platform.', '',
  'FLEX', 'Okay.', '',
  'VENOMSPUR', 'Sit down.', '',
  'SCENE 2 — INT. OFFICE — LATER', '',
  'A photograph slips from the file.', '',
  'A modest kitchen. A small boy sitting behind a birthday cake.', '',
  'FLEX', 'Mine.', '',
  'SCENE 3 — INT. OFFICE — LATER', '', 'Flex studies the photograph.', '', 'FLEX', 'Right.',
].join(nl)
const style = { name: 's', description: 'd', rendering: 'r' } as never

describe('who and what may appear in a frame', () => {
  const analysis = analyzeScript(script)
  const shots = planCoverage(analysis)
  it('a shot with people in it says only those people appear (no crowd or bystanders), but an establishing shot may show the place busy', () => {
    const master = shots.find((s) => s.sceneId === 'SCENE-001' && s.coverage === 'master')!
    expect(buildShotPrompt(master, analysis, style, [])).toMatch(/Only these people appear in the frame: no other people, creatures, crowd or bystanders/)
    const establishing = shots.find((s) => s.coverage === 'establishing')!
    expect(buildShotPrompt(establishing, analysis, style, [])).not.toMatch(/Only these people appear/)
  })
  it('a shot with a set picture says to keep that exact set, and the set picture is never dropped by the reference cap', () => {
    const master = shots.find((s) => s.sceneId === 'SCENE-001' && s.coverage === 'master')!
    const p = buildShotPrompt(master, analysis, style, [{ label: 'PLATFORM', path: 'p.png', kind: 'set' }])
    expect(p).toMatch(/Set consistency: the picture labelled "PLATFORM" is this exact place/)
    expect(buildShotPrompt(master, analysis, style, [])).not.toMatch(/Set consistency/)
    const queue = { jobs: analysis.assets.map((a, i) => ({ assetId: a.id, variant: 'Canonical', approved: true, outputPath: `${i}.png`, viewKey: 'front', revision: 1 })) } as never
    const many = { ...master, assetIds: analysis.assets.map((a) => a.id) }
    const refs = shotReferences(many, analysis, queue)
    const setAsset = analysis.assets.find((a) => a.type === 'set' || a.type === 'environment')
    if (setAsset) expect(refs.some((r) => r.kind === 'set')).toBe(true)
    expect(refs.length).toBeLessThanOrEqual(8)
  })
  it('a described prop shows exactly what its description says and nothing added', () => {
    const insert = shots.find((s) => s.coverage === 'insert' && /photograph/.test(s.title))!
    const prompt = buildShotPrompt(insert, analysis, style, [])
    expect(prompt).toMatch(/small boy sitting behind a birthday cake/)
    expect(prompt).toMatch(/exactly what its description says and nothing more: add no other people or objects/)
  })
  it('the described prop sheet asks for exactly the description, so the reference picture has no extra figures either', () => {
    const asset = analysis.assets.find((a) => a.name === 'photograph')!
    const p = buildViewPrompt({ style: defaultStyleBible, asset, variant: 'Canonical', sheetType: 'Multi-view', view: { key: 'front', label: 'Front', instruction: 'Front.', aspect: '1:1', fullBody: false } as never })
    expect(p).toMatch(/shows exactly this and nothing more: add no other people, figures or objects/)
  })
})

describe('a place written two ways is one set', () => {
  it('"OFFICE / CORRIDOR" folds into the office when the office also appears on its own', () => {
    const a = analyzeScript(['SCENE 1 — INT. OFFICE — NIGHT', '', 'FLEX', 'Hi.', '', 'SCENE 2 — INT. OFFICE / CORRIDOR — LATER', '', 'FLEX', 'Bye.'].join(nl))
    expect(a.assets.filter((x) => x.type === 'set').map((x) => x.name)).toEqual(['OFFICE'])
  })
  it('stays separate when the office never appears on its own', () => {
    const a = analyzeScript(['SCENE 1 — INT. OFFICE / CORRIDOR — NIGHT', '', 'FLEX', 'Hi.'].join(nl))
    expect(a.assets.filter((x) => x.type === 'set').map((x) => x.name)).toEqual(['OFFICE / CORRIDOR'])
  })
})
