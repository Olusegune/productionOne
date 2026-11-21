// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RelinkDialog } from './RelinkDialog'
import type { RelinkRow } from '../domain/relink'

afterEach(cleanup)

const rows: RelinkRow[] = [
  { jobId: 'a', name: 'AMINA · Front · revision 3', stem: 'amina_front_v03', path: 'D:/pics/work/amina_front_v03.png', was: 'approved' },
  { jobId: 'b', name: 'AMINA · Side · revision 1', stem: 'amina_side_v01', path: 'D:/pics/work/amina_side_v01.png', was: 'waiting' },
  { jobId: 'c', name: 'SAVANNA · Establishing · revision 1', stem: 'savanna_v01', path: null, was: 'waiting' },
]
const setup = (over: Partial<Parameters<typeof RelinkDialog>[0]> = {}) => {
  const fns = { onConfirm: vi.fn(), onCancel: vi.fn(), onAnother: vi.fn() }
  render(<RelinkDialog folder="D:/pics/work" rows={rows} {...fns} {...over} />)
  return fns
}

describe('Review matches before relinking', () => {
  it('shows every picture, what was found, and that nothing changes until the button is pressed', () => {
    const f = setup()
    expect(screen.getByRole('status').textContent).toMatch(/2 of 3 found/)
    expect(screen.getByText('AMINA · Front · revision 3')).toBeTruthy()
    expect(screen.getByText(/Was approved: comes back approved/)).toBeTruthy()
    expect(screen.getByText('Not in this folder')).toBeTruthy()
    expect(f.onConfirm).not.toHaveBeenCalled()
  })
  it('links only the ticked pictures', () => {
    const f = setup()
    expect(screen.getByRole('button', { name: 'Relink 2 files' })).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Link AMINA · Side · revision 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Relink 1 file' }))
    expect(f.onConfirm).toHaveBeenCalledWith(['a'])
  })
  it('select all ticks and clears, and with nothing ticked the button is off', () => {
    setup()
    const all = screen.getByRole('checkbox', { name: 'Select all found pictures' })
    fireEvent.click(all)
    expect((screen.getByRole('button', { name: 'Relink 0 files' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(all)
    expect((screen.getByRole('button', { name: 'Relink 2 files' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('Cancel, Escape and Choose another folder do not link anything', () => {
    const f = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(f.onCancel).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: /Choose another folder/ }))
    expect(f.onAnother).toHaveBeenCalledTimes(1)
    expect(f.onConfirm).not.toHaveBeenCalled()
  })
  it('says plainly when the folder has none of them, and offers no relink', () => {
    setup({ rows: rows.map((r) => ({ ...r, path: null })) })
    expect(screen.getByRole('status').textContent).toMatch(/None of the 3 missing pictures are in this folder/)
    expect((screen.getByRole('button', { name: 'Relink 0 files' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
