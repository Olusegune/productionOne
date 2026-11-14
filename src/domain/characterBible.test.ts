import { describe, expect, it } from 'vitest'
import { characterBibleProgress, identityAnchored } from './characterBible'
import type { ImageJob } from './generationQueue'

const job = (p: Partial<ImageJob>): ImageJob => ({ id: Math.random().toString(), key: '', assetId: 'A', variant: 'base', sheetType: 'Identity', viewKey: 'portrait', label: '', prompt: '', aspect: '1:1', fullBody: false, provider: '', model: '', references: [], useAnchor: false, outputName: '', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 0, updatedAt: 0, ...p } as ImageJob)
const get = (jobs: ImageJob[], id: string, lines = 0) => characterBibleProgress(jobs, 'A', lines).find((s) => s.id === id)!

describe('characterBibleProgress', () => {
  it('starts empty and blocks motion and voice', () => {
    expect(get([], 'identity').state).toBe('empty')
    expect(get([], 'motion').state).toBe('blocked')
    expect(get([], 'voice').state).toBe('blocked')
  })
  it('uses the newest revision per view', () => {
    const jobs = [job({ revision: 1, rejected: true }), job({ revision: 2, approved: true })]
    expect(get(jobs, 'identity').state).toBe('approved')
  })
  it('reports review and working states', () => {
    expect(get([job({})], 'identity').state).toBe('review')
    expect(get([job({ status: 'generating' })], 'identity').state).toBe('working')
  })
  it('unlocks motion once identity and turnaround are approved', () => {
    const jobs = [job({ approved: true }), job({ sheetType: 'Turnaround', viewKey: 'front', approved: true })]
    const p = characterBibleProgress(jobs, 'A', 0)
    expect(p.find((s) => s.id === 'motion')!.state).toBe('ready')
    expect(identityAnchored(p)).toBe(true)
  })
  it('ignores other assets and cancelled jobs', () => {
    expect(get([job({ assetId: 'B', approved: true }), job({ status: 'cancelled' })], 'identity').state).toBe('empty')
  })
  it('unlocks voice only with dialogue', () => { expect(get([], 'voice', 3).state).toBe('ready') })
})
