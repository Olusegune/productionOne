import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { AppearanceMenu } from './AppearanceMenu'
import { applyLook, startLook, useLook, useProjectAccent } from '../data/appearance'
import { renderHook } from '@testing-library/react'

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-look'); document.documentElement.removeAttribute('style'); document.documentElement.dataset.theme = 'dark'; startLook() })
afterEach(() => { document.documentElement.removeAttribute('data-look') })

function Wrapper({ onClose = () => {} }: { onClose?: () => void }) {
  const { look, setLook } = useLook()
  return <AppearanceMenu look={look} onLook={setLook} onClose={onClose} />
}

describe('appearance', () => {
  it('starts in Studio, applies a look at once, and remembers it', () => {
    expect(document.documentElement.dataset.look).toBe('studio')
    render(<Wrapper />)
    expect(screen.getByRole('radio', { name: /Studio/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: /Cinematic/ }))
    expect(document.documentElement.dataset.look).toBe('cinematic')
    expect(localStorage.getItem('po.look')).toBe('cinematic')
    expect(screen.getByRole('radio', { name: /Cinematic/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /Studio/ }).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('radio', { name: /Futurist/ }))
    expect(document.documentElement.dataset.look).toBe('futurist')
  })
  it('comes back to the remembered look after a restart', () => {
    applyLook('futurist')
    document.documentElement.removeAttribute('data-look')
    startLook()
    expect(document.documentElement.dataset.look).toBe('futurist')
  })
  it('closes with Escape and with the close button', () => {
    const onClose = vi.fn()
    render(<Wrapper onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close appearance' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('switches the colour scheme from the same dialog without changing the look', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByRole('radio', { name: /Cinematic/ }))
    fireEvent.click(screen.getByRole('button', { name: /Light/ }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.look).toBe('cinematic')
  })
})

describe('project accent', () => {
  it('sets the accent from the style palette in Cinematic only, and removes it elsewhere', () => {
    const palette = ['#171b1f', '#d1b47b', '#78624a', '#6e7a78']
    const { rerender } = renderHook(({ look }) => useProjectAccent(look, palette), { initialProps: { look: 'cinematic' as const } })
    expect(document.documentElement.style.getPropertyValue('--accent-project')).toMatch(/^#[0-9a-f]{6}$/)
    act(() => { rerender({ look: 'studio' as never }) })
    expect(document.documentElement.style.getPropertyValue('--accent-project')).toBe('')
  })
  it('keeps the look default when the palette has no colour', () => {
    renderHook(() => useProjectAccent('cinematic', ['#111111', '#999999']))
    expect(document.documentElement.style.getPropertyValue('--accent-project')).toBe('')
  })
})
