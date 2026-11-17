import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ImageJob } from '../domain/generationQueue'
import { Lightbox, type LightboxItem } from './Lightbox'
import { ModelPicker } from './ModelPicker'
import { builtInModels } from '../domain/imageCatalog'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (p: string) => `asset://${p}`, invoke: async () => undefined }))

const job = (id: string, status: ImageJob['status']): ImageJob => ({
  id, key: id, assetId: 'CHAR-1', variant: 'Canonical', sheetType: 'Turnaround', viewKey: id, label: id, prompt: '', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false,
  outputName: id, revision: 1, status, attempts: 1, maxAttempts: 3, outputPath: `C:/${id}.png`, width: 1024, height: 1536, qaNotes: ['Something touches the bottom edge: the feet may be cropped.'], approved: false, rejected: false, createdAt: 0, updatedAt: 0,
})
const items: LightboxItem[] = [{ job: job('front', 'needs-review'), label: 'Front' }, { job: job('side', 'completed'), label: 'Side' }, { job: job('rear', 'needs-review'), label: 'Rear' }]

function Harness({ onApprove = () => {}, onReject = () => {}, onClose = () => {}, onReconsider = undefined as undefined | (() => void), list = items }) {
  const [i, setI] = useState(0)
  return <Lightbox items={list} index={i} onIndex={setI} onClose={onClose} onApprove={onApprove} onReject={onReject} onReconsider={onReconsider} />
}

describe('Lightbox', () => {
  it('shows the full file, its notes, and moves between views with the arrow keys', () => {
    render(<Harness />)
    expect(screen.getByAltText('Front, full size').getAttribute('src')).toBe('asset://C:/front.png')
    expect(screen.getByText(/feet may be cropped/)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByAltText('Side, full size')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByAltText('Rear, full size')).toBeTruthy()
  })
  it('zooms with the keyboard and the buttons and resets to fit', () => {
    render(<Harness />)
    expect(screen.getByText('100%')).toBeTruthy()
    fireEvent.keyDown(window, { key: '+' })
    expect(screen.queryByText('100%')).toBeNull()
    fireEvent.click(screen.getByLabelText('Fit to screen'))
    expect(screen.getByText('100%')).toBeTruthy()
  })
  it('can take a decision back: approved or rejected pictures show Take back / Not decided (and U), waiting ones do not', () => {
    const back = vi.fn()
    const decided: LightboxItem[] = [{ job: { ...job('a', 'completed'), approved: true }, label: 'Approved one' }, { job: { ...job('b', 'completed'), rejected: true }, label: 'Rejected one' }, { job: job('c', 'needs-review'), label: 'Waiting one' }]
    render(<Harness list={decided} onReconsider={back} />)
    expect(screen.getByText('Take back approval')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Approve A/ })).toBeNull()
    fireEvent.keyDown(window, { key: 'u' })
    expect(back).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Not decided')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Approve A/ })).toBeTruthy() // a rejected picture can be approved directly
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.queryByText('Not decided')).toBeNull()
    fireEvent.keyDown(window, { key: 'u' })
    expect(back).toHaveBeenCalledTimes(1)
  })
  it('approves and rejects an image that is waiting or already decided, and closes with Escape', () => {
    const approve = vi.fn()
    const reject = vi.fn()
    const close = vi.fn()
    render(<Harness onApprove={approve} onReject={reject} onClose={close} />)
    fireEvent.keyDown(window, { key: 'a' })
    expect(approve).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'r' })
    expect(reject).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'ArrowRight' }) // Side is completed but undecided: it can still be approved
    fireEvent.keyDown(window, { key: 'a' })
    expect(approve).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).toHaveBeenCalled()
  })
})

describe('ModelPicker', () => {
  it('lists every provider, filters by search, and accepts any model id', () => {
    const picked: Array<[string, string]> = []
    render(<ModelPicker catalog={builtInModels} configured={{ kie: true }} provider="kie" modelId="google/nanobanana-2-1" onPick={(p, id) => picked.push([p, id])} />)
    fireEvent.click(screen.getByLabelText('Choose image model'))
    const list = () => within(screen.getByRole('listbox'))
    expect(list().getAllByRole('option').length).toBe(builtInModels.length)
    fireEvent.change(screen.getByLabelText('Search models'), { target: { value: 'seedream' } })
    expect(list().getAllByRole('option').every((o) => /seedream/i.test(o.textContent ?? ''))).toBe(true)
    fireEvent.change(screen.getByLabelText('Search models'), { target: { value: 'brand/new-model-9' } })
    expect(list().queryAllByRole('option')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /use .brand\/new-model-9/i }))
    expect(picked).toEqual([['kie', 'brand/new-model-9']])
  })
})
