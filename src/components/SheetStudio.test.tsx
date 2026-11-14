import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useImageQueue } from '../data/useImageQueue'
import { emptyQueue, type QueueState } from '../domain/generationQueue'
import { analyzeScript } from '../domain/productionStudio'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { sampleStory } from '../engine/sampleStory'
import { SheetStudio } from './SheetStudio'

const calls: Array<{ name: string; args: Record<string, unknown> }> = []
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }))
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
  invoke: async (name: string, args: Record<string, unknown> = {}) => {
    calls.push({ name, args })
    if (name === 'credential_status') return true
    if (name === 'model_catalog') return {}
    if (name === 'kie_models') return { kie: { fetchedAt: Date.now() / 1000, models: [] } }
    if (name === 'generate_image') return { path: 'C:/a.png', inspection: { width: 1024, height: 1536, warnings: [] } }
    if (name === 'qa_image') return { notes: [] }
    if (name === 'image_preview') return 'data:image/jpeg;base64,AAAA'
    if (name === 'pick_image_files') return ['D:/photos/actor.png']
    if (name === 'import_images') return [{ path: 'C:/assets/actor_yours.png', inspection: { width: 2000, height: 3000, warnings: [] } }]
    return undefined
  },
}))

const analysis = analyzeScript(sampleStory)

let latestQueue: QueueState = emptyQueue()
const approvals: string[] = []
function Harness({ initial = emptyQueue() }: { initial?: QueueState }) {
  const [queue, setQueue] = useState(initial)
  const [refs, setRefs] = useState<Record<string, string[]>>({})
  latestQueue = queue
  useImageQueue(queue, (u) => setQueue(u), true)
  const jonah = analysis.assets.findIndex((a) => a.name === 'AMINA')
  return <SheetStudio assets={analysis.assets} scenes={analysis.scenes} story={analysis.story} assetIndex={jonah} style={defaultStyleBible} queue={queue} setQueue={(u) => setQueue(u)} desktop providersVersion={0} onApproved={(job) => approvals.push(job.outputPath ?? '')} notify={() => {}} openProviders={() => {}} refs={refs} setRefs={(u2) => setRefs(u2)} />
}

describe('SheetStudio generate flow', () => {
  it('one Generate press queues the views and runs the front view first, without any cost prompt', async () => {
    calls.length = 0
    render(<Harness />)
    await waitFor(() => expect(calls.some((c) => c.name === 'credential_status')).toBe(true))
    fireEvent.click(await screen.findByRole('button', { name: /generate 5 views/i }))
    // no spending dialog: generation starts straight away
    expect(screen.queryByLabelText(/price per image/i)).toBeNull()
    await waitFor(() => expect(calls.filter((c) => c.name === 'generate_image')).toHaveLength(1))
    expect(calls.find((c) => c.name === 'generate_image')!.args.outputName).toContain('front')
    await screen.findAllByText(/needs review/i)
    expect(calls.filter((c) => c.name === 'generate_image')).toHaveLength(1) // the other four wait for the approved front
  })

  it('uses your own image for a view: saved as supplied, approved at once, and made the anchor', async () => {
    calls.length = 0
    approvals.length = 0
    render(<Harness />)
    const mine = await screen.findAllByRole('button', { name: /use my image/i })
    fireEvent.click(mine[0]) // the Front card
    await waitFor(() => expect(latestQueue.jobs).toHaveLength(1))
    expect(latestQueue.jobs[0]).toMatchObject({ viewKey: 'front', source: 'supplied', approved: true, outputPath: 'C:/assets/actor_yours.png', width: 2000 })
    expect(approvals).toEqual(['C:/assets/actor_yours.png'])
    expect(calls.some((c) => c.name === 'generate_image')).toBe(false)
  })

  it('exports the views that have a picture as one labelled sheet image', async () => {
    calls.length = 0
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /export sheet as one image/i })).toBeNull()
    const mine = await screen.findAllByRole('button', { name: /use my image/i })
    fireEvent.click(mine[0])
    await waitFor(() => expect(latestQueue.jobs).toHaveLength(1))
    expect(screen.queryByRole('button', { name: /export sheet as one image/i })).toBeNull() // one view is not a sheet yet
    fireEvent.click((await screen.findAllByRole('button', { name: /use my image/i }))[1])
    await waitFor(() => expect(latestQueue.jobs).toHaveLength(2))
    fireEvent.click(await screen.findByRole('button', { name: /export sheet as one image/i }))
    await waitFor(() => expect(calls.some((c) => c.name === 'export_contact_sheet')).toBe(true))
    const call = calls.find((c) => c.name === 'export_contact_sheet')!
    expect((call.args.cells as unknown[]).length).toBe(2)
    expect(call.args.columns).toBe(2)
    expect(String(call.args.title)).toMatch(/AMINA Turnaround/)
  })
  it('attaches reference photos to the asset and sends them with generation requests', async () => {
    calls.length = 0
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: /add photos/i }))
    await screen.findByAltText('Reference photo')
    fireEvent.click(screen.getByRole('button', { name: /generate 5 views/i }))
    await waitFor(() => expect(calls.filter((c) => c.name === 'generate_image')).toHaveLength(1))
    expect(calls.find((c) => c.name === 'generate_image')!.args.references).toEqual(['C:/assets/actor_yours.png'])
  })
})
