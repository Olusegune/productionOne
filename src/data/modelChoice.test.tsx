// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useModelChoice } from './modelChoice'

let release: () => void = () => {}
const gate = new Promise<void>((r) => { release = r })
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (name: string) => {
    if (name === 'credential_status') { await gate; return true }
    if (name === 'model_catalog') return {}
    if (name === 'kie_models') return { kie: { fetchedAt: Date.now() / 1000, models: [] } }
    return undefined
  },
}))

describe('useModelChoice', () => {
  it('says the saved keys have not been read yet, so "no key" is never a guess, then says when they have', async () => {
    const { result } = renderHook(() => useModelChoice(true, 0))
    expect(result.current.keysChecked).toBe(false)
    expect(result.current.configured.kie).toBeFalsy()
    release()
    await waitFor(() => expect(result.current.keysChecked).toBe(true))
    expect(result.current.configured.kie).toBe(true)
  })
  it('in the browser preview there is nothing to read, so it stays unchecked', () => {
    const { result } = renderHook(() => useModelChoice(false, 0))
    expect(result.current.keysChecked).toBe(false)
  })
})
