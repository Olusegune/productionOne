import { describe, expect, it } from 'vitest'
import { characterBibleProgress, identityAnchored } from './characterBible'
import { betterTake, type ImageJob } from './generationQueue'
import { viewsFor } from './sheetSpecs'
import type { SheetType } from './visualDevelopment'

const job = (p: Partial<ImageJob>): ImageJob => ({ id: Math.random().toString(), key: '', assetId: 'A', variant: 'base', sheetType: 'Identity', viewKey: 'portrait', label: '', prompt: '', aspect: '1:1', fullBody: false, provider: '', model: '', references: [], useAnchor: false, outputName: '', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 0, updatedAt: 0, ...p } as ImageJob)
const get = (jobs: ImageJob[], id: string, lines = 0) => characterBibleProgress(jobs, 'A', lines).find((s) => s.id === id)!
/** Every planned view of a sheet, approved. */
const full = (sheet: SheetType, over: Partial<ImageJob> = {}) => viewsFor('character', sheet).map((v) => job({ sheetType: sheet, viewKey: v.key, approved: true, ...over }))

describe('characterBibleProgress', () => {
  it('starts empty and blocks motion and voice', () => {
    expect(get([], 'identity').state).toBe('empty')
    expect(get([], 'motion').state).toBe('blocked')
    expect(get([], 'voice').state).toBe('blocked')
  })
  it('uses the newest revision per view', () => {
    const [first, ...rest] = full('Identity')
    const jobs = [{ ...first, rejected: true, approved: false }, { ...first, id: 'second', revision: 2 }, ...rest]
    expect(get(jobs, 'identity').state).toBe('approved')
  })
  it('reports review and working states', () => {
    expect(get([job({})], 'identity').state).toBe('review')
    expect(get([job({ status: 'generating' })], 'identity').state).toBe('working')
  })
  it('unlocks motion once identity and turnaround are fully approved', () => {
    const jobs = [...full('Identity'), ...full('Turnaround')]
    const p = characterBibleProgress(jobs, 'A', 0)
    expect(p.find((s) => s.id === 'motion')!.state).toBe('ready')
    expect(identityAnchored(p)).toBe(true)
  })
  it('does not call a sheet approved while planned views have no picture yet', () => {
    const turnaround = get([job({ sheetType: 'Turnaround', viewKey: 'front', approved: true })], 'turnaround')
    expect(turnaround).toMatchObject({ state: 'review', approved: 1, total: viewsFor('character', 'Turnaround').length })
    expect(turnaround.next).toMatch(/1 of 5 views are approved\. Generate the other 4/)
    expect(identityAnchored(characterBibleProgress([job({ sheetType: 'Turnaround', viewKey: 'front', approved: true })], 'A', 0))).toBe(false)
  })
  it('ignores other assets and cancelled jobs', () => {
    expect(get([job({ assetId: 'B', approved: true }), job({ status: 'cancelled' })], 'identity').state).toBe('empty')
  })
  it('unlocks voice only with dialogue', () => { expect(get([], 'voice', 3).state).toBe('ready') })
})

describe('which take stands for a view', () => {
  it('prefers an approved take over a newer turned-down one, and the newer of two approved takes', () => {
    const old = job({ revision: 1, approved: true })
    const newer = job({ revision: 2, rejected: true })
    expect(betterTake(old, newer)).toBe(old)
    expect(betterTake(newer, old)).toBe(old)
    const also = job({ revision: 3, approved: true })
    expect(betterTake(old, also)).toBe(also)
    expect(betterTake(undefined, old)).toBe(old)
  })
  it('falls back to the newest take when none is approved', () => {
    const a = job({ revision: 1 })
    const b = job({ revision: 2 })
    expect(betterTake(a, b)).toBe(b)
    expect(betterTake(b, a)).toBe(b)
  })
  it('keeping an older take keeps the sheet approved', () => {
    const [front, ...rest] = full('Identity')
    const jobs = [front, { ...front, id: 'newer', revision: 2, approved: false, rejected: true }, ...rest]
    expect(get(jobs, 'identity').state).toBe('approved')
  })
})
