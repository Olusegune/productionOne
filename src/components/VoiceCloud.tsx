import { useEffect, useState } from 'react'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { KeyRound, Sparkles, Volume2 } from 'lucide-react'
import type { VoiceProvider } from '../domain/voiceDirection'

interface CloudVoice { id: string; name: string; detail: string }
interface Preview { id: string; path: string }

/** Connect, choose or design a voice, and make sound effects for a cloud voice service. Keys go straight to the Windows Credential Manager and are never shown again. */
export function VoiceCloud(props: {
  provider: VoiceProvider
  desktop: boolean
  assetId: string
  voice: string
  setVoice: (voice: string) => void
  model: string
  setModel: (model: string) => void
  onClip: (clip: { path: string; label: string; line: string }) => void
  notify: (message: string) => void
  setError: (message: string) => void
  /** Props and vehicles: only the sound-effect maker, no voices. */
  soundOnly?: boolean
  soundHint?: string
}) {
  const { provider, desktop, assetId, voice, setVoice, model, setModel, onClip, notify, setError, soundOnly, soundHint } = props
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [entry, setEntry] = useState<Record<string, string>>({})
  const [voices, setVoices] = useState<CloudVoice[]>([])
  const [busy, setBusy] = useState('')
  const [description, setDescription] = useState('')
  const [sample, setSample] = useState('')
  const [previews, setPreviews] = useState<Preview[]>([])
  const [voiceName, setVoiceName] = useState('')
  const [soundText, setSoundText] = useState('')
  const [soundSeconds, setSoundSeconds] = useState(2)

  const refreshStatus = async () => {
    if (!desktop) return
    const next: Record<string, boolean> = {}
    for (const k of provider.keys ?? []) next[k.id] = await invoke<boolean>('credential_status', { provider: k.id }).catch(() => false)
    setSaved(next)
  }
  useEffect(() => { void refreshStatus(); setVoices([]); setPreviews([]) }, [provider.id, desktop])
  const connected = (provider.keys ?? []).every((k) => saved[k.id])
  const run = async (what: string, job: () => Promise<void>) => { setBusy(what); setError(''); try { await job() } catch (e) { setError(String(e)) } finally { setBusy('') } }

  const saveKey = (id: string) => run('key', async () => {
    await invoke('save_credential', { provider: id, apiKey: entry[id] ?? '' })
    setEntry((e) => ({ ...e, [id]: '' }))
    await refreshStatus()
    notify('Saved to the Windows Credential Manager.')
  })
  const removeKey = (id: string) => run('key', async () => { await invoke('delete_credential', { provider: id }); await refreshStatus() })
  const loadVoices = () => run('voices', async () => {
    const list = await invoke<CloudVoice[]>(provider.id === 'elevenlabs' ? 'elevenlabs_voices' : 'voicekiller_voices')
    setVoices(list)
    if (!voice && list[0]) setVoice(list[0].id)
    notify(`${list.length} voices loaded.`)
  })
  const design = () => run('design', async () => {
    setPreviews(await invoke<Preview[]>('design_voice', { description, sampleText: sample, outputName: `${assetId}_voice_design` }))
  })
  const keep = (preview: Preview) => run('keep', async () => {
    const kept = await invoke<CloudVoice>('save_designed_voice', { name: voiceName, description, generatedVoiceId: preview.id })
    setVoices((v) => [kept, ...v]); setVoice(kept.id); setPreviews([])
    notify(`Saved "${kept.name}" to your ElevenLabs account and selected it.`)
  })
  const makeSound = () => run('sound', async () => {
    const path = await invoke<string>('sound_elevenlabs', { text: soundText, durationSeconds: soundSeconds, promptInfluence: 0.5, outputName: `${assetId}_sound_effect` })
    onClip({ path, label: `${provider.label} · sound effect`, line: soundText })
    notify('Sound effect saved with the audio clips.')
  })

  return <div className="voice-cloud">
    <p className="helper warn">Every action here spends credits on your {provider.label.replace(' (cloud)', '')} account.</p>
    <details open={!connected}>
      <summary><KeyRound size={14} /> Connect {connected ? '(keys saved)' : '(needed)'}</summary>
      {(provider.keys ?? []).map((k) => <div className="sheet-controls" key={k.id}>
        <label><span>{k.label} {saved[k.id] ? '· saved' : ''}</span><input type="password" autoComplete="off" value={entry[k.id] ?? ''} onChange={(e) => setEntry((x) => ({ ...x, [k.id]: e.target.value }))} placeholder={saved[k.id] ? 'Saved. Paste a new one to replace it' : 'Paste it here'} aria-label={k.label} /></label>
        <button className="secondary" disabled={!desktop || !(entry[k.id] ?? '').trim() || busy === 'key'} onClick={() => void saveKey(k.id)}>Save</button>
        {saved[k.id] && <button className="secondary" onClick={() => void removeKey(k.id)}>Remove</button>}
      </div>)}
    </details>
    {!soundOnly && <div className="sheet-controls">
      {provider.models && <label><span>Model</span><select value={model} onChange={(e) => setModel(e.target.value)}>{provider.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>}
      {voices.length > 0
        ? <label><span>Voice</span><select value={voice} onChange={(e) => setVoice(e.target.value)}>{voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.detail ? ` · ${v.detail}` : ''}</option>)}</select></label>
        : <label><span>{provider.id === 'elevenlabs' ? 'Voice id' : 'Voice name'}</span><input value={voice} onChange={(e) => setVoice(e.target.value)} placeholder={provider.id === 'elevenlabs' ? 'load your voices, or paste a voice id' : 'e.g. Jett'} /></label>}
      <button className="secondary" disabled={!desktop || !connected || busy === 'voices'} onClick={() => void loadVoices()}>{busy === 'voices' ? 'Loading…' : 'Load my voices'}</button>
    </div>}
    {provider.designsVoices && !soundOnly && <details>
      <summary><Sparkles size={14} /> Design a new voice from a description</summary>
      <label className="settings-field"><span>Describe the voice (20 to 1000 characters)</span><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. woman in her forties, Lagos accent, low and weathered, dry humour, unhurried" /></label>
      <label className="settings-field"><span>Sample text it will read ({sample.trim().length}/100 to 1000 characters)</span><textarea rows={3} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Paste a few lines of her dialogue so you can judge the voice." /></label>
      <button className="secondary" disabled={!desktop || !connected || busy === 'design'} onClick={() => void design()}>{busy === 'design' ? 'Designing…' : 'Make previews'}</button>
      {previews.length > 0 && <>
        <label className="settings-field"><span>Name to save the voice under</span><input value={voiceName} onChange={(e) => setVoiceName(e.target.value)} placeholder="e.g. Amina" /></label>
        <div className="clip-grid">{previews.map((p, i) => <figure key={p.id}><audio controls src={convertFileSrc(p.path)} aria-label={`Voice preview ${i + 1}`} /><figcaption><b>Preview {i + 1}</b><button className="secondary" disabled={!voiceName.trim() || busy === 'keep'} onClick={() => void keep(p)}>Keep this voice</button></figcaption></figure>)}</div>
        <p className="helper">Keeping a voice uses one of your ElevenLabs custom voice slots.</p>
      </>}
    </details>}
    {provider.soundEffects && <details open={soundOnly}>
      <summary><Volume2 size={14} /> Make a separate sound effect (grunt, laugh, engine, footsteps)</summary>
      <label className="settings-field"><span>Describe the sound</span><input value={soundText} onChange={(e) => setSoundText(e.target.value)} placeholder={soundHint ?? "e.g. a woman's short effortful grunt lifting something heavy"} /></label>
      <label className="settings-field"><span>Length: {soundSeconds}s (0.5 to 30)</span><input type="range" min={0.5} max={10} step={0.5} value={soundSeconds} onChange={(e) => setSoundSeconds(Number(e.target.value))} aria-label="Sound length in seconds" /></label>
      <button className="secondary" disabled={!desktop || !connected || !soundText.trim() || busy === 'sound'} onClick={() => void makeSound()}>{busy === 'sound' ? 'Making…' : 'Make sound effect'}</button>
    </details>}
  </div>
}
