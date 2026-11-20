import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useImageQueue } from '../data/useImageQueue'
import { addSupplied, emptyQueue, type QueueState } from '../domain/generationQueue'
import { analyzeScript, type ShotRecord } from '../domain/productionStudio'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { sampleStory } from '../engine/sampleStory'
import { DirectRoom } from './DirectRoom'

const calls: Array<{ name: string; args: Record<string, unknown> }> = []
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }))
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
  invoke: async (name: string, args: Record<string, unknown> = {}) => {
    calls.push({ name, args })
    if (name === 'credential_status') return true
    if (name === 'model_catalog') return {}
    if (name === 'kie_models') return { kie: { fetchedAt: Date.now() / 1000, models: [] } }
    if (name === 'generate_image') return { path: 'C:/frame.png', inspection: { width: 1920, height: 1080, warnings: [] } }
    if (name === 'qa_image') return { notes: [] }
    return undefined
  },
}))

const analysis = analyzeScript(sampleStory)
const amina = analysis.assets.find((a) => a.name === 'AMINA')!
let latest: { shots: ShotRecord[]; queue: QueueState } = { shots: [], queue: emptyQueue() }
const notes: string[] = []

function Harness({ enabled = true, startFormat = '16:9' }: { enabled?: boolean; startFormat?: string }) {
  const [format, setFormat] = useState(startFormat)
  const [shots, setShots] = useState<ShotRecord[]>([])
  const [queue, setQueue] = useState<QueueState>(() => addSupplied(emptyQueue(), { assetId: amina.id, variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', aspect: '3:4', fullBody: true, path: 'C:/amina.png', width: 1, height: 1 }).state)
  const [on, setOn] = useState(enabled)
  latest = { shots, queue }
  useImageQueue(queue, (u) => setQueue(u), true)
  return <DirectRoom analysis={analysis} shots={shots} setShots={(u) => setShots(u)} queue={queue} setQueue={(u) => setQueue(u)} style={defaultStyleBible} assetRefs={{}} desktop providersVersion={0} enabled={on} setEnabled={setOn} title="The Last Horizon" notify={(m) => notes.push(m)} openProviders={() => {}} format={format} setFormat={setFormat} />
}

describe('Directors room', () => {
  it('stays out of the way until it is turned on', () => {
    render(<Harness enabled={false} />)
    expect(screen.getByRole('button', { name: /turn on the director/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /turn on the director/i }))
    expect(screen.getByRole('button', { name: /plan all scenes/i })).toBeTruthy()
  })

  it('plans coverage for the whole script, lets you edit a shot, and keeps the classic fields in step', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /plan all scenes/i }))
    await waitFor(() => expect(latest.shots.length).toBeGreaterThan(8))
    const first = latest.shots[0]
    const size = (await screen.findAllByLabelText(/^shot size$/i))[0] as HTMLSelectElement
    fireEvent.change(size, { target: { value: 'CU' } })
    const edited = latest.shots.find((s) => s.id === first.id)!
    expect(edited).toMatchObject({ size: 'CU', lens: 85, cameraFraming: 'Close-up' })
  })

  it('makes storyboard frames from the approved anchors and shows them in the animatic', async () => {
    calls.length = 0
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /plan all scenes/i }))
    await waitFor(() => expect(latest.shots.length).toBeGreaterThan(8))
    fireEvent.click(await screen.findByRole('button', { name: /^generate \d+ frames?( · .*)?$/i }))
    await waitFor(() => expect(calls.filter((c) => c.name === 'generate_image').length).toBeGreaterThan(0))
    const first = calls.find((c) => c.name === 'generate_image')!
    expect(first.args.aspect).toBe('16:9')
    expect(String(first.args.prompt)).toContain('Storyboard frame')
    expect(String(first.args.outputName)).toMatch(/^SHOT-\d+_storyboard_v01$/)
    await waitFor(() => expect(latest.queue.jobs.some((j) => j.sheetType === 'Storyboard' && j.status === 'needs-review')).toBe(true))
    expect(screen.getByLabelText('Animatic')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Image quality/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('makes frames in the project format: 9:16 for a phone story', async () => {
    calls.length = 0
    render(<Harness startFormat="9:16" />)
    fireEvent.click(screen.getByRole('button', { name: /plan all scenes/i }))
    await waitFor(() => expect(latest.shots.length).toBeGreaterThan(8))
    fireEvent.click(await screen.findByRole('button', { name: /^generate \d+ frames?( · .*)?$/i }))
    await waitFor(() => expect(calls.some((c) => c.name === 'generate_image')).toBe(true))
    const first = calls.find((c) => c.name === 'generate_image')!
    expect(first.args.aspect).toBe('9:16')
    expect(String(first.args.prompt)).toContain('Storyboard frame, 9:16')
    expect(screen.getByRole('button', { name: /TikTok/ }).getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('.dr-cards.portrait')).toBeTruthy()
  })

  it('marks frames made at another shape when the format changes, and does not spend anything', async () => {
    calls.length = 0
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /plan all scenes/i }))
    await waitFor(() => expect(latest.shots.length).toBeGreaterThan(8))
    fireEvent.click(await screen.findByRole('button', { name: /^generate \d+ frames?( · .*)?$/i }))
    await waitFor(() => expect(latest.queue.jobs.some((j) => j.sheetType === 'Storyboard' && j.outputPath)).toBe(true))
    await waitFor(() => expect(latest.queue.jobs.filter((j) => j.sheetType === 'Storyboard').every((j) => !['queued', 'generating', 'validating'].includes(j.status))).toBe(true), { timeout: 5000 })
    const made = calls.filter((c) => c.name === 'generate_image').length
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /TikTok/ }))
    expect((await screen.findByRole('status')).textContent).toMatch(/made at another shape/)
    expect(screen.getAllByText('Made at 16:9').length).toBeGreaterThan(0)
    expect(calls.filter((c) => c.name === 'generate_image').length).toBe(made)
  })
})
