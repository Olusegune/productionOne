import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { demo2DProject, demo2DRequests, styleByName } from '../domain/demo2d'
import { buildProjectFile, parseProjectFile } from './projectFile'
import { readProfiles } from '../domain/proportions'

// The fixtures were written once by the 0.51.2 code (WRITE_FIXTURES=1 regenerates them, which should only ever be done on purpose).
const DIR = 'fixtures/legacy'
const PROJECT = `${DIR}/project-0.51.2.pone`
const PROMPTS = `${DIR}/prompts-0.51.2.json`
const style = styleByName('Clean digital cel animation')

if (process.env.WRITE_FIXTURES) {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(PROJECT, JSON.stringify(demo2DProject(style), null, 2))
  writeFileSync(PROMPTS, JSON.stringify(demo2DRequests(style).map(({ assetId, sheetType, viewKey, prompt }) => ({ assetId, sheetType, viewKey, prompt })), null, 2))
}

describe('a project saved before proportion profiles existed', () => {
  it('has fixtures on disk', () => { expect(existsSync(PROJECT) && existsSync(PROMPTS)).toBe(true) })

  it('opens as a current-format project with no profiles, and saving it again adds none', () => {
    const parsed = parseProjectFile(readFileSync(PROJECT, 'utf8'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.legacy).toBe(false)
    expect(parsed.file.studio.proportions).toBeUndefined()
    expect(readProfiles(parsed.file.studio.proportions)).toEqual({})
    const resaved = JSON.parse(JSON.stringify(buildProjectFile(parsed.file.title, parsed.file.graph, parsed.file.studio, parsed.file.savedAt)))
    expect(resaved).toEqual(JSON.parse(readFileSync(PROJECT, 'utf8')))
  })

  it('renders every prompt exactly as before (golden snapshot)', () => {
    const golden = JSON.parse(readFileSync(PROMPTS, 'utf8')) as Array<{ assetId: string; sheetType: string; viewKey: string; prompt: string }>
    const now = demo2DRequests(style).map(({ assetId, sheetType, viewKey, prompt }) => ({ assetId, sheetType, viewKey, prompt }))
    expect(golden.length).toBeGreaterThan(10)
    expect(now).toEqual(golden)
  })
})
