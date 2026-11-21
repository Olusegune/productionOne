import { describe, expect, it } from 'vitest'
import { approve, dropMissing, emptyQueue, enqueue, reject, type QueueState } from './generationQueue'
import { applyRelink, planRelink, relinkSummary, savedStem, shortPath, wantedStems } from './relink'

const req = (viewKey: string) => ({ assetId: 'MARCUS', variant: 'Canonical', sheetType: 'Turnaround', viewKey, label: viewKey, prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], outputName: (r: number) => `MARCUS Front/${viewKey}_v${r}` })

function lostQueue(): { queue: QueueState; paths: string[] } {
  const q = enqueue(emptyQueue(), [req('front'), req('side'), req('back')], 1, false).state
  let s: QueueState = { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'needs-review' as const, outputPath: `C:/old/${savedStem(j.outputName)}.png` })) }
  s = approve(s, s.jobs[0].id)
  s = reject(s, s.jobs[1].id)
  const paths = s.jobs.map((j) => j.outputPath as string)
  return { queue: dropMissing(s, paths).state, paths }
}

describe('relinking missing pictures', () => {
  it('names the file the way the app saved it', () => {
    expect(savedStem('MARCUS Front/front_v1')).toBe('MARCUS_Front_front_v1')
    expect(savedStem('__a b__')).toBe('a_b')
  })
  it('remembers what was lost when a file goes missing, and asks for each stem once', () => {
    const { queue } = lostQueue()
    expect(queue.jobs[0].lost).toMatchObject({ approved: true, rejected: false })
    expect(queue.jobs[1].lost).toMatchObject({ approved: false, rejected: true })
    const w = wantedStems(queue)
    expect(w.takes).toBe(3)
    expect(w.stems).toHaveLength(3)
  })
  it('points found pictures back, restores approved, rejected and waiting, and leaves the rest', () => {
    const { queue } = lostQueue()
    const stems = wantedStems(queue).stems
    const r = applyRelink(queue, { [stems[0].toLowerCase()]: 'D:/new/a.png', [stems[1].toLowerCase()]: 'D:/new/b.png' })
    expect(r.relinked).toHaveLength(2)
    expect(r.stillMissing).toBe(1)
    expect(r.state.jobs[0]).toMatchObject({ outputPath: 'D:/new/a.png', status: 'completed', approved: true, rejected: false })
    expect(r.state.jobs[0].lost).toBeUndefined()
    expect(r.state.jobs[0].error).toBeUndefined()
    expect(r.state.jobs[1]).toMatchObject({ status: 'completed', approved: false, rejected: true })
    expect(r.state.jobs[2]).toEqual(queue.jobs[2])
  })
  it('a picture whose decision was not remembered comes back waiting for you, never approved', () => {
    const { queue } = lostQueue()
    const forgotten: QueueState = { ...queue, jobs: queue.jobs.map(({ lost: _l, ...j }) => j) }
    const stems = wantedStems(forgotten).stems
    const r = applyRelink(forgotten, { [stems[0]]: 'D:/new/a.png' })
    expect(r.state.jobs[0]).toMatchObject({ status: 'needs-review', approved: false, rejected: false, outputPath: 'D:/new/a.png' })
  })
  it('matches names without regard to case and returns the same queue when nothing is found', () => {
    const { queue } = lostQueue()
    const stem = wantedStems(queue).stems[0]
    expect(applyRelink(queue, { [stem.toUpperCase()]: 'D:/x.png' }).relinked).toHaveLength(1)
    const none = applyRelink(queue, {})
    expect(none.state).toBe(queue)
    expect(none.stillMissing).toBe(3)
  })
  it('only touches takes whose file is missing, not failed generations', () => {
    const q = enqueue(emptyQueue(), [req('front')], 1, false).state
    const failed: QueueState = { ...q, jobs: q.jobs.map((j) => ({ ...j, status: 'failed' as const, error: 'The provider said no' })) }
    expect(applyRelink(failed, { [savedStem(failed.jobs[0].outputName)]: 'D:/x.png' }).relinked).toHaveLength(0)
  })
  it('says what happened in plain words', () => {
    expect(relinkSummary({ relinked: 0, stillMissing: 5 })).toMatch(/None of the missing pictures/)
    expect(relinkSummary({ relinked: 1, stillMissing: 0 })).toBe('Found 1 picture and linked it back. Nothing was copied or generated.')
    expect(relinkSummary({ relinked: 12, stillMissing: 29 })).toMatch(/Found 12 pictures and linked them back\. 29 are still missing/)
  })
})

describe('the match preview', () => {
  it('lists every missing picture with the file found for it, or none, before anything changes', () => {
    const { queue } = lostQueue()
    const stems = wantedStems(queue).stems
    const rows = planRelink(queue, { [stems[0].toLowerCase()]: 'D:/pics/a.png' }, () => 'MARCUS')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ name: 'MARCUS · front · revision 1', path: 'D:/pics/a.png', was: 'approved' })
    expect(rows[1]).toMatchObject({ path: null, was: 'rejected' })
    expect(rows[2]).toMatchObject({ path: null, was: 'waiting' })
    expect(queue.jobs.every((j) => j.status === 'failed')).toBe(true)
  })
  it('links only the takes that were ticked', () => {
    const { queue } = lostQueue()
    const stems = wantedStems(queue).stems
    const found = { [stems[0].toLowerCase()]: 'D:/a.png', [stems[1].toLowerCase()]: 'D:/b.png' }
    const r = applyRelink(queue, found, 1, new Set([queue.jobs[1].id]))
    expect(r.relinked.map((j) => j.id)).toEqual([queue.jobs[1].id])
    expect(r.state.jobs[0]).toEqual(queue.jobs[0])
    expect(r.stillMissing).toBe(2)
  })
  it('shortens a long path to its last three parts', () => {
    expect(shortPath('C:\\Users\\me\\Pictures\\project\\a.png')).toBe('…/Pictures/project/a.png')
    expect(shortPath('D:/a/b.png')).toBe('D:/a/b.png')
  })
})
