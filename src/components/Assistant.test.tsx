import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { approve, emptyQueue, type QueueState } from '../domain/generationQueue'
import { demoAssets2D, styleByName } from '../domain/demo2d'
import type { AnalysisResult, ShotRecord } from '../domain/productionStudio'
import { AssistantView, HELP, WRITE_SYSTEM, forgetAssistant } from './Assistant'

const calls: Array<{ name: string; args: Record<string, unknown> }> = []
let keys = { google: false, openrouter: false }
let attachments: unknown[] = []
let written = 'Title: Lantern\n\nINT. HARBOUR OFFICE - DAY\n\nMIRA holds a brass lantern.\n\nMIRA\nWe sail at dawn.'
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }))
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
  invoke: async (name: string, args: Record<string, unknown> = {}) => {
    calls.push({ name, args })
    if (name === 'credential_status') return !!(keys as Record<string, boolean>)[String(args.provider)]
    if (name === 'model_catalog') return {}
    if (name === 'kie_models') return { kie: { fetchedAt: Date.now() / 1000, models: [] } }
    if (name === 'pick_attachments') return attachments
    if (name === 'assistant_complete') return written
    return undefined
  },
}))

const style = styleByName('Clean digital cel animation')
const none: AnalysisResult = { scenes: [], assets: [] }
const filled: AnalysisResult = { scenes: [], assets: demoAssets2D() }

function Harness(p: { analysis?: AnalysisResult; useScript?: (n: string, k: string, t: string) => unknown; addImages?: (k: string, paths: string[]) => Promise<number>; auto?: boolean; onQueue?: (q: QueueState) => void }) {
  const [queue, setQueue] = useState<QueueState>(emptyQueue())
  const [shots, setShots] = useState<ShotRecord[]>([])
  useEffect(() => { p.onQueue?.(queue) }, [queue])
  // a stand-in for the image model: queued pictures come back finished
  useEffect(() => {
    if (!p.auto) return
    if (queue.jobs.some((j) => ['queued', 'pending'].includes(j.status))) setQueue((q) => ({ ...q, jobs: q.jobs.map((j) => (['queued', 'pending'].includes(j.status) ? { ...j, status: 'needs-review' as const, outputPath: `C:/assets/${j.outputName}.png` } : j)) }))
  }, [queue, p.auto])
  return <AssistantView analysis={p.analysis ?? none} shots={shots} setShots={(u) => setShots(u)} queue={queue} setQueue={(u) => setQueue(u)} style={style} assetRefs={{}} format="16:9" script="" desktop providersVersion={0}
    notify={() => {}} openProviders={() => calls.push({ name: 'open-providers', args: {} })} openReview={() => calls.push({ name: 'open-review', args: {} })} openDesign={() => {}} openDeliver={() => {}}
    useScript={(p.useScript ?? (() => ({ ok: true, scenes: 2, assets: 3 }))) as never} addImages={p.addImages ?? (async () => 2)} onApproved={() => {}} />
}
const type = (text: string) => { fireEvent.change(screen.getByLabelText('Message'), { target: { value: text } }); fireEvent.click(screen.getByRole('button', { name: /^Send$/ })) }

beforeEach(() => { forgetAssistant(); calls.length = 0; keys = { google: false, openrouter: false }; attachments = [] })

