import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useImageQueue } from '../data/useImageQueue'
import { addSupplied, emptyQueue, type QueueState } from '../domain/generationQueue'
import { styleByName } from '../domain/demo2d'
import type { ExtractedAsset } from '../domain/productionStudio'
import { analyzeScript } from '../domain/productionStudio'
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
    return undefined
  },
}))

const base = analyzeScript(sampleStory)
const amina = base.assets.find((a) => a.name === 'AMINA')!
const notes: string[] = []

function Harness({ projectStyle, override, initial = emptyQueue(), description }: { projectStyle: string; override?: string; initial?: QueueState; description?: string }) {
  const [queue, setQueue] = useState(initial)
  const [refs, setRefs] = useState<Record<string, string[]>>({})
  const [assets, setAssets] = useState<ExtractedAsset[]>(() => base.assets.map((a) => (a.id === amina.id ? { ...a, ...(override ? { style: { ...styleByName(override), locked: false } } : {}), ...(description ? { description } : {}) } : a)))
  useImageQueue(queue, (u) => setQueue(u), true)
  return <SheetStudio assets={assets} scenes={base.scenes} story={base.story} assetIndex={assets.findIndex((a) => a.id === amina.id)} style={styleByName(projectStyle)} queue={queue} setQueue={(u) => setQueue(u)} desktop providersVersion={0} onApproved={() => {}} notify={(m) => notes.push(m)} openProviders={() => {}} refs={refs} setRefs={(u) => setRefs(u)}
    onAssetStyle={(id, style) => setAssets((list) => list.map((a) => { if (a.id !== id) return a; if (style) return { ...a, style }; const { style: _x, ...rest } = a; return rest }))}
    onPatchAsset={(id, patch) => setAssets((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)))} />
}

const prompts = () => calls.filter((c) => c.name === 'generate_image').map((c) => String(c.args.prompt))

describe('SheetStudio with a 2D style', () => {
  it('sends the compiled 2D style, the description and the identity anchor to the provider, and shows what the asset inherits', async () => {
    calls.length = 0
    render(<Harness projectStyle="Clean digital cel animation" description="A tall woman with a silver braid" />)
    await waitFor(() => expect(calls.some((c) => c.name === 'credential_status')).toBe(true))
    expect(screen.getByText('inherited from the project')).toBeTruthy()
    expect(screen.getByText('2D')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /generate 5 views/i }))
    await waitFor(() => expect(prompts()).toHaveLength(1))
    const p = prompts()[0]
    expect(p).toContain('2D art style "Clean digital cel animation"')
    expect(p).toContain("Description (the person's own words): A tall woman with a silver braid")
    expect(p).toContain('not a 3D render and not a photograph')
    expect(p).not.toMatch(/Natural skin with visible fine texture/)
    const job = (calls.find((c) => c.name === 'generate_image')!.args)
    expect(job.aspect).toBeTruthy()
  })

  it('uses an asset\'s own style instead of the project\'s, says so, and goes back to inheriting on request', async () => {
    calls.length = 0
    render(<Harness projectStyle="Clean digital cel animation" override="Flat vector" />)
    expect(await screen.findByText('your override for this asset')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /generate 5 views/i }))
    await waitFor(() => expect(prompts()).toHaveLength(1))
    expect(prompts()[0]).toContain('2D art style "Flat vector"')
    expect(prompts()[0]).not.toContain('Clean digital cel animation')
    fireEvent.click(screen.getByRole('button', { name: /use the project style/i }))
    expect(await screen.findByText('inherited from the project')).toBeTruthy()
  })

  it('marks a picture made in another style as out of date, without approving or rejecting anything', async () => {
    calls.length = 0
    const queue0 = addSupplied(emptyQueue(), { assetId: amina.id, variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', aspect: '3:4', fullBody: true, path: 'C:/assets/front.png', width: 800, height: 1200 }).state
    const queue = { ...queue0, jobs: queue0.jobs.map((j) => ({ ...j, source: 'generated' as const, styleName: 'Flat vector', styleFp: 'Flat vector#old' })) }
    render(<Harness projectStyle="Clean digital cel animation" initial={queue} />)
    expect(await screen.findByText(/Made in Flat vector: out of date/)).toBeTruthy()
    expect(queue.jobs[0].approved).toBe(true)
  })

  it('reinterprets the approved picture as a new revision for review, keeping the original and its approval', async () => {
    calls.length = 0
    const q = addSupplied(emptyQueue(), { assetId: amina.id, variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', aspect: '3:4', fullBody: true, path: 'C:/assets/front.png', width: 800, height: 1200 }).state
    const stale = { ...q, jobs: q.jobs.map((j) => ({ ...j, source: 'generated' as const })) }
    let latest: QueueState = stale
    function Probe() {
      const [queue, setQueue] = useState(stale)
      latest = queue
      useImageQueue(queue, (u) => setQueue(u), true)
      return <SheetStudio assets={base.assets} scenes={base.scenes} story={base.story} assetIndex={base.assets.findIndex((a) => a.id === amina.id)} style={styleByName('Watercolor Storybook')} queue={queue} setQueue={(u) => setQueue(u)} desktop providersVersion={0} onApproved={() => {}} notify={() => {}} openProviders={() => {}} refs={{}} setRefs={() => {}} />
    }
    render(<Probe />)
    const button = await screen.findByRole('button', { name: /Reinterpret in Watercolor Storybook/ })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(button)
    await waitFor(() => expect(prompts()).toHaveLength(1))
    expect(prompts()[0]).toMatch(/new design revision/)
    expect(prompts()[0]).toMatch(/Identity may not carry over exactly/)
    const sent = calls.find((c) => c.name === 'generate_image')!.args.references as string[]
    expect(sent[0]).toBe('C:/assets/front.png')
    await waitFor(() => expect(latest.jobs.filter((j) => j.viewKey === 'front').length).toBe(2))
    const front = latest.jobs.filter((j) => j.viewKey === 'front').sort((a, b) => a.revision - b.revision)
    expect(front[0].approved).toBe(true)
    expect(front[0].outputPath).toBe('C:/assets/front.png')
    expect(front[1].approved).toBe(false)
    expect(front[1].revision).toBe(2)
  })

  it('shows a layout field only for a place, never demographic fields', async () => {
    render(<Harness projectStyle="Flat vector" />)
    fireEvent.click(await screen.findByText(/About this character/))
    expect(screen.getByLabelText('Description of AMINA')).toBeTruthy()
    expect(screen.queryByLabelText('Layout of AMINA')).toBeNull()
  })
})
