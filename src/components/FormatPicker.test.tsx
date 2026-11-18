import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FormatPicker } from './FormatPicker'

describe('FormatPicker', () => {
  it('shows the named formats and marks the chosen one', () => {
    render(<FormatPicker value="9:16" onChange={() => {}} />)
    for (const name of [/Widescreen/, /Cinema/, /TikTok/, /Instagram portrait/, /Square/]) expect(screen.getByRole('button', { name })).toBeTruthy()
    expect(screen.getByRole('button', { name: /TikTok/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /Widescreen/ }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText(/Full-screen phone video/)).toBeTruthy()
  })
  it('chooses a preset or any other shape', () => {
    const onChange = vi.fn()
    render(<FormatPicker value="16:9" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Instagram portrait/ }))
    expect(onChange).toHaveBeenLastCalledWith('4:5')
    fireEvent.change(screen.getByLabelText('More shapes'), { target: { value: '3:2' } })
    expect(onChange).toHaveBeenLastCalledWith('3:2')
  })
  it('shows a custom shape as the current choice and presses no preset', () => {
    render(<FormatPicker value="3:2" onChange={() => {}} />)
    expect((screen.getByLabelText('More shapes') as HTMLSelectElement).value).toBe('3:2')
    expect(screen.getAllByRole('button').every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true)
  })
})
