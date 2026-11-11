import { describe, expect, it } from 'vitest'
import { convertScript, fdxToScreenplay, fountainClean, restoreBlankLines } from './importers'
import { parseStory } from './story'

const fdx = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="3">
  <Content>
    <Paragraph Type="Scene Heading"><Text>int. kitchen - day</Text></Paragraph>
    <Paragraph Type="Action"><Text>Anna stirs a pot. She</Text><Text> holds the wooden spoon.</Text></Paragraph>
    <Paragraph Type="Character"><Text>Anna</Text></Paragraph>
    <Paragraph Type="Parenthetical"><Text>softly</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>It needs more salt.</Text></Paragraph>
    <Paragraph Type="Transition"><Text>cut to:</Text></Paragraph>
    <Paragraph Type="Scene Heading"><Text>EXT. YARD - NIGHT</Text></Paragraph>
    <Paragraph Type="Action"><Text>Tom waits.</Text></Paragraph>
  </Content>
  <TitlePage><Content><Paragraph Type="Title"><Text>The Soup Film</Text></Paragraph></Content></TitlePage>
</FinalDraft>`

describe('script importers', () => {
  it('converts Final Draft so the story reader finds scenes, a speaker and her parenthetical', () => {
    const { text } = fdxToScreenplay(fdx)
    const s = parseStory(text)
    expect(s.scenes.map((x) => x.setting)).toEqual(['KITCHEN', 'YARD'])
    expect(s.scenes[0].dialogue[0]).toMatchObject({ speaker: 'ANNA', text: 'It needs more salt.', parenthetical: 'softly' })
    expect(s.props.map((p) => p.name)).toContain('wooden spoon')
  })
  it('refuses a file that is not Final Draft instead of guessing', () => {
    expect(() => fdxToScreenplay('<html><body>no</body></html>')).toThrow(/Final Draft/)
    expect(() => fdxToScreenplay('not xml at all <<<')).toThrow()
  })
  it('cleans Fountain: notes, boneyard, sections, synopses, page breaks, centered and forced action', () => {
    const { text, notes } = fountainClean('Title: Demo\n\n# Act One\n= A synopsis\n\nINT. ROOM - DAY [[check this]]\n\n/* cut this */\n!SOMEONE enters.\n\n> THE END <\n\n===\n')
    expect(text).not.toMatch(/Act One|synopsis|check this|cut this|===/)
    expect(text).toContain('SOMEONE enters.')
    expect(text).toContain('THE END')
    expect(notes.length).toBe(2)
  })
  it('puts blank lines back in Word/PDF text that lost them, so cues and scenes are read', () => {
    const flat = 'INT. KITCHEN - DAY\nAnna stirs a pot.\nANNA\nIt needs salt.\nTom nods.\nEXT. YARD - NIGHT\nTom waits.'
    const s = parseStory(restoreBlankLines(flat).text)
    expect(s.scenes).toHaveLength(2)
    expect(s.scenes[0].dialogue[0]).toMatchObject({ speaker: 'ANNA', text: 'It needs salt.' })
  })
  it('leaves text that already has blank lines alone and handles empty input', () => {
    const ok = 'INT. A - DAY\n\nANNA\nHi.\n\nShe leaves.\n'
    expect(restoreBlankLines(ok).text).toBe(ok)
    expect(restoreBlankLines('').text).toBe('')
  })
  it('chooses the right converter per file kind', () => {
    expect(convertScript('fdx', fdx).text).toContain('INT. KITCHEN - DAY')
    expect(convertScript('text', 'INT. A - DAY\n\nHi.').text).toContain('INT. A - DAY')
    expect(convertScript('docx', 'INT. A - DAY\nANNA\nHi.').text).toContain('\n\nANNA')
  })
  it('parses narrated PDF-style bracketed acts into sections and recurring characters', () => {
    const s = parseStory(`[OPENING]\nA boy named Beau lived above a laundromat. His mother sang hymns. Beau loved Jesus. Jesus was his hope.\n\n[ACT ONE – THE PREACHER]\nBeau became Bishop Beaumont. Bishop Bling Bling preached to crowds. Bishop Bling Bling gathered crowds. His wife warned him.\n\n[ENDING]\nBeau returned home.`)
    expect(s.scenes.map((scene) => scene.heading)).toEqual(['OPENING', 'ACT ONE – THE PREACHER', 'ENDING'])
    expect(s.characters.map((character) => character.name)).toEqual(expect.arrayContaining(['BEAU', 'JESUS', 'BISHOP BLING BLING']))
    expect(s.scenes.length).toBe(3)
  })
  it('does not promote ordinary sentence words into characters or create a front-matter scene', () => {
    const s = parseStory(`BISHOP BLING BLING\nThe Pastor Who Lost Jesus\n\n[OPENING]\nBeau was sincere. Not because he was impressive. Because he was sincere. Another crowd watched Beau.\n\n[ENDING]\nBeau came home.`)
    expect(s.scenes.map((scene) => scene.heading)).toEqual(['OPENING', 'ENDING'])
    expect(s.characters.map((character) => character.name)).toEqual(['BEAU'])
  })
})