describe('the assistant chat', () => {
  it('greets you and offers friendly starting points, and explains itself on request', async () => {
    render(<Harness />)
    expect((await screen.findAllByText(/Give me a script or an idea/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Attach a script \(Word, PDF, text\)/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Describe a short film/ })).toBeTruthy()
    type('help')
    expect(await screen.findByText(/Attach a script: a Word document, a PDF/)).toBeTruthy()
    expect(HELP).toMatch(/Nothing is made until you press Start/)
  })

  it('reads an attached Word or PDF script and says what it found', async () => {
    attachments = [{ path: 'C:/docs/film.docx', name: 'film.docx', kind: 'script', text: 'INT. HARBOUR - DAWN\n\nMIRA waits.' }, { path: 'C:/docs/old.pdf', name: 'old.pdf', kind: 'script', text: 'EXT. PIER - NIGHT\n\nA lamp.' }]
    const useScript = vi.fn(() => ({ ok: true, scenes: 4, assets: 9 }))
    render(<Harness useScript={useScript} />)
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }))
    expect(await screen.findByLabelText('Attached files')).toBeTruthy()
    expect(screen.getByText(/film\.docx/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Send$/ }))
    expect(await screen.findAllByText(/I read (film\.docx|old\.pdf): 4 scenes and 9 characters, props and places/)).toHaveLength(2)
    expect(useScript).toHaveBeenCalledWith('film.docx', 'text', 'INT. HARBOUR - DAWN\n\nMIRA waits.')
    expect(useScript).toHaveBeenCalledTimes(2)
  })

  it('tells you plainly when a file cannot be used, and lets you take an attachment off', async () => {
    attachments = [{ path: 'C:/x/virus.exe', name: 'virus.exe', kind: 'unsupported', error: 'Production One reads scripts (.txt, .md, .fountain, .fdx, .docx, .pdf) and pictures (.png, .jpg, .webp).' }, { path: 'C:/x/ok.txt', name: 'ok.txt', kind: 'script', text: 'INT. A - DAY' }]
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }))
    await screen.findByLabelText('Attached files')
    fireEvent.click(screen.getByRole('button', { name: 'Remove ok.txt' }))
    expect(screen.queryByText('ok.txt')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Send$/ }))
    expect(await screen.findByText(/I could not use virus\.exe: Production One reads scripts/)).toBeTruthy()
  })

  it('turns attached pictures into items of the kind you choose', async () => {
    attachments = [{ path: 'C:/p/a.png', name: 'a.png', kind: 'image' }, { path: 'C:/p/b.jpg', name: 'b.jpg', kind: 'image' }]
    const addImages = vi.fn(async () => 2)
    render(<Harness addImages={addImages} />)
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }))
    await screen.findByLabelText('Attached files')
    fireEvent.click(screen.getByRole('button', { name: /^Send$/ }))
    const group = await screen.findByRole('group', { name: 'What are these pictures?' })
    fireEvent.click(Array.from(group.querySelectorAll('button')).find((b) => b.textContent === 'Characters')!)
    await waitFor(() => expect(addImages).toHaveBeenCalledWith('character', ['C:/p/a.png', 'C:/p/b.jpg']))
    expect(await screen.findByText(/Added 2 items, each with your picture as the approved reference/)).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'What are these pictures?' })).toBeNull()
  })

  it('writes a script from a short idea when a language model key is saved, and reads it back', async () => {
    keys = { google: true, openrouter: false }
    const useScript = vi.fn(() => ({ ok: true, scenes: 1, assets: 2 }))
    render(<Harness useScript={useScript} />)
    await waitFor(() => expect(calls.some((c) => c.name === 'credential_status' && c.args.provider === 'google')).toBe(true))
    await new Promise((r) => setTimeout(r, 50))
    type('A short film about a harbour pilot and a lantern')
    await waitFor(() => expect(calls.some((c) => c.name === 'assistant_complete')).toBe(true))
    const ask = calls.find((c) => c.name === 'assistant_complete')!.args as { provider: string; model: string; system: string; messages: Array<{ role: string; text: string }> }
    expect(ask).toMatchObject({ provider: 'google', model: 'gemini-2.5-flash', system: WRITE_SYSTEM })
    expect(ask.messages[0]).toMatchObject({ role: 'user' })
    expect(ask.messages[0].text).toContain('A short film about a harbour pilot and a lantern')
    expect(await screen.findByText(/Here is the script I wrote/)).toBeTruthy()
    expect(useScript).toHaveBeenCalledWith('the script I wrote', 'text', written)
  })

  it('does not pretend: with no key it says it cannot write from an idea and offers to add one', async () => {
    render(<Harness />)
    await new Promise((r) => setTimeout(r, 50))
    type('A short film about a harbour pilot')
    expect(await screen.findByText(/I need a language model key/)).toBeTruthy()
    expect(calls.some((c) => c.name === 'assistant_complete')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Add a key' }))
    expect(calls.some((c) => c.name === 'open-providers')).toBe(true)
  })

  it('takes a pasted script as it is, without asking a model', async () => {
    keys = { google: true, openrouter: false }
    const useScript = vi.fn(() => ({ ok: true, scenes: 3, assets: 5 }))
    render(<Harness useScript={useScript} />)
    await new Promise((r) => setTimeout(r, 50))
    type('INT. KITCHEN - DAY\n\nTOM cooks.')
    expect(await screen.findByText(/I read your script: 3 scenes and 5 characters/)).toBeTruthy()
    expect(calls.some((c) => c.name === 'assistant_complete')).toBe(false)
  })
})

