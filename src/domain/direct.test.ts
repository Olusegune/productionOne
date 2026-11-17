import { describe, expect, it } from 'vitest'
import { buildShotPrompt, checkContinuity, estimateDuration, frameForShot, lightingFor, planCoverage, replanScene, shotListCsv, shotListMarkdown, shotReferences, sizeLabels } from './direct'
import { addSupplied, emptyQueue, enqueue, type QueueState } from './generationQueue'
import { analyzeScript } from './productionStudio'
import { defaultStyleBible } from './visualDevelopment'
import { sampleStory } from '../engine/sampleStory'

const analysis = analyzeScript(sampleStory)
const shots = planCoverage(analysis)
const asset = (name: string) => analysis.assets.find((a) => a.name === name)!

describe('coverage planning', () => {
  it('plans every scene starting with the place, then a master with everyone in it', () => {
    expect(shots.length).toBeGreaterThan(8)
    const first = shots.filter((s) => s.sceneId === 'SCENE-001')
    expect(first[0]).toMatchObject({ coverage: 'establishing', size: 'EWS' })
    expect(first[1].coverage).toBe('master')
    expect(first[1].assetIds).toContain(asset('AMINA').id)
    expect(new Set(shots.map((s) => s.id)).size).toBe(shots.length)
    expect(shots.map((s) => s.order)).toEqual(shots.map((_, i) => i + 1))
  })
  it('covers dialogue and gives each speaker one side of the line', () => {
    const talk = shots.filter((s) => s.sceneId === 'SCENE-001' && s.dialogue)
    expect(talk.map((s) => s.speaker)).toEqual(['AMINA', 'MARCUS', 'AMINA'])
    const dirs = new Map(talk.map((s) => [s.speaker, s.screenDir]))
    expect(dirs.get('AMINA')).toBe('L>R')
    expect(dirs.get('MARCUS')).toBe('R>L')
    expect(talk.find((s) => s.speaker === 'MARCUS')!.emotion).toBe('fear')
  })
  it('adds an insert for a prop with a stated condition and a close-up for strong feeling', () => {
    expect(shots.some((s) => s.coverage === 'insert' && /cracked solar compass/.test(s.title ?? ''))).toBe(true)
    const kofi = shots.find((s) => s.speaker === 'KOFI')!
    expect(kofi.size).toBe('CU')
    expect(kofi.cameraFraming).toBe(sizeLabels.CU)
    expect(kofi.lens).toBe(85)
  })
  it('fills the classic shot fields so the video compiler still works', () => {
    for (const s of shots) {
      expect(s.cameraFraming.length).toBeGreaterThan(2)
      expect(s.lighting.length).toBeGreaterThan(5)
      expect(s.duration).toBeGreaterThanOrEqual(2)
      expect(s.storyboardStatus).toBe('planned')
    }
  })
  it('estimates dialogue time and lights by time of day', () => {
    expect(estimateDuration('We are close.')).toBe(2)
    expect(estimateDuration('word '.repeat(60))).toBe(10)
    expect(lightingFor('NIGHT', 'INT')).toMatch(/practical/i)
    expect(lightingFor('DAWN', 'EXT')).toMatch(/low warm sun/i)
  })
})

