import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (p: string) => `asset://${p}`, invoke: vi.fn(async () => ({})) }))
vi.mock('../data/localAi', () => ({ useLocalAi: () => ({ templates: [] }) }))

import { MotionDemo } from './MotionDemo'
import { emptyQueue, type ImageJob } from '../domain/generationQueue'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { StyleBible } from '../domain/visualDevelopment'

const asset = { id: 'C1', name: 'MARA', type: 'character', sceneIds: [], status: 'approved' } as ExtractedAsset
const anchor = { id: 'j', assetId: 'C1', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', approved: true, outputPath: 'C:/front.png', status: 'completed', revision: 1 } as unknown as ImageJob

describe('Motion audition video model', () => {
  it('is a drop-down of video models (not only Kling and Seedance) with a way to type another id', () => {
    render(<MotionDemo asset={asset} queue={{ ...emptyQueue(), jobs: [anchor] }} clips={[]} setClips={() => {}} style={{} as StyleBible} desktop={true} notify={() => {}} openProviders={() => {}} />)
    const select = screen.getByLabelText('Video model') as HTMLSelectElement
    const names = Array.from(select.options).map((o) => o.textContent)
    for (const n of ['Seedance 2.5', 'Kling 4.0 · reference to video', 'Wan 3.0', 'HappyHorse 1.1 · image to video', 'MiniMax H3 · image to video', 'PixVerse V6 · image to video']) expect(names).toContain(n)
    expect(names.at(-1)).toMatch(/Another model id/)
    // starts on a lower-cost model; the premium ones are still there, in their own labelled group
    expect(select.value).toBe('kling/image-to-video')
    const groups = Array.from(select.querySelectorAll('optgroup')).map((g) => g.label)
    expect(groups[0]).toMatch(/Lower cost/)
    expect(groups[1]).toMatch(/Premium/)
    expect(Array.from(select.querySelectorAll('optgroup')[1].querySelectorAll('option')).map((o) => o.textContent)).toContain('Seedance 2.5')
    expect(screen.queryByLabelText('Video model id')).toBeNull()
    fireEvent.change(select, { target: { value: '__other' } })
    const box = screen.getByLabelText('Video model id') as HTMLInputElement
    fireEvent.change(box, { target: { value: 'vendor/new-video' } })
    expect(box.value).toBe('vendor/new-video')
  })
})