describe('the plan and the run', () => {
  const setMoney = (price: string, budget: string) => {
    fireEvent.change(screen.getByLabelText('Price per picture in dollars'), { target: { value: price } })
    fireEvent.change(screen.getByLabelText('Budget in dollars'), { target: { value: budget } })
  }

  it('shows nothing to plan until there is something to make', () => {
    render(<Harness />)
    expect(screen.getByText(/Nothing to plan yet/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Start/ })).toBeNull()
  })

  it('shows the number of pictures and the cost, and will not start without a price and a budget', () => {
    render(<Harness analysis={filled} />)
    const sum = () => document.querySelector('.asst-sum')?.textContent ?? ''
    expect(sum()).toMatch(/3 items/)
    expect(sum()).toMatch(/35 pictures/)
    const start = screen.getByRole('button', { name: /^Start/ }) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toMatch(/Enter what one picture costs/)
    setMoney('0.1', '')
    expect(screen.getByRole('alert').textContent).toMatch(/Set a budget/)
    setMoney('0.1', '2')
    expect(screen.getByRole('alert').textContent).toMatch(/\$3\.50.*\$2\.00/)
    expect(start.disabled).toBe(true)
    setMoney('0.1', '5')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(start.disabled).toBe(false)
    expect(start.textContent).toMatch(/about \$3\.50/)
    fireEvent.click(screen.getByRole('button', { name: 'Quick: one sheet each' }))
    expect(sum()).toMatch(/11 pictures/)
  })

  it('spends nothing until Start, then puts the budget on the queue, stops for the concepts, and approves nothing by itself', async () => {
    let latest = emptyQueue()
    render(<Harness analysis={filled} auto onQueue={(q) => { latest = q }} />)
    setMoney('0.1', '5')
    expect(latest.jobs).toHaveLength(0)
    expect(latest.guard).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /^Start/ }))
    expect(await screen.findByText(/3 concepts waiting for you/, {}, { timeout: 4000 })).toBeTruthy()
    expect(latest.guard).toBe(true)
    expect(latest).toMatchObject({ perImageUsd: 0.1, totalCeilingUsd: 5 })
    expect(latest.jobs).toHaveLength(3)
    expect(latest.jobs.some((j) => j.approved)).toBe(false)
    expect(screen.getByRole('button', { name: /^Continue$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Review' })).toBeTruthy()
  })

  it('carries on to every sheet after you approve the concepts and press Continue, then reports honestly and gives the budget settings back', async () => {
    let latest = emptyQueue()
    let setQ: ((u: (q: QueueState) => QueueState) => void) | null = null
    function Wrap() {
      const [queue, setQueue] = useState<QueueState>(emptyQueue())
      latest = queue; setQ = setQueue
      useEffect(() => { if (queue.jobs.some((j) => ['queued', 'pending'].includes(j.status))) setQueue((q) => ({ ...q, jobs: q.jobs.map((j, i) => (['queued', 'pending'].includes(j.status) ? (j.viewKey === 'top' ? { ...j, status: 'failed' as const, error: 'Kie 403' } : { ...j, status: 'needs-review' as const, outputPath: `C:/assets/${j.outputName}.png` }) : j)) })) }, [queue])
      return <AssistantView analysis={filled} shots={[]} setShots={() => {}} queue={queue} setQueue={(u) => setQueue(u)} style={style} assetRefs={{}} format="16:9" script="" desktop providersVersion={0} notify={() => {}} openProviders={() => {}} openReview={() => {}} openDesign={() => {}} openDeliver={() => {}} useScript={(() => ({ ok: true, scenes: 1, assets: 1 })) as never} addImages={async () => 0} onApproved={() => {}} />
    }
    render(<Wrap />)
    setMoney('0.1', '5')
    fireEvent.click(screen.getByRole('button', { name: /^Start/ }))
    await screen.findByText(/3 concepts waiting for you/, {}, { timeout: 4000 })
    act(() => { setQ!((q) => q.jobs.reduce((acc, j) => approve(acc, j.id), q)) })
    fireEvent.click(await screen.findByRole('button', { name: /^Continue$/ }))
    await screen.findByLabelText('Report', {}, { timeout: 6000 })
    expect(latest.jobs.length).toBe(35)
    const report = screen.getByLabelText('Report').textContent ?? ''
    expect(report).toMatch(/Finished/)
    expect(report).toMatch(/1 failed/)
    expect(report).toMatch(/Brass lantern, Top: Kie 403/)
    expect(report).toMatch(/your own estimate from the price you entered, not a bill/)
    expect(latest.guard).toBe(false)
    expect(latest.perImageUsd).toBeNull()
    expect(report).toMatch(/About \$\d+\.\d\d spent on requests sent/)
  })

  it('can stop a run, cancelling what has not started, and says so', async () => {
    render(<Harness analysis={filled} />)
    setMoney('0.1', '5')
    fireEvent.click(screen.getByRole('button', { name: /^Start/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Stop/ }))
    expect(await screen.findByText(/Stopped\. Pictures already being made will finish/)).toBeTruthy()
    expect(screen.getByLabelText('Report').textContent).toMatch(/Stopped/)
  })
})
