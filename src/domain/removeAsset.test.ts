import { describe, expect, it } from 'vitest'
import { describeRemoval, removeAsset, type ProjectSlice } from './removeAsset'
import { emptyQueue, enqueue, approve } from './generationQueue'
import { createProfile } from './proportions'
import { addThing, assignOwner, emptySceneState, seat } from './sceneState'
import { emptyReviews, recordReview, type Finding } from './visualReview'
import type { ExtractedAsset, ShotRecord } from './productionStudio'

const a = (id: string, name: string, type: ExtractedAsset['type']): ExtractedAsset => ({ id, name, type, sceneIds: ['SC-1'], status: 'planned' })
const shot = (id: string, assetIds: string[], extra: Partial<ShotRecord> = {}): ShotRecord => ({ id, sceneId: 'SC-1', order: 1, duration: 4, assetIds, action: '', dialogue: '', speaker: '', emotionalObjective: '', facialActing: '', bodyLanguage: '', microAnimation: '', cameraFraming: '', cameraMovement: '', lighting: '', soundEffects: '', ambience: '', music: '', transition: 'Cut', storyboardStatus: 'planned', ...extra })

function project(): ProjectSlice {
  let queue = enqueue(emptyQueue(), [
    { assetId: 'MARCUS', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: (r) => `m_front_${r}` },
    { assetId: 'MARCUS', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'side', label: 'Side', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: (r) => `m_side_${r}` },
    { assetId: 'AMINA', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: (r) => `a_front_${r}` },
  ], 1, false).state
  queue = { ...queue, jobs: queue.jobs.map((j) => ({ ...j, status: 'needs-review', outputPath: `C:/out/${j.outputName}.png` })) }
  queue = approve(queue, queue.jobs[0].id, 5)
  let scene = emptySceneState('SC-1')
  scene = addThing(scene, { id: 'CHAIR', kind: 'furniture', name: 'Chair', x: 1, y: 1, facing: 0 })
  scene = addThing(scene, { id: 'MARCUS', kind: 'character', name: 'MARCUS', x: 0, y: 0, facing: 0 })
  scene = addThing(scene, { id: 'AMINA', kind: 'character', name: 'AMINA', x: 3, y: 3, facing: 0 })
  scene = assignOwner(scene, 'CHAIR', 'MARCUS')
  const sat = seat(scene, 'MARCUS', 'CHAIR'); if (!sat.ok) throw new Error(sat.error); scene = sat.state
  const finding = (id: string, target: string, job: string): Finding => ({ id, targetId: target, outputJobId: job, outputRevision: 1, category: 'B', severity: 'low', confidence: 1, expected: '', observed: '', sourceRule: '', suggestedAction: '', source: 'deterministic', status: 'open' })
  const reviews = recordReview(recordReview(emptyReviews(), queue.jobs[0].id, 'deterministic', [finding('F1', 'MARCUS', queue.jobs[0].id)], ['B']), queue.jobs[2].id, 'deterministic', [finding('F2', 'AMINA', queue.jobs[2].id)], ['B'])
  return {
    analysis: { scenes: [{ id: 'SC-1', heading: 'INT.', setting: 'X', timeOfDay: 'DAY', assetIds: ['MARCUS', 'AMINA'] } as never], assets: [a('MARCUS', 'MARCUS', 'character'), a('MANU-CHAR-002-X', 'AMINA', 'character'), a('SET-1', 'KITCHEN', 'set')] },
    queue, assetOutputs: { MARCUS: 'C:/out/m_front_1.png', AMINA: 'C:/out/a.png' }, assetRefs: { MARCUS: ['C:/p/marcus.png'], AMINA: ['C:/p/amina.png'] },
    proportions: { MARCUS: createProfile('MARCUS'), AMINA: createProfile('AMINA') }, fitRules: { MARCUS: [], AMINA: [] },
    sheetNotes: { MARCUS: 'n1', AMINA: 'n2' }, sheetSettings: { 'MARCUS|Turnaround': '1:1', 'MARCUS|Turnaround|backdrop': 'white', 'AMINA|Turnaround': '3:4', MARCUSX: 'keep' },
    shots: [shot('S1', ['MARCUS', 'AMINA', 'SET-1'], { focusAssetId: 'MARCUS', looks: { MARCUS: 'Canonical', AMINA: 'Canonical' }, camera: { focusTarget: 'MARCUS' } }), shot('S2', ['AMINA'], { focusAssetId: 'AMINA' })],
    sceneStates: { 'SC-1': scene }, reviews,
  }
}

