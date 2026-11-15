import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StyleGallery } from './StyleGallery'
import { ArtDirectionBar } from './ArtDirectionBar'
import { defaultStyleBible, stylePresets } from '../domain/visualDevelopment'

beforeEach(() => { localStorage.clear() })

describe('style gallery', () => {
  const open = (current = defaultStyleBible.name) => {
    const onChoose = vi.fn(); const onClose = vi.fn()
    render(<StyleGallery styles={stylePresets} current={current} onChoose={onChoose} onClose={onClose} />)
    return { onChoose, onClose }
  }
  it('lists every style as a card and says which is current', () => {
    open()
    expect(screen.getByRole('list', { name: 'Styles' }).querySelectorAll('li').length).toBe(stylePresets.length)
    expect(screen.getByRole('button', { name: new RegExp(`${defaultStyleBible.name}, current style`) })).toBeTruthy()
  })
  it('searches and filters by family', () => {
    open()
    fireEvent.change(screen.getByLabelText('Search styles'), { target: { value: 'clay' } })
    const cards = screen.getByRole('list', { name: 'Styles' }).querySelectorAll('li')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.length).toBeLessThan(stylePresets.length)
    fireEvent.change(screen.getByLabelText('Search styles'), { target: { value: 'zzzz-nothing' } })
    expect(screen.getByText(/No styles match/)).toBeTruthy()
  })
  it('keeps favourites between openings', () => {
    const first = render(<StyleGallery styles={stylePresets} current="x" onChoose={() => {}} onClose={() => {}} />)
    const name = stylePresets[3].name
    fireEvent.click(screen.getByRole('button', { name: `Add ${name} to favourites` }))
    first.unmount()
    render(<StyleGallery styles={stylePresets} current="x" onChoose={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: `Remove ${name} from favourites` })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Favourites \(1\)/ }))
    expect(screen.getByRole('list', { name: 'Styles' }).querySelectorAll('li').length).toBe(1)
  })
  it('shows details for the picked style and chooses it only on the button', () => {
    const { onChoose } = open()
    const target = stylePresets[5]
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${target.name}`) }))
    expect(onChoose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Selected style').textContent).toContain(target.name)
    fireEvent.click(screen.getByRole('button', { name: 'Use this style' }))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ name: target.name }))
  })
  it('closes with Escape or the close button', () => {
    const { onClose } = open()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close the style gallery' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('art direction bar', () => {
  it('opens the gallery, and picking a style changes the look without locking it', () => {
    const onChange = vi.fn()
    render(<ArtDirectionBar style={defaultStyleBible} onChange={onChange} sheetCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose a visual style' }))
    expect(screen.getByRole('dialog', { name: 'Choose a visual style' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${stylePresets[6].name}`) }))
    fireEvent.click(screen.getByRole('button', { name: 'Use this style' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: stylePresets[6].name, locked: false }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('cannot open the gallery while the style is locked', () => {
    render(<ArtDirectionBar style={{ ...defaultStyleBible, locked: true }} onChange={() => {}} sheetCount={0} />)
    expect((screen.getByRole('button', { name: 'Choose a visual style' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
