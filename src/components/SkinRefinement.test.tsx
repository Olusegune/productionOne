import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SkinRefinement, type SkinRefinementProps } from './SkinRefinement'
import { emptyQueue, enqueue, type ImageJob, type QueueState } from '../domain/generationQueue'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { approveRevision, emptyVariations, type VariationState } from '../domain/variations'
import { newSkin, recordSkin } from '../domain/skin'
import { skinRequests, sourceForView, startSkinRefinement } from '../domain/skinRefine'
import type { ExtractedAsset } from '../domain/productionStudio'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}`, invoke: vi.fn().mockResolvedValue(null) }))

const mara = { id: 'CHAR-MARA', name: 'Mara', type: 'character', sceneIds: [], status: 'approved', age: '34' } as ExtractedAsset
const photo = { ...defaultStyleBible, family: 'Realistic 3D', name: 'Photoreal cinematic CG', rendering: 'photographic' }
const job = (over: Partial<ImageJob>): ImageJob => ({ id: 'J', key: 'k', assetId: 'CHAR-MARA', variant: 'Canonical', sheetType: 'Identity', viewKey: 'full-front', label: 'x', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false, outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: true, rejected: false, createdAt: 1, updatedAt: 1, outputPath: 'C:/m/full.jpg', ...over } as ImageJob)

function profile(): VariationState {
  const made = recordSkin(emptyVariations(), newSkin(mara.id), 'Mara', 'a'); if ('error' in made) throw new Error()
  return approveRevision(made.state, made.ref)
}
const originals = (): QueueState => ({ ...emptyQueue(), perImageUsd: 0.04, jobs: [job({ id: 'J-FULL' }), job({ id: 'J-PORT', viewKey: 'portrait', outputPath: 'C:/m/portrait.jpg', fullBody: false })] })

/** A refinement that has been generated: candidate revision, two finished pictures. */
function generated(): { variations: VariationState; queue: QueueState } {
  const started = startSkinRefinement(profile(), { character: mara, now: 'n' }); if ('error' in started) throw new Error()
  const q = originals()
  const reqs = skinRequests({ style: photo, provider: 'kie', model: 'nano', character: mara, lookName: started.variant, skin: started.ref, spec: started.spec, sources: { portrait: sourceForView(q, mara, 'portrait') as string, 'full-front': sourceForView(q, mara, 'full-front') as string } })
  const added = enqueue(q, reqs, 1, true).state
  return { variations: started.variations, queue: { ...added, jobs: added.jobs.map((j) => (j.variation ? { ...j, status: 'completed', outputPath: `C:/m/refined-${j.viewKey}.jpg` } : j)) as ImageJob[] } }
}

function props(over: Partial<SkinRefinementProps> = {}): SkinRefinementProps {
  return { character: mara, variations: profile(), updateVariations: vi.fn(), queue: originals(), setQueue: vi.fn(), style: photo, desktop: false, providersVersion: 0, onApproved: vi.fn(), onUnapproved: vi.fn(), notify: vi.fn(), openProviders: vi.fn(), onOpenSheets: vi.fn(), ...over }
}

describe('skin refinement', () => {
  it('shows nothing for a stylized or 2D project (it never pushes toward realism)', () => {
    const { container } = render(<SkinRefinement {...props({ style: { ...defaultStyleBible, family: 'Family 3D', name: 'Family 3D Feature', rendering: 'stylized 3D' } })} />)
    expect(container.textContent).toBe('')
  })

  it('renders without starting anything: no record, no request, until the explicit button', () => {
    const p = props()
    render(<SkinRefinement {...p} />)
    expect(screen.getByRole('button', { name: /Generate refinement/ })).toBeTruthy()
    expect(screen.getByText(/Pressing the button below is the only thing that spends money/)).toBeTruthy()
    expect(p.updateVariations).not.toHaveBeenCalled()
    expect(p.setQueue).not.toHaveBeenCalled()
  })

  it('Generate refinement makes a candidate record and two requests, each with the approved original as its one reference', () => {
    const p = props()
    render(<SkinRefinement {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /Generate refinement/ }))
    expect(p.updateVariations).toHaveBeenCalledTimes(1)
    expect(p.setQueue).toHaveBeenCalledTimes(1)
    const next = (p.setQueue as ReturnType<typeof vi.fn>).mock.calls[0][0] as () => QueueState
    const made = next().jobs.filter((j) => j.variation?.role === 'skin-candidate')
    expect(made.map((j) => j.viewKey).sort()).toEqual(['full-front', 'portrait'])
    expect(made.find((j) => j.viewKey === 'portrait')?.references).toEqual(['C:/m/portrait.jpg'])
    expect(made.every((j) => j.references.length === 1 && !j.approved)).toBe(true)
    expect(p.notify).toHaveBeenCalledWith(expect.stringMatching(/The approved picture is not changed/))
  })

  it('missing things are named and nothing starts: no approved profile, no approved picture', () => {
    const none = props({ variations: emptyVariations() })
    const { unmount } = render(<SkinRefinement {...none} />)
    expect(screen.getByRole('alert').textContent).toMatch(/Save and approve the skin profile first/)
    expect((screen.getByRole('button', { name: /Generate refinement/ }) as HTMLButtonElement).disabled).toBe(true)
    unmount()
    const noPicture = props({ queue: { ...emptyQueue(), jobs: [] } })
    render(<SkinRefinement {...noPicture} />)
    expect(screen.getByRole('alert').textContent).toMatch(/Approve Mara's front view first.*nothing to start from/)
    fireEvent.click(screen.getByRole('button', { name: /Generate refinement/ }))
    expect(noPicture.updateVariations).not.toHaveBeenCalled()
    expect(noPicture.setQueue).not.toHaveBeenCalled()
  })

  it('compares with the original; approval needs the identity decision, and better skin alone is not enough', () => {
    const g = generated()
    const p = props({ ...g })
    render(<SkinRefinement {...p} />)
    expect(screen.getByRole('heading', { name: /Compare with the original/ })).toBeTruthy()
    expect(within(screen.getByRole('group', { name: 'Look closely at' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Forehead', 'Eye area', 'Cheeks', 'Mouth'])
    expect(screen.getByText('Original (approved)')).toBeTruthy()
    const approveButton = screen.getByRole('button', { name: /Approve as a new version/ }) as HTMLButtonElement
    expect(approveButton.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/Surface:/))
    expect(approveButton.disabled).toBe(true)
    expect(screen.getByText(/Better-looking skin is not enough on its own/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/Identity:/))
    expect(approveButton.disabled).toBe(false)
    fireEvent.click(approveButton)
    expect(p.setQueue).toHaveBeenCalledTimes(1)
    expect(p.onApproved).toHaveBeenCalledTimes(1)
    expect((p.onApproved as ReturnType<typeof vi.fn>).mock.calls[0][0].viewKey).toBe('portrait')
  })

  it('lists what is protected and what is meant to change, and offers the before/after toggle', () => {
    render(<SkinRefinement {...props({ ...generated() })} />)
    expect(screen.getByText('Protected (should be unchanged)')).toBeTruthy()
    expect(within(screen.getByText('Protected (should be unchanged)').parentElement as HTMLElement).getByText('Facial structure')).toBeTruthy()
    expect(screen.getByText('Intended to change')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Original' }))
    expect([...document.querySelectorAll('figcaption')].map((c) => c.textContent)).toEqual(['Original (approved)'])
    fireEvent.click(screen.getByRole('button', { name: 'Candidate' }))
    expect([...document.querySelectorAll('figcaption')].map((c) => c.textContent)).toEqual(['Candidate'])
  })

  it('turning it down rejects the candidates; request changes only explains and keeps history', () => {
    const p = props({ ...generated() })
    render(<SkinRefinement {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))
    expect(p.setQueue).not.toHaveBeenCalled()
    expect(p.notify).toHaveBeenCalledWith(expect.stringMatching(/stays in the history; nothing is overwritten/))
    fireEvent.click(screen.getByRole('button', { name: /Turn down this refinement/ }))
    expect(p.setQueue).toHaveBeenCalledTimes(2)
  })

  it('shows what has been spent, and that retries add to it', () => {
    const g = generated()
    const retried = { ...g.queue, jobs: g.queue.jobs.map((j) => (j.variation ? { ...j, attempts: j.viewKey === 'portrait' ? 3 : 1 } : j)) }
    render(<SkinRefinement {...props({ variations: g.variations, queue: retried })} />)
    expect(screen.getByText(/Spent on refinements so far: 4 attempts, about \$0\.16\. Retries add to this and never replace it\./)).toBeTruthy()
  })

  it('once a refinement is approved, new sheets are offered from the approved skin reference', () => {
    const g = generated()
    const approvedState = approveRevision(g.variations, { id: 'SKN-001', revision: 2 })
    const approvedQueue = { ...g.queue, jobs: g.queue.jobs.map((j) => (j.variation && j.viewKey === 'full-front' ? { ...j, approved: true } : j)) }
    const p = props({ variations: approvedState, queue: approvedQueue })
    render(<SkinRefinement {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /Make reference sheets with this skin/ }))
    expect(p.onOpenSheets).toHaveBeenCalledWith('Mara, refined skin')
  })
})