describe('describing a removal', () => {
  it('counts the pictures, the approved ones and the shots, and says whether a script would bring it back', () => {
    const p = project()
    expect(describeRemoval(p, 'MARCUS')).toEqual({ found: true, name: 'MARCUS', type: 'character', pictures: 2, approved: 1, shots: 1, fromScript: true })
    expect(describeRemoval(p, 'MANU-CHAR-002-X')).toMatchObject({ name: 'AMINA', fromScript: false, pictures: 0 })
    expect(describeRemoval(p, 'NOBODY')).toMatchObject({ found: false })
  })
})

describe('removing an item', () => {
  it('removes it and everything that pointed only at it, and nothing else', () => {
    const p = project()
    const r = removeAsset(p, 'MARCUS')
    expect(r.analysis.assets.map((x) => x.name)).toEqual(['AMINA', 'KITCHEN'])
    expect((r.analysis.scenes[0] as unknown as { assetIds: string[] }).assetIds).toEqual(['AMINA'])
    expect(r.queue.jobs.map((j) => j.assetId)).toEqual(['AMINA'])
    expect(r.assetOutputs).toEqual({ AMINA: 'C:/out/a.png' })
    expect(r.assetRefs).toEqual({ AMINA: ['C:/p/amina.png'] })
    expect(Object.keys(r.proportions)).toEqual(['AMINA'])
    expect(Object.keys(r.fitRules)).toEqual(['AMINA'])
    expect(r.sheetNotes).toEqual({ AMINA: 'n2' })
    expect(r.sheetSettings).toEqual({ 'AMINA|Turnaround': '3:4', MARCUSX: 'keep' })
    expect(r.shots[0].assetIds).toEqual(['AMINA', 'SET-1'])
    expect(r.shots[0].focusAssetId).toBeUndefined()
    expect(r.shots[0].looks).toEqual({ AMINA: 'Canonical' })
    expect(r.shots[0].camera?.focusTarget).toBeUndefined()
    expect(r.shots[1]).toEqual(p.shots[1])
    const world = r.sceneStates['SC-1'].world.things
    expect(world.map((t) => t.id)).toEqual(['CHAIR', 'AMINA'])
    expect(world.find((t) => t.id === 'CHAIR')!.ownedBy).toBeUndefined()
    expect(r.reviews.deterministic.map((f) => f.id)).toEqual(['F2'])
    expect(Object.keys(r.reviews.checked)).toEqual([p.queue.jobs[2].id])
  })
  it('leaves the picture files alone: the removal never names a file to delete', () => {
    const p = project()
    const r = removeAsset(p, 'MARCUS')
    expect(JSON.stringify(r)).not.toMatch(/delete|unlink/i)
    expect(p.queue.jobs.filter((j) => j.assetId === 'MARCUS').every((j) => j.outputPath)).toBe(true)
  })
  it('does not change the original, and a removal of something that is not there changes nothing', () => {
    const p = project()
    const before = JSON.stringify(p)
    removeAsset(p, 'MARCUS')
    expect(JSON.stringify(p)).toBe(before)
    expect(removeAsset(p, 'NOBODY')).toBe(p)
  })
  it('undo is a restore of the snapshot taken before: removing and restoring gives back the same project', () => {
    const p = project()
    const snapshot = structuredClone(p)
    removeAsset(p, 'AMINA')
    expect(JSON.stringify(snapshot)).toBe(JSON.stringify(p))
  })
  it('removes a set the same way (a place named in shots and owned nothing)', () => {
    const r = removeAsset(project(), 'SET-1')
    expect(r.analysis.assets.map((x) => x.id)).toEqual(['MARCUS', 'MANU-CHAR-002-X'])
    expect(r.shots[0].assetIds).toEqual(['MARCUS', 'AMINA'])
  })
})
