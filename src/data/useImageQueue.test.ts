import { act, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyQueue, enqueue, type QueueState } from '../domain/generationQueue'
import { useImageQueue } from './useImageQueue'

// A plain function, not vi.fn: a spy that wraps rejecting promises makes this vitest version report them as unhandled.
const calls: string[] = []
let impl: (name: string) => Promise<unknown> = async () => undefined
const invoke = { mockImplementation: (fn: (name: string) => Promise<unknown>) => { impl = fn }, reset: () => { calls.length = 0; impl = async () => undefined } }
vi.mock('@tauri-apps/api/core', () => ({ invoke: (name: string) => { calls.push(name); return impl(name) } }))

const request = (viewKey: string) => ({
  assetId: 'CHAR-001', variant: 'Canonical', sheetType: 'Turnaround', viewKey, label: viewKey, prompt: 'p', aspect: '3:4', fullBody: true,
  provider: 'google', model: 'm', references: [], outputName: (r: number) => `CHAR-001_${viewKey}_v${r}`,
})
const funded = (keys: string[]): QueueState => ({ ...enqueue(emptyQueue(), keys.map(request)).state, guard: true, perImageUsd: 0.1, totalCeilingUsd: 1 })

function harness(initial: QueueState) {
  return renderHook(() => {
    const [queue, setQueue] = useState(initial)
    useImageQueue(queue, (update) => setQueue(update), true)
    return queue
  })
}

describe('useImageQueue', () => {
  beforeEach(() => invoke.reset())

  it('generates, validates and stops at needs-review with the QA notes, never auto-approving', async () => {
    invoke.mockImplementation(async (name: string) => {
      if (name === 'generate_image') return { path: 'C:/a.png', inspection: { width: 1024, height: 1536, warnings: [] } }
      if (name === 'qa_image') return { notes: ['Something touches the bottom edge: the feet may be cropped.'] }
    })
    const { result } = harness(funded(['front']))
    await waitFor(() => expect(result.current.jobs[0].status).toBe('needs-review'))
    expect(result.current.jobs[0].approved).toBe(false)
    expect(result.current.jobs[0].qaNotes[0]).toContain('feet')
    expect(result.current.jobs[0].outputPath).toBe('C:/a.png')
    expect(calls.filter((n) => n === 'generate_image')).toHaveLength(1)
  })

  it('with the guard on, sends nothing until a spending limit exists', async () => {
    const { result } = harness({ ...enqueue(emptyQueue(), [request('front')]).state, guard: true })
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(calls).toEqual([])
    expect(result.current.jobs[0].status).toBe('queued')
  })

  it('backs off on a rate limit instead of failing, and keeps the attempt counted', async () => {
    invoke.mockImplementation(async () => { throw new Error('OpenAI image request failed (429): slow down') })
    const { result } = harness(funded(['front']))
    await waitFor(() => expect(result.current.jobs[0].attempts).toBe(1))
    await waitFor(() => expect(result.current.jobs[0].status).toBe('queued'))
    expect(result.current.jobs[0].notBefore).toBeGreaterThan(Date.now())
    expect(calls).toHaveLength(1)
  })

  it('fails a rejected key immediately with advice', async () => {
    invoke.mockImplementation(async () => { throw new Error('Google Gemini image request failed (401): bad key') })
    const { result } = harness(funded(['front']))
    await waitFor(() => expect(result.current.jobs[0].status).toBe('failed'))
    expect(result.current.jobs[0].error).toContain('Provider Settings')
  })

  it('never exceeds the concurrency limit', async () => {
    let running = 0
    let peak = 0
    invoke.mockImplementation(async (name: string) => {
      if (name === 'generate_image') {
        running++
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 30))
        running--
        return { path: 'x.png', inspection: { width: 1024, height: 1536, warnings: [] } }
      }
      return { notes: [] }
    })
    const { result } = harness({ ...funded(['a', 'b', 'c', 'd']), concurrency: 2 })
    await waitFor(() => expect(result.current.jobs.map((j) => j.status)).toEqual(['needs-review', 'needs-review', 'needs-review', 'needs-review']))
    expect(peak).toBe(2)
  })
})