describe('continuity checks', () => {
  it('warns about characters with no approved reference, and stops once one is approved', () => {
    const before = checkContinuity(shots, analysis, emptyQueue())
    expect(before.some((f) => /AMINA has no approved reference/.test(f.message))).toBe(true)
    const q = addSupplied(emptyQueue(), { assetId: asset('AMINA').id, variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', aspect: '3:4', fullBody: true, path: 'C:/a.png', width: 1, height: 1 }).state
    expect(checkContinuity(shots, analysis, q).some((f) => /AMINA has no approved reference/.test(f.message))).toBe(false)
  })
  it('flags a camera that crosses the line between two shots of the same person', () => {
    const talk = shots.filter((s) => s.sceneId === 'SCENE-001' && s.speaker === 'AMINA')
    const flipped = talk.map((s, i) => (i === 1 ? { ...s, screenDir: 'R>L' as const } : s))
    expect(checkContinuity(flipped, analysis, emptyQueue()).some((f) => /crosses the line/.test(f.message))).toBe(true)
    expect(checkContinuity(talk, analysis, emptyQueue()).some((f) => /crosses the line/.test(f.message))).toBe(false)
  })
  it('flags a look that disagrees with what the script says for that scene', () => {
    const s = shots.find((x) => x.sceneId === 'SCENE-001' && x.speaker === 'MARCUS')!
    const wrong = { ...s, looks: { [asset('MARCUS').id]: 'Blue Raincoat' } }
    expect(checkContinuity([wrong], analysis, emptyQueue()).some((f) => /Blue Raincoat/.test(f.message))).toBe(true)
  })
})

describe('frames, references and prompts', () => {
  const approvedFor = (name: string, path: string): QueueState => addSupplied(emptyQueue(), { assetId: asset(name).id, variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', aspect: '3:4', fullBody: true, path, width: 1, height: 1 }).state
  it('collects the approved anchors of the people in the shot in a fixed order, and falls back to your own photo', () => {
    const master = shots.find((s) => s.sceneId === 'SCENE-001' && s.coverage === 'master')!
    const refs = shotReferences(master, analysis, approvedFor('AMINA', 'C:/amina.png'), { [asset('MARCUS').id]: ['C:/marcus-photo.png'] })
    expect(refs.map((r) => r.label)).toEqual(['AMINA', 'MARCUS (your photo)'])
  })
  it('names the references in the prompt and carries the camera, feeling and direction', () => {
    const marcus = shots.find((s) => s.speaker === 'MARCUS')!
    const refs = shotReferences(marcus, analysis, approvedFor('MARCUS', 'C:/m.png'))
    const prompt = buildShotPrompt(marcus, analysis, defaultStyleBible, refs)
    expect(prompt).toContain('1 = MARCUS')
    expect(prompt).toContain('85mm'.replace('85', String(marcus.lens)))
    expect(prompt).toMatch(/Feeling: fear/)
    expect(prompt).toMatch(/faces left/)
    expect(prompt).toContain('No text')
  })
  it('shows the approved frame in the animatic, else the newest image', () => {
    let q = enqueue(emptyQueue(), [{ assetId: 'SHOT-001', variant: 'Storyboard', sheetType: 'Storyboard', viewKey: 'frame', label: 'f', prompt: 'p', aspect: '16:9', fullBody: false, provider: 'kie', model: 'm', references: [], outputName: (r) => `s${r}` }]).state
    expect(frameForShot(q, 'SHOT-001')).toBeUndefined()
    q = { ...q, jobs: q.jobs.map((j) => ({ ...j, outputPath: 'C:/frame.png', status: 'needs-review' as const })) }
    expect(frameForShot(q, 'SHOT-001')?.outputPath).toBe('C:/frame.png')
  })
  it('replans a scene but keeps shots whose frames you approved', () => {
    const keepId = shots.find((s) => s.sceneId === 'SCENE-002' && s.coverage === 'master')!.id
    const q = addSupplied(emptyQueue(), { assetId: keepId, variant: 'Storyboard', sheetType: 'Storyboard', viewKey: 'frame', label: 'f', aspect: '16:9', fullBody: false, path: 'C:/f.png', width: 1, height: 1 }).state
    const again = replanScene(shots, analysis, 'SCENE-002', q)
    expect(again.some((s) => s.id === keepId)).toBe(true)
    expect(new Set(again.map((s) => s.id)).size).toBe(again.length)
    expect(again.filter((s) => s.sceneId === 'SCENE-001').length).toBe(shots.filter((s) => s.sceneId === 'SCENE-001').length)
  })
  it('replanning twice does not draw a kept shot a second time, and refreshes what is written about it', () => {
    const kept = shots.filter((s) => s.sceneId === 'SCENE-002')
    let q = emptyQueue()
    for (const k of kept) q = addSupplied(q, { assetId: k.id, variant: 'Storyboard', sheetType: 'Storyboard', viewKey: 'frame', label: 'f', aspect: '16:9', fullBody: false, path: 'C:/f.png', width: 1, height: 1 }).state
    const stale = shots.map((s) => (s.sceneId === 'SCENE-002' ? { ...s, action: 'old words' } : s))
    const again = replanScene(stale, analysis, 'SCENE-002', q)
    expect(again.filter((s) => s.sceneId === 'SCENE-002')).toHaveLength(kept.length)
    expect(again.filter((s) => s.sceneId === 'SCENE-002').every((s) => s.action !== 'old words')).toBe(true)
    expect(replanScene(again, analysis, 'SCENE-002', q)).toHaveLength(again.length)
  })
})

describe('shot list exports', () => {
  it('writes a CSV with a header row and quotes embedded quotes, and a readable Markdown list', () => {
    const csv = shotListCsv(shots, analysis.scenes)
    expect(csv.split('\r\n')[0].startsWith('"Shot","Scene"')).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(shots.length + 1)
    const md = shotListMarkdown('The Last Horizon', shots, analysis.scenes)
    expect(md).toContain('## EXT. SAVANNA - DUSK')
    expect(md).toContain('Establishing')
  })
})

describe('voices that are heard, not seen', () => {
  it('a PA VOICE or a recording is not cast in the master shot and does not get its own side of the line', () => {
    const script = ['SCENE 1 — INT. OFFICE — NIGHT', '', 'FLEX', 'Hello.', '', 'PA VOICE', 'Please keep your belongings with you.', '', 'VENOMSPUR', 'Sit down.'].join(String.fromCharCode(10))
    const a = analyzeScript(script)
    const plan = planCoverage(a)
    const master = plan.find((x) => x.coverage === 'master')!
    const names = master.assetIds.map((id) => a.assets.find((x) => x.id === id)?.name)
    expect(names).toContain('FLEX')
    expect(names).toContain('VENOMSPUR')
    expect(names).not.toContain('PA VOICE')
  })
})
