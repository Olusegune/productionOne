/**
 * The story reader: free, local and deterministic. It turns a screenplay, a shot-list style script, lyrics or plain prose into scenes, dialogue, characters,
 * props and story variants (ages, wardrobe, injuries, disguises). Every finding keeps the line it came from, so nothing is a black box and the writer's words are never rewritten.
 */

export type StoryFormat = 'screenplay' | 'shotlist' | 'lyrics' | 'prose' | 'empty'

export interface Evidence { line: number; text: string }

export interface DialogueLine {
  speaker: string
  text: string
  parenthetical?: string
  voiceOver?: boolean
  line: number
  source: 'script' | 'proposed'
}

export interface StoryScene {
  id: string
  number: number
  heading: string
  setting: string
  intExt: 'INT' | 'EXT' | 'INT/EXT' | 'UNSPECIFIED'
  timeOfDay: string
  startLine: number
  endLine: number
  /** Action / description lines with their line numbers. */
  action: Array<{ line: number; text: string }>
  dialogue: DialogueLine[]
  body: string
}

export interface StoryCharacter {
  /** True when the name was found acting in the description but never speaks under a cue. */
  fromAction?: boolean
  name: string
  sceneIds: string[]
  firstSceneId: string
  dialogueCount: number
  mentionCount: number
}

export interface StoryProp { name: string; sceneIds: string[]; evidence: Evidence[]; condition?: string }

export type VariantKind = 'age' | 'wardrobe' | 'injury' | 'state'
export interface StoryVariant { character: string; kind: VariantKind; value: string; sceneId: string; evidence: Evidence }

export interface ParsedStory {
  format: StoryFormat
  title?: string
  scenes: StoryScene[]
  characters: StoryCharacter[]
  props: StoryProp[]
  variants: StoryVariant[]
  warnings: string[]
}

const TIMES = 'DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|SUNSET|SUNRISE|TWILIGHT|MIDNIGHT|NOON|LATER|CONTINUOUS|MOMENTS LATER|SAME|SAME TIME|DAYBREAK|EARLY MORNING|LATE NIGHT'
const SLUG = /^(?:\.(?=[A-Za-z])|(INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\s*\/\s*E|INT|EXT)[.\s])\s*(.+)$/i
const SEP = /\s+[-–—]+\s+|\s*[–—]\s*/
const TRANSITION = /^(?:FADE (?:IN|OUT|TO)|CUT TO|DISSOLVE TO|SMASH CUT|MATCH CUT|JUMP CUT|WIPE TO|IRIS (?:IN|OUT)|BACK TO|THE END)\b.*[:.]?$|.*\bTO:$/
const CUE = /^(@)?([A-Z][A-Z0-9 .'’-]{0,34})(\s*\((?:V\.?O\.?|O\.?S\.?|O\.?C\.?|CONT'?D|CONT’D|FILTERED|ON PHONE|PRE-LAP)\))*\s*(\^)?$/
const SHOTLIST_SCENE = /^(?:#{1,4}\s*)?(?:\*\*)?(?:SCENE|SEQUENCE)\s+(?:\d+[A-Za-z]?|[IVXLC]+)\b[\s:.–—-]*(.*?)(?:\*\*)?$/i
const SHOT_LINE = /^(?:\*\*)?(?:SHOT|SH)\.?\s*#?\s*\d+[A-Za-z]?\b/i
const LYRIC_TAG = /^\[(.+?)\]\s*$/
const PRONOUN_START = /^(?:he|she|they|it|his|her|their|the|a|an|as|then|we see|we hear|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:is|are|was|walks|runs|looks|turns|stands|sits|moves|enters|exits|crosses|steps|takes|picks|holds|places|opens|closes|reaches|pulls|pushes|kneels|smiles|nods|shakes|stares|watches|listens|falls|rises|lifts|raises|drops|grabs|leans|laughs|cries|whispers|says|speaks))\b/i

