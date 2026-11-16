import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EngineSwitch } from './EngineSwitch'
import type { EngineOption } from '../domain/imageCatalog'

const opt = (over: Partial<EngineOption>): EngineOption => ({ key: 'k|m', provider: 'kie', model: 'm', label: 'Model', available: true, takesReferences: true, note: '', ...over })
const options = [
  opt({ key: 'google|nano', provider: 'google', model: 'nano', label: 'Nano Banana 2.1' }),
  opt({ key: 'kie|seed', model: 'seed', label: 'Seedream 5.0 Pro' }),
  opt({ key: 'openai|gpt', provider: 'openai', model: 'gpt', label: 'GPT Image 1.5', available: false, note: 'needs an OpenAI key' }),
  opt({ key: 'comfyui|sdxl', provider: 'comfyui', model: 'sdxl', label: 'On this computer: SDXL', takesReferences: false, note: 'no identity lock: it cannot use the approved front as a reference' }),
]

describe('choosing another engine for a view', () => {
  it('lists the engines, leaves out the one already in use, and disables those that are not ready', () => {
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={() => {}} />)
    const select = screen.getByLabelText('Make this view with') as HTMLSelectElement
    const labels = [...select.options].map((o) => o.textContent)
    expect(labels.some((l) => l?.startsWith('Nano Banana'))).toBe(false)
    expect(labels).toContain('GPT Image 1.5 (needs an OpenAI key)')
    expect([...select.options].find((o) => o.value === 'openai|gpt')?.disabled).toBe(true)
  })
  it('sends nothing until Use is pressed, then hands over the chosen engine', () => {
    const onUse = vi.fn()
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={onUse} />)
    expect(onUse).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Make this view with'), { target: { value: 'comfyui|sdxl' } })
    expect(document.querySelector('.engine-note')?.textContent).toMatch(/no identity lock/)
    fireEvent.click(screen.getByRole('button', { name: 'Use SDXL' }))
    expect(onUse).toHaveBeenCalledTimes(1)
    expect(onUse.mock.calls[0][0]).toMatchObject({ provider: 'comfyui', model: 'sdxl' })
  })
  it('selects the first ready engine by default', () => {
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={() => {}} />)
    expect(screen.getByRole('button', { name: 'Use Seedream 5.0 Pro' })).toBeTruthy()
  })
})
