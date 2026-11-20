// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpCenter, richText } from './HelpCenter'
import { helpChapters } from '../domain/helpContent'

afterEach(cleanup)

describe('HelpCenter', () => {
  it('opens on the welcome chapter with a contents list, a close button and a search box', () => {
    render(<HelpCenter onClose={() => {}} version="v9.9.9" />)
    expect(screen.getByRole('dialog', { name: 'Documentation' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: helpChapters[0].title })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close the guide' })).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: 'Search the guide' })).toBeTruthy()
    expect(screen.getByText('v9.9.9')).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Guide contents' })
    expect(within(nav).getAllByRole('button')).toHaveLength(helpChapters.length)
  })
  it('closes with the button and with Escape, and not when you click inside', () => {
    const close = vi.fn()
    render(<HelpCenter onClose={close} />)
    fireEvent.click(screen.getByRole('heading', { level: 2, name: helpChapters[0].title }))
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close the guide' }))
    expect(close).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(2)
  })
  it('moves between chapters from the contents and with next and previous', () => {
    render(<HelpCenter onClose={() => {}} />)
    const nav = screen.getByRole('navigation', { name: 'Guide contents' })
    fireEvent.click(within(nav).getByText(helpChapters[3].title))
    expect(screen.getByRole('heading', { level: 2, name: helpChapters[3].title })).toBeTruthy()
    const pager = (title: string) => screen.getAllByRole('button').find((b) => b.className.includes('secondary') && (b.textContent ?? '').includes(title))!
    fireEvent.click(pager(helpChapters[4].title))
    expect(screen.getByRole('heading', { level: 2, name: helpChapters[4].title })).toBeTruthy()
    fireEvent.click(pager(helpChapters[3].title))
    expect(screen.getByRole('heading', { level: 2, name: helpChapters[3].title })).toBeTruthy()
  })
  it('searches the guide and says when nothing matches', () => {
    render(<HelpCenter onClose={() => {}} />)
    const nav = screen.getByRole('navigation', { name: 'Guide contents' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the guide' }), { target: { value: 'blocking map' } })
    const items = within(nav).getAllByRole('button')
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(helpChapters.length)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the guide' }), { target: { value: 'qqqqzzzz' } })
    expect(within(nav).queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText(/Nothing matches/)).toBeTruthy()
  })
  it('shows a screenshot with a caption, and a note when a picture is missing', () => {
    render(<HelpCenter onClose={() => {}} />)
    const img = screen.getAllByRole('img')[0] as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/help/01-projects.webp')
    expect(img.getAttribute('alt')).toMatch(/Projects screen/)
    fireEvent.error(img)
    expect(screen.getByText('Screenshot not available')).toBeTruthy()
  })
  it('offers to open the screen the chapter is about, and the desktop shortcut on the Windows chapter', () => {
    const go = vi.fn(); const close = vi.fn(); const shortcut = vi.fn()
    render(<HelpCenter onClose={close} onGo={go} onDesktopShortcut={shortcut} initialChapter="direct" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Direct' }))
    expect(go).toHaveBeenCalledWith('Direct')
    expect(close).toHaveBeenCalled()
    cleanup()
    render(<HelpCenter onClose={close} onGo={go} onDesktopShortcut={shortcut} initialChapter="windows" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Production One to the Desktop' }))
    expect(shortcut).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull()
  })
  it('turns bold and code markers into elements and nothing else (no markup from help text)', () => {
    const { container } = render(<p>{richText('Press **Start** then `Ctrl+S` <i>raw</i>')}</p>)
    expect(container.querySelector('b')?.textContent).toBe('Start')
    expect(container.querySelector('code')?.textContent).toBe('Ctrl+S')
    expect(container.querySelector('i')).toBeNull()
    expect(container.textContent).toContain('<i>raw</i>')
  })
})