const slug = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const clean = (line: string) => line.replace(/^﻿/, '').replace(/\*\*|__/g, '').replace(/\t/g, '  ').trimEnd()
const titleCase = (value: string) => value.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
const escapeRx = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function detectFormat(lines: string[]): StoryFormat {
  const text = lines.map(clean)
  if (!text.some((l) => l.trim())) return 'empty'
  if (text.some((l) => SLUG.test(l.trim()))) return 'screenplay'
  if (text.filter((l) => LYRIC_TAG.test(l.trim())).length >= 2) return 'lyrics'
  if (text.some((l) => SHOT_LINE.test(l.trim())) || text.some((l) => SHOTLIST_SCENE.test(l.trim()))) return 'shotlist'
  return 'prose'
}

function parseSlug(raw: string): { setting: string; intExt: StoryScene['intExt']; timeOfDay: string } | null {
  const trimmed = raw.trim().replace(/\s*#[\w.-]+#\s*$/, '')
  const m = SLUG.exec(trimmed)
  if (!m) return null
  const kind = (m[1] ?? '').toUpperCase().replace(/\s/g, '')
  const intExt: StoryScene['intExt'] = !m[1] ? 'UNSPECIFIED' : kind.includes('/') || kind === 'IE' ? 'INT/EXT' : kind.startsWith('INT') ? 'INT' : 'EXT'
  const rest = m[2].trim()
  const parts = rest.split(SEP).map((p) => p.trim()).filter(Boolean)
  let timeOfDay = 'UNSPECIFIED'
  if (parts.length > 1 && new RegExp(`^(?:${TIMES})$`, 'i').test(parts[parts.length - 1])) timeOfDay = parts.pop()!.toUpperCase()
  return { setting: (parts.join(' - ') || rest).trim(), intExt, timeOfDay }
}

const isCueLine = (line: string) => {
  const t = line.trim()
  if (!t || t.length > 40 || TRANSITION.test(t) || SLUG.test(t) || !/[A-Z]/.test(t)) return false
  if (t !== t.toUpperCase() && !t.startsWith('@')) return false
  return CUE.test(t)
}

export function cleanCueName(cue: string): { name: string; voiceOver: boolean } {
  const voiceOver = /\((?:V\.?O\.?|O\.?S\.?|FILTERED|ON PHONE|PRE-LAP)\)/i.test(cue)
  const name = cue.replace(/^@/, '').replace(/\^$/, '').replace(/\s*\([^)]*\)/g, '').trim()
  return { name, voiceOver }
}

interface Builder { scenes: StoryScene[]; warnings: string[] }

const newScene = (b: Builder, heading: string, setting: string, intExt: StoryScene['intExt'], timeOfDay: string, line: number): StoryScene => {
  const scene: StoryScene = { id: `SCENE-${String(b.scenes.length + 1).padStart(3, '0')}`, number: b.scenes.length + 1, heading, setting, intExt, timeOfDay, startLine: line, endLine: line, action: [], dialogue: [], body: '' }
  b.scenes.push(scene)
  return scene
}

