import { describe, expect, it } from 'vitest'
import { analyzeScript } from '../domain/productionStudio'
import { buildViewPrompt } from '../domain/sheetSpecs'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { planCoverage, buildShotPrompt } from '../domain/direct'
import { parseStory } from './story'

const nl = String.fromCharCode(10)
const script = [
  'SCENE 1 — INT. OFFICE — NIGHT', '',
  'A silver microphone rests on the desk.', '',
  'Beyond the window, an immense city descends into an abyss.', '',
  'FLEX', 'Okay.', '',
  'SCENE 2 — INT. OFFICE — LATER', '',
  'A photograph slips from the file.', '',
  'A modest kitchen. A small boy sitting behind a birthday cake.', '',
  'The music disappears.', '',
  'Flex catches the photograph before Venomspur can retrieve it.', '',
  'FLEX', "That's my boy.", '',
  'VENOMSPUR', 'His seventh birthday.', '',
  'Flex smooths a curled corner of the photograph.',
  '', 'SCENE 3 — INT. OFFICE — LATER', '', 'Flex studies the photograph.', '', 'FLEX', 'Right.',
].join(nl)

describe('props keep what the script says they show', () => {
  const story = parseStory(script)
  it('a photograph is described by the lines that follow it', () => {
    const p = story.props.find((x) => x.name === 'photograph')
    expect(p?.description).toMatch(/small boy sitting behind a birthday cake/)
    expect(p?.description).toMatch(/modest kitchen/)
    expect(p?.description).not.toMatch(/music disappears/)
  })
  it('an ordinary object is not given the lines about the room as a description', () => {
    expect(story.props.find((x) => x.name === 'silver microphone')?.description).toBeUndefined()
  })
  const analysis = analyzeScript(script)
  it('the prop asset, its sheet prompt, its insert shot and the shot prompt all carry the description', () => {
    const asset = analysis.assets.find((a) => a.name === 'photograph')!
    expect(asset.prompt).toMatch(/As the script describes it: .*birthday cake/)
    const sheet = buildViewPrompt({ style: defaultStyleBible, asset, variant: 'Canonical', sheetType: 'Multi-view', view: { key: 'front', label: 'Front', instruction: 'Front.', aspect: '1:1', fullBody: false } as never })
    expect(sheet).toMatch(/birthday cake/)
    const shots = planCoverage(analysis)
    const insert = shots.find((s) => s.coverage === 'insert' && /photograph/.test(s.title))!
    expect(insert.action).toMatch(/What it shows, as the script describes it: .*birthday cake/)
    const prompt = buildShotPrompt(insert, analysis, { name: 's', description: 'd', rendering: 'r' } as never, [])
    expect(prompt).toMatch(/Props in frame: photograph \(.*birthday cake/)
  })
})
