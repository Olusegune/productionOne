import type { ExtractedAsset } from './productionStudio'

/**
 * Turns a plain story outline (one beat per line) into a screenplay-shaped script that the normal script reader understands, using the characters, places and props the
 * person already has (for example from their own pictures). It needs no language model and sends nothing anywhere. It does not invent story: every sentence is the
 * person's own; it only adds scene headings and capitalises the names of known items so they are found.
 *
 * A beat that names a place starts that place's scene; a beat that does not stays in the current scene. `Name: words` becomes a line of dialogue for that character.
 */
export interface OutlineResult {
  script: string
  scenes: number
  beats: number
  /** Things to tell the person: a beat that names nobody, no places in the project, and so on. */
  notes: string[]
}

const TIMES: Array<[RegExp, string]> = [
  [/\b(dawn|sunrise|daybreak|first light)\b/i, 'DAWN'], [/\b(morning)\b/i, 'MORNING'], [/\b(afternoon)\b/i, 'AFTERNOON'], [/\b(dusk|sunset|twilight|evening)\b/i, 'DUSK'],
  [/\b(midnight|night|tonight|after dark)\b/i, 'NIGHT'], [/\b(day|noon|daytime)\b/i, 'DAY'],
]
const INTERIOR = /\b(room|kitchen|office|house|cabin|bedroom|hall|inside|indoors?|interior|bar|shop|lab|studio|church|ship'?s? cabin|bridge|garage|attic|cellar|hospital|school|cafe|café)\b/i
const EXTERIOR = /\b(pier|harbou?r|cliff|beach|street|road|field|forest|woods|sea|shore|yard|garden|outside|outdoors?|exterior|dock|hill|mountain|desert|savanna|lighthouse|bridge|river|lake|park|rooftop|island)\b/i

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const nameRegex = (name: string) => new RegExp(`(^|[^A-Za-z0-9])(${esc(name.trim()).replace(/\s+/g, '\\s+')})(?=$|[^A-Za-z0-9])`, 'gi')
const mentions = (text: string, name: string) => !!name.trim() && new RegExp(nameRegex(name).source, 'i').test(text)

/** Capitalises every known name in a sentence (screenplay style) without touching anything else. */
function capitalise(text: string, names: string[]): string {
  let out = text
  for (const n of [...names].sort((a, b) => b.length - a.length)) out = out.replace(nameRegex(n), (_m, pre: string, hit: string) => `${pre}${hit.toUpperCase()}`)
  return out
}

const cleanBeat = (line: string) => line.replace(/^\s*(?:[-*•]|\d+[.)]|beat\s*\d*\s*[:.-])\s*/i, '').replace(/\s+/g, ' ').trim()

export function looksLikeOutline(text: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return lines.length >= 2 || /^\s*(story|outline|beats?)\s*:/i.test(text)
}

export function outlineToScript(outline: string, assets: ExtractedAsset[]): OutlineResult {
  const body = outline.replace(/^\s*(story|outline|beats?)\s*:\s*/i, '')
  const beats = body.split(/\r?\n/).map(cleanBeat).filter(Boolean)
  const characters = assets.filter((a) => a.type === 'character')
  const places = assets.filter((a) => a.type === 'set' || a.type === 'environment')
  const others = assets.filter((a) => a.type === 'prop' || a.type === 'costume')
  const everyName = [...characters, ...places, ...others].map((a) => a.name)
  const notes: string[] = []
  if (!beats.length) return { script: '', scenes: 0, beats: 0, notes: ['There is no story text yet.'] }
  if (!places.length) notes.push('There are no places in the project, so every scene is at "LOCATION". Add a place (Design, Add to the bible) or name one in each beat.')

  interface Scene { place: string; time: string; int: boolean; blocks: string[] }
  const scenes: Scene[] = []
  let current: Scene | undefined
  let lastTime = 'DAY'
  let lastPlace = places[0]?.name.toUpperCase() ?? 'LOCATION'
  let lastInt = true

  beats.forEach((beat, i) => {
    const placeHit = places.find((p) => mentions(beat, p.name))
    const time = TIMES.find(([r]) => r.test(beat))?.[1]
    const dialogue = /^([A-Za-z][A-Za-z0-9' -]{0,30}):\s*(.+)$/.exec(beat)
    const speaker = dialogue && characters.find((c) => c.name.trim().toLowerCase() === dialogue[1].trim().toLowerCase())
    const place = placeHit ? placeHit.name.toUpperCase() : lastPlace
    const int = placeHit ? (INTERIOR.test(placeHit.name) ? true : EXTERIOR.test(placeHit.name) ? false : lastInt) : lastInt
    const intHint = !placeHit && INTERIOR.test(beat) ? true : !placeHit && EXTERIOR.test(beat) && !INTERIOR.test(beat) ? false : int
    const newScene = !current || (!!placeHit && place !== current.place) || (!!time && time !== current.time)
    if (newScene) { current = { place, time: time ?? lastTime, int: intHint, blocks: [] }; scenes.push(current) }
    lastPlace = place; lastTime = time ?? lastTime; lastInt = intHint
    if (speaker) current!.blocks.push(`${speaker.name.toUpperCase()}\n${dialogue![2].trim()}`)
    else {
      const present = characters.filter((c) => mentions(beat, c.name))
      if (!present.length && !placeHit) notes.push(`Beat ${i + 1} names nobody from your project ("${beat.slice(0, 50)}${beat.length > 50 ? '…' : ''}"). It is kept as action.`)
      current!.blocks.push(capitalise(beat, everyName))
    }
  })

  const script = scenes.map((s) => `${s.int ? 'INT.' : 'EXT.'} ${s.place} - ${s.time}\n\n${s.blocks.join('\n\n')}`).join('\n\n') + '\n'
  return { script, scenes: scenes.length, beats: beats.length, notes }
}
