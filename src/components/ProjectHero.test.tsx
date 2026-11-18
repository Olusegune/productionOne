import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ProjectHero } from './ProjectHero'
import type { GoldenPathInput } from '../domain/goldenPath'
import type { StyleBible } from '../domain/visualDevelopment'

const golden: GoldenPathInput = { hasScript: true, assetCount: 8, styleLocked: false, outputsCount: 0, approvedCount: 0, jobsActive: 0, storyboards: false, shotCount: 0, ready: false }
const style: StyleBible = { name: 'Restrained Cinematic Realism', description: '', palette: ['#111111', '#d1b47b'], materials: '', rendering: '', lighting: '', locked: false, revision: 1 }
const counts = { scenes: 3, characters: 4, props: 2, sets: 2 }
const handlers = () => ({ onNew: vi.fn(), onOpen: vi.fn(), onSave: vi.fn(), onContinue: vi.fn(), onWorkspace: vi.fn() })

describe('ProjectHero', () => {
  it('shows the title, status and progress, and continues to the next step', () => {
    const h = handlers()
    render(<ProjectHero title="The Last Horizon" filePath={null} style={style} golden={golden} counts={counts} {...h} />)
    expect(screen.getByRole('heading', { name: 'The Last Horizon' })).toBeTruthy()
    expect(screen.getByText('0 of 8 assets approved')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Production progress' }).getAttribute('aria-valuenow')).toMatch(/^\d+$/)
    fireEvent.click(screen.getByRole('button', { name: /Continue: Approve a visual style/ }))
    expect(h.onContinue).toHaveBeenCalledTimes(1)
    expect(h.onContinue.mock.calls[0][0].workspace).toBe('Design')
  })
  it('opens Deliver when every step is done', () => {
    const h = handlers()
    render(<ProjectHero title="T" filePath="C:/x.pone" style={{ ...style, locked: true }} golden={{ ...golden, styleLocked: true, outputsCount: 8, approvedCount: 8, ready: true }} counts={counts} {...h} />)
    expect(screen.getByText('LOCKED LOOK')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Open Deliver/ }))
    expect(h.onWorkspace).toHaveBeenCalledWith('Deliver')
  })
  it('keeps New, Open and Save', () => {
    const h = handlers()
    render(<ProjectHero title="T" filePath={null} style={style} golden={golden} counts={counts} {...h} />)
    for (const n of [/New/, /Open…/, /Save/]) fireEvent.click(screen.getByRole('button', { name: n }))
    expect(h.onNew).toHaveBeenCalled(); expect(h.onOpen).toHaveBeenCalled(); expect(h.onSave).toHaveBeenCalled()
  })
  it('falls back to the palette when the style has no picture', () => {
    render(<ProjectHero title="T" filePath={null} style={{ ...style, name: 'My own style', family: undefined }} golden={golden} counts={counts} {...handlers()} />)
    expect(screen.getByRole('img', { name: 'Palette of the visual style' })).toBeTruthy()
  })
  it('an empty project offers to start from images, a project with assets does not', () => {
    const h = handlers()
    const { unmount } = render(<ProjectHero title="T" filePath={null} style={style} golden={{ ...golden, hasScript: false, assetCount: 0 }} counts={counts} {...h} />)
    expect(screen.getByText(/or start from your own images/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Start from images/ }))
    expect(h.onWorkspace).toHaveBeenCalledWith('Design')
    unmount()
    render(<ProjectHero title="T" filePath={null} style={style} golden={{ ...golden, hasScript: false, assetCount: 1 }} counts={counts} {...h} />)
    expect(screen.queryByRole('button', { name: /Start from images/ })).toBeNull()
  })
})
