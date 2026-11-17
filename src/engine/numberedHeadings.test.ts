import { describe, expect, it } from 'vitest'
import { detectFormat, parseStory } from './story'

const text = `NO VIP IN HELL

SCENE 1 — EXT. CONCOURSE — TIMELESS

A black train glides away.

FLEX
Okay. Underground venue.

PA VOICE
Welcome to Eternal Arrivals.

SCENE 2 — INT. VENOMSPUR'S OFFICE — CONTINUOUS

VENOMSPUR
(Without looking up.)
And yet the seating remains complimentary.
`

describe('numbered scene headings (SCENE 2 — INT. PLACE — TIME)', () => {
  it('is read as a screenplay, so speakers and their lines are found', () => {
    expect(detectFormat(text.split('\n'))).toBe('screenplay')
    const s = parseStory(text)
    expect(s.scenes.map((x) => [x.intExt, x.setting])).toEqual([['EXT', 'CONCOURSE'], ['INT', "VENOMSPUR'S OFFICE"]])
    expect(s.scenes.flatMap((x) => x.dialogue.map((d) => d.speaker))).toEqual(['FLEX', 'PA VOICE', 'VENOMSPUR'])
  })
  it('a plain numbered shot list without INT/EXT is still a shot list', () => {
    expect(detectFormat(['SCENE 1 — The kitchen', 'SHOT 1: close on the kettle'])).toBe('shotlist')
  })
  it('signs and verse references written as LABEL: number are not speakers', () => {
    const s = parseStory(['SCENE 1 — INT. HALL — NIGHT', '', 'TICKET: 8,004,119.', '', 'NOW SERVING: 6.', '', 'EPHESIANS 2:8.', '', 'FLEX', 'Hello there.'].join(String.fromCharCode(10)))
    expect(s.characters.map((c) => c.name)).toEqual(['FLEX'])
  })
  it('beats after a dash fold into the plain location, so one room is one set', () => {
    const s = parseStory(['SCENE 1 — INT. OFFICE — CONTINUOUS', '', 'A clock ticks.', '', 'SCENE 2 — INT. OFFICE — THE ACCOUNT', '', 'A pen scratches.', '', 'SCENE 3 — EXT. STREET — TIMELESS', '', 'Rain.'].join(String.fromCharCode(10)))
    expect(s.scenes.map((x) => x.setting)).toEqual(['OFFICE', 'OFFICE', 'STREET'])
    expect(s.scenes[2].timeOfDay).toBe('TIMELESS')
  })
})
