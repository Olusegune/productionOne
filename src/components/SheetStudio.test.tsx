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
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (name: string, args: Record<string, unknown> = {}) => {
    calls.push({ name, args })
    if (name === 'credential_status') return true
    if (name === 'model_catalog') return {}
    if (name === 'generate_image') return { path: 'C:/a.png', inspection: { width: 1024, height: 1536, warnings: [] } }
    if (name === 'qa_image') return { notes: [] }
    if (name === 'image_preview') return 'data:image/jpeg;base64,AAAA'
    return undefined
  },
}))

const analysis = analyzeScript(sampleStory)

function Harness({ initial = emptyQueue() }: { initial?: QueueState }) {
  const [queue, setQueue] = useState(initial)
  useImageQueue(queue, (u) => setQueue(u), true)
  const jonah = analysis.assets.findIndex((a) => a.name === 'AMINA')
  return <SheetStudio assets={analysis.assets} scenes={analysis.scenes} story={analysis.story} assetIndex={jonah} style={defaultStyleBible} queue={queue} setQueue={(u) => setQueue(u)} desktop providersVersion={0} onApproved={() => {}} notify={() => {}} openProviders={() => {}} />
}

describe('SheetStudio generate flow', () => {
  it('one Generate press queues the views, asks for the spending limit, then runs the front view first', async () => {
    calls.length = 0
    render(<Harness />)
    await waitFor(() => expect(calls.some((c) => c.name === 'credential_status')).toBe(true))
    fireEvent.click(await screen.findByRole('button', { name: /generate 5 views/i }))
    // the spending sheet opens by itself because no limit exists yet
    const price = await screen.findByLabelText(/price per image/i)
    fireEvent.change(price, { target: { value: '0.05' } })
    fireEvent.change(screen.getByLabelText(/total spending ceiling/i), { target: { value: '0.5' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /allow generation/i }))
    await waitFor(() => expect(calls.filter((c) => c.name === 'generate_image')).toHaveLength(1))
    expect(calls.find((c) => c.name === 'generate_image')!.args.outputName).toContain('front')
    await screen.findAllByText(/needs review/i)
    expect(calls.filter((c) => c.name === 'generate_image')).toHaveLength(1) // the other four wait for the approved front
  })
})
