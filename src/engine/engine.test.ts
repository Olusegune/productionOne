import { describe, expect, it } from 'vitest'
import { characterArcs, expressionPlan, readText, sceneMood } from './emotion'
import { sampleStory } from './sampleStory'
import { detectFormat, parseStory } from './story'

const story = parseStory(sampleStory)

describe('story reader: screenplay', () => {
  it('reads scenes with setting, interior/exterior and time of day', () => {
    expect(story.format).toBe('screenplay')
    expect(story.title).toBe('The Last Horizon')
    expect(story.scenes.map((s) => [s.setting, s.intExt, s.timeOfDay])).toEqual([
      ['SAVANNA', 'EXT', 'DUSK'], ['CLIFF BEDROOM', 'INT', 'NIGHT'], ['SAVANNA', 'EXT', 'DAWN'],
    ])
  })
  it('finds the four characters with their dialogue counts and keeps source provenance', () => {
    expect(story.characters.map((c) => c.name).sort()).toEqual(['AMINA', 'ELENA', 'KOFI', 'MARCUS'])
    expect(story.characters.find((c) => c.name === 'AMINA')?.dialogueCount).toBe(3)
    const d = story.scenes[0].dialogue
    expect(d[1]).toMatchObject({ speaker: 'MARCUS', parenthetical: 'whispering', source: 'script' })
    expect(d[1].text).toContain("I'm afraid")
  })
  it('keeps the line number of every finding', () => {
    expect(story.scenes[0].dialogue[0].line).toBeGreaterThan(3)
    expect(story.props[0].evidence[0].line).toBeGreaterThan(0)
  })
  it('finds props with their condition, including the damaged compass', () => {
    const compass = story.props.find((p) => p.name.includes('compass'))
    expect(compass?.name).toBe('cracked solar compass')
    expect(compass?.condition).toBe('cracked')
    expect(compass?.sceneIds).toEqual(['SCENE-001', 'SCENE-003'])
    expect(story.props.find((p) => p.name.includes('photograph'))?.condition).toBe('weathered')
  })
  it('does not mistake body parts or furniture for props', () => {
    const names = story.props.map((p) => p.name)
    expect(names.some((n) => /\b(arm|hand|leg|table|bed)\b/.test(n))).toBe(false)
  })
  it('finds ages, wardrobe, injuries as variants tied to a character and a line', () => {
    const v = (character: string, kind: string) => story.variants.filter((x) => x.character === character && x.kind === kind).map((x) => x.value)
    expect(v('AMINA', 'age')).toEqual(expect.arrayContaining(['Age 30s', 'Young']))
    expect(v('AMINA', 'wardrobe')).toContain('Dust-Worn Field Jacket')
    expect(v('MARCUS', 'wardrobe')).toContain('Torn Navy Coat')
    expect(v('MARCUS', 'injury')).toEqual(expect.arrayContaining(['Bleeding']))
    expect(v('ELENA', 'wardrobe')).toContain('Faded Blue Dress')
    expect(v('KOFI', 'age')).toEqual(expect.arrayContaining(['Old']))
    expect(story.variants.every((x) => x.evidence.line > 0 && x.evidence.text.length > 0)).toBe(true)
  })
})

describe('story reader: other formats and edge cases', () => {
  it('reads a script where action follows dialogue with no blank line', () => {
    const s = parseStory('EXT. SAVANNA - DUSK\nAMINA\nWe are close.\nShe holds the solar compass and studies the horizon.')
    expect(s.scenes[0].dialogue).toHaveLength(1)
    expect(s.scenes[0].dialogue[0].text).toBe('We are close.')
    expect(s.props[0].name).toBe('solar compass')
  })
  it('handles voice-over cues, Fountain forced scenes, scene numbers and transitions', () => {
    const s = parseStory('.FLASHBACK - DAY\n\nJONAH (V.O.)\nI remember the harbor.\n\nCUT TO:\n\nINT. BOAT - NIGHT #4#\n\nHe lowers the lantern.')
    expect(s.scenes.map((x) => x.setting)).toEqual(['FLASHBACK', 'BOAT'])
    expect(s.scenes[0].dialogue[0]).toMatchObject({ speaker: 'JONAH', voiceOver: true })
    expect(s.scenes[1].action.some((a) => a.text === 'CUT TO:')).toBe(false)
  })
  it('reads multi-line dialogue and ignores a title page before the first scene', () => {
    const s = parseStory('Title: Test\nCredit: Someone\n\nINT. KITCHEN - DAY\n\nANNA\nFirst line,\nsecond line.\n\nShe leaves.')
    expect(s.scenes[0].dialogue[0].text).toBe('First line, second line.')
    expect(s.warnings.join(' ')).toContain('before the first scene')
  })
  it('detects shot-list, lyrics and prose formats', () => {
    expect(detectFormat(['## SCENE 1: THE BAND', 'SHOT 01 - close on his hands'])).toBe('shotlist')
    expect(detectFormat(['[Verse 1]', 'la la', '[Chorus]', 'hey'])).toBe('lyrics')
    expect(detectFormat(['Just some words.'])).toBe('prose')
    expect(detectFormat(['', '  '])).toBe('empty')
    const lyrics = parseStory('[Verse 1]\nWalking home alone\n[Chorus]\nWe rise')
    expect(lyrics.scenes.map((x) => x.setting)).toEqual(['Verse 1', 'Chorus'])
    const shotlist = parseStory('## SCENE 1: THE BAND\nSHOT 01 - wide on the stage\nLYRIC: hold on tonight')
    expect(shotlist.scenes[0].setting).toBe('THE BAND')
    expect(shotlist.scenes[0].dialogue[0].speaker).toBe('LYRIC')
  })
  it('reads prose: quoted speech with a speaker and no headings', () => {
    const s = parseStory('The harbor was quiet.\n\n"We sail today," Jonah said. The fog lay thick.')
    expect(s.format).toBe('prose')
    expect(s.characters.map((c) => c.name)).toEqual(['Jonah'])
    expect(s.warnings.join(' ')).toContain('prose')
  })
  it('never throws on empty or odd input', () => {
    for (const text of ['', '   \n\n', '###', 'INT.', '﻿EXT. X', 'A'.repeat(5000)]) expect(() => parseStory(text)).not.toThrow()
    expect(parseStory('').scenes).toEqual([])
  })
})

