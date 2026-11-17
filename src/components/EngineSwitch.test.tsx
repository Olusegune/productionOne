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
  it('lists every engine inline, keeps the one used before (marked), and disables those that are not ready, with the reason visible', () => {
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={() => {}} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.value)).toEqual(['google|nano', 'kie|seed', 'openai|gpt', 'comfyui|sdxl'])
    expect(screen.getByText(/used before/)).toBeTruthy()
    expect(radios.find((r) => r.value === 'openai|gpt')?.disabled).toBe(true)
    expect(screen.getByText('needs an OpenAI key')).toBeTruthy()
    expect(document.querySelector('select')).toBeNull()
  })
  it('sends nothing until Use is pressed, then hands over the chosen engine', () => {
    const onUse = vi.fn()
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={onUse} />)
    expect(onUse).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: /On this computer: SDXL/ }))
    expect(screen.getByText(/no identity lock/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use SDXL' }))
    expect(onUse).toHaveBeenCalledTimes(1)
    expect(onUse.mock.calls[0][0]).toMatchObject({ provider: 'comfyui', model: 'sdxl' })
  })
  it('selects the first ready engine by default, which can be the one used before', () => {
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={() => {}} />)
    expect((screen.getByRole('radio', { name: /Nano Banana 2.1/ }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('button', { name: 'Use Nano Banana 2.1' })).toBeTruthy()
  })
  it('can use the engine it used before again', () => {
    const onUse = vi.fn()
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={onUse} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use Nano Banana 2.1' }))
    expect(onUse.mock.calls[0][0]).toMatchObject({ provider: 'google', model: 'nano' })
  })
  it('does not let a disabled engine be used', () => {
    const onUse = vi.fn()
    render(<EngineSwitch options={[options[2]]} current={{ provider: 'google', model: 'nano' }} onUse={onUse} />)
    expect((screen.getByRole('button', { name: /Use/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
