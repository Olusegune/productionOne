import { describe, expect, it } from 'vitest'
import { dropMissingRefs, flagMissingClips, reconcileMissing } from './missingFiles'

const job = (assetId: string, viewKey: string, outputPath: string | undefined, revision = 1, approved = true) => ({ assetId, viewKey, approved, outputPath, revision })

describe('an asset whose picture is gone', () => {
  const assets = [{ id: 'A', status: 'approved' as const }, { id: 'B', status: 'approved' as const }, { id: 'C', status: 'planned' as const }]
  it('goes back to planned and loses its picture when nothing else stands for it', () => {
    const out = reconcileMissing(assets, { A: 'C:/gone/a.png', B: 'C:/here/b.png' }, [job('A', 'front', undefined), job('B', 'front', 'C:/here/b.png')], ['C:/gone/a.png'])
    expect(out.demoted).toEqual(['A'])
    expect(out.outputs).toEqual({ B: 'C:/here/b.png' })
  })
  it('keeps its approval when another approved front view still has a file, and points at that file', () => {
    const out = reconcileMissing(assets, { A: 'C:/gone/a.png' }, [job('A', 'front', undefined, 2), job('A', 'full-front', 'C:/here/a2.png', 1)], ['C:/gone/a.png'])
    expect(out.demoted).toEqual([])
    expect(out.outputs).toEqual({ A: 'C:/here/a2.png' })
  })
  it('does not use a side view, a rejected take or another missing file as a stand-in', () => {
    const jobs = [job('A', 'side', 'C:/here/side.png'), { ...job('A', 'front', 'C:/here/rejected.png'), rejected: true }, job('A', 'front', 'C:/gone/other.png')]
    const out = reconcileMissing(assets, { A: 'C:/gone/a.png' }, jobs, ['C:/gone/a.png', 'C:/gone/other.png'])
    expect(out.demoted).toEqual(['A'])
  })
  it('changes nothing when no recorded picture is missing, and leaves unrelated assets alone', () => {
    const outputs = { A: 'C:/here/a.png' }
    const out = reconcileMissing(assets, outputs, [], ['C:/elsewhere.png'])
    expect(out).toEqual({ outputs, demoted: [] })
  })
  it('does not demote an asset that was never marked approved', () => {
    const out = reconcileMissing(assets, { C: 'C:/gone/c.png' }, [], ['C:/gone/c.png'])
    expect(out.demoted).toEqual([])
    expect(out.outputs).toEqual({})
  })
})

describe('clips whose file is gone', () => {
  const clips = [{ id: '1', path: 'C:/gone/a.mp3' }, { id: '2', path: 'C:/here/b.mp3' }, { id: '3', path: 'C:/back.mp3', missing: true }]
  it('are flagged, keep their record, and are un-flagged when the file is back', () => {
    const out = flagMissingClips(clips, ['C:/gone/a.mp3'])
    expect(out.map((c) => !!c.missing)).toEqual([true, false, false])
    expect(out.map((c) => c.id)).toEqual(['1', '2', '3'])
  })
  it('return the same array when nothing changed', () => {
    const same = [{ id: '1', path: 'C:/a.mp3' }]
    expect(flagMissingClips(same, [])).toBe(same)
    expect(flagMissingClips(same, ['C:/other.mp3'])).toBe(same)
  })
})

describe('reference photos that are gone', () => {
  it('are taken off their lists and counted', () => {
    const out = dropMissingRefs({ A: ['C:/gone/1.png', 'C:/here/2.png'], B: ['C:/gone/1.png'], C: [] }, ['C:/gone/1.png'])
    expect(out.dropped).toBe(2)
    expect(out.refs).toEqual({ A: ['C:/here/2.png'], B: [], C: [] })
  })
  it('leave the object alone when none is missing', () => {
    const refs = { A: ['C:/here/2.png'] }
    const out = dropMissingRefs(refs, ['C:/x.png'])
    expect(out.refs).toBe(refs)
    expect(out.dropped).toBe(0)
  })
})
