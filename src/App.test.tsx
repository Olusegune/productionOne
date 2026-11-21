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

    fireEvent.click(within(nav).getByRole('button', { name: /Script/ }))
    expect(screen.getByLabelText('Script source')).toBeTruthy()

    fireEvent.click(within(nav).getByRole('button', { name: /Design/ }))
    expect(screen.getByRole('tablist', { name: 'Asset Studio sections' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Sheets', selected: true })).toBeTruthy()
    expect(screen.getByLabelText('Production bible')).toBeTruthy()

    fireEvent.click(within(nav).getByRole('button', { name: /Storyboards/ }))
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

  it('Asset Studio opens on the sheets, and the other sections are one tab away without being lost', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: '3', altKey: true })
    const sheets = document.getElementById('sec-sheets')!
    const identity = document.getElementById('sec-identity')!
    expect(sheets.hidden).toBe(false)
    expect(identity.hidden).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Identity' }))
    expect(identity.hidden).toBe(false)
    expect(sheets.hidden).toBe(true)
    expect(document.contains(sheets)).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Voice and sound' }))
    expect(document.getElementById('sec-voice')!.hidden).toBe(false)
  })
  it('the look bar is one line with its settings folded away, and the add form lives in a dialog', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: '3', altKey: true })
    expect(screen.getByRole('button', { name: 'Choose a visual style' })).toBeTruthy()
    expect(screen.getByText(/Look settings/)).toBeTruthy()
    expect(screen.queryByLabelText('Name for the new asset')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Add to the bible/ }))
    expect(screen.getByLabelText('Name for the new asset')).toBeTruthy()
  })
})
