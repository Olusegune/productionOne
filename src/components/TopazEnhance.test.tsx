// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TopazEnhance } from './TopazEnhance'

const api = vi.hoisted(() => ({ hasKey: vi.fn(), balance: vi.fn(), enhance: vi.fn() }))
vi.mock('../data/topaz', () => ({ topazHasKey: api.hasKey, topazBalance: api.balance, enhanceWithTopaz: api.enhance }))

const base = { path: 'C:/assets/a.png', width: 1024, height: 1536, name: 'AMINA · Front', onClose: () => {}, onDone: () => {}, onKey: () => {} }
beforeEach(() => { api.hasKey.mockResolvedValue(true); api.balance.mockResolvedValue({ available: 40, reserved: 0, total: 40 }); api.enhance.mockReset() })
afterEach(cleanup)

describe('Enhance with Topaz', () => {
  it('shows the size and the likely cost before anything is sent, and the balance', async () => {
    render(<TopazEnhance {...base} />)
    expect(screen.getByTestId('tz-cost').textContent).toMatch(/2048 by 3072 pixels \(6\.3 megapixels\).*about 1 credit/)
    await screen.findByText(/40 credits available/)
    expect(api.enhance).not.toHaveBeenCalled()
  })
  it('4x refuses a result that is too big and turns the button off', () => {
    render(<TopazEnhance {...base} width={4000} height={4000} />)
    fireEvent.click(screen.getByRole('button', { name: '4x' }))
    expect(screen.getByTestId('tz-cost').textContent).toMatch(/Choose 2x/)
    expect((screen.getByRole('button', { name: /Enhance \(uses Topaz credits\)/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('offers only enlarge-and-sharpen kinds of picture, and says what each is for', () => {
    render(<TopazEnhance {...base} />)
    const select = screen.getByRole('combobox', { name: 'Topaz model' }) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Standard', 'High fidelity', 'Low resolution', 'CGI and illustration', 'Text'])
    fireEvent.change(select, { target: { value: 'CGI' } })
    expect(screen.getByText(/3D renders, cartoons and drawn art/)).toBeTruthy()
  })
  it('only the button sends: it passes the picture, the model and the scale, and reports the result', async () => {
    const onDone = vi.fn()
    api.enhance.mockResolvedValue({ path: 'C:/assets/a_topaz.png', width: 2048, height: 3072, credits: 1 })
    render(<TopazEnhance {...base} onDone={onDone} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Topaz model' }), { target: { value: 'High Fidelity V2' } })
    fireEvent.click(screen.getByRole('button', { name: /Enhance \(uses Topaz credits\)/ }))
    await screen.findByText(/Done: 2048 by 3072 pixels, 1 credit used/)
    expect(api.enhance).toHaveBeenCalledWith('C:/assets/a.png', 'High Fidelity V2', 2)
    expect(onDone).toHaveBeenCalledWith({ path: 'C:/assets/a_topaz.png', width: 2048, height: 3072, credits: 1 })
  })
  it('shows what went wrong in plain words and lets you try again', async () => {
    api.enhance.mockRejectedValue('Your Topaz account has no credits left for this.')
    render(<TopazEnhance {...base} />)
    fireEvent.click(screen.getByRole('button', { name: /Enhance \(uses Topaz credits\)/ }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/no credits left/)
    expect((screen.getByRole('button', { name: /Enhance \(uses Topaz credits\)/ }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('without a key it says so, turns the button off and offers the key', async () => {
    api.hasKey.mockResolvedValue(false)
    const onKey = vi.fn()
    render(<TopazEnhance {...base} onKey={onKey} />)
    await screen.findByText(/no Topaz key yet/)
    expect((screen.getByRole('button', { name: /Enhance \(uses Topaz credits\)/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Add the Topaz key' }))
    expect(onKey).toHaveBeenCalled()
    await waitFor(() => expect(api.balance).not.toHaveBeenCalled())
  })
})
