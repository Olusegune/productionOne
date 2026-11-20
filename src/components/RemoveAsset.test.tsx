import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RemoveAsset } from './RemoveAsset'
import { emptyQueue } from '../domain/generationQueue'
import { emptyReviews } from '../domain/visualReview'
import type { ProjectSlice } from '../domain/removeAsset'

const slice = (): ProjectSlice => ({
  analysis: { scenes: [], assets: [{ id: 'MARCUS', name: 'MARCUS', type: 'character', sceneIds: [], status: 'planned' }] } as never,
  queue: emptyQueue(), assetOutputs: {}, assetRefs: {}, proportions: {}, fitRules: {}, sheetNotes: {}, sheetSettings: {}, shots: [], sceneStates: {}, reviews: emptyReviews(),
})

describe('Remove from project', () => {
  it('asks first, removes only on confirm, and can be undone', () => {
    const apply = vi.fn()
    const s = slice()
    render(<RemoveAsset slice={s} assetId="MARCUS" apply={apply} />)
    fireEvent.click(screen.getByRole('button', { name: /remove from project/i }))
    expect(apply).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog').textContent).toMatch(/picture files stay on your computer|comes back|undo/i)
    fireEvent.click(screen.getByRole('button', { name: /^remove marcus$/i }))
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls[0][0].analysis.assets).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(apply.mock.calls[1][0]).toBe(s)
  })
  it('can be cancelled without changing anything', () => {
    const apply = vi.fn()
    render(<RemoveAsset slice={slice()} assetId="MARCUS" apply={apply} />)
    fireEvent.click(screen.getByRole('button', { name: /remove from project/i }))
    fireEvent.click(screen.getByRole('button', { name: /keep it/i }))
    expect(apply).not.toHaveBeenCalled()
  })
  it('shows nothing when no item is selected', () => {
    render(<RemoveAsset slice={slice()} assetId={undefined} apply={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /remove from project/i })).toBeNull()
  })
})
