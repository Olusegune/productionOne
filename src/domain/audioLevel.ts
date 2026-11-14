/**
 * Level matching and silence trimming for audition clips, so voices are compared at the same loudness and without dead air at the ends.
 * Nothing here changes a file: the numbers are used at playback time.
 *
 * Loudness follows ITU-R BS.1770 / EBU R128 for a single channel: K-weighting (a high-shelf and a high-pass), 400 ms blocks every 100 ms,
 * an absolute gate at -70 LUFS and a relative gate 10 LU below the average of what remains. The filter coefficients are computed for the clip's own sample rate.
 */

/** A comfortable speech level for comparing voices. Quieter than broadcast's -23 would make short, low voices hard to judge on laptop speakers. */
export const TARGET_LUFS = -20
/** Never boost or cut by more than this, so a nearly silent or broken clip is not blown up. */
export const MAX_GAIN_DB = 12
/** Keep the matched peak below this many dBFS so levelling never clips. */
export const PEAK_CEILING_DBFS = -1
/** Below this short-term level (dBFS) a stretch counts as silence at the ends of a clip. */
export const SILENCE_DBFS = -50

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number }

/** Stage 1: the high-shelf (head-related) filter, coefficients as in libebur128. */
function shelfFilter(sampleRate: number): Biquad {
  const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196
  const K = Math.tan((Math.PI * f0) / sampleRate)
  const Vh = Math.pow(10, G / 20)
  const Vb = Math.pow(Vh, 0.4996667741545416)
  const a0 = 1 + K / Q + K * K
  return {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  }
}

/** Stage 2: the revised low-frequency high-pass. */
function highpassFilter(sampleRate: number): Biquad {
  const f0 = 38.13547087602444, Q = 0.5003270373238773
  const K = Math.tan((Math.PI * f0) / sampleRate)
  const a0 = 1 + K / Q + K * K
  return { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 }
}

function applyBiquad(x: Float32Array | Float64Array, f: Biquad): Float64Array {
  const y = new Float64Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = f.b0 * x[i] + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2
    y[i] = v; x2 = x1; x1 = x[i]; y2 = y1; y1 = v
  }
  return y
}

/** Integrated loudness in LUFS of a mono signal, or -Infinity when it is silent or too short to measure. */
export function integratedLufs(samples: Float32Array, sampleRate: number): number {
  const block = Math.round(0.4 * sampleRate)
  const hop = Math.round(0.1 * sampleRate)
  if (samples.length === 0 || sampleRate <= 0) return -Infinity
  const w = applyBiquad(applyBiquad(samples, shelfFilter(sampleRate)), highpassFilter(sampleRate))
  const meanSquare = (from: number, to: number) => { let sum = 0; for (let i = from; i < to; i++) sum += w[i] * w[i]; return sum / (to - from) }
  const energies: number[] = []
  if (w.length <= block) {
    // A clip shorter than one block (a 0.3 s "Yes.") is measured as a single block, so it still gets a number.
    energies.push(meanSquare(0, w.length))
  } else {
    for (let start = 0; start + block <= w.length; start += hop) energies.push(meanSquare(start, start + block))
  }
  const lufs = (z: number) => -0.691 + 10 * Math.log10(z)
  const absolute = energies.filter((z) => z > 0 && lufs(z) > -70)
  if (!absolute.length) return -Infinity
  const mean = absolute.reduce((a, b) => a + b, 0) / absolute.length
  const gated = absolute.filter((z) => lufs(z) > lufs(mean) - 10)
  if (!gated.length) return -Infinity
  return lufs(gated.reduce((a, b) => a + b, 0) / gated.length)
}

export function peakDbfs(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}

/** Gain in dB that brings a clip to the target loudness without clipping, limited to ±MAX_GAIN_DB. 0 for a clip that cannot be measured. */
export function matchGainDb(lufs: number, peak: number, target = TARGET_LUFS): number {
  if (!Number.isFinite(lufs)) return 0
  let gain = Math.max(-MAX_GAIN_DB, Math.min(MAX_GAIN_DB, target - lufs))
  if (Number.isFinite(peak) && peak + gain > PEAK_CEILING_DBFS) gain = PEAK_CEILING_DBFS - peak
  return Math.max(-MAX_GAIN_DB, gain)
}

/**
 * Where the sound starts and ends, in seconds, ignoring silence at the two ends only (never inside). A little air is kept on each side so a word never starts or stops abruptly.
 * `leadAir` and `tailAir` are in seconds.
 */
export function trimRange(samples: Float32Array, sampleRate: number, leadAir = 0.04, tailAir = 0.12): { start: number; end: number; duration: number } {
  const duration = samples.length / sampleRate
  const window = Math.max(1, Math.round(0.01 * sampleRate))
  const threshold = Math.pow(10, SILENCE_DBFS / 20)
  const loud = (from: number) => {
    let sum = 0
    const to = Math.min(samples.length, from + window)
    for (let i = from; i < to; i++) sum += samples[i] * samples[i]
    return Math.sqrt(sum / Math.max(1, to - from)) > threshold
  }
  let first = -1, last = -1
  for (let i = 0; i < samples.length; i += window) if (loud(i)) { first = i; break }
  if (first < 0) return { start: 0, end: duration, duration } // all silence: leave it alone
  for (let i = samples.length - window; i >= 0; i -= window) if (loud(i)) { last = Math.min(samples.length, i + window); break }
  const start = Math.max(0, first / sampleRate - leadAir)
  const end = Math.min(duration, last / sampleRate + tailAir)
  return { start, end: Math.max(end, start), duration }
}

export interface ClipLevel { lufs: number; peak: number; gainDb: number; start: number; end: number; duration: number; trimmedSeconds: number }

/** Everything the player needs about one clip. Channels are averaged to mono for the measurement. */
export function analyseClip(channels: Float32Array[], sampleRate: number): ClipLevel {
  const length = channels[0]?.length ?? 0
  const mono = new Float32Array(length)
  for (const c of channels) for (let i = 0; i < length; i++) mono[i] += c[i] / channels.length
  const lufs = integratedLufs(mono, sampleRate)
  const peak = peakDbfs(mono)
  const range = trimRange(mono, sampleRate)
  return { lufs, peak, gainDb: matchGainDb(lufs, peak), start: range.start, end: range.end, duration: range.duration, trimmedSeconds: Math.max(0, range.duration - (range.end - range.start)) }
}