const LABELS = new Set(['SCENE', 'SHOT', 'CAMERA', 'ACTION', 'NOTE', 'NOTES', 'LYRIC', 'EXPRESSION', 'LIGHTING', 'FRAMING', 'PERFORMANCE', 'SOUND', 'SFX', 'MUSIC', 'TITLE', 'CREDIT', 'LOCATION', 'TIME', 'VISUAL', 'VISUALS', 'DIALOGUE', 'SETTING', 'INT', 'EXT', 'CUT', 'FADE', 'TRANSITION', 'SUPER', 'CHARACTERS', 'CHARACTER', 'CAST', 'LOGLINE', 'GENRE', 'STYLE', 'FORMAT', 'DURATION', 'RUNTIME', 'ASPECT', 'MOOD', 'THEME', 'PROP', 'PROPS', 'ANGLE', 'LENS', 'MOVEMENT', 'SYNOPSIS', 'SUMMARY', 'EXAMPLE', 'WARNING', 'TIP', 'OPTION', 'STEP', 'DAY', 'NIGHT', 'WRITTEN BY', 'AUTHOR', 'DRAFT', 'DATE', 'CONTACT', 'ACT'])
// "CHLOE: hello", "Chloe (whispering): hello", "CHLOE:" followed by lines. Name must look like a name, not a label.
const COLON_LINE = /^(@)?([A-Za-z][A-Za-z0-9 .'’-]{0,30}?)(?:\s*\(([^)]{0,40})\))?\s*:\s*(.*)$/

function colonSpeaker(t: string, counts: Map<string, number>): { name: string; parenthetical?: string; rest: string } | null {
  const m = COLON_LINE.exec(t)
  if (!m) return null
  const name = m[2].trim()
  const words = name.split(/\s+/)
  if (words.length > 4 || LABELS.has(name.toUpperCase()) || SLUG.test(t) || /^\d/.test(name)) return null
  const allCaps = name === name.toUpperCase()
  if (!allCaps && (counts.get(name.toUpperCase()) ?? 0) < 2) return null
  if (allCaps && name.length < 2) return null
  return { name: name.toUpperCase() === name ? name : name.toUpperCase(), parenthetical: m[3]?.trim() || undefined, rest: m[4].trim() }
}

const stripQuotes = (value: string) => value.replace(/^["“”*_]+|["“”*_]+$/g, '').trim()

function readScreenplay(lines: string[], b: Builder) {
  const speakerCounts = new Map<string, number>()
  for (const raw of lines) {
    const m = COLON_LINE.exec(clean(raw).trim())
    if (m && m[2].trim().split(/\s+/).length <= 4) speakerCounts.set(m[2].trim().toUpperCase(), (speakerCounts.get(m[2].trim().toUpperCase()) ?? 0) + 1)
  }
  const known = new Set<string>()
  // First pass: names that cue dialogue, so action lines that start with a known name are read as action.
  lines.forEach((raw, i) => {
    const t = clean(raw).trim()
    const prevBlank = i === 0 || !clean(lines[i - 1]).trim()
    if (prevBlank && isCueLine(t) && clean(lines[i + 1] ?? '').trim() && !SLUG.test(clean(lines[i + 1]).trim())) known.add(cleanCueName(t).name.toUpperCase())
  })
  let scene: StoryScene | null = null
  let i = 0
  while (i < lines.length) {
    const t = clean(lines[i]).trim()
    const line = i + 1
    const slugged = t ? parseSlug(t) : null
    if (slugged) { scene = newScene(b, t.replace(/^\./, ''), slugged.setting, slugged.intExt, slugged.timeOfDay, line); i++; continue }
    if (!t || !scene) { i++; continue }
    scene.endLine = line
    const colon = colonSpeaker(t, speakerCounts)
    if (colon) {
      let text = stripQuotes(colon.rest)
      let parenthetical = colon.parenthetical
      const lead = /^\(([^)]{0,60})\)\s*(.*)$/.exec(text)
      if (lead) { parenthetical = parenthetical ? `${parenthetical}; ${lead[1]}` : lead[1]; text = stripQuotes(lead[2]) }
      let j = i + 1
      if (!text) { const parts: string[] = []; while (j < lines.length && clean(lines[j]).trim() && !SLUG.test(clean(lines[j]).trim()) && !colonSpeaker(clean(lines[j]).trim(), speakerCounts)) { parts.push(stripQuotes(clean(lines[j]).trim())); j++ } text = parts.join(' ') }
      if (text) {
        scene.dialogue.push({ speaker: colon.name, text, parenthetical, voiceOver: /\((?:V\.?O\.?|O\.?S\.?)\)/i.test(t) || undefined, line, source: 'script' })
        scene.body += `${scene.body ? '\n' : ''}${colon.name}\n${text}`
        scene.endLine = j
        i = j
        continue
      }
    }
    const prevBlank = i === 0 || !clean(lines[i - 1]).trim() || SLUG.test(clean(lines[i - 1]).trim())
    const next = clean(lines[i + 1] ?? '').trim()
    if (prevBlank && isCueLine(t) && next && !SLUG.test(next)) {
      const { name, voiceOver } = cleanCueName(t)
      let parenthetical: string | undefined
      const spoken: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const dl = clean(lines[j]).trim()
        if (!dl) break
        if (SLUG.test(dl)) break
        if (/^\(.*\)$/.test(dl)) { parenthetical = parenthetical ? `${parenthetical}; ${dl.slice(1, -1)}` : dl.slice(1, -1); j++; continue }
        const firstWord = dl.split(/\s+/)[0].replace(/[^A-Za-z]/g, '').toUpperCase()
        const startsWithKnown = spoken.length > 0 && (known.has(firstWord) || [...known].some((k) => new RegExp(`^${escapeRx(k)}\\b`, 'i').test(dl)))
        if (spoken.length > 0 && (PRONOUN_START.test(dl) || startsWithKnown)) break
        spoken.push(dl)
        j++
      }
      if (spoken.length) {
        scene.dialogue.push({ speaker: name, text: spoken.join(' '), parenthetical, voiceOver: voiceOver || undefined, line, source: 'script' })
        scene.body += `${scene.body ? '\n' : ''}${t}\n${spoken.join(' ')}`
        scene.endLine = j
        i = j
        continue
      }
    }
    if (!TRANSITION.test(t)) { scene.action.push({ line, text: t }); scene.body += `${scene.body ? '\n' : ''}${t}` }
    i++
  }
}

