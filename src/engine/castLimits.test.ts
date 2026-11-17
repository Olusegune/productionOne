import { describe, expect, it } from 'vitest'
import { analyzeScript } from '../domain/productionStudio'
import { buildShotPrompt, planCoverage } from '../domain/direct'
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
