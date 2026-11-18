import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addCleaned, type ImageJob, type QueueState } from '../domain/generationQueue'
import { CleanRender, mergeSuggestion, neutral } from './CleanRender'

let failUpscale = false
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
    if (cmd === 'upscale_image') { if (failUpscale) throw new Error('Kie.ai request failed (402): insufficient credits'); return { path: 'C:/assets/front_up_01.png', width: 2048, height: 2048 } }
    if (cmd === 'clean_save') return { path: 'C:/assets/front_clean_01.png', width: 1024, height: 1024 }
    return undefined
  },
}))

const job = (id: string, approved = true): ImageJob => ({
  id, key: id, assetId: 'CHAR-1', variant: 'Canonical', sheetType: 'Turnaround', viewKey: id, label: id, prompt: '', aspect: '1:1', fullBody: false, provider: 'kie', model: 'm', references: [], useAnchor: false,
  outputName: `${id}_v01`, revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, outputPath: `C:/assets/${id}.png`, width: 1024, height: 1024, qaNotes: [], approved, rejected: false, createdAt: 0, updatedAt: 0,
})

beforeEach(() => { calls.length = 0; failUpscale = false })

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

describe('brightness, contrast and enlarging', () => {
  it('offers brightness and contrast, and sends them with the preview', async () => {
    render(<CleanRender items={[job('front')]} index={0} onIndex={() => {}} onClose={() => {}} notify={() => {}} onSaved={() => {}} />)
    await screen.findByText(/lean strongly yellow/)
    const contrast = screen.getByText('Contrast').closest('label')!.querySelector('input') as HTMLInputElement
    expect(screen.getByText('Brightness')).toBeTruthy()
    fireEvent.change(contrast, { target: { value: '40' } })
    await waitFor(() => expect(calls.some((c) => c.cmd === 'clean_preview' && (c.args.params as { contrast: number }).contrast === 40 && c.args.original === false)).toBe(true))
    expect((screen.getByRole('button', { name: /save corrected revision/i }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('enlarges 2x or 4x on its own, says it is not AI, and saves with the factor', async () => {
    const saved: string[] = []
    render(<CleanRender items={[job('front')]} index={0} onIndex={() => {}} onClose={() => {}} notify={() => {}} onSaved={(j) => saved.push(j.id)} />)
    await screen.findByText(/lean strongly yellow/)
    const save = screen.getByRole('button', { name: /save corrected revision/i }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByRole('combobox', { name: 'Enlarge' }), { target: { value: '2' } })
    expect(save.disabled).toBe(false)
    expect(screen.getByText(/without adding detail/)).toBeTruthy()
    fireEvent.click(save)
    await waitFor(() => expect(saved).toEqual(['front']))
    expect((calls.find((c) => c.cmd === 'clean_save')?.args.params as { enlarge: number }).enlarge).toBe(2)
  })
  it('a suggestion never changes the enlarge choice', () => {
    expect(mergeSuggestion({ ...neutral, enlarge: 4 }, { ...neutral, temperature: -30 }).enlarge).toBe(4)
  })
})

describe('upscalers', () => {
  const open = (items = [job('front')], onSaved: (j: ImageJob, f: { path: string }) => void = () => {}) => render(<CleanRender items={items} index={0} onIndex={() => {}} onClose={() => {}} notify={() => {}} onSaved={onSaved} />)
  const choose = (value: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Enlarge method' }), { target: { value } })
  it('offers the four ways to enlarge only once enlarging is on, smooth first', async () => {
    open()
    await screen.findByText(/lean strongly yellow/)
    expect(screen.queryByRole('combobox', { name: 'Enlarge method' })).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: 'Enlarge' }), { target: { value: '2' } })
    const options = Array.from((screen.getByRole('combobox', { name: 'Enlarge method' }) as HTMLSelectElement).options).map((o) => o.value)
    expect(options).toEqual(['smooth', 'local', 'topaz', 'magnific'])
    expect((screen.getByRole('combobox', { name: 'Enlarge method' }) as HTMLSelectElement).value).toBe('smooth')
  })
  it('says a paid upscaler costs money, names the button for it, and spends nothing until it is pressed', async () => {
    open([job('front'), job('side')])
    await screen.findByText(/lean strongly yellow/)
    fireEvent.change(screen.getByRole('combobox', { name: 'Enlarge' }), { target: { value: '4' } })
    choose('topaz')
    expect(screen.getByText(/Topaz costs money/)).toBeTruthy()
    expect(screen.getByText(/Billed by Kie.ai/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Upscale 4× with Topaz \(paid\) and save/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /apply to all/i })).toBeNull()
    expect(calls.some((c) => c.cmd === 'upscale_image')).toBe(false)
    choose('magnific')
    expect(screen.getByText(/Magnific costs money/)).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Magnific style' })).toBeTruthy()
  })
  it('sends the chosen method, factor and picture, and saves the result as a copy', async () => {
    const saved: string[] = []
    open([job('front')], (_, f) => saved.push(f.path))
    await screen.findByText(/lean strongly yellow/)
    fireEvent.change(screen.getByRole('combobox', { name: 'Enlarge' }), { target: { value: '2' } })
    choose('topaz')
    fireEvent.click(screen.getByRole('button', { name: /Upscale 2× with Topaz/ }))
    await waitFor(() => expect(saved).toEqual(['C:/assets/front_up_01.png']))
    expect(calls.filter((c) => c.cmd === 'upscale_image')).toHaveLength(1)
    expect(calls.find((c) => c.cmd === 'upscale_image')?.args).toMatchObject({ method: 'topaz', path: 'C:/assets/front.png', factor: 2 })
    expect(calls.some((c) => c.cmd === 'clean_save')).toBe(false)
  })
  it('shows a failure inside the panel (the notice behind it cannot be seen), and a success too', async () => {
    failUpscale = true
    open()
    await screen.findByText(/lean strongly yellow/)
    fireEvent.change(screen.getByRole('combobox', { name: 'Enlarge' }), { target: { value: '2' } })
    choose('topaz')
    fireEvent.click(screen.getByRole('button', { name: /Upscale 2× with Topaz/ }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/insufficient credits/)
    failUpscale = false
    fireEvent.click(screen.getByRole('button', { name: /Upscale 2× with Topaz/ }))
    expect(await screen.findByText(/Saved a 2× copy made with Topaz \(2048×2048\)/)).toBeTruthy()
  })
  it('applies the adjustments first, without enlarging them, then upscales that copy', async () => {
    open()
    await screen.findByText(/lean strongly yellow/)
    fireEvent.change(screen.getByText('Contrast').closest('label')!.querySelector('input') as HTMLInputElement, { target: { value: '30' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Enlarge' }), { target: { value: '2' } })
    choose('local')
    fireEvent.click(screen.getByRole('button', { name: /Upscale 2× with Real-ESRGAN and save/ }))
    await waitFor(() => expect(calls.some((c) => c.cmd === 'upscale_image')).toBe(true))
    const order = calls.filter((c) => c.cmd === 'clean_save' || c.cmd === 'upscale_image')
    expect(order.map((c) => c.cmd)).toEqual(['clean_save', 'upscale_image'])
    expect(order[0].args.params).toMatchObject({ contrast: 30, enlarge: 1 })
    expect(order[1].args).toMatchObject({ method: 'local', path: 'C:/assets/front_clean_01.png', factor: 2 })
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
