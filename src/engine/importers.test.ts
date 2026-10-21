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
})
