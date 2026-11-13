import { useEffect, useMemo, useState } from 'react'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { Copy, Volume2 } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { ParsedStory } from '../engine/story'
import type { DemoClip } from '../domain/demoClips'
import { buildPerformance, emptyDirection, performanceBrief, providerById, providers, voiceEvents, voiceStates, type EventCue, type ProviderId, type VoiceEvent, type VoiceState } from '../domain/voiceDirection'
import { SearchSelect } from './SearchSelect'
import { VoiceCloud } from './VoiceCloud'
import { latestElevenModel, rankElevenModels, type CloudModel } from '../domain/elevenModels'
import { sampleLines, soundBrief, suggestVoice, voiceBrief, type InstalledVoice } from '../domain/voiceAudition'

/** Hear a character speak (installed Windows voices, free and offline) or get a sound brief for a prop. Auditions are saved with the project like motion clips. */
export function VoiceAudition(props: { asset?: ExtractedAsset; story?: ParsedStory; clips: DemoClip[]; setClips: (update: (clips: DemoClip[]) => DemoClip[]) => void; desktop: boolean; notify: (message: string) => void; providersVersion: number; openProviders: (providerId?: string) => void; onChange: (asset: ExtractedAsset) => void }) {
  const { asset, story, clips, setClips, desktop, notify, onChange, providersVersion, openProviders } = props
  const [voices, setVoices] = useState<InstalledVoice[]>([])
  const [voice, setVoice] = useState('')
  const [rate, setRate] = useState(0)
  const [custom, setCustom] = useState('')
  const [picked, setPicked] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [providerId, setProviderId] = useState<ProviderId>(() => { try { return (localStorage.getItem('po.voice.provider') as ProviderId) || 'windows' } catch { return 'windows' } })
  const provider = providerById(providerId)
  const [base, setBase] = useState(() => { try { return localStorage.getItem('po.voice.base.' + providerId) || provider.defaultBase } catch { return provider.defaultBase } })
  const [model, setModel] = useState(provider.defaultModel)
  const [serverVoice, setServerVoice] = useState('')
  const [language, setLanguage] = useState('en')
  const [expressiveness, setExpressiveness] = useState(0.5)
  const [direction, setDirection] = useState(emptyDirection)
  const [cloudVoice, setCloudVoice] = useState('')
  const [elevenModels, setElevenModels] = useState<CloudModel[]>([])
  const chooseProvider = (id: ProviderId) => {
    const p = providerById(id)
    setProviderId(id); setModel(p.defaultModel); setCloudVoice('')
    let saved = ''
    try { localStorage.setItem('po.voice.provider', id); saved = localStorage.getItem('po.voice.base.' + id) ?? '' } catch { /* storage unavailable */ }
    setBase(saved || p.defaultBase)
  }
  const setCue = (index: number, patch: Partial<EventCue>) => setDirection((d) => ({ ...d, events: d.events.map((c, i) => (i === index ? { ...c, ...patch } : c)) }))
  useEffect(() => { if (desktop) void invoke<InstalledVoice[]>('local_voices').then(setVoices).catch((e) => setError(String(e))) }, [desktop])
  // The newest ElevenLabs speech models come from the account itself, so a new generation shows up without an app update.
  useEffect(() => {
    if (!desktop || providerId !== 'elevenlabs') return
    let live = true
    void invoke<boolean>('credential_status', { provider: 'elevenlabs' }).then((ok) => ok ? invoke<CloudModel[]>('elevenlabs_models') : []).then((list) => { if (live) setElevenModels(rankElevenModels(list)) }).catch(() => { if (live) setElevenModels([]) })
    return () => { live = false }
  }, [desktop, providerId, providersVersion])
  const lines = useMemo(() => (asset ? sampleLines(story, asset.name) : []), [story, asset])
  useEffect(() => { if (asset && !voice) setVoice(suggestVoice(voices, asset)?.name ?? '') }, [voices, asset, voice])
  if (!asset || asset.type === 'set' || asset.type === 'environment' || asset.type === 'costume') return null
  const isCharacter = asset.type === 'character'
  const line = custom.trim() || lines[picked]?.text || ''
  const mine = clips.filter((c) => c.assetId === asset.id && c.kind === 'audio')
  const latest = latestElevenModel(elevenModels)
  const activeModel = provider.id === 'elevenlabs' && model === 'latest' ? latest : model
  const performance = buildPerformance(line, direction, provider, activeModel)
  const speak = async () => {
    setBusy(true); setError('')
    try {
      const outputName = `${asset.id}_voice_audition`
      let path: string
      if (provider.transport === 'http') {
        try { localStorage.setItem('po.voice.base.' + providerId, base) } catch { /* storage unavailable */ }
        path = await invoke<string>('speak_http', { base, model, voice: serverVoice || asset.soundDirection || '', text: performance.text, speed: 1 + rate / 10, extra: provider.languages ? { language, exaggeration: expressiveness } : undefined, outputName })
      } else if (provider.id === 'elevenlabs') {
        path = await invoke<string>('speak_elevenlabs', { voiceId: cloudVoice, modelId: activeModel, text: performance.text, stability: 0.5, speed: Math.min(1.2, Math.max(0.7, 1 + rate / 20)), outputName })
      } else if (provider.id === 'voicekiller') {
        path = await invoke<string>('speak_voicekiller', { voiceName: cloudVoice, script: performance.text, instructions: [asset.soundDirection, performance.instructions].filter(Boolean).join(' '), outputName })
      } else path = await invoke<string>('speak_local', { text: performance.text, voice, rate, outputName })
      setClips((list) => [...list, { id: `AUD-${asset.id}-${Date.now().toString(36)}`, assetId: asset.id, assetName: asset.name, motion: 'custom', model: provider.transport === 'http' ? `${provider.label} · ${serverVoice || 'default voice'}` : provider.transport === 'cloud' ? `${provider.label} · ${cloudVoice || 'voice'}` : `Windows voice · ${voice || 'default'}`, path, prompt: `${voiceBrief(asset, line)}
${performanceBrief(line, direction)}`, duration: 0, createdAt: Date.now(), kind: 'audio', line }])
      notify(`Voice audition saved for ${asset.name}.`)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  const copy = (text: string) => { void navigator.clipboard?.writeText(text); notify('Brief copied. Paste it into your voice or sound tool.') }
  return <section className="panel voice-audition" id="voice-audition" tabIndex={-1} aria-label="Voice and sound audition">
    <div className="panel-heading"><div><span className="eyebrow">{isCharacter ? 'VOICE AUDITION · SOUND' : 'SOUND AUDITION'}</span><h3>{asset.name}: {isCharacter ? 'hear them speak' : 'what it sounds like'}</h3></div></div>
    {isCharacter ? <>
      <section className="vg" aria-labelledby="vg-engine"><h4 className="vg-title" id="vg-engine"><i>1</i>Engine and voice</h4>
      <label className="settings-field"><span>Voice engine</span><select value={providerId} onChange={(e) => chooseProvider(e.target.value as ProviderId)}>{providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <p className="helper">{provider.note}{!provider.verified && ' Not yet tested against a live server: if it fails, the error below says why.'}</p>
      {!desktop && <p className="helper">Voice auditions run in the Windows app.</p>}
      {provider.transport === 'cloud' && <VoiceCloud provider={provider} desktop={desktop} assetId={asset.id} voice={cloudVoice} setVoice={setCloudVoice} model={model} setModel={setModel} models={elevenModels} latestModel={latest} providersVersion={providersVersion} openProviders={openProviders} notify={notify} setError={setError} onClip={(c) => setClips((list) => [...list, { id: `AUD-${asset.id}-${Date.now().toString(36)}`, assetId: asset.id, assetName: asset.name, motion: 'custom', model: c.label, path: c.path, prompt: c.line, duration: 0, createdAt: Date.now(), kind: 'audio', line: c.line }])} />}
      <div className="sheet-controls">
        {provider.transport === 'windows' && <label><span>Voice (type to search)</span><SearchSelect label="Windows voice" value={voice} onChange={setVoice} emptyText="No Windows voices found" options={voices.map((v) => ({ value: v.name, label: `${v.name} · ${v.gender} · ${v.culture}` }))} /></label>}
        {provider.transport === 'http' && <><label><span>Server address</span><input value={base} onChange={(e) => setBase(e.target.value)} aria-label="Speech server address" /></label><label><span>Model</span><input value={model} onChange={(e) => setModel(e.target.value)} /></label>{provider.languages && <><label><span>Language</span><select value={language} onChange={(e) => setLanguage(e.target.value)}>{provider.languages.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label><label><span>Expressiveness</span><input type="range" min={0} max={1.5} step={0.05} value={expressiveness} onChange={(e) => setExpressiveness(Number(e.target.value))} aria-label="Expressiveness" /></label></>}<label><span>{provider.languages ? 'Reference clip path (optional)' : provider.describesVoice ? 'Voice name or description' : 'Voice name'}</span><input value={serverVoice} onChange={(e) => setServerVoice(e.target.value)} placeholder={asset.soundDirection || 'as your server names it'} /></label></>}
        <label><span>Pace</span><input type="range" min={-6} max={6} value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Speaking pace" /></label>
      </div>
      </section>
      <section className="vg" aria-labelledby="vg-line"><h4 className="vg-title" id="vg-line"><i>2</i>Line</h4>
      {lines.length > 0 && <div className="sheet-controls">{lines.length > 0 && <label><span>Line from the script</span><select value={picked} onChange={(e) => { setPicked(Number(e.target.value)); setCustom('') }}>{lines.map((l, i) => <option key={l.line} value={i}>Line {l.line}: {l.text.slice(0, 48)}</option>)}</select></label>}</div>}
      <label className="settings-field"><span>{lines.length ? 'Or type your own line' : 'Line to speak (no dialogue for this character in the script)'}</span><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Type a line to hear" /></label>
      </section>
      <section className="vg" aria-labelledby="vg-dir"><h4 className="vg-title" id="vg-dir"><i>3</i>Direction</h4>
      <label className="settings-field"><span>Voice direction (saved with the character)</span><input value={asset.soundDirection ?? ''} onChange={(e) => onChange({ ...asset, soundDirection: e.target.value })} placeholder="e.g. low, tired, measured, slight northern accent" /></label>
      <fieldset className="settings-field"><legend>Performance direction</legend>
        <div className="sheet-controls">
          <label><span>Physical state</span><select value={direction.state} onChange={(e) => setDirection({ ...direction, state: e.target.value as VoiceState })}>{voiceStates.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label><span>Emotion</span><input value={direction.emotion} onChange={(e) => setDirection({ ...direction, emotion: e.target.value })} placeholder="e.g. weary, amused" /></label>
        </div>
        {direction.events.map((c, i) => <div className="sheet-controls" key={i}>
          <label><span>Sound</span><select value={c.event} onChange={(e) => setCue(i, { event: e.target.value as VoiceEvent })}>{voiceEvents.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label><span>Where</span><select value={c.at} onChange={(e) => setCue(i, { at: e.target.value as EventCue['at'] })}><option value="before">before the line</option><option value="after">after the line</option></select></label>
          <button className="secondary" onClick={() => setDirection({ ...direction, events: direction.events.filter((_, j) => j !== i) })}>Remove</button>
        </div>)}
        <button className="secondary" onClick={() => setDirection({ ...direction, events: [...direction.events, { event: 'laugh', at: 'after' }] })}>Add a laugh, grunt or other sound</button>
        {performance.applied.map((a) => <p className="helper" key={a}>✓ {a}</p>)}
        {performance.notApplied.map((a) => <p className="helper warn" key={a}>Not applied: {a}</p>)}
      </fieldset>
      </section>
      <section className="vg" aria-labelledby="vg-result"><h4 className="vg-title" id="vg-result"><i>4</i>Result</h4>
      <div className="sheet-actions-row">
        <button className="primary" disabled={!desktop || busy || !line || (provider.transport === 'windows' && !voices.length) || (provider.transport === 'cloud' && !cloudVoice.trim())} onClick={() => void speak()}><Volume2 size={15} /> {busy ? 'Speaking…' : 'Hear this line'}</button>
        <button className="secondary" onClick={() => copy(`${voiceBrief(asset, line)}
${performanceBrief(line, direction)}`)}><Copy size={14} /> Copy casting brief</button>
      </div>
      </section>
    </> : <>
      <p className="helper">This brief lists what to record or generate; it is also saved with the asset's sound direction. You can make each sound as a short effect below with ElevenLabs (paid, needs your key).</p>
      {desktop && <VoiceCloud provider={providerById('elevenlabs')} desktop={desktop} assetId={asset.id} voice={cloudVoice} setVoice={setCloudVoice} model={model} setModel={setModel} models={elevenModels} latestModel={latest} providersVersion={providersVersion} openProviders={openProviders} notify={notify} setError={setError} soundOnly soundHint={`e.g. ${soundBrief(asset).split('Sounds to supply: ')[1]?.split(',')[0] ?? 'engine start'}`} onClip={(c) => setClips((list) => [...list, { id: `AUD-${asset.id}-${Date.now().toString(36)}`, assetId: asset.id, assetName: asset.name, motion: 'custom', model: c.label, path: c.path, prompt: c.line, duration: 0, createdAt: Date.now(), kind: 'audio', line: c.line }])} />}
      <label className="settings-field"><span>Sounds to supply</span><textarea rows={3} value={asset.soundDirection ?? ''} onChange={(e) => onChange({ ...asset, soundDirection: e.target.value })} placeholder="Leave empty to use the suggested list below" /></label>
      <pre className="helper" style={{ whiteSpace: 'pre-wrap' }}>{soundBrief(asset)}</pre>
      <div className="sheet-actions-row"><button className="secondary" onClick={() => copy(soundBrief(asset))}><Copy size={14} /> Copy sound brief</button></div>
    </>}
    {error && <p className="helper warn" role="alert">{error}</p>}
    {mine.length > 0 && <div className="clip-grid">{mine.slice().reverse().map((c) => <figure key={c.id}><audio controls src={convertFileSrc(c.path)} aria-label={`${c.assetName} voice audition`} /><figcaption><b>“{(c.line ?? '').slice(0, 60)}”</b><small>{c.model}</small></figcaption></figure>)}</div>}
  </section>
}
