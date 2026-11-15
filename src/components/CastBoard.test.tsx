import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { CastBoard } from './CastBoard'
import { analyzeScript, type AnalysisResult } from '../domain/productionStudio'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (p: string) => p, invoke: async () => null }))

const SCRIPT = [
  'Title: Test', '', 'EXT. SAVANNA - DUSK', '',
  'AMINA (30s), a weathered explorer, stands at the ridge. She holds the cracked solar compass.', '',
  'AMINA', 'We are close.', '', 'MARCUS', 'I am afraid.', '',
  'INT. CLIFF BEDROOM - NIGHT', '', 'MARCUS, her brother, wearing a torn navy coat, limps in.', '',
].join('\n')

let latest: AnalysisResult
function Harness({ outputs, spies }: { outputs?: Record<string, string>; spies: { onJump: (n: number) => void; onAdd: () => void; onOpenAsset: (id: string) => void } }) {
  const [analysis, setAnalysis] = useState(() => analyzeScript(SCRIPT))
  latest = analysis
  return <CastBoard analysis={analysis} onChange={setAnalysis} onAdd={spies.onAdd} onJump={spies.onJump} outputs={outputs} onOpenAsset={spies.onOpenAsset} />
}
const spies = () => ({ onJump: vi.fn(), onAdd: vi.fn(), onOpenAsset: vi.fn() })
const ids = () => analyzeScript(SCRIPT).assets
beforeEach(() => { localStorage.clear() })

describe('cast board', () => {
  it('shows a card for every asset and the first one selected with what the script says', () => {
    render(<Harness spies={spies()} />)
    const cards = within(screen.getByRole('list', { name: 'Cast board' })).getAllByRole('button')
    expect(cards).toHaveLength(ids().length)
    expect(cards[0].getAttribute('aria-pressed')).toBe('true')
    const detail = screen.getByRole('article')
    expect(within(detail).getByDisplayValue(ids()[0].name)).toBeTruthy()
  })
  it('selecting a card shows that asset, its words from the script, and jumps to them', () => {
    const s = spies()
    render(<Harness spies={s} />)
    fireEvent.click(screen.getByRole('button', { name: /^AMINA, Character/ }))
    const detail = screen.getByRole('article')
    expect(within(detail).getByText(/weathered explorer/)).toBeTruthy()
    fireEvent.click(within(detail).getByRole('button', { name: /Show in the script \(line \d+\)/ }))
    expect(s.onJump).toHaveBeenCalledWith(expect.any(Number))
    fireEvent.click(within(detail).getAllByRole('button', { name: /^Scene \d/ })[0])
    expect(s.onJump).toHaveBeenCalledTimes(2)
  })
  it('moves the selection with the arrow keys, Home and End', () => {
    render(<Harness spies={spies()} />)
    const cards = () => within(screen.getByRole('list', { name: 'Cast board' })).getAllByRole('button')
    fireEvent.keyDown(cards()[0], { key: 'ArrowRight' })
    expect(cards()[1].getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(cards()[1], { key: 'End' })
    expect(cards()[cards().length - 1].getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(cards()[cards().length - 1], { key: 'Home' })
    expect(cards()[0].getAttribute('aria-pressed')).toBe('true')
  })
  it('edits the name, the type and a character fact, and keeps them', () => {
    render(<Harness spies={spies()} />)
    fireEvent.click(screen.getByRole('button', { name: /^AMINA, Character/ }))
    const id = ids().find((a) => a.name === 'AMINA')!.id
    fireEvent.change(screen.getByLabelText(`${id} name`), { target: { value: 'AMINA OKAFOR' } })
    fireEvent.change(screen.getByLabelText(`${id} age`), { target: { value: '41' } })
    expect(latest.assets.find((a) => a.id === id)).toMatchObject({ name: 'AMINA OKAFOR', age: '41' })
    expect(screen.getByRole('button', { name: /^AMINA OKAFOR, Character/ })).toBeTruthy()
  })
  it('removes the selected asset and falls back to the first one', () => {
    render(<Harness spies={spies()} />)
    const before = ids().length
    fireEvent.click(screen.getByRole('button', { name: /^MARCUS, Character/ }))
    fireEvent.click(screen.getByRole('button', { name: /Remove MARCUS/ }))
    expect(latest.assets).toHaveLength(before - 1)
    expect(within(screen.getByRole('list', { name: 'Cast board' })).getAllByRole('button')[0].getAttribute('aria-pressed')).toBe('true')
  })
  it('switches to the compact list and remembers the choice', () => {
    const { unmount } = render(<Harness spies={spies()} />)
    fireEvent.click(screen.getByRole('button', { name: /List/ }))
    expect(screen.queryByRole('list', { name: 'Cast board' })).toBeNull()
    expect(localStorage.getItem('po.cast.view')).toBe('list')
    unmount()
    render(<Harness spies={spies()} />)
    expect(screen.queryByRole('list', { name: 'Cast board' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Cast/ }))
    expect(screen.getByRole('list', { name: 'Cast board' })).toBeTruthy()
  })
  it('offers to make the sheets of an asset with no picture, and to open one that has a picture', () => {
    const s = spies()
    const a = ids()[0]
    const { unmount } = render(<Harness spies={s} />)
    fireEvent.click(screen.getByRole('button', { name: /Make its sheets/ }))
    expect(s.onOpenAsset).toHaveBeenCalledWith(a.id)
    unmount()
    render(<Harness spies={s} outputs={{ [a.id]: 'C:/a.png' }} />)
    expect(screen.getByRole('button', { name: /Open in Design/ })).toBeTruthy()
  })
  it('adds an asset from the bar, once', () => {
    const s = spies()
    render(<Harness spies={s} />)
    fireEvent.click(screen.getAllByRole('button', { name: /Add asset/ })[0])
    expect(s.onAdd).toHaveBeenCalledTimes(1)
  })
})
