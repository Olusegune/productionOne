import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SkinLightingTest, type SkinLightingTestProps } from './SkinLightingTest'
import { emptyQueue, enqueue, type ImageJob, type QueueState } from '../domain/generationQueue'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { addRevision, approveRevision, emptyVariations, type VariationState } from '../domain/variations'
import { newSkin, recordSkin } from '../domain/skin'
import { lightingRequests, startLightingTest } from '../domain/skinLighting'
import type { ExtractedAsset } from '../domain/productionStudio'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}`, invoke: vi.fn().mockResolvedValue(null) }))

const mara = { id: 'CHAR-MARA', name: 'Mara', type: 'character', sceneIds: [], status: 'approved', age: '34' } as ExtractedAsset
const photo = { ...defaultStyleBible, family: 'Realistic 3D', name: 'Photoreal cinematic CG', rendering: 'photographic' }
const job = (over: Partial<ImageJob>): ImageJob => ({ id: 'J', key: 'k', assetId: 'CHAR-MARA', variant: 'Canonical', sheetType: 'Identity', viewKey: 'full-front', label: 'x', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false, outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: true, rejected: false, createdAt: 1, updatedAt: 1, outputPath: 'C:/m/full.jpg', ...over } as ImageJob)
const originals = (): QueueState => ({ ...emptyQueue(), perImageUsd: 0.04, jobs: [job({ id: 'J-FULL' }), job({ id: 'J-PORT', viewKey: 'portrait', outputPath: 'C:/m/portrait.jpg', fullBody: false })] })

function profile(): VariationState {
  const made = recordSkin(emptyVariations(), { ...newSkin(mara.id), complexion: 'warm olive' }, 'Mara', 'a'); if ('error' in made) throw new Error()
  return approveRevision(made.state, made.ref)
}
function generated(): { variations: VariationState; queue: QueueState } {
  const t = startLightingTest(profile(), { character: mara, now: 'n' }); if ('error' in t) throw new Error()
  const reqs = lightingRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: t.variant, test: t.ref, spec: newSkin(mara.id), source: 'C:/m/portrait.jpg' })
  const added = enqueue(originals(), reqs, 1, true).state
  return { variations: t.variations, queue: { ...added, jobs: added.jobs.map((j) => (j.variation ? { ...j, status: 'completed', outputPath: `C:/m/${j.viewKey}.jpg` } : j)) as ImageJob[] } }
}
function props(over: Partial<SkinLightingTestProps> = {}): SkinLightingTestProps {
  return { character: mara, variations: profile(), updateVariations: vi.fn(), queue: originals(), setQueue: vi.fn(), style: photo, desktop: false, providersVersion: 0, onApproved: vi.fn(), onUnapproved: vi.fn(), notify: vi.fn(), openProviders: vi.fn(), ...over }
}

describe('the lighting test', () => {
  it('shows nothing for a 2D or stylized project', () => {
    const { container } = render(<SkinLightingTest {...props({ style: { ...defaultStyleBible, family: '2D', name: 'Ink', rendering: 'flat 2D' } })} />)
    expect(container.textContent).toBe('')
  })
  it('starts nothing until the explicit button, and says what it is and is not', () => {
    const p = props()
    render(<SkinLightingTest {...p} />)
    expect(screen.getByText(/not the same picture relit and never a colour filter/)).toBeTruthy()
    expect(screen.getByText(/nothing here tries to remove a warm cast/)).toBeTruthy()
    expect(p.updateVariations).not.toHaveBeenCalled()
    expect(p.setQueue).not.toHaveBeenCalled()
  })
  it('Generate makes the test record and four requests, each with the approved picture as its one reference', () => {
    const p = props()
    render(<SkinLightingTest {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /Generate lighting test/ }))
    expect(p.updateVariations).toHaveBeenCalledTimes(1)
    const made = ((p.setQueue as ReturnType<typeof vi.fn>).mock.calls[0][0] as () => QueueState)().jobs.filter((j) => j.variation?.role === 'lighting-candidate')
    expect(made.map((j) => j.viewKey).sort()).toEqual(['light-backlight', 'light-directional', 'light-neutral-diffuse', 'light-soft-side'])
    expect(made.every((j) => j.references.length === 1 && j.references[0] === 'C:/m/portrait.jpg' && !j.approved)).toBe(true)
  })
  it('missing things are named and nothing starts', () => {
    const p = props({ variations: emptyVariations() })
    render(<SkinLightingTest {...p} />)
    expect(screen.getByRole('alert').textContent).toMatch(/Save and approve the skin profile first/)
    fireEvent.click(screen.getByRole('button', { name: /Generate lighting test/ }))
    expect(p.updateVariations).not.toHaveBeenCalled()
    expect(p.setQueue).not.toHaveBeenCalled()
  })
  it('compares each light with the approved reference; keeping needs identity and colour confirmed, per light', () => {
    const g = generated()
    const p = props({ ...g })
    render(<SkinLightingTest {...p} />)
    expect(screen.getByText('Compare each light with the approved reference')).toBeTruthy()
    const keep = screen.getByRole('button', { name: /Keep this light as a reference/ }) as HTMLButtonElement
    expect(keep.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/Is it still the same person/))
    expect(keep.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/Is the complexion \("warm olive"\) the same as the approved reference, allowing for this light/))
    expect(keep.disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Directional light' }))
    expect((screen.getByRole('button', { name: /Keep this light as a reference/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Neutral diffuse' }))
    fireEvent.click(keep)
    expect(p.setQueue).toHaveBeenCalledTimes(1)
    expect((p.onApproved as ReturnType<typeof vi.fn>).mock.calls[0][0].viewKey).toBe('light-neutral-diffuse')
    expect(screen.getAllByText(/A near-neutral light \(about 5600 K\)/).length).toBeGreaterThan(0)
  })
  it('says the test is out of date when the skin profile has changed since it was approved', () => {
    const g = generated()
    const approved = approveRevision(g.variations, { id: 'LGT-001', revision: 1 })
    const next = addRevision(approved, 'SKN-001', { spec: { ...newSkin(mara.id), preset: 'weathered', textureDetail: 'pronounced' }, now: 'x' })
    render(<SkinLightingTest {...props({ variations: approveRevision(next.state, next.ref), queue: g.queue })} />)
    expect(screen.getByText(/The skin profile has changed since this lighting test was approved/)).toBeTruthy()
  })
  it('explains pictures refused on this computer in plain words and does not count them as spend', () => {
    const g = generated()
    const outside = 'Only images in the Production One assets folder can be previewed (this one is at C:/other/a.png, the folder is C:/app) The request was not accepted.'
    const refused = { ...g.queue, jobs: g.queue.jobs.map((j) => (j.variation ? { ...j, status: 'failed', error: outside, attempts: 1, outputPath: undefined } : j)) as ImageJob[] }
    render(<SkinLightingTest {...props({ variations: g.variations, queue: refused })} />)
    const alert = screen.getAllByRole('alert').find((a) => /could not be made/.test(a.textContent ?? ''))!
    expect(alert.textContent).toMatch(/4 pictures could not be made/)
    expect(alert.textContent).toMatch(/stored outside the Production One folder/)
    expect(screen.getByText(/4 more were refused on this computer before sending, so they were not charged/)).toBeTruthy()
  })
})
