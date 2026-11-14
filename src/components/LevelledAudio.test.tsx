import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { LevelledAudio } from './LevelledAudio'
import { resetLevelMatching, setLevelMatching } from '../data/audioPrefs'

const RATE = 22050
// 0.3 s of quiet tone, then 0.6 s of silence at the end
const samples = new Float32Array(Math.round(RATE * 0.9))
for (let i = 0; i < RATE * 0.3; i++) samples[i] = 0.06 * Math.sin((2 * Math.PI * 700 * i) / RATE) + 0.06 * Math.sin((2 * Math.PI * 200 * i) / RATE)

const started: Array<{ when: number; offset: number; length: number; gain: number }> = []
let lastGain = 1
class FakeContext {
  state = 'running'; currentTime = 0; destination = {}
  resume = async () => {}
  decodeAudioData = async () => ({ sampleRate: RATE, numberOfChannels: 1, length: samples.length, duration: samples.length / RATE, getChannelData: () => samples })
  createGain = () => { const g = { gain: { value: 1 }, connect: (n: unknown) => n }; lastGain = 1; return new Proxy(g, { get: (t, k) => (k === 'gain' ? new Proxy(t.gain, { set: (o, p, v) => { (o as Record<string, number>)[p as string] = v; lastGain = v; return true } }) : (t as Record<string | symbol, unknown>)[k]) }) }
  createBufferSource = () => { const node: Record<string, unknown> = { buffer: null, onended: null, connect: (n: unknown) => n, stop: () => {}, start: (when: number, offset: number, length: number) => started.push({ when, offset, length, gain: lastGain }) }; return node }
}

let invokeResult: () => Promise<ArrayBuffer> = async () => new ArrayBuffer(8)
vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (p: string) => `asset://${p}`, invoke: (name: string) => (name === 'read_audio_clip' ? invokeResult() : Promise.resolve(undefined)) }))

beforeEach(() => { started.length = 0; invokeResult = async () => new ArrayBuffer(8); resetLevelMatching(); setLevelMatching(true); (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext })
afterEach(() => { cleanup(); delete (window as unknown as { AudioContext?: unknown }).AudioContext })

describe('level-matched audition player', () => {
  it('measures the clip, says what it will do, and plays it boosted with the silence trimmed', async () => {
    render(<LevelledAudio path="C:/assets/clip-a.wav" label="MARA voice audition" />)
    const note = await screen.findByText(/dB to -?\d+ LUFS/)
    expect(note.textContent).toMatch(/^\+\d+\.\d dB to -20 LUFS/)
    expect(note.textContent).toMatch(/s of silence trimmed/)
    fireEvent.click(screen.getByRole('button', { name: 'Play MARA voice audition' }))
    await waitFor(() => expect(started).toHaveLength(1))
    expect(started[0].offset).toBeLessThan(0.05) // starts at the sound
    expect(started[0].length).toBeLessThan(0.6) // the 0.6 s of trailing silence is gone
    expect(started[0].gain).toBeGreaterThan(1) // a quiet clip is brought up
  })

  it('plays the original, untrimmed and at unit gain, when level matching is switched off', async () => {
    render(<LevelledAudio path="C:/assets/clip-b.wav" label="voice" />)
    await screen.findByText(/dB to/)
    fireEvent.click(screen.getByLabelText('Match levels and trim silence'))
    expect(await screen.findByText('Original, as recorded')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Play voice' }))
    await waitFor(() => expect(started).toHaveLength(1))
    expect(started[0]).toMatchObject({ offset: 0, gain: 1 })
    expect(started[0].length).toBeCloseTo(0.9, 1)
  })

  it('falls back to the plain player when the clip cannot be read or decoded', async () => {
    invokeResult = async () => { throw new Error('nope') }
    const { container } = render(<LevelledAudio path="C:/assets/clip-c.wav" label="voice" />)
    await waitFor(() => expect(container.querySelector('audio')).toBeTruthy())
    expect(container.querySelector('audio')!.getAttribute('src')).toBe('asset://C:/assets/clip-c.wav')
  })

  it('falls back to the plain player where the browser has no audio engine', async () => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext
    const { container } = render(<LevelledAudio path="C:/assets/clip-d.wav" label="voice" />)
    await waitFor(() => expect(container.querySelector('audio')).toBeTruthy())
  })
})
