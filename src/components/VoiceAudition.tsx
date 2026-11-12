import { useEffect, useMemo, useState } from 'react'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { Copy, Volume2 } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { ParsedStory } from '../engine/story'
import type { DemoClip } from '../domain/demoClips'
import { sampleLines, soundBrief, suggestVoice, voiceBrief, type InstalledVoice } from '../domain/voiceAudition'

/** Hear a character speak (installed Windows voices, free and offline) or get a sound brief for a prop. Auditions are saved with the project like motion clips. */
export function VoiceAudition(props: { asset?: ExtractedAsset; story?: ParsedStory; clips: DemoClip[]; setClips: (update: (clips: DemoClip[]) => DemoClip[]) => void; desktop: boolean; notify: (message: string) => void; onChange: (asset: ExtractedAsset) => void }) {
  const { asset, story, clips, setClips, desktop, notify, onChange } = props
  const [voices, setVoices] = useState<InstalledVoice[]>([])
  const [voice, setVoice] = useState('')
  const [rate, setRate] = useState(0)
  const [custom, setCustom] = useState('')
  const [picked, setPicked] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (desktop) void invoke<InstalledVoice[]>('local_voices').then(setVoices).catch((e) => setError(String(e))) }, [desktop])
  const lines = useMemo(() => (asset ? sampleLines(story, asset.name) : []), [story, asset])
  useEffect(() => { if (asset && !voice) setVoice(suggestVoice(voices, asset)?.name ?? '') }, [voices, asset, voice])
  if (!asset || asset.type === 'set' || asset.type === 'environment' || asset.type === 'costume') return null
  const isCharacter = asset.type === 'character'
  const line = custom.trim() || lines[picked]?.text || ''
  const mine = clips.filter((c) => c.assetId === asset.id && c.kind === 'audio')
  const speak = async () => {
    setBusy(true); setError('')
    try {
      const path = await invoke<string>('speak_local', { text: line, voice, rate, outputName: `${asset.id}_voice_audition` })
      setClips((list) => [...list, { id: `AUD-${asset.id}-${Date.now().toString(36)}`, assetId: asset.id, assetName: asset.name, motion: 'custom', model: `Windows voice · ${voice || 'default'}`, path, prompt: voiceBrief(asset, line), duration: 0, createdAt: Date.now(), kind: 'audio', line }])
      notify(`Voice audition saved for ${asset.name}.`)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  const copy = (text: string) => { void navigator.clipboard?.writeText(text); notify('Brief copied. Paste it into your voice or sound tool.') }
  return <section className="panel voice-audition" id="voice-audition" tabIndex={-1} aria-label="Voice and sound audition">
    <div className="panel-heading"><div><span className="eyebrow">{isCharacter ? 'VOICE AUDITION · SOUND' : 'SOUND AUDITION'}</span><h3>{asset.name}: {isCharacter ? 'hear them speak' : 'what it sounds like'}</h3></div></div>
    {isCharacter ? <>
      <p className="helper">Stand-in voices from this computer: free and offline. They are for casting, pace and timing, not final performance. Use the brief to cast a real voice elsewhere.</p>
      {!desktop && <p className="helper">Voice auditions run in the Windows app.</p>}
      <div className="sheet-controls">
        <label><span>Voice</span><select value={voice} onChange={(e) => setVoice(e.target.value)} disabled={!voices.length}>{voices.length === 0 && <option value="">No Windows voices found</option>}{voices.map((v) => <option key={v.name} value={v.name}>{v.name} · {v.gender} · {v.culture}</option>)}</select></label>
        <label><span>Pace</span><input type="range" min={-6} max={6} value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Speaking pace" /></label>
        {lines.length > 0 && <label><span>Line from the script</span><select value={picked} onChange={(e) => { setPicked(Number(e.target.value)); setCustom('') }}>{lines.map((l, i) => <option key={l.line} value={i}>Line {l.line}: {l.text.slice(0, 48)}</option>)}</select></label>}
      </div>
      <label className="settings-field"><span>{lines.length ? 'Or type your own line' : 'Line to speak (no dialogue for this character in the script)'}</span><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Type a line to hear" /></label>
      <label className="settings-field"><span>Voice direction (saved with the character)</span><input value={asset.soundDirection ?? ''} onChange={(e) => onChange({ ...asset, soundDirection: e.target.value })} placeholder="e.g. low, tired, measured, slight northern accent" /></label>
      <div className="sheet-actions-row">
        <button className="primary" disabled={!desktop || busy || !line || !voices.length} onClick={() => void speak()}><Volume2 size={15} /> {busy ? 'Speaking…' : 'Hear this line'}</button>
        <button className="secondary" onClick={() => copy(voiceBrief(asset, line))}><Copy size={14} /> Copy casting brief</button>
      </div>
    </> : <>
      <p className="helper">Sound is not generated in this version. This brief lists what to record or generate; it is also saved with the asset's sound direction.</p>
      <label className="settings-field"><span>Sounds to supply</span><textarea rows={3} value={asset.soundDirection ?? ''} onChange={(e) => onChange({ ...asset, soundDirection: e.target.value })} placeholder="Leave empty to use the suggested list below" /></label>
      <pre className="helper" style={{ whiteSpace: 'pre-wrap' }}>{soundBrief(asset)}</pre>
      <div className="sheet-actions-row"><button className="secondary" onClick={() => copy(soundBrief(asset))}><Copy size={14} /> Copy sound brief</button></div>
    </>}
    {error && <p className="helper warn" role="alert">{error}</p>}
    {mine.length > 0 && <div className="clip-grid">{mine.slice().reverse().map((c) => <figure key={c.id}><audio controls src={convertFileSrc(c.path)} aria-label={`${c.assetName} voice audition`} /><figcaption><b>“{(c.line ?? '').slice(0, 60)}”</b><small>{c.model}</small></figcaption></figure>)}</div>}
  </section>
}
