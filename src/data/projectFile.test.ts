import { describe, expect, it } from 'vitest'
import { demoGraph } from '../domain/demoGraph'
import { analyzeScript } from '../domain/productionStudio'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { buildProjectFile, parseProjectFile, suggestedFileName, titleFromFilePath } from './projectFile'

describe('naming the file names the production', () => {
  it('a new file name becomes the title; an unchanged one does not', () => {
    expect(titleFromFilePath('C:\\Users\\a\\Desktop\\No VIP in Hell.pone', 'Untitled production')).toBe('No VIP in Hell')
    expect(titleFromFilePath('/home/a/Untitled production.pone', 'Untitled production')).toBeUndefined()
    expect(titleFromFilePath('C:\\x\\.pone', 'T')).toBeUndefined()
  })
})

const script = 'EXT. SAVANNA - DUSK\nAMINA\nWe are close.'
const studio = () => ({ script, analysis: analyzeScript(script), shots: [], jobs: [], storyboardsEnabled: false, model: 'Seedance 2.0' as const, assetOutputs: {}, styleBible: defaultStyleBible })

describe('project files', () => {
  it('round-trips a native .pone project exactly', () => {
    const file = buildProjectFile('Test', structuredClone(demoGraph), studio(), '2026-10-21T00:00:00.000Z')
    const parsed = parseProjectFile(JSON.stringify(file))
    expect(parsed.ok && parsed.legacy).toBe(false)
    expect(parsed.ok && parsed.file).toEqual(file)
  })
  it('opens a legacy Production Guy export without losing its content', () => {
    const s = studio()
    const parsed = parseProjectFile(JSON.stringify({ analysis: s.analysis, shots: s.shots, jobs: s.jobs, graph: demoGraph }))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.legacy).toBe(true)
      expect(parsed.file.studio.analysis).toEqual(s.analysis)
      expect(parsed.file.graph).toEqual(demoGraph)
    }
  })
  it('opens a legacy production-state file that carries its script', () => {
    const parsed = parseProjectFile(JSON.stringify(studio()))
    expect(parsed.ok && parsed.file.studio.script).toContain('SAVANNA')
  })
  it('rejects bad input with a readable message instead of throwing', () => {
    for (const text of ['not json', '[]', '{}', JSON.stringify({ format: 'production-one-project', version: 9 })]) {
      const parsed = parseProjectFile(text)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.error.length).toBeGreaterThan(10)
    }
  })
  it('makes safe file names', () => {
    expect(suggestedFileName('A/B: "Film"?')).toBe('A B Film.pone')
    expect(suggestedFileName('   ')).toBe('Untitled production.pone')
  })

  it('keeps the project format (for example 9:16) through a save and an open, and reads older projects as widescreen', () => {
    const studio = { script: '', analysis: analyzeScript('Title: T'), shots: [], jobs: [], storyboardsEnabled: false, model: 'Seedance 2.0' as const, styleBible: defaultStyleBible, format: '9:16' }
    const parsed = parseProjectFile(JSON.stringify(buildProjectFile('Reel', structuredClone(demoGraph), studio)))
    expect(parsed.ok && parsed.file.studio.format).toBe('9:16')
    const older = parseProjectFile(JSON.stringify(buildProjectFile('Old', structuredClone(demoGraph), { ...studio, format: undefined })))
    expect(older.ok && older.file.studio.format).toBeUndefined()
  })
})
