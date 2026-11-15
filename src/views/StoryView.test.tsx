import { describe, expect, it, vi } from 'vitest'
import { createRef, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { StoryView } from './StoryView'
import { analyzeScript, type AnalysisResult } from '../domain/productionStudio'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (p: string) => p, invoke: async () => null }))

const SCRIPT = ['Title: Test', '', 'EXT. SAVANNA - DUSK', '', 'AMINA (30s), a weathered explorer, stands at the ridge.', '', 'AMINA', 'We are close.', '', 'MARCUS', 'I am afraid.', ''].join('\n')

function Harness({ initial = SCRIPT, spies }: { initial?: string; spies: { onJump: (line: number) => void; onImport: () => void; onAnalyze: () => void } }) {
  const [script, setScript] = useState(initial)
  const [analysis, setAnalysis] = useState<AnalysisResult>(() => analyzeScript(initial))
  return <StoryView script={script} setScript={setScript} scriptArea={createRef()} analysis={analysis} setAnalysis={(u) => setAnalysis(u as never)} desktop={false} notify={() => {}} onImport={spies.onImport} onAnalyze={spies.onAnalyze} onJump={spies.onJump} onAddProp={() => {}} onUseAge={() => {}} onAddAsset={() => {}} />
}
const spies = () => ({ onJump: vi.fn(), onImport: vi.fn(), onAnalyze: vi.fn() })

describe('Script workspace', () => {
  it('has a compact toolbar and counts the scenes and assets', () => {
    render(<Harness spies={spies()} />)
    const bar = screen.getByRole('toolbar', { name: 'Script actions' })
    expect(within(bar).getByRole('button', { name: /Import script/ })).toBeTruthy()
    expect(within(bar).getByRole('button', { name: /Analyze script/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Script breakdown' })).toBeTruthy()
    expect(screen.getByText(/1 scene · \d assets?/)).toBeTruthy()
  })
  it('shows templates only when the script is empty, or on request in a dialog', () => {
    const { unmount } = render(<Harness initial="" spies={spies()} />)
    expect(screen.getByLabelText('Script templates')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Templates/ })).toBeNull()
    unmount()
    render(<Harness spies={spies()} />)
    expect(screen.queryByLabelText('Script templates')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Templates/ }))
    expect(screen.getByRole('dialog', { name: 'Script templates' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('keeps questions apart from confirmed findings', () => {
    render(<Harness spies={spies()} />)
    fireEvent.click(screen.getByRole('tab', { name: /Questions/ }))
    expect(screen.getByText('Needs your check')).toBeTruthy()
    expect(within(screen.getByRole('tabpanel')).getAllByText('MARCUS').length).toBeGreaterThan(0)
    expect(screen.getByText(/Confirmed by the script/)).toBeTruthy()
  })
  it('jumps the script to the evidence for an asset, and for a finding', () => {
    const s = spies()
    render(<Harness spies={s} />)
    fireEvent.click(screen.getAllByRole('button', { name: /Evidence/ })[0])
    expect(s.onJump).toHaveBeenCalledTimes(1)
    expect(typeof s.onJump.mock.calls[0][0]).toBe('number')
    fireEvent.click(screen.getByRole('tab', { name: /Questions/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /^line \d+/ })[0])
    expect(s.onJump).toHaveBeenCalledTimes(2)
  })
  it('keeps character facts editable behind a Facts toggle and keeps what was typed', () => {
    render(<Harness spies={spies()} />)
    const id = analyzeScript(SCRIPT).assets.find((a) => a.type === 'character')!.id
    expect(screen.queryByLabelText(`${id} age`)).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: /Facts/ })[0])
    fireEvent.change(screen.getByLabelText(`${id} age`), { target: { value: '41' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Facts/ })[0])
    expect(screen.getByText(/41/)).toBeTruthy()
  })
  it('switches between the three breakdown tabs without losing the script', () => {
    render(<Harness spies={spies()} />)
    for (const name of [/Questions/, /Reading/, /Assets/]) fireEvent.click(screen.getByRole('tab', { name }))
    expect((screen.getByLabelText('Script source') as HTMLTextAreaElement).value).toBe(SCRIPT)
  })
})
