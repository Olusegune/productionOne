import { describe, expect, it } from 'vitest'
import { chooseWriter, isWriterId, writerOption, writerOptions, writerReady } from './assistantWriters'

describe('assistant writers', () => {
  it('offers cloud and local models, each with a default model id', () => {
    expect(writerOptions.map((o) => o.id)).toEqual(['google', 'openai', 'openrouter', 'ollama', 'lmstudio'])
    expect(writerOptions.filter((o) => o.local).map((o) => o.id)).toEqual(['ollama', 'lmstudio'])
    for (const o of writerOptions) expect(o.defaultModel).toMatch(/^[A-Za-z0-9._:/-]+$/)
  })
  it('a local writer needs no key; a cloud one does', () => {
    expect(writerReady('ollama', {})).toBe(true)
    expect(writerReady('lmstudio', undefined)).toBe(true)
    expect(writerReady('openai', {})).toBe(false)
    expect(writerReady('openai', { openai: true })).toBe(true)
  })
  it('keeps the saved writer when it works, otherwise falls back to one that does', () => {
    expect(chooseWriter('ollama', {})).toBe('ollama')
    expect(chooseWriter('openai', { openai: true })).toBe('openai')
    expect(chooseWriter('openai', { google: true })).toBe('google')
    expect(chooseWriter('google', {})).toBe('google')
    expect(chooseWriter('nonsense', { openrouter: true })).toBe('openrouter')
    expect(chooseWriter('nonsense', {})).toBe('google')
  })
  it('knows valid ids and defaults unknown ones to the first', () => {
    expect(isWriterId('openai')).toBe(true)
    expect(isWriterId('claude')).toBe(false)
    expect(writerOption('nope').id).toBe('google')
  })
})
