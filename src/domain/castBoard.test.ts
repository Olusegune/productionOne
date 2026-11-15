import { describe, expect, it } from 'vitest'
import { evidenceFor, keepSelection, looksOf, scenesOf, typeName, typeTint } from './castBoard'
import { analyzeScript, type ExtractedAsset } from './productionStudio'

const SCRIPT = [
  'Title: Test',
  '',
  'EXT. SAVANNA - DUSK',
  '',
  'AMINA (30s), a weathered explorer, stands at the ridge. She holds the cracked solar compass.',
  '',
  'AMINA',
  'We are close.',
  '',
  'MARCUS',
  'I am afraid.',
  '',
  'INT. CLIFF BEDROOM - NIGHT',
  '',
  'MARCUS, her brother, wearing a torn navy coat, limps in.',
  '',
].join('\n')
const analysis = analyzeScript(SCRIPT)
const story = analysis.story
const byName = (n: string): ExtractedAsset => analysis.assets.find((a) => a.name.toUpperCase() === n)!

describe('evidence for an asset', () => {
  it('uses the first description line that names a character', () => {
    const e = evidenceFor(byName('AMINA'), story)
    expect(e.kind).toBe('description')
    expect(e.text).toMatch(/weathered explorer/)
    expect(typeof e.line).toBe('number')
  })
  it('falls back to a first line of dialogue, then to the scene heading', () => {
    const lone: ExtractedAsset = { id: 'X', name: 'ZED', type: 'character', sceneIds: [], status: 'planned' }
    expect(evidenceFor(lone, story).kind).toBe('none')
    const onlySpeaks = analyzeScript('EXT. HILL - DAY\n\nBO\nHello there.\n')
    const bo = onlySpeaks.assets.find((a) => a.name === 'BO')!
    expect(evidenceFor(bo, onlySpeaks.story).kind).toBe('dialogue')
  })
  it('uses the line the reader found a prop on', () => {
    const prop = analysis.assets.find((a) => a.type === 'prop')
    if (prop) expect(evidenceFor(prop, story).kind).toBe('prop')
  })
  it('uses the first scene heading for a set', () => {
    const set = analysis.assets.find((a) => a.type === 'set')!
    const e = evidenceFor(set, story)
    expect(e.kind).toBe('scene')
    expect(e.text).toMatch(/SAVANNA|CLIFF/)
  })
  it('says nothing when there is no reading', () => {
    expect(evidenceFor(byName('AMINA'), undefined)).toEqual({ text: '', kind: 'none' })
  })
  it('shortens a very long line instead of showing a wall of text', () => {
    const long = analyzeScript(`EXT. HILL - DAY\n\nKIT stands ${'and waits '.repeat(60)}.\n`)
    const kit = long.assets.find((a) => a.name === 'KIT')
    if (kit) expect(evidenceFor(kit, long.story).text.length).toBeLessThanOrEqual(221)
  })
})

describe('scenes and looks', () => {
  it('lists only the scenes linked to the asset, in order', () => {
    const marcus = scenesOf(byName('MARCUS'), story)
    expect(marcus.map((s) => s.number)).toEqual([...marcus.map((s) => s.number)].sort((a, b) => a - b))
    expect(marcus.length).toBeGreaterThan(0)
    expect(scenesOf(byName('MARCUS'), undefined)).toEqual([])
  })
  it('lists a character looks (ages, costumes) and nothing for other kinds', () => {
    expect(looksOf(byName('AMINA'), story).some((v) => v.kind === 'age')).toBe(true)
    const set = analysis.assets.find((a) => a.type === 'set')!
    expect(looksOf(set, story)).toEqual([])
  })
})

describe('selection and names', () => {
  const list = analysis.assets
  it('keeps the selected asset while it exists, else the first, else none', () => {
    expect(keepSelection(list, list[2].id)).toBe(list[2].id)
    expect(keepSelection(list, 'gone')).toBe(list[0].id)
    expect(keepSelection(list, null)).toBe(list[0].id)
    expect(keepSelection([], 'x')).toBeNull()
  })
  it('has a name and a tint for every kind of asset', () => {
    for (const t of ['character', 'costume', 'prop', 'set', 'environment'] as const) { expect(typeName[t]).toBeTruthy(); expect(typeTint[t]).toMatch(/^var\(--tint-/) }
  })
})
