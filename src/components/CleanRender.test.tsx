import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addCleaned, type ImageJob, type QueueState } from '../domain/generationQueue'
import { CleanRender, mergeSuggestion, neutral } from './CleanRender'

const calls: Array<{ cmd: string; args: Record<string, unknown> }> = []
const report = { width: 1024, height: 1024, warmCast: 0.3, clippedHighlights: 0, clippedShadows: 0, noise: 2, edgeOvershoot: 0, bloom: 0, skinFraction: 0, skinDetail: 0, suggestions: [
  { id: 'warm-cast', severity: 'suggest', message: 'The mid-tones lean strongly yellow or orange (30% more red than blue).', remedy: 'Cooling shifts the whole image.', params: { ...neutral, temperature: -30 } },
  { id: 'waxy-skin', severity: 'warn', message: 'The skin is extremely smooth.', remedy: 'Regenerate with natural skin texture.', params: null },
] }
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    calls.push({ cmd, args })
    if (cmd === 'clean_analyze') return report
    if (cmd === 'clean_preview') return 'data:image/jpeg;base64,AAAA'
    if (cmd === 'clean_save') return { path: 'C:/assets/front_clean_01.png', width: 1024, height: 1024 }
    return undefined
  },
}))

const job = (id: string, approved = true): ImageJob => ({
  id, key: id, assetId: 'CHAR-1', variant: 'Canonical', sheetType: 'Turnaround', viewKey: id, label: id, prompt: '', aspect: '1:1', fullBody: false, provider: 'kie', model: 'm', references: [], useAnchor: false,
  outputName: `${id}_v01`, revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, outputPath: `C:/assets/${id}.png`, width: 1024, height: 1024, qaNotes: [], approved, rejected: false, createdAt: 0, updatedAt: 0,
})

beforeEach(() => { calls.length = 0 })

describe('CleanRender', () => {
  it('shows measured suggestions, applies one as slider values and saves a new revision without touching the original', async () => {
    const saved: Array<[string, string]> = []
    const notes: string[] = []
    render(<CleanRender items={[job('front')]} index={0} onIndex={() => {}} onClose={() => {}} notify={(m) => notes.push(m)} onSaved={(j, f) => saved.push([j.id, f.path])} />)
    expect(await screen.findByText(/lean strongly yellow/)).toBeTruthy()
    expect(screen.getByText(/Regenerate with natural skin texture/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /try this/i })).toHaveLength(1) // the waxy-skin warning offers no filter
    expect((screen.getByRole('button', { name: /save corrected revision/i }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /try this/i }))
    await waitFor(() => expect(calls.some((c) => c.cmd === 'clean_preview' && (c.args.params as { temperature: number }).temperature === -30 && c.args.original === false)).toBe(true))
    expect(await screen.findByAltText('Corrected')).toBeTruthy()
    expect(screen.getByText(/can be intentional/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /save corrected revision/i }))
    await waitFor(() => expect(saved).toEqual([['front', 'C:/assets/front_clean_01.png']]))
    expect(calls.find((c) => c.cmd === 'clean_save')?.args).toMatchObject({ path: 'C:/assets/front.png' })
    expect(notes.at(-1)).toMatch(/originals are kept/)
  })

  it('resets every control and applies to all images when asked', async () => {
    const saved: string[] = []
    render(<CleanRender items={[job('front'), job('side')]} index={0} onIndex={() => {}} onClose={() => {}} notify={() => {}} onSaved={(j) => saved.push(j.id)} />)
    await screen.findByText(/lean strongly yellow/)
    fireEvent.click(screen.getByRole('button', { name: /try this/i }))
    fireEvent.click(screen.getByRole('button', { name: /apply to all 2 images/i }))
    await waitFor(() => expect(saved).toEqual(['front', 'side']))
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect((screen.getByRole('button', { name: /save corrected revision/i }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('corrected revisions in the queue', () => {
  it('adds a new revision that keeps the approval and leaves the earlier image in the history', () => {
    const state: QueueState = { jobs: [job('front')], paused: false } as unknown as QueueState
    const out = addCleaned(state, state.jobs[0], { path: 'C:/assets/front_clean_01.png', width: 1024, height: 1024 }, 5)
    expect(out.state.jobs).toHaveLength(2)
    expect(out.state.jobs[0].outputPath).toBe('C:/assets/front.png')
    expect(out.job).toMatchObject({ revision: 2, source: 'cleaned', approved: true, outputPath: 'C:/assets/front_clean_01.png', status: 'completed' })
  })
  it('merges a suggestion without disturbing the other controls', () => {
    const merged = mergeSuggestion({ ...neutral, denoise: 40, sharpen: 10 }, { ...neutral, temperature: -25 })
    expect(merged).toMatchObject({ temperature: -25, denoise: 40, sharpen: 10, texture: 50 })
  })
})
