import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { SearchSelect } from './SearchSelect'

const options = [{ value: 'a', label: 'Aria · Female' }, { value: 'b', label: 'Bruno · Male' }, { value: 'c', label: 'Cleo · Female' }]
function Harness() { const [v, setV] = useState('a'); return <><SearchSelect label="Voice" options={options} value={v} onChange={setV} /><output>{v}</output></> }

describe('SearchSelect', () => {
  it('shows the current choice and filters as you type', () => {
    render(<Harness />)
    const box = screen.getByRole('combobox', { name: 'Voice' })
    expect((box as HTMLInputElement).value).toBe('Aria · Female')
    fireEvent.focus(box)
    expect(screen.getAllByRole('option')).toHaveLength(3)
    fireEvent.change(box, { target: { value: 'fem' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Aria · Female', 'Cleo · Female'])
    fireEvent.change(box, { target: { value: 'zzz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
  it('chooses with the keyboard and closes with Escape', () => {
    render(<Harness />)
    const box = screen.getByRole('combobox', { name: 'Voice' })
    fireEvent.focus(box)
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(document.querySelector('output')?.textContent).toBe('c')
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.focus(box)
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
