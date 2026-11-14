import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'

beforeEach(() => { try { localStorage.clear() } catch { /* ignore */ } })

// A walk through every workspace: guards the screens that were split out of App.tsx.
describe('App workspaces', () => {
  it('opens every workspace without crashing and shows its content', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Workspaces' })
    expect(screen.getByRole('heading', { name: 'The Last Horizon' })).toBeTruthy()

    fireEvent.click(within(nav).getByRole('button', { name: /Story/ }))
    expect(screen.getByLabelText('Script source')).toBeTruthy()

    fireEvent.click(within(nav).getByRole('button', { name: /Design/ }))
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeTruthy()
    expect(screen.getByLabelText('Production bible')).toBeTruthy()

    fireEvent.click(within(nav).getByRole('button', { name: /Direct/ }))
    expect(document.querySelector('.dr-wrap')).toBeTruthy()

    fireEvent.click(within(nav).getByRole('button', { name: /Deliver/ }))
    expect(screen.getByText(/Production readiness/)).toBeTruthy()

    fireEvent.click(within(nav).getByRole('button', { name: /Projects/ }))
    expect(screen.getByRole('list', { name: 'Project at a glance' })).toBeTruthy()
  })

  it('switches workspace with Alt+number', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: '3', altKey: true })
    expect(screen.getByLabelText('Production bible')).toBeTruthy()
    fireEvent.keyDown(window, { key: '2', altKey: true })
    expect(screen.getByLabelText('Script source')).toBeTruthy()
  })
})
