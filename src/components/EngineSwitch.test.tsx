import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EngineSwitch } from './EngineSwitch'
import type { EngineOption } from '../domain/imageCatalog'

const opt = (over: Partial<EngineOption>): EngineOption => ({ key: 'k|m', provider: 'kie', model: 'm', label: 'Model', available: true, takesReferences: true, note: '', group: 'latest', ...over })
const options = [
  opt({ key: 'google|nano', provider: 'google', model: 'nano', label: 'Nano Banana 2.1' }),
  opt({ key: 'kie|seed', model: 'seed', label: 'Seedream 5.5' }),
  opt({ key: 'openai|gpt', provider: 'openai', model: 'gpt', label: 'GPT Image 1.5', available: false, note: 'needs an OpenAI key' }),
  opt({ key: 'comfyui|sdxl', provider: 'comfyui', model: 'sdxl', label: 'On this computer: SDXL', takesReferences: false, note: 'no identity lock: it cannot use the approved front as a reference' }),
  opt({ key: 'kie|flux', model: 'flux', label: 'Kie.ai: FLUX 3 Klein', group: 'other' }),
]
const select = () => screen.getByRole('combobox') as HTMLSelectElement

describe('choosing another engine for a view', () => {
  it('is a drop-down listing every engine in two groups, keeps the one used before (marked) and disables those not ready, with the reason in the entry', () => {
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={() => {}} />)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(Array.from(select().options).map((o) => o.value)).toEqual(['google|nano', 'kie|seed', 'openai|gpt', 'comfyui|sdxl', 'kie|flux'])
    expect(Array.from(select().querySelectorAll('optgroup')).map((g) => g.label)).toEqual(['Newest models', 'Other image models'])
    expect(select().options[0].textContent).toMatch(/used before/)
    expect(select().options[2].disabled).toBe(true)
    expect(select().options[2].textContent).toMatch(/needs an OpenAI key/)
  })
  it('sends nothing until Use is pressed, then hands over the chosen engine and shows what is lost', () => {
    const onUse = vi.fn()
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={onUse} />)
    expect(onUse).not.toHaveBeenCalled()
    fireEvent.change(select(), { target: { value: 'comfyui|sdxl' } })
    expect(screen.getByText(/no identity lock/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use SDXL' }))
    expect(onUse).toHaveBeenCalledTimes(1)
    expect(onUse.mock.calls[0][0]).toMatchObject({ provider: 'comfyui', model: 'sdxl' })
  })
  it('selects the first ready engine by default, which can be the one used before, and can use it again', () => {
    const onUse = vi.fn()
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={onUse} />)
    expect(select().value).toBe('google|nano')
    fireEvent.click(screen.getByRole('button', { name: 'Use Nano Banana 2.1' }))
    expect(onUse.mock.calls[0][0]).toMatchObject({ provider: 'google', model: 'nano' })
  })
  it('can choose a model from the other-models group', () => {
    const onUse = vi.fn()
    render(<EngineSwitch options={options} current={{ provider: 'google', model: 'nano' }} onUse={onUse} />)
    fireEvent.change(select(), { target: { value: 'kie|flux' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use Kie.ai: FLUX 3 Klein' }))
    expect(onUse.mock.calls[0][0]).toMatchObject({ model: 'flux' })
  })
  it('does not let a disabled engine be used', () => {
    const onUse = vi.fn()
    render(<EngineSwitch options={[options[2]]} current={{ provider: 'google', model: 'nano' }} onUse={onUse} />)
    fireEvent.click(screen.getByRole('button', { name: /Use/ }))
    expect(onUse).not.toHaveBeenCalled()
  })
})
