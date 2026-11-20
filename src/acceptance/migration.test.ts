import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildProjectFile, parseProjectFile } from '../data/projectFile'
import { demoGraph } from '../domain/demoGraph'
import { readCamera } from '../domain/camera'
import { readLedgers } from '../domain/correction'
import { readFitRules } from '../domain/fit'
import { emptyLooks, readLooks } from '../domain/grade'
import { readLighting } from '../domain/lighting'
import { readProfiles } from '../domain/proportions'
import { readSceneStates } from '../domain/sceneState'
import { normalizeShots } from '../domain/shotRecords'
import { emptyReviews, readReviews } from '../domain/visualReview'
import { defaultWorld, readWorld } from '../domain/worldRules'
import { runAcceptance } from './flow'

const V052 = 'fixtures/acceptance/project-0.52.pone'
const files = {
  guy: 'fixtures/legacy/production-guy-0.9.pguy.json',
  v051: 'fixtures/legacy/project-0.51.2.pone',
  v052: V052,
}

// The 0.52 fixture is written once by the acceptance run (WRITE_FIXTURES=1 regenerates it, which should only be done on purpose).
if (process.env.WRITE_FIXTURES) {
  const run = await runAcceptance()
  mkdirSync('fixtures/acceptance', { recursive: true })
  writeFileSync(V052, JSON.stringify(buildProjectFile('Acceptance', demoGraph, run.project, '2026-11-20T00:00:00.000Z'), null, 2))
}

const open = (path: string) => { const parsed = parseProjectFile(readFileSync(path, 'utf8')); if (!parsed.ok) throw new Error(parsed.error); return parsed }

describe('every earlier version of a project opens', () => {
  it('has a real fixture for each version', () => { for (const f of Object.values(files)) expect(existsSync(f), f).toBe(true) })

  it('a legacy Production Guy file opens, is marked legacy and gets every new record at its default', () => {
    const p = open(files.guy)
    expect(p.legacy).toBe(true)
    expect(p.file.title).toBe('The Pier')
    const s = p.file.studio
    expect(s.analysis.assets.map((a) => a.name)).toEqual(['NORA', 'PIER OFFICE'])
    expect(s.proportions).toBeUndefined()
    expect(readProfiles(s.proportions)).toEqual({})
    expect(readFitRules(s.fitRules)).toEqual({})
    expect(readSceneStates(s.sceneStates)).toEqual({})
    expect(readReviews(s.reviews)).toEqual(emptyReviews())
    expect(readLedgers(s.corrections)).toEqual({})
    expect(readLooks(s.looks)).toEqual(emptyLooks())
    expect(readWorld(s.world)).toEqual(defaultWorld())
    const shots = normalizeShots(s.shots)
    expect(shots).toHaveLength(1)
    expect(shots[0].camera).toBeUndefined()
    expect(shots[0].lightingRecord).toBeUndefined()
    expect(shots[0]).toEqual(s.shots[0])
  })

  it('a 0.51.2 project opens as a current project with no new records and saves back unchanged', () => {
    const p = open(files.v051)
    expect(p.legacy).toBe(false)
    expect(p.file.studio.proportions).toBeUndefined()
    expect(normalizeShots(p.file.studio.shots)).toEqual(p.file.studio.shots)
    const again = JSON.parse(JSON.stringify(buildProjectFile(p.file.title, p.file.graph, p.file.studio, p.file.savedAt)))
    expect(again).toEqual(JSON.parse(readFileSync(files.v051, 'utf8')))
  })

  it('a 0.52 project (every new record) opens with all of them intact and round-trips exactly', () => {
    const p = open(files.v052)
    const s = p.file.studio
    expect(Object.keys(readProfiles(s.proportions))).toEqual(['MARCUS', 'AMINA'])
    expect(readProfiles(s.proportions)).toEqual(s.proportions)
    expect(readFitRules(s.fitRules)).toEqual(s.fitRules)
    expect(readSceneStates(s.sceneStates)).toEqual(s.sceneStates)
    expect(readReviews(s.reviews)).toEqual(s.reviews)
    expect(readLedgers(s.corrections)).toEqual(s.corrections)
    expect(readLooks(s.looks)).toEqual(s.looks)
    expect(readWorld(s.world)).toEqual(s.world)
    expect(normalizeShots(s.shots)).toEqual(s.shots)
    expect(JSON.parse(JSON.stringify(buildProjectFile(p.file.title, p.file.graph, s, p.file.savedAt)))).toEqual(JSON.parse(readFileSync(files.v052, 'utf8')))
  })

  it('a file from a newer app is refused with a clear message, not half-read', () => {
    const newer = JSON.parse(readFileSync(files.v052, 'utf8')); newer.version = 2
    const r = parseProjectFile(JSON.stringify(newer))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/newer Production One/)
  })
})

describe('missing and damaged fields take documented defaults', () => {
  it('every reader accepts nothing, junk and half-records without throwing', () => {
    for (const junk of [undefined, null, 42, 'x', [], {}, { nope: 1 }]) {
      expect(() => { readProfiles(junk); readFitRules(junk); readSceneStates(junk); readReviews(junk); readLedgers(junk); readLooks(junk); readWorld(junk); readLighting(junk); readCamera(junk); normalizeShots(junk) }).not.toThrow()
    }
    expect(readCamera({ height: 'moon', sensor: 'huge', distanceM: 1e9, dof: 'shallow' })).toEqual({ distanceM: 500, dof: 'shallow' })
    expect(readCamera({ height: 'moon' })).toBeUndefined()
    expect(readLighting({})).toMatchObject({ keyAzimuth: 0, keyElevation: 30, sourceSize: 'medium', contrast: 'medium', colorTempK: 5500, rim: false, exposure: 'normal' })
  })
  it('a shot with a damaged camera or lighting record opens, repaired or without it', () => {
    const shot = { ...open(files.guy).file.studio.shots[0], camera: { height: 'moon', dof: 'deep' }, lightingRecord: { keyAzimuth: 999, sourceSize: 'huge' } } as never
    const [s] = normalizeShots([shot])
    expect(s.camera).toEqual({ dof: 'deep' })
    expect(s.lightingRecord).toMatchObject({ keyAzimuth: 180, sourceSize: 'medium' })
    const [t] = normalizeShots([{ ...(shot as object), camera: 'junk', lightingRecord: 7 } as never])
    expect(t.camera).toBeUndefined()
    expect(t.lightingRecord).toBeUndefined()
  })
  it('world rules default to the metre convention with no starting profile', () => {
    expect(defaultWorld()).toEqual({ scaleConvention: 'metres' })
    expect(readWorld({ profile: { preset: 'rounded', stylization: 500 }, notes: 'x'.repeat(900) })).toEqual({ scaleConvention: 'metres', profile: { preset: 'rounded', stylization: 100 }, notes: 'x'.repeat(500) })
    expect(readWorld({ profile: { preset: 'nonsense', stylization: 5 } }).profile).toBeUndefined()
  })
})
