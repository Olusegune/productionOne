/**
 * Turns the files writers really have into the plain screenplay text the story reader understands: Final Draft (.fdx), Fountain, and the loose text that comes out of Word
 * and PDF (where the blank lines that separate elements are often lost). The writer's words are never changed, only the layout around them.
 */

export interface Converted { text: string; notes: string[] }

const TYPE_ORDER = ['Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Transition', 'Shot', 'General']

/** Final Draft XML to screenplay text. Dual dialogue is flattened in reading order. */
export function fdxToScreenplay(xml: string): Converted {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror') || !doc.querySelector('FinalDraft, Content')) throw new Error('That does not look like a Final Draft (.fdx) file.')
  const notes: string[] = []
  const lines: string[] = []
  const title = [...doc.querySelectorAll('TitlePage Paragraph')].map((p) => text(p)).find((t) => t.trim())
  if (title) lines.push(`Title: ${title.trim()}`, '')
  const paragraphs = [...doc.querySelectorAll('Content Paragraph')]
  let previous = ''
  for (const p of paragraphs) {
    const type = p.getAttribute('Type') ?? 'Action'
    const t = text(p).trim()
    if (!t) continue
    if (!TYPE_ORDER.includes(type)) notes.push(`Skipped an element of type ${type}.`)
    const needsBlank = type === 'Scene Heading' || type === 'Character' || (type === 'Action' && previous !== 'Action') || type === 'Transition' || type === 'Shot' || type === 'General'
    if (needsBlank && lines.length && lines[lines.length - 1] !== '') lines.push('')
    if (type === 'Scene Heading') lines.push(t.toUpperCase())
    else if (type === 'Character') lines.push(t.toUpperCase())
    else if (type === 'Parenthetical') lines.push(/^\(.*\)$/.test(t) ? t : `(${t.replace(/^\(|\)$/g, '')})`)
    else if (type === 'Transition') lines.push(t.toUpperCase())
    else lines.push(t)
    previous = type
  }
  if (!paragraphs.length) notes.push('The file had no script paragraphs.')
  return { text: lines.join('\n').trim() + '\n', notes }
}

function text(el: Element): string {
  return [...el.querySelectorAll('Text')].map((t) => t.textContent ?? '').join('')
}

/** Fountain to plain screenplay text: drops notes, boneyard, synopses, sections and page breaks, and unwraps forced elements. */
export function fountainClean(input: string): Converted {
  const notes: string[] = []
  let t = input.replace(/\r/g, '').replace(/^﻿/, '')
  if (/\/\*[\s\S]*?\*\//.test(t)) { t = t.replace(/\/\*[\s\S]*?\*\//g, ''); notes.push('Removed boneyard (/* … */) text.') }
  if (/\[\[[\s\S]*?\]\]/.test(t)) { t = t.replace(/\[\[[\s\S]*?\]\]/g, ''); notes.push('Removed [[notes]].') }
  const out: string[] = []
  for (const raw of t.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (/^\s*#{1,6}\s/.test(line)) continue // sections
    if (/^\s*=(?!==)\s?/.test(line) && !/^={3,}$/.test(line.trim())) continue // synopses
    if (/^={3,}$/.test(line.trim())) continue // page break
    const centered = /^\s*>\s*(.+?)\s*<\s*$/.exec(line)
    if (centered) { out.push(centered[1]); continue }
    if (/^!(?!\s)/.test(line)) { out.push(line.slice(1)); continue } // forced action
    if (/^~/.test(line)) { out.push(line.replace(/^~\s?/, '')); continue } // lyrics keep their words
    out.push(line)
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', notes }
}

const SLUG = /^(?:INT|EXT|INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\s*\/\s*E)[.\s]/i
const CUE = /^[A-Z][A-Z0-9 .'’-]{0,34}(?:\s*\((?:V\.?O\.?|O\.?S\.?|CONT'?D)\))?$/
const TRANSITION = /\bTO:$|^FADE (?:IN|OUT)|^THE END$/

/**
 * Word and PDF text often arrives one element per line with no blank lines between them. Blank lines are put back where a screenplay has them (before scene headings, before
 * character cues and before action that follows dialogue) so the reader sees the same structure the writer typed. Text that already has blank lines is left alone.
 */
export function restoreBlankLines(input: string): Converted {
  const lines = input.replace(/\r/g, '').trim().split('\n').map((l) => l.replace(/^\s+|\s+$/g, ''))
  const nonBlank = lines.filter(Boolean).length
  const blanks = lines.length - nonBlank
  if (nonBlank === 0) return { text: '', notes: [] }
  if (blanks / nonBlank > 0.12) return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', notes: [] }
  const out: string[] = []
  let inDialogue = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!l) { inDialogue = false; if (out[out.length - 1] !== '') out.push(''); continue }
    const isSlug = SLUG.test(l)
    const isCue = !isSlug && !TRANSITION.test(l) && CUE.test(l) && l === l.toUpperCase() && !!lines[i + 1] && !SLUG.test(lines[i + 1])
    if (isSlug || isCue || (inDialogue && /^\(.*\)$/.test(l) === false && !/^[a-z"'(“]/.test(l) && /^[A-Z]/.test(l) && l.length > 3 && false)) { if (out.length && out[out.length - 1] !== '') out.push('') }
    out.push(l)
    inDialogue = isCue ? true : isSlug ? false : inDialogue
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', notes: ['Blank lines were put back between the elements of this script.'] }
}

export type ScriptKind = 'text' | 'fdx' | 'docx' | 'pdf'

export function convertScript(kind: ScriptKind, raw: string): Converted {
  if (kind === 'fdx') return fdxToScreenplay(raw)
  if (kind === 'docx' || kind === 'pdf') return restoreBlankLines(fountainClean(raw).text)
  return fountainClean(raw)
}
