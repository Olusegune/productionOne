import { describe, expect, it } from 'vitest'
import { analyzeScript, mergeAnalysis } from './productionStudio'
import { buildViewPrompt, viewsFor } from './sheetSpecs'
import { styleByName } from './demo2d'

const script = ['Title: The Lantern', '', 'INT. HARBOUR OFFICE - DAWN', '', 'A cramped office above the quay, wood panelling and pinned charts.', '', 'MIRA, a weathered harbour pilot with a short grey braid and a long navy coat with brass buttons, holds a squat brass lantern.', '', 'MIRA', 'We sail at dawn.'].join('\n')

describe('what the script says about a person or a place reaches every picture', () => {
  const analysis = analyzeScript(script)
  const mira = analysis.assets.find((a) => a.type === 'character')!
  const office = analysis.assets.find((a) => a.type === 'set')!
  it('keeps the writer\'s own description of a character and of a place', () => {
    expect(mira.description).toMatch(/weathered harbour pilot with a short grey braid and a long navy coat/)
    expect(office.description).toMatch(/cramped office above the quay/)
  })
  it('describes a place with a line about the place, not a line about a person in it', () => {
    const onlyPerson = analyzeScript(['INT. LIGHTHOUSE - NIGHT', '', 'TOM, a tired keeper in an oilskin coat, climbs the stairs.', '', 'TOM', 'Almost there.'].join('\n'))
    expect(onlyPerson.assets.find((a) => a.type === 'set')?.description).toBeUndefined()
    expect(office.description).not.toMatch(/MIRA/)
  })
  it('puts it into the sheet prompts', () => {
    const view = viewsFor('character', 'Turnaround')[0]
    const p = buildViewPrompt({ style: styleByName('Clean digital cel animation'), asset: mira, variant: 'Canonical', sheetType: 'Turnaround', view })
    expect(p).toContain('short grey braid')
    expect(p).toContain('long navy coat with brass buttons')
  })
  it('never overwrites a description the person wrote, even after reading the script again', () => {
    const edited = { ...analysis, assets: analysis.assets.map((a) => (a.id === mira.id ? { ...a, description: 'My own words' } : a)) }
    const again = mergeAnalysis(edited, analyzeScript(script))
    expect(again.assets.find((a) => a.name === mira.name)!.description).toBe('My own words')
  })
  it('leaves a character the script never describes without a description, rather than inventing one', () => {
    const bare = analyzeScript(['INT. ROOM - DAY', '', 'TOM', 'Hello.'].join('\n'))
    expect(bare.assets.find((a) => a.type === 'character')?.description).toBeUndefined()
  })
})
