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

describe('2D styles in the gallery', () => {
  const open = (current = defaultStyleBible.name) => {
    const onChoose = vi.fn()
    render(<StyleGallery styles={stylePresets} current={current} onChoose={onChoose} onClose={() => {}} />)
    return { onChoose }
  }
  const count2D = stylePresets.filter((s) => s.spec2d).length
  it('has a clearly visible 2D filter that shows only 2D styles, and still shows everything under All', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: `2D (${count2D})` }))
    expect(screen.getByRole('list', { name: 'Styles' }).querySelectorAll('li').length).toBe(count2D)
    fireEvent.click(screen.getByRole('button', { name: `All (${stylePresets.length})` }))
    expect(screen.getByRole('list', { name: 'Styles' }).querySelectorAll('li').length).toBe(stylePresets.length)
  })
  it('searches 2D styles by name and family, and shows an example picture for each', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: `2D (${count2D})` }))
    fireEvent.change(screen.getByLabelText('Search styles'), { target: { value: 'pixel' } })
    const cards = screen.getByRole('list', { name: 'Styles' }).querySelectorAll('li')
    expect(cards.length).toBe(2)
    expect(cards[0].querySelector('img')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search styles'), { target: { value: 'storybook and painterly' } })
    expect(screen.getByRole('list', { name: 'Styles' }).querySelectorAll('li').length).toBeGreaterThanOrEqual(7)
  })
  it('shows the selected style settings, what the app makes, the provider note and where the preview comes from, then chooses it', () => {
    const { onChoose } = open()
    fireEvent.click(screen.getByRole('button', { name: `2D (${count2D})` }))
    fireEvent.click(screen.getByRole('button', { name: /^Flat vector$/ }))
    const detail = screen.getByLabelText('Selected style')
    expect(detail.textContent).toMatch(/Shading/)
    expect(detail.textContent).toMatch(/Not vector artwork, not a layered file/i)
    expect(detail.textContent).toMatch(/live-tested/)
    expect(detail.textContent).toMatch(/One test only/)
    expect(detail.textContent).toMatch(/example made with an image model/)
    expect(detail.querySelector('img')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /use this style/i }))
    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onChoose.mock.calls[0][0].spec2d.id).toBe('2d-flat-vector')
  })
  it('keeps the drawn preview free of file paths, so a saved project stays portable', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: `2D (${count2D})` }))
    const html = screen.getByRole('list', { name: 'Styles' }).innerHTML
    expect(html).not.toMatch(/[A-Z]:[\/]/)
    expect(html).not.toContain('file:')
    // The few 2D styles that already had a bundled picture point at the app's own relative folder; none points at a file on this computer.
    for (const m of html.matchAll(/ src="([^"]*)"/g)) expect(m[1].startsWith('/style-thumbs/')).toBe(true)
  })
})
