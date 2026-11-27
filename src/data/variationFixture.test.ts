import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { demo2DProject, styleByName } from '../domain/demo2d'
import { buildProjectFile, parseProjectFile } from './projectFile'
import { emptyQueue, type ImageJob } from '../domain/generationQueue'
import { deriveFromLegacy, variationsOf } from '../domain/variationMigration'
import { approveRevision, createEntity, emptyVariations } from '../domain/variations'
import { validateVariations } from '../domain/variationGraph'
import type { StoryVariant } from '../engine/story'

// A project written by 0.65.1, before variations existed: one character with a costume asset, an approved base picture, an approved age variant
// and a costume-change variant that was never approved. WRITE_FIXTURES=1 regenerates it, which should only ever be done on purpose.
const FILE = 'fixtures/legacy/project-0.65.1-variants.pone'
const OLD = 'fixtures/legacy/project-0.51.2.pone'

const job = (over: Partial<ImageJob>): ImageJob => ({
  id: 'j', key: 'k', assetId: 'DEMO-CHAR-001', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false,
  outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 1, updatedAt: 1, ...over,
})

function build() {
  const base = demo2DProject(styleByName('Clean digital cel animation'))
  const s = base.studio
  const assets = [...s.analysis.assets, { id: 'DEMO-COST-001', name: 'Mira costume', type: 'costume' as const, sceneIds: [], status: 'approved' as const, description: 'A long navy coat with brass buttons and a patched satchel.' }]
  const variants = [
    { character: 'Mira', kind: 'age', value: 'Age 65', sceneId: 'SCENE-002', evidence: { sceneId: 'SCENE-002', line: 1, text: 'MIRA (65)' } },
    { character: 'Mira', kind: 'wardrobe', value: 'Storm coat', sceneId: 'SCENE-003', evidence: { sceneId: 'SCENE-003', line: 4, text: 'in a storm coat' } },
  ] as unknown as StoryVariant[]
  const queue = {
    ...emptyQueue(),
    jobs: [
      job({ id: 'J1', approved: true, outputPath: 'assets/mira_front.jpg' }),
      job({ id: 'J2', variant: 'Age 65', approved: true, outputPath: 'assets/mira_65_front.jpg' }),
      job({ id: 'J3', variant: 'Storm coat', status: 'needs-review', outputPath: 'assets/mira_storm_front.jpg' }),
      job({ id: 'J4', assetId: 'DEMO-COST-001', sheetType: 'Wardrobe', approved: true, outputPath: 'assets/mira_costume.jpg' }),
    ],
  }
  return buildProjectFile('Variation fixture 0.65.1', base.graph, { ...s, analysis: { ...s.analysis, assets, story: { variants } as never }, queue }, '2026-11-27T00:00:00.000Z')
}

if (process.env.WRITE_FIXTURES) writeFileSync(FILE, JSON.stringify(build(), null, 2))

const open = (path: string) => {
  const parsed = parseProjectFile(readFileSync(path, 'utf8'))
  if (!parsed.ok) throw new Error(`fixture ${path} did not open: ${parsed.error}`)
  return parsed.file
}
const queueVariant = (e: { revisions: Array<{ spec: unknown }> }) => (e.revisions[0].spec as { queueVariant: string }).queueVariant

describe('a project saved before variations existed', () => {
  it('has the fixture on disk', () => { expect(existsSync(FILE)).toBe(true) })

  it('opens untouched, and saving it again adds nothing', () => {
    const text = readFileSync(FILE, 'utf8')
    const file = open(FILE)
    expect(file.studio.variations).toBeUndefined()
    const resaved = JSON.parse(JSON.stringify(buildProjectFile(file.title, file.graph, file.studio, file.savedAt)))
    expect(resaved).toEqual(JSON.parse(text))
  })

  it('keeps its characters, approvals and pictures exactly as they were', () => {
    const file = open(FILE)
    const before = JSON.stringify(file.studio)
    variationsOf(file.studio)
    expect(JSON.stringify(file.studio)).toBe(before)
    expect((file.studio.queue?.jobs ?? []).filter((j) => j.approved).map((j) => j.id)).toEqual(['J1', 'J2', 'J4'])
  })

  it('derives one garment per costume asset, with its description, picture and approval', () => {
    const garments = variationsOf(open(FILE).studio).entities.filter((e) => e.kind === 'garment')
    expect(garments).toHaveLength(1)
    expect(garments[0]).toMatchObject({ id: 'GAR-L-DEMO-COST-001', characterId: 'DEMO-CHAR-001', name: 'Mira costume' })
    const r = garments[0].revisions[0]
    expect(r.status).toBe('approved')
    expect((r.spec as { description: string }).description).toMatch(/navy coat/)
    expect(r.media.map((m) => m.path)).toEqual(['assets/mira_costume.jpg'])
    expect(r.legacy?.source).toBe('costume-asset')
  })

  it('derives one look per variant name already in use, approved only where a picture was approved', () => {
    const looks = variationsOf(open(FILE).studio).entities.filter((e) => e.kind === 'look' && e.characterId === 'DEMO-CHAR-001')
    expect(Object.fromEntries(looks.map((l) => [queueVariant(l), l.revisions[0].status]))).toEqual({ Canonical: 'approved', 'Age 65': 'approved', 'Storm coat': 'candidate' })
    const age = looks.find((l) => queueVariant(l) === 'Age 65')
    expect((age?.revisions[0].spec as { sceneIds?: string[] }).sceneIds).toEqual(['SCENE-002'])
  })

  it('derives the same records, with the same ids, every time, and they are internally consistent', () => {
    const file = open(FILE)
    const a = deriveFromLegacy(file.studio)
    expect(deriveFromLegacy(structuredClone(file.studio))).toEqual(a)
    expect(validateVariations(a)).toEqual([])
  })

  it('prefers the saved records once variations exist', () => {
    const saved = { schema: 1 as const, entities: [], counters: {} }
    expect(variationsOf({ ...open(FILE).studio, variations: saved })).toBe(saved)
  })

  it('reads the 0.51.2 fixture too: no costume, so only a Canonical look per character', () => {
    const v = variationsOf(open(OLD).studio)
    expect(v.entities.filter((e) => e.kind === 'garment')).toHaveLength(0)
    expect(v.entities.filter((e) => e.kind === 'look').every((l) => queueVariant(l) === 'Canonical')).toBe(true)
  })

  it('saves new variation records with the project and reads them back unchanged', () => {
    const file = open(FILE)
    let v = emptyVariations()
    const g = createEntity(v, 'garment', { name: 'Field jacket', spec: { description: 'waxed cotton' }, now: '2026-11-27T00:00:00.000Z' })
    v = approveRevision(g.state, g.ref)
    const saved = JSON.stringify(buildProjectFile(file.title, file.graph, { ...file.studio, variations: v }, file.savedAt))
    const back = parseProjectFile(saved)
    expect(back.ok && back.file.studio.variations).toEqual(v)
    expect(back.ok && variationsOf(back.file.studio)).toEqual(v)
  })
})