describe('emotions engine', () => {
  it('reads emotion words, delivery notes and intensity', () => {
    expect(readText('I hate you!', {}).emotion).toBe('anger')
    expect(readText("I can't feel my leg. I'm afraid.").emotion).toBe('fear')
    expect(readText('You will be braver than all of us.', { parenthetical: 'tearfully' }).emotion).toBe('sadness')
    const mild = readText('She smiles slightly.')
    const strong = readText('She laughs, utterly delighted!')
    expect(mild.emotion).toBe('joy')
    expect(strong.intensity).toBeGreaterThan(mild.intensity)
  })
  it('respects negation and says when it has no evidence', () => {
    expect(readText('He is not afraid.').emotion).toBe('neutral')
    const plain = readText('The door opens.')
    expect(plain.emotion).toBe('neutral')
    expect(plain.confidence).toBeLessThan(0.3)
  })
  it('always reports the words that produced a reading', () => {
    const r = readText('She weeps and trembles.')
    expect(r.cues.length).toBeGreaterThan(0)
    expect(r.source).toBe('rules')
  })
  it('follows each character through the story', () => {
    const arcs = characterArcs(story)
    const kind = (name: string) => arcs.find((a) => a.character === name)!.points.map((p) => p.reading.emotion)
    expect(kind('MARCUS')).toEqual(['fear'])
    expect(kind('KOFI')).toEqual(['anger'])
    expect(kind('ELENA')[0]).toBe('sadness')
    const amina = arcs.find((a) => a.character === 'AMINA')!
    expect(amina.points.at(-1)?.reading.emotion).toBe('joy')
    expect(amina.points.at(-1)?.evidence[0].line).toBeGreaterThan(0)
  })
  it('turns an arc into the expressions the story actually needs, always with a neutral baseline', () => {
    const plan = expressionPlan(characterArcs(story).find((a) => a.character === 'ELENA')!)
    expect(plan[0].emotion).toBe('neutral')
    expect(plan.map((n) => n.emotion)).toContain('sadness')
    expect(plan.find((n) => n.emotion === 'sadness')?.why).toContain('Scene 2')
  })
  it('reads the mood of a scene for set and lighting direction', () => {
    const mood = sceneMood(story.scenes[1])
    expect(mood.valence).toBeLessThan(0)
    expect(mood.cues.length).toBeGreaterThan(0)
  })
})

describe('scripts written with colons and action-only characters', () => {
  const colon = `INT. LINCOLN MIDDLE SCHOOL - PLAYGROUND - DAY

Chloe walks across the yard with her lunch bag. Chloe looks at the other children. Her hand doesn't shake as she holds the water jar.

CHLOE: (softly) I can do this.

**JACOB:** "Are you sure?"

Chloe sits on the stone rim. Chloe folds her hands in prayer. Chloe smiles at Jacob.

NOTE: this scene runs two minutes.
Camera: slow push in.

SAMARIA:
Come and see.
She waits.
`
  const story = parseStory(colon)
  it('reads CHLOE: style speakers, bold names and speaker blocks, but not labels like NOTE: or Camera:', () => {
    const speakers = story.scenes[0].dialogue.map((d) => d.speaker)
    expect(speakers).toEqual(['CHLOE', 'JACOB', 'SAMARIA'])
    expect(story.scenes[0].dialogue[0]).toMatchObject({ text: 'I can do this.', parenthetical: 'softly' })
    expect(story.scenes[0].dialogue[1].text).toBe('Are you sure?')
    expect(story.scenes[0].dialogue[2].text).toContain('Come and see.')
  })
  it('does not invent props from verbs that are really nouns or clauses', () => {
    const names = story.props.map((p) => p.name)
    expect(names).not.toContain("doesn't shake")
    expect(names.some((n) => /^(?:on|in) /.test(n))).toBe(false)
    expect(names).toEqual(expect.arrayContaining(['water jar']))
  })
  it('finds characters that only act in the description and says they were inferred', () => {
    const act = parseStory('INT. KITCHEN - DAY\n\nMaria walks to the stove. Maria looks at the pot. Maria smiles and nods.\n\nEXT. YARD - DAY\n\nMaria sits on the step. Maria waits.')
    expect(act.characters.map((c) => c.name)).toEqual(['MARIA'])
    expect(act.characters[0].fromAction).toBe(true)
  })
  it('warns when no characters can be found', () => {
    expect(parseStory('INT. ROOM - DAY\n\nSilence fills the room.').warnings.join(' ')).toContain('No characters were found')
  })
})
