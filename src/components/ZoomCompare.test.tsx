// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CROP_ZOOM, MAX_ZOOM, MIN_ZOOM, ZoomImage, ZoomToolbar, clampZoom, scrollRatio, useZoomSync } from './ZoomCompare'

afterEach(cleanup)

function Pair({ resetKey = 'a' }: { resetKey?: string }) {
  const z = useZoomSync(resetKey)
  return (
    <>
      <ZoomToolbar z={z} />
      <ZoomImage z={z} index={0} label="left" empty="none" />
      <ZoomImage z={z} index={1} label="right" empty="none" />
    </>
  )
}
const levels = () => Array.from(document.querySelectorAll('.rv-zoom')).map((e) => (e as HTMLElement).dataset.zoom)

describe('zoom maths', () => {
  it('keeps zoom inside its range', () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(2.5)).toBe(2.5)
  })
  it('says how far along its range a pane is, and 0 when it cannot scroll', () => {
    expect(scrollRatio(50, 300, 100)).toBe(0.25)
    expect(scrollRatio(500, 300, 100)).toBe(1)
    expect(scrollRatio(10, 100, 100)).toBe(0)
  })
})

describe('zoom toolbar', () => {
  it('starts on the full picture, zooms both panes together, and Fit brings them back', () => {
    render(<Pair />)
    expect(levels()).toEqual(['1', '1'])
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(levels()).toEqual(['2', '2'])
    expect(screen.getByLabelText('Zoom level').textContent).toBe('200%')
    fireEvent.click(screen.getByRole('button', { name: 'Fit the whole picture' }))
    expect(levels()).toEqual(['1', '1'])
  })
  it('Top crop zooms in on both panes, and Full image goes back', () => {
    render(<Pair />)
    fireEvent.click(screen.getByRole('button', { name: 'Top crop' }))
    expect(levels()).toEqual([String(CROP_ZOOM), String(CROP_ZOOM)])
    fireEvent.click(screen.getByRole('button', { name: 'Full image' }))
    expect(levels()).toEqual(['1', '1'])
  })
  it('with Sync zoom on, Ctrl and the wheel zoom both panes; off, only the pane under the mouse', () => {
    render(<Pair />)
    const panes = Array.from(document.querySelectorAll('.rv-zoom'))
    fireEvent.wheel(panes[0], { ctrlKey: true, deltaY: -100 })
    expect(levels()).toEqual(['1.5', '1.5'])
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sync zoom' }))
    fireEvent.wheel(panes[1], { ctrlKey: true, deltaY: -100 })
    expect(levels()).toEqual(['1.5', '2'])
  })
  it('a different picture starts from the chosen view again', () => {
    const { rerender } = render(<Pair resetKey="a" />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(levels()).toEqual(['1.5', '1.5'])
    rerender(<Pair resetKey="b" />)
    expect(levels()).toEqual(['1', '1'])
  })
  it('does not zoom past either end', () => {
    render(<Pair />)
    expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(true)
    for (let i = 0; i < 20; i++) fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(levels()).toEqual([String(MAX_ZOOM), String(MAX_ZOOM)])
    expect((screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
