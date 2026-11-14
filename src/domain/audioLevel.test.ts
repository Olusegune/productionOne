import { describe, expect, it } from 'vitest'
import { MAX_GAIN_DB, PEAK_CEILING_DBFS, TARGET_LUFS, analyseClip, integratedLufs, matchGainDb, peakDbfs, trimRange } from './audioLevel'

const tone = (seconds: number, amplitude: number, sampleRate: number, frequency = 1000) => {
  const s = new Float32Array(Math.round(seconds * sampleRate))
  for (let i = 0; i < s.length; i++) s[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  return s
}
const silence = (seconds: number, sampleRate: number) => new Float32Array(Math.round(seconds * sampleRate))
const join = (...parts: Float32Array[]) => { const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length } return out }
const speechLike = (seconds: number, amplitude: number, sampleRate: number) => { // a few different tones so the signal is not a pure sine
  const a = tone(seconds / 3, amplitude, sampleRate, 220), b = tone(seconds / 3, amplitude, sampleRate, 700), c = tone(seconds / 3, amplitude, sampleRate, 1800)
  return join(a, b, c)
}

describe('integrated loudness', () => {
  it('matches ffmpeg ebur128 for a 1 kHz tone, at any sample rate', () => {
    // ffmpeg measured -27.1 LUFS for amplitude 0.0625 at both 48000 and 22050 Hz
    for (const rate of [48000, 22050, 44100]) expect(integratedLufs(tone(5, 0.0625, rate), rate)).toBeCloseTo(-27.1, 0)
  })
  it('rises 6 dB when the signal doubles', () => {
    const quiet = integratedLufs(tone(3, 0.05, 44100), 44100)
    const loud = integratedLufs(tone(3, 0.1, 44100), 44100)
    expect(loud - quiet).toBeCloseTo(6.02, 1)
  })
  it('is -Infinity for silence and for nothing', () => {
    expect(integratedLufs(silence(2, 44100), 44100)).toBe(-Infinity)
    expect(integratedLufs(new Float32Array(0), 44100)).toBe(-Infinity)
  })
  it('measures a clip shorter than one block instead of giving up', () => {
    expect(Number.isFinite(integratedLufs(tone(0.25, 0.1, 44100), 44100))).toBe(true)
  })
  it('ignores a very quiet tail (the gate), so trailing room tone does not change the answer', () => {
    const body = tone(1.5, 0.1, 44100)
    const withTail = join(body, tone(4, 0.00005, 44100))
    expect(integratedLufs(withTail, 44100)).toBeCloseTo(integratedLufs(body, 44100), 0)
  })
})

describe('gain to match a target', () => {
  it('is the difference to the target when there is headroom', () => expect(matchGainDb(-26, -12)).toBeCloseTo(6, 5))
  it('cuts a loud clip', () => expect(matchGainDb(-16, -3)).toBeCloseTo(-4, 5))
  it('never boosts past the ceiling, so a levelled clip does not clip', () => {
    expect(matchGainDb(-30, -4)).toBeCloseTo(PEAK_CEILING_DBFS - -4, 5)
    expect(-4 + matchGainDb(-30, -4)).toBeLessThanOrEqual(PEAK_CEILING_DBFS + 1e-9)
  })
  it('is limited to the maximum either way', () => {
    expect(matchGainDb(-60, -40)).toBe(MAX_GAIN_DB)
    expect(matchGainDb(5, 0)).toBe(-MAX_GAIN_DB)
  })
  it('does nothing to a clip that could not be measured', () => expect(matchGainDb(-Infinity, -Infinity)).toBe(0))
})

describe('trimming silence at the two ends', () => {
  const rate = 22050
  it('finds the sound inside leading and trailing silence, keeping a little air', () => {
    const clip = join(silence(0.8, rate), tone(0.5, 0.2, rate), silence(0.8, rate))
    const r = trimRange(clip, rate)
    expect(r.start).toBeCloseTo(0.76, 1)
    expect(r.end).toBeCloseTo(1.42, 1)
    expect(r.duration).toBeCloseTo(2.1, 2)
  })
  it('never cuts silence inside the clip', () => {
    const clip = join(silence(0.3, rate), tone(0.4, 0.2, rate), silence(0.6, rate), tone(0.4, 0.2, rate), silence(0.3, rate))
    const r = trimRange(clip, rate)
    expect(r.end - r.start).toBeGreaterThan(1.4 + 0.1) // both bursts and the gap between them
  })
  it('leaves a clip that is all silence alone', () => {
    const r = trimRange(silence(1, rate), rate)
    expect([r.start, r.end]).toEqual([0, 1])
  })
  it('leaves a clip with no silence at the ends alone (apart from rounding)', () => {
    const r = trimRange(tone(1, 0.2, rate), rate)
    expect(r.start).toBe(0)
    expect(r.end).toBeCloseTo(1, 1)
  })
  it('treats a very quiet noise floor as silence', () => {
    const noise = new Float32Array(rate); for (let i = 0; i < noise.length; i++) noise[i] = 0.001 * Math.sin(i) // about -60 dBFS
    const r = trimRange(join(noise, tone(0.3, 0.2, rate), noise), rate)
    expect(r.start).toBeGreaterThan(0.9)
  })
})

describe('analysing a clip', () => {
  const rate = 24000
  it('brings two clips of different loudness to the same level, within half a LU', () => {
    const quiet = analyseClip([speechLike(2, 0.05, rate)], rate)
    const loud = analyseClip([speechLike(2, 0.2, rate)], rate)
    expect(quiet.gainDb).toBeGreaterThan(loud.gainDb)
    expect(quiet.lufs + quiet.gainDb).toBeCloseTo(TARGET_LUFS, 0)
    expect(Math.abs(quiet.lufs + quiet.gainDb - (loud.lufs + loud.gainDb))).toBeLessThan(0.5)
  })
  it('reports how much silence it trimmed', () => {
    const a = analyseClip([join(speechLike(1, 0.1, rate), silence(0.8, rate))], rate)
    expect(a.trimmedSeconds).toBeGreaterThan(0.6)
    expect(a.trimmedSeconds).toBeLessThan(0.8)
    expect(peakDbfs(speechLike(1, 0.1, rate))).toBeCloseTo(-20, 0)
  })
  it('averages channels to mono for the measurement', () => {
    const mono = analyseClip([tone(2, 0.1, rate)], rate)
    const stereo = analyseClip([tone(2, 0.1, rate), tone(2, 0.1, rate)], rate)
    expect(stereo.lufs).toBeCloseTo(mono.lufs, 1)
  })
})

describe('the safety limits on levelling', () => {
  const rate = 24000
  it('does not blow up a nearly silent clip: boost stops at the maximum', () => {
    const a = analyseClip([speechLike(2, 0.002, rate)], rate)
    expect(a.gainDb).toBe(MAX_GAIN_DB)
    expect(a.lufs + a.gainDb).toBeLessThan(TARGET_LUFS)
  })
})
