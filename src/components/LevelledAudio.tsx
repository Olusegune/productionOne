import { useEffect, useRef, useState } from 'react'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { Play, Square } from 'lucide-react'
import { analyseClip, type ClipLevel } from '../domain/audioLevel'
import { setLevelMatching, useLevelMatching } from '../data/audioPrefs'

interface Loaded { buffer: AudioBuffer; level: ClipLevel }
const loaded = new Map<string, Promise<Loaded>>()
let context: AudioContext | null = null
let stopCurrent: (() => void) | null = null

const audioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context ??= new Ctor()
  return context
}

/** Reads a saved clip, decodes it and measures it once. The file itself is never changed. */
function load(path: string): Promise<Loaded> {
  const cached = loaded.get(path)
  if (cached) return cached
  const ctx = audioContext()
  const job = (async () => {
    if (!ctx) throw new Error('This computer cannot decode audio here')
    const bytes = await invoke<ArrayBuffer>('read_audio_clip', { path })
    const buffer = await ctx.decodeAudioData(bytes.slice(0))
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
    return { buffer, level: analyseClip(channels, buffer.sampleRate) }
  })()
  loaded.set(path, job)
  job.catch(() => loaded.delete(path))
  return job
}

const signed = (db: number) => `${db >= 0 ? '+' : '−'}${Math.abs(db).toFixed(1)}`

/**
 * One audition clip. Played level-matched and with the silence at its two ends trimmed, so voices are compared fairly; the switch plays the original instead.
 * Where audio cannot be decoded it falls back to the plain browser player, so a clip can always be heard.
 */
export function LevelledAudio({ path, label }: { path: string; label: string }) {
  const matched = useLevelMatching()
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [level, setLevel] = useState<ClipLevel | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const source = useRef<AudioBufferSourceNode | null>(null)
  const frame = useRef(0)

  useEffect(() => {
    let live = true
    setState('loading')
    load(path).then((l) => { if (live) { setLevel(l.level); setState('ready') } }).catch(() => { if (live) setState('fallback') })
    return () => { live = false }
  }, [path])

  const stop = () => {
    try { source.current?.stop() } catch { /* already stopped */ }
    source.current = null
    cancelAnimationFrame(frame.current)
    setPlaying(false); setProgress(0)
    if (stopCurrent === stop) stopCurrent = null
  }
  useEffect(() => () => { try { source.current?.stop() } catch { /* nothing playing */ } cancelAnimationFrame(frame.current) }, [])

  const play = async () => {
    const ctx = audioContext()
    if (!ctx || !level) return
    stopCurrent?.() // one clip at a time, so clips can be compared by ear
    const { buffer } = await load(path)
    if (ctx.state === 'suspended') await ctx.resume()
    const gain = ctx.createGain()
    gain.gain.value = matched ? Math.pow(10, level.gainDb / 20) : 1
    const node = ctx.createBufferSource()
    node.buffer = buffer
    node.connect(gain).connect(ctx.destination)
    const from = matched ? level.start : 0
    const length = (matched ? level.end : buffer.duration) - from
    node.onended = () => { if (source.current === node) stop() }
    node.start(0, from, length)
    source.current = node
    stopCurrent = stop
    setPlaying(true)
    const began = ctx.currentTime
    const tick = () => { setProgress(Math.min(1, (ctx.currentTime - began) / Math.max(0.01, length))); frame.current = requestAnimationFrame(tick) }
    frame.current = requestAnimationFrame(tick)
  }

  if (state === 'fallback') return <audio controls src={convertFileSrc(path)} aria-label={label} />
  const shown = level ? (matched ? level.end - level.start : level.duration) : 0
  return (
    <div className="levelled-audio" data-state={state} data-gain-db={level ? level.gainDb.toFixed(2) : ''} data-lufs={level && Number.isFinite(level.lufs) ? level.lufs.toFixed(1) : ''} data-trimmed-s={level ? level.trimmedSeconds.toFixed(2) : ''}>
      <button className="icon-button" onClick={() => (playing ? stop() : void play())} disabled={state !== 'ready'} aria-label={`${playing ? 'Stop' : 'Play'} ${label}`} title={matched ? 'Plays level-matched, with silence at the ends trimmed' : 'Plays the original as recorded'}>
        {playing ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      </button>
      <div className="la-bar" role="progressbar" aria-label={`${label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><i style={{ width: `${progress * 100}%` }} /></div>
      <span className="la-time">{state === 'ready' ? `${shown.toFixed(1)} s` : '…'}</span>
      <label className="la-toggle"><input type="checkbox" checked={matched} onChange={(e) => setLevelMatching(e.target.checked)} aria-label="Match levels and trim silence" /> Level-matched</label>
      <small className="la-note">
        {state !== 'ready' || !level ? 'Reading the clip…'
          : !matched ? 'Original, as recorded'
          : !Number.isFinite(level.lufs) ? 'Could not measure this clip, played as recorded'
          : `${signed(level.gainDb)} dB to ${Math.round(level.lufs + level.gainDb)} LUFS${level.trimmedSeconds >= 0.05 ? ` · ${level.trimmedSeconds.toFixed(1)} s of silence trimmed` : ''}`}
      </small>
    </div>
  )
}
