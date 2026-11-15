import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { FileText, KeyRound, Music, Wand2 } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { ParsedStory } from '../engine/story'
import { MUSIC_HELPER_SYSTEM, STYLE_MAX, TITLE_MAX, musicHelperPrompt, parseMusicReply, scenesFor, scriptMusicBrief, type MusicTarget } from '../domain/musicBrief'
import { refreshLocal, useLocalAi } from '../data/localAi'

interface Track { path: string; title: string; duration: number }

/**
 * Music from Suno, reached through Kie.ai (a third-party route: Suno has no public API). A character theme or the score for a scene the character is in.
 * The text is written from the script, by the local AI helper, or by hand; it is sent to Kie.ai only when "Make music" is pressed, and that spends Kie credits.
 */
export function MusicMaker(props: {
  asset: ExtractedAsset
  story?: ParsedStory
  desktop: boolean
  providersVersion: number
  openProviders: (providerId?: string) => void
  onClip: (clip: { path: string; label: string; line: string; duration: number }) => void
  notify: (message: string) => void
  setError: (message: string) => void
}) {
  const { asset, story, desktop, providersVersion, openProviders, onClip, notify, setError } = props
  const { config } = useLocalAi(desktop)
  const [connected, setConnected] = useState(false)
  const [target, setTarget] = useState('theme')
  const [idea, setIdea] = useState('')
  const [title, setTitle] = useState('')
  const [style, setStyle] = useState('')
  const [instrumental, setInstrumental] = useState(true)
  const [lyrics, setLyrics] = useState('')
  const [seconds, setSeconds] = useState(45)
  const [model, setModel] = useState('V6_MINI')
  const [busy, setBusy] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const scenes = scenesFor(asset, story)
  const musicTarget: MusicTarget = target === 'theme' ? { kind: 'theme' } : { kind: 'scene', sceneId: target }

  useEffect(() => { if (desktop) void invoke<boolean>('credential_status', { provider: 'kie' }).then(setConnected).catch(() => setConnected(false)) }, [desktop, providersVersion])
  useEffect(() => { setTarget('theme'); setTitle(''); setStyle(''); setEvidence([]) }, [asset.id])

  const fromScript = () => {
    setError('')
    const b = scriptMusicBrief(asset, musicTarget, story, idea)
    setEvidence(b.evidence)
    if (b.title) setTitle(b.title)
    if (!b.style) { setError(`There is not enough stated yet to write a style. Add a personality under Identity, or type an idea. Missing: ${b.missing.join(', ')}.`); return }
    setStyle(b.style)
    notify(b.missing.length ? `Filled from the script. To improve it: ${b.missing.join(', ')}.` : 'Filled from the script.')
  }
  const askHelper = async () => {
    setBusy('helper'); setError('')
    try {
      const cfg = config.textModel ? config : (await refreshLocal()).config
      const kind = cfg.textProvider ?? 'ollama'
      const model = cfg.textModel
      if (!model) throw new Error('Choose a local model first (Local AI, then pick one under Ollama or LM Studio). "Fill from the script" works without one.')
      const base = kind === 'lmstudio' ? (cfg.lmstudioUrl ?? 'http://127.0.0.1:1234') : (cfg.ollamaUrl ?? 'http://127.0.0.1:11434')
      const reply = await invoke<string>('local_llm', { kind, base, model, system: MUSIC_HELPER_SYSTEM, prompt: musicHelperPrompt(asset, musicTarget, story, idea), jsonMode: true, images: [] })
      const parsed = parseMusicReply(reply)
      if (!parsed) throw new Error('The AI helper did not return a usable music prompt. Try again, or use "Fill from the script".')
      if (parsed.title) setTitle(parsed.title)
      setStyle(parsed.style)
      setEvidence([`Written by ${model} on this computer from your idea and what the script states`])
      notify('The AI helper wrote a music prompt. Read it and edit anything that is wrong.')
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setBusy('') }
  }
  const make = async () => {
    setBusy('make'); setError('')
    try {
      const tracks = await invoke<Track[]>('make_music', { request: { title, style, instrumental, lyrics, negativeTags: '', model, durationSeconds: seconds, vocalGender: '', outputName: `${asset.id}_${target === 'theme' ? 'theme' : target}` } })
      for (const t of tracks) onClip({ path: t.path, label: `Suno ${model} · ${target === 'theme' ? 'theme' : 'scene score'}`, line: t.title || title, duration: Math.round(t.duration) })
      notify(`${tracks.length} track${tracks.length === 1 ? '' : 's'} saved with the audio clips below.`)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setBusy('') }
  }

  return <details className="music-maker">
    <summary><Music size={14} /> Make music with Suno (theme or scene score)</summary>
    <p className="helper warn">Suno is reached through Kie.ai, a third-party service. Your text is sent to Kie.ai only when you press Make music, and each request spends Kie credits and makes two tracks. Check Kie's and Suno's terms before using the music commercially.</p>
    <div className="sheet-actions-row">
      <span className="helper"><KeyRound size={14} /> {connected ? 'Kie.ai key saved in Settings.' : 'No Kie.ai key yet.'}</span>
      <button className="secondary" onClick={() => openProviders('kie')}>{connected ? 'Change key' : 'Add your key'} in Settings</button>
    </div>
    <div className="sheet-controls">
      <label><span>Music for</span><select value={target} onChange={(e) => setTarget(e.target.value)}><option value="theme">{asset.name}'s theme</option>{scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.number}: {s.heading.slice(0, 40)}</option>)}</select></label>
      <label><span>Your idea (optional)</span><input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. slow build, then a quiet release" /></label>
    </div>
    <div className="sheet-actions-row">
      <button className="secondary" onClick={fromScript}><FileText size={14} /> Fill from the script</button>
      <button className="secondary" disabled={!desktop || busy === 'helper'} onClick={() => void askHelper()}><Wand2 size={14} /> {busy === 'helper' ? 'Writing…' : 'Ask the AI helper'}</button>
    </div>
    {evidence.length > 0 && <p className="helper">Built from: {evidence.join('; ')}.</p>}
    <label className="settings-field"><span>Title ({title.trim().length}/{TITLE_MAX})</span><input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} /></label>
    <label className="settings-field"><span>Style ({style.trim().length}/{STYLE_MAX})</span><textarea rows={3} value={style} maxLength={STYLE_MAX} onChange={(e) => setStyle(e.target.value)} placeholder="Genre, instruments, tempo and mood" /></label>
    <div className="sheet-controls">
      <label><span>Model</span><select value={model} onChange={(e) => setModel(e.target.value)}><option value="V6_MINI">V6 Mini (fast, cheaper)</option><option value="V6">V6 (best vocals)</option><option value="V6_WILD">V6 Wild (bolder)</option></select></label>
      <label><span>Length: {seconds}s (10 to 360)</span><input type="range" min={10} max={180} step={5} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} aria-label="Music length in seconds" /></label>
      <label><input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} /> Instrumental (no singing)</label>
    </div>
    {!instrumental && <label className="settings-field"><span>Lyrics you provide (up to 5000 characters)</span><textarea rows={4} value={lyrics} maxLength={5000} onChange={(e) => setLyrics(e.target.value)} /></label>}
    <button className="secondary" disabled={!desktop || !connected || !title.trim() || !style.trim() || (!instrumental && !lyrics.trim()) || busy === 'make'} onClick={() => void make()}>{busy === 'make' ? 'Making music (a few minutes)…' : 'Make music'}</button>
  </details>
}