function readShotlist(lines: string[], b: Builder) {
  let scene: StoryScene | null = null
  lines.forEach((raw, idx) => {
    const t = clean(raw).replace(/^#{1,4}\s*/, '').trim()
    const line = idx + 1
    if (!t) return
    const sc = SHOTLIST_SCENE.exec(t)
    if (sc) { const name = (sc[1] || `Scene ${b.scenes.length + 1}`).replace(/\*+$/, '').trim(); scene = newScene(b, t, name, 'UNSPECIFIED', 'UNSPECIFIED', line); return }
    const slugged = SLUG.test(t) ? parseSlug(t) : null
    if (slugged) { scene = newScene(b, t, slugged.setting, slugged.intExt, slugged.timeOfDay, line); return }
    if (!scene) { b.warnings.push(`Line ${line} is before the first scene and was kept as project notes, not as story.`); return }
    scene.endLine = line
    const labelled = /^(?:LYRIC|DIALOGUE|SAY|SAYS)\s*:\s*(.+)$/i.exec(t)
    if (labelled) { scene.dialogue.push({ speaker: 'LYRIC', text: labelled[1], line, source: 'script' }); scene.body += `${scene.body ? '\n' : ''}${t}`; return }
    scene.action.push({ line, text: t })
    scene.body += `${scene.body ? '\n' : ''}${t}`
  })
}

function readLyrics(lines: string[], b: Builder) {
  let scene: StoryScene | null = null
  lines.forEach((raw, idx) => {
    const t = clean(raw).trim()
    const line = idx + 1
    const tag = LYRIC_TAG.exec(t)
    if (tag) { scene = newScene(b, t, tag[1], 'UNSPECIFIED', 'UNSPECIFIED', line); return }
    if (!t) return
    if (!scene) scene = newScene(b, '[Intro]', 'Intro', 'UNSPECIFIED', 'UNSPECIFIED', line)
    scene.endLine = line
    scene.action.push({ line, text: t })
    scene.body += `${scene.body ? '\n' : ''}${t}`
  })
}

const SPEECH_VERB = 'said|says|asked|asks|replied|replies|whispered|whispers|shouted|shouts|muttered|mutters|cried|cries|laughed|answered|called|murmured|snapped|sighed|yelled|insisted'

function readProse(lines: string[], b: Builder) {
  let scene: StoryScene | null = null
  let paragraph: Array<{ line: number; text: string }> = []
  const flush = () => {
    if (!paragraph.length) return
    if (!scene) scene = newScene(b, 'UNTITLED SCENE', 'Unspecified', 'UNSPECIFIED', 'UNSPECIFIED', paragraph[0].line)
    const text = paragraph.map((p) => p.text).join(' ')
    scene.endLine = paragraph[paragraph.length - 1].line
    scene.action.push({ line: paragraph[0].line, text })
    scene.body += `${scene.body ? '\n' : ''}${text}`
    const quote = new RegExp(`["“]([^"”]{2,300})["”],?\\s*(?:(?:${SPEECH_VERB})\\s+)?([A-Z][a-z]+)?(?:\\s+(?:${SPEECH_VERB}))?`, 'g')
    for (const m of text.matchAll(quote)) {
      const who = m[2] ?? new RegExp(`\\b([A-Z][a-z]+)\\s+(?:${SPEECH_VERB})`).exec(text.slice(0, m.index))?.[1]
      if (who) scene.dialogue.push({ speaker: who.toUpperCase(), text: m[1], line: paragraph[0].line, source: 'script' })
    }
    paragraph = []
  }
  lines.forEach((raw, idx) => {
    const t = clean(raw).trim()
    if (/^(?:\*{3,}|-{3,}|#{1,3}\s+.+|CHAPTER\s+\w+.*)$/i.test(t)) { flush(); scene = newScene(b, t.replace(/^#+\s*/, ''), t.replace(/^#+\s*/, '').replace(/^[*-]+$/, 'Scene'), 'UNSPECIFIED', 'UNSPECIFIED', idx + 1); return }
    if (!t) { flush(); return }
    paragraph.push({ line: idx + 1, text: t })
  })
  flush()
}

const NOT_PROPS = new Set(['hand', 'hands', 'arm', 'arms', 'head', 'eyes', 'eye', 'face', 'hair', 'breath', 'gaze', 'distance', 'horizon', 'moment', 'time', 'way', 'step', 'steps', 'it', 'him', 'her', 'them', 'back', 'side', 'air', 'silence', 'room', 'floor', 'ground', 'place', 'voice', 'mouth', 'lip', 'lips', 'fist', 'fists', 'finger', 'fingers', 'leg', 'legs', 'foot', 'feet', 'shoulder', 'shoulders', 'chest', 'heart', 'door', 'window', 'wall', 'table'])
const PROP_VERB = '(?:holds?|holding|carries|carrying|picks? up|places?|placing|opens?|uses?|using|grabs?|draws?|wields?|clutches|clutching|raises?|lifts?|sets? down|puts? down|pulls? out|throws?|drops?|unfolds?|unrolls?|reads?|checks?|studies|inspects?|cradles?|tucks?|slides?)'
/** A prop phrase never starts with these (a preposition or auxiliary means the match is a clause, not an object) and never contains them. */
const NOT_PHRASE_START = new Set(['on', 'in', 'at', 'by', 'of', 'off', 'up', 'out', 'down', 'over', 'under', 'with', 'without', 'for', 'from', 'into', 'onto', 'to', 'toward', 'towards', 'against', 'across', 'through', 'near', 'beside', 'behind', 'around', 'as', 'while', 'when', 'and', 'but', 'or', 'then', 'so', 'not', 'no', 'never', 'is', 'are', 'was', 'were', 'be', 'it', 'that', 'this', 'there', 'here'])
const AUX = /\b(?:doesn't|don't|didn't|isn't|aren't|wasn't|won't|can't|cannot|does|do|did|is|are|was|were|will|would|could|should|has|have|had|not|never|shake|shakes|shaking|trembles?|tremble|feels?)\b/i
const PROP_RX = new RegExp(`\\b${PROP_VERB}\\s+(?:(?:an?|the|his|her|their|its|some|one)\\s+)?([a-z][a-z'-]*(?:\\s+[a-z][a-z'-]*){0,3}?)(?=\\s+(?:and|on|in|at|to|with|from|into|onto|beside|toward|towards|against|for|as|while|then|before|after|over|under)\\b|[,.;:!?]|$)`, 'gi')
const DAMAGE = /\b(broken|cracked|shattered|torn|burned|burnt|rusted|rusty|bent|chipped|damaged|weathered|worn|frayed|dented|scratched|stained|bloodied|charred|snapped)\b/i

function addProps(scenes: StoryScene[]): StoryProp[] {
  const props = new Map<string, StoryProp>()
  for (const scene of scenes) {
    for (const act of scene.action) {
      for (const m of act.text.matchAll(PROP_RX)) {
        const words = m[1].trim().split(/\s+/)
        const last = words[words.length - 1].toLowerCase()
        if (NOT_PROPS.has(last) || words.length === 0 || NOT_PHRASE_START.has(words[0].toLowerCase()) || /^(?:what|how|where|these|those)$/.test(words[0].toLowerCase()) || AUX.test(m[1]) || /(?:ing|ed)$/.test(last) && words.length === 1) continue
        const name = words.join(' ').toLowerCase()
        const key = last
        const existing = props.get(key)
        const condition = DAMAGE.exec(name)?.[1]?.toLowerCase()
        const evidence = { line: act.line, text: act.text }
        if (existing) {
          if (!existing.sceneIds.includes(scene.id)) existing.sceneIds.push(scene.id)
          existing.evidence.push(evidence)
          if (name.split(' ').length > existing.name.split(' ').length) existing.name = name
          if (condition && !existing.condition) existing.condition = condition
        } else props.set(key, { name, sceneIds: [scene.id], evidence: [evidence], condition })
      }
    }
  }
  return [...props.values()]
}

const AGE_WORDS = 'young|teenage|teen|child|little|elderly|older|old|aged|adult|middle-aged|baby|infant'
const WEAR = /\b(?:wears?|wearing|dressed in|clad in|in a|in an|in the|puts? on|slips? into|changes? into)\s+(?:(?:an?|the|his|her|their)\s+)?([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3}?)(?=\s+(?:and|with|over|under|that|which|as|while|,)|[,.;:!?]|$)/i
const GARMENT = /\b(jacket|coat|dress|gown|suit|uniform|robe|shirt|blouse|tunic|cloak|cape|hoodie|sweater|armor|armour|vest|skirt|trousers|pants|jeans|scarf|hat|cap|helmet|boots|shoes|apron|poncho|kimono|sari|saree|gele|dashiki|overalls|costume|wetsuit|lab coat|jumpsuit)s?\b/i
const INJURY = /\b(wounded|injured|bleeding|bandaged|bandage|limping|limps?|bruised|scarred|burned|burnt|cut|gash|broken arm|broken leg|black eye|stitches|crutch|sling|cast)\b/i
const STATE = /\b(disguised as|disguised|in disguise|transforms?|transformed|becomes|turns into|possessed|glowing|ghostly|drenched|soaked|muddy|covered in (?:dust|mud|blood|ash|soot))\b/i

function addVariants(scenes: StoryScene[], characters: string[]): StoryVariant[] {
  const out: StoryVariant[] = []
  const seen = new Set<string>()
  const push = (v: StoryVariant) => {
    const key = `${v.character}|${v.kind}|${v.value.toLowerCase()}|${v.sceneId}`
    if (!seen.has(key)) { seen.add(key); out.push(v) }
  }
  for (const scene of scenes) {
    for (const act of scene.action) {
      let subject: string | undefined
      for (const sentence of act.text.split(/(?<=[.!?])\s+/)) {
        const named = characters.filter((c) => new RegExp(`\\b${escapeRx(c)}\\b`, 'i').test(sentence))
        // "He is bleeding." with no name belongs to the person the previous sentence was about (the one named first there).
        const pronoun = !named.length && subject && /^(?:he|she|they)\b/i.test(sentence.trim())
        const mentioned = pronoun ? [subject!] : named
        if (named.length) subject = [...named].sort((a, b) => sentence.search(new RegExp(`\\b${escapeRx(a)}\\b`, 'i')) - sentence.search(new RegExp(`\\b${escapeRx(b)}\\b`, 'i')))[0]
        if (!mentioned.length) continue
        const evidence = { line: act.line, text: sentence }
        for (const name of mentioned) {
          const n = escapeRx(name)
          const ageBefore = new RegExp(`\\b(${AGE_WORDS})\\s+${n}\\b`, 'i').exec(sentence)
          const ageParen = new RegExp(`\\b${n}\\s*\\(\\s*(?:age\\s+)?(\\d{1,3}s?|${AGE_WORDS})\\s*\\)`, 'i').exec(sentence)
          const ageIs = new RegExp(`\\b${n}\\b[^.]{0,20}?(?:,|\\()\\s*(?:age[sd]?\\s+)?(\\d{1,3})\\b`, 'i').exec(sentence)
          const age = ageBefore?.[1] ?? ageParen?.[1] ?? ageIs?.[1]
          if (age) push({ character: name, kind: 'age', value: /^\d/.test(age) ? `Age ${age}` : titleCase(age), sceneId: scene.id, evidence })
          // Wardrobe: only the sentence part that follows this character's name, so "Marcus watches Amina, who wears ..." is attributed correctly.
          const at = sentence.search(new RegExp(`\\b${n}\\b`, 'i'))
          const after = at >= 0 ? sentence.slice(at) : sentence
          const wear = WEAR.exec(after)
          if (wear && GARMENT.test(wear[1])) push({ character: name, kind: 'wardrobe', value: titleCase(wear[1].trim()), sceneId: scene.id, evidence })
          for (const m of after.matchAll(new RegExp(INJURY.source, 'gi'))) push({ character: name, kind: 'injury', value: titleCase(m[1]), sceneId: scene.id, evidence })
          for (const m of after.matchAll(new RegExp(STATE.source, 'gi'))) push({ character: name, kind: 'state', value: titleCase(m[1]), sceneId: scene.id, evidence })
        }
      }
    }
    // Cues such as "YOUNG AMINA" or "AMINA (OLD)" mark an age variant of one character.
    for (const d of scene.dialogue) {
      const m = new RegExp(`^(${AGE_WORDS})\\s+(.+)$`, 'i').exec(d.speaker)
      if (m && characters.some((c) => c.toUpperCase() === m[2].toUpperCase())) push({ character: characters.find((c) => c.toUpperCase() === m[2].toUpperCase())!, kind: 'age', value: titleCase(m[1]), sceneId: scene.id, evidence: { line: d.line, text: d.speaker } })
    }
  }
  return out
}

const COMMON = new Set('The She He They It As When Then After Before With Her His Their This That These Those There Here And But Soon Now Inside Outside Suddenly Later Meanwhile Behind Above Below Across Around Beside Beyond During While Still Just Every Each Both Some Many One Two Three All Any Not Yes Please Thank Finally Slowly Quietly Beneath Under Over Through Into Onto From For About Against Between Among Toward Towards Until Upon Within Without Also Even Only Once Maybe Perhaps Close Cut Fade Day Night Morning Evening Afternoon Dawn Dusk Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December God Lord Mr Mrs Ms Dr We You Your Our Its What Who Why How Which Where Whose Like Let Maybe Okay Well Oh Hey Look See Come Go Take Get Make Put Use Give Tell Ask Keep Hold Stand Sit Turn Walk Run Wait Stop Start Begin End Open Shut Pull Push Reach Raise Lower Hear Feel Think Know Want Need Try Help Find Leave Stay Move Bring Carry Pick Place Set Hands Eyes Her Him Them Us Me My Mine'.split(' '))
const ACTION_VERB = /^(?:is|was|walks?|runs?|looks?|turns?|stands?|sits?|moves?|enters?|exits?|crosses?|steps?|takes?|picks?|holds?|places?|opens?|closes?|reaches?|pulls?|pushes?|kneels?|smiles?|nods?|shakes?|stares?|watches?|listens?|falls?|rises?|lifts?|raises?|drops?|grabs?|leans?|laughs?|cries?|whispers?|says?|speaks?|asks?|replies?|feels?|thinks?|knows?|sees?|hears?|wants?|needs?|begins?|starts?|stops?|waits?|follows?|leads?|finds?|pauses?|hesitates?|frowns?|sighs?|grins?|prays?|bows?|has|have|does|did|can|will|would|then|climbs?|studies|carries|tells?|answers?|explains?|nervously|quietly|slowly|carefully)\b/i

/** Names that act in the description (Chloe walks, Chloe looks) but never speak under a cue. Needs repeated evidence; it is labelled so the writer can check it. */
function inferFromAction(scenes: StoryScene[], known: string[]): StoryCharacter[] {
  const skip = new Set(known.map((k) => k.toUpperCase()))
  for (const scene of scenes) for (const w of scene.setting.split(/[^A-Za-z']+/)) if (w) skip.add(w.toUpperCase().replace(/'S$/, ''))
  const stats = new Map<string, { total: number; acting: number; scenes: Set<string>; shown: string }>()
  for (const scene of scenes) {
    for (const act of scene.action) {
      for (const m of act.text.matchAll(/\b([A-Z][a-z]{2,})(?:'s)?(?=[\s,.;:!?)]|$)(.{0,18})/g)) {
        const name = m[1]
        if (COMMON.has(name) || skip.has(name.toUpperCase()) || /(?:ing|tion|ness|ment)$/.test(name)) continue
        const st = stats.get(name.toUpperCase()) ?? { total: 0, acting: 0, scenes: new Set<string>(), shown: name }
        st.total++
        if (ACTION_VERB.test(m[2].trim().replace(/^,\s*/, '')) || /^\s*,\s*(?:who|a|an|the|her|his)\b/.test(m[2])) st.acting++
        st.scenes.add(scene.id)
        stats.set(name.toUpperCase(), st)
      }
    }
  }
  return [...stats.values()].filter((st) => st.total >= 3 && st.acting >= 2).map((st) => ({ name: st.shown.toUpperCase(), sceneIds: [...st.scenes].sort(), firstSceneId: [...st.scenes].sort()[0], dialogueCount: 0, mentionCount: st.total, fromAction: true }))
}

export function parseStory(input: string): ParsedStory {
  const lines = input.replace(/\r/g, '').split('\n')
  const format = detectFormat(lines)
  const b: Builder = { scenes: [], warnings: [] }
  if (format === 'screenplay') readScreenplay(lines, b)
  else if (format === 'shotlist') readShotlist(lines, b)
  else if (format === 'lyrics') readLyrics(lines, b)
  else if (format === 'prose') readProse(lines, b)

  if (format === 'prose') b.warnings.push('No scene headings were found, so this was read as prose. Add INT./EXT. headings for the most accurate result.')
  if (format === 'screenplay' && lines.some((l, i) => i < lines.findIndex((x) => SLUG.test(clean(x).trim())) && clean(l).trim() && !/^\s*(?:title|credit|author|authors|source|draft date|date|contact|copyright|notes?)\s*:/i.test(clean(l)))) b.warnings.push('Text before the first scene heading (title page or notes) was not treated as story.')

  // Characters: dialogue speakers (age-modifier cues folded into the base character), then mentions in action.
  const base = new Map<string, StoryCharacter>()
  const ageCue = new RegExp(`^(?:${AGE_WORDS})\\s+(.+)$`, 'i')
  const speakers = new Set(b.scenes.flatMap((s) => s.dialogue.map((d) => d.speaker.toUpperCase())).filter((s) => s !== 'LYRIC'))
  for (const scene of b.scenes) {
    for (const d of scene.dialogue) {
      if (d.speaker === 'LYRIC') continue
      const key = ageCue.exec(d.speaker)?.[1] && speakers.has(ageCue.exec(d.speaker)![1].toUpperCase()) ? ageCue.exec(d.speaker)![1].toUpperCase() : d.speaker.toUpperCase()
      const existing = base.get(key)
      if (existing) { existing.dialogueCount++; if (!existing.sceneIds.includes(scene.id)) existing.sceneIds.push(scene.id) } else base.set(key, { name: format === 'prose' ? titleCase(key) : key, sceneIds: [scene.id], firstSceneId: scene.id, dialogueCount: 1, mentionCount: 0 })
    }
  }
  for (const c of base.values()) {
    const rx = new RegExp(`\\b${escapeRx(c.name)}\\b`, 'gi')
    for (const scene of b.scenes) {
      const hits = scene.action.reduce((n, a) => n + (a.text.match(rx)?.length ?? 0), 0)
      c.mentionCount += hits
      if (hits && !c.sceneIds.includes(scene.id)) c.sceneIds.push(scene.id)
    }
    c.sceneIds.sort()
  }
  const characters = [...base.values()]
  if (format === 'screenplay' || format === 'shotlist') characters.push(...inferFromAction(b.scenes, characters.map((c) => c.name)))
  if (!characters.length && b.scenes.length) b.warnings.push('No characters were found. Characters are read from speaker lines (CHLOE, or CHLOE: text) and from names that act in the description (Chloe walks…). Check how the script marks who is speaking.')
  const props = addProps(b.scenes)
  const variants = addVariants(b.scenes, characters.map((c) => c.name))
  if (!b.scenes.length && input.trim()) b.warnings.push('No scenes could be read from this text.')
  return { format, title: titleOf(lines), scenes: b.scenes, characters, props, variants, warnings: b.warnings }
}

function titleOf(lines: string[]): string | undefined {
  for (const raw of lines.slice(0, 12)) {
    const m = /^\s*title\s*:\s*(.+)$/i.exec(clean(raw))
    if (m) return m[1].trim()
  }
  return undefined
}

export { slug as storySlug, titleCase }
