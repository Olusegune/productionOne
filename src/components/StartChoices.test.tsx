// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StartChoices } from './StartChoices'

afterEach(cleanup)

describe('How do you want to start?', () => {
  it('offers three ways in, the Assistant first and marked as the easiest', () => {
    const f = { onAssistant: vi.fn(), onScript: vi.fn(), onPictures: vi.fn() }
    render(<StartChoices {...f} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.querySelector('b')?.textContent)).toEqual(['Ask the Assistant', 'Add a script', 'Start from my pictures'])
    expect(buttons[0].textContent).toMatch(/Easiest way to begin/)
    fireEvent.click(buttons[0]); fireEvent.click(buttons[1]); fireEvent.click(buttons[2])
    expect(f.onAssistant).toHaveBeenCalledTimes(1)
    expect(f.onScript).toHaveBeenCalledTimes(1)
    expect(f.onPictures).toHaveBeenCalledTimes(1)
  })
  it('promises that nothing costs anything until a button says so', () => {
    render(<StartChoices onAssistant={() => {}} onScript={() => {}} onPictures={() => {}} />)
    expect(screen.getByText(/Nothing is made, and nothing costs anything/)).toBeTruthy()
  })
})
