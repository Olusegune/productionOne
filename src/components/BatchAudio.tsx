import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AlertTriangle, Check, Music, Square, Volume2 } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { ParsedStory } from '../engine/story'
import type { DemoClip } from '../domain/demoClips'
import { providerById, providers, type ProviderId } from '../domain/voiceDirection'
import { cachedVoices, rememberVoices } from '../domain/voiceCache'
import { latestElevenModel, rankElevenModels, type CloudModel } from '../domain/elevenModels'
import { countWithSavedVoice, rememberVoice, savedVoiceFor } from '../domain/castVoice'
import { sampleLines, voiceBrief, type InstalledVoice } from '../domain/voiceAudition'
import '../batch.css'
import { estimateMusic, estimateVoice, failureText, isStopper, planMusicBatch, planVoiceBatch, type MusicTargetRef, type Prices, type RunState, type VoiceChoice } from '../domain/batchAudio'

interface CloudVoice { id: string; name: string; detail: string }
interface Track { path: string; title: string; duration: number }

const batchProviders = providers.filter((p) => p.id !== 'speech-server')
const readNumber = (key: string): number | undefined => { try { const n = Number(localStorage.getItem(key)); return Number.isFinite(n) && n > 0 ? n : undefined } catch { return undefined } }
const savePrice = (key: string, value: string) => { try { if (value.trim()) localStorage.setItem(key, value); else localStorage.removeItem(key) } catch { /* storage unavailable */ } }

/**
 * Cast several characters or score several themes and scenes in one go. The plan is shown first with what it will spend (in units the provider bills, and dollars only from a price the person types),
 * and nothing is sent until the confirming click. Results are saved with the audio clips like any single audition.
 */
export function BatchAudio(props: {
  assets: ExtractedAsset[]
  story?: ParsedStory
  clips: DemoClip[]
  setClips: (update: (clips: DemoClip[]) => DemoClip[]) => void
  desktop: boolean
  notify: (message: string) => void
  providersVersion: number
  openProviders: (providerId?: string) => void
  /** Saves a voice on a character. */
  onAssetChange?: (asset: ExtractedAsset) => void
}) {
  const { assets, story, setClips, desktop, notify, providersVersion, openProviders, onAssetChange } = props
  const characters = useMemo(() => assets.filter((a) => a.type === 'character'), [assets])
  const [tab, setTab] = useState<'voice' | 'music'>('voice')
  const [providerId, setProviderId] = useState<ProviderId>(() => { try { return (localStorage.getItem('po.voice.provider') as ProviderId) || 'windows' } catch { return 'windows' } })
  const provider = providerById(providerId)
  const [choices, setChoices] = useState<Record<string, VoiceChoice>>({})
  const [winVoices, setWinVoices] = useState<InstalledVoice[]>([])
  const [cloud, setCloud] = useState<CloudVoice[]>(() => cachedVoices<CloudVoice>(providerId))
  const [prices, setPrices] = useState<Prices>(() => ({ perThousandCharacters: readNumber('po.price.chars'), perMusicRequest: readNumber('po.price.music') }))
  const [targets, setTargets] = useState<MusicTargetRef[]>([])
  const [idea, setIdea] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [states, setStates] = useState<Record<string, { state: RunState; note?: string }>>({})
  const [error, setError] = useState('')
  const stop = useRef(false)

  useEffect(() => { if (desktop) void invoke<InstalledVoice[]>('local_voices').then(setWinVoices).catch(() => setWinVoices([])) }, [desktop])
  useEffect(() => { setCloud(cachedVoices<CloudVoice>(providerId)); setConfirming(false) }, [providerId, providersVersion])
  useEffect(() => { setConfirming(false) }, [tab, choices, targets, idea])

  // A character's saved voice fills in for this engine unless the person has chosen another for this batch.
  const choice = (a: ExtractedAsset): VoiceChoice => choices[a.id] ?? { include: false, voice: savedVoiceFor(a, providerId)?.voice ?? '' }
  const patch = (a: ExtractedAsset, p: Partial<VoiceChoice>) => setChoices((c) => ({ ...c, [a.id]: { ...choice(a), ...p } }))
  const chooseProvider = (id: ProviderId) => { setProviderId(id); try { localStorage.setItem('po.voice.provider', id) } catch { /* storage unavailable */ } }

  const effectiveChoices = useMemo(() => Object.fromEntries(characters.map((a) => [a.id, choices[a.id] ?? { include: false, voice: savedVoiceFor(a, providerId)?.voice ?? '' }])), [characters, choices, providerId])
  const savedCount = countWithSavedVoice(assets, providerId)
  const tickSaved = () => setChoices((c) => ({ ...c, ...Object.fromEntries(characters.filter((a) => savedVoiceFor(a, providerId)).map((a) => [a.id, { ...(c[a.id] ?? { voice: savedVoiceFor(a, providerId)!.voice }), include: true }])) }))
  const rememberChosen = () => {
    if (!onAssetChange) return
    let n = 0
    for (const a of characters) {
      const c = effectiveChoices[a.id]
      if (!c?.include || !c.voice.trim()) continue
      const label = provider.transport === 'cloud' ? cloud.find((v) => (providerId === 'voicekiller' ? v.name : v.id) === c.voice)?.name : undefined
      onAssetChange(rememberVoice(a, { provider: providerId, voice: c.voice, label }))
      n += 1
    }
    notify(n ? `Saved ${n} voice${n === 1 ? '' : 's'}. Those characters will start with them next time.` : 'Tick characters and choose their voices first.')
  }
  const voiceItems = useMemo(() => planVoiceBatch({ assets, story, choices: effectiveChoices, providerId }), [assets, story, effectiveChoices, providerId])
  const musicItems = useMemo(() => planMusicBatch({ assets, story, targets, idea }), [assets, story, targets, idea])
  const voiceEstimate = estimateVoice(voiceItems, providerId, prices)
  const musicEstimate = estimateMusic(musicItems, prices)
  const estimate = tab === 'voice' ? voiceEstimate : musicEstimate
  const items = tab === 'voice' ? voiceItems : musicItems

  const loadCloud = async () => {
    setError('')
    try {
      const list = await invoke<CloudVoice[]>(providerId === 'elevenlabs' ? 'elevenlabs_voices' : 'voicekiller_voices')
      rememberVoices(providerId, list); setCloud(list)
    } catch (e) { setError(failureText(e)) }
  }
  const setPrice = (key: 'perThousandCharacters' | 'perMusicRequest', storeKey: string, text: string) => {
    savePrice(storeKey, text)
    const n = Number(text)
    setPrices((p) => ({ ...p, [key]: text.trim() && Number.isFinite(n) && n > 0 ? n : undefined }))
  }
  const toggleTarget = (t: MusicTargetRef) => setTargets((list) => (list.some((x) => JSON.stringify(x) === JSON.stringify(t)) ? list.filter((x) => JSON.stringify(x) !== JSON.stringify(t)) : [...list, t]))
  const hasTarget = (t: MusicTargetRef) => targets.some((x) => JSON.stringify(x) === JSON.stringify(t))

  const addClip = (asset: { id: string; name: string }, model: string, path: string, prompt: string, line: string, duration = 0) =>
    setClips((list) => [...list, { id: `AUD-${asset.id}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, assetId: asset.id, assetName: asset.name, motion: 'custom', model, path, prompt, duration, createdAt: Date.now(), kind: 'audio', line }])

  const run = async () => {
    setConfirming(false); setRunning(true); setError(''); stop.current = false
    const todo = items.filter((i) => !i.skip)
    setStates(Object.fromEntries(todo.map((i) => [i.id, { state: 'waiting' as RunState }])))
    let made = 0
    let modelId = provider.defaultModel
    try {
      if (tab === 'voice' && providerId === 'elevenlabs' && modelId === 'latest') {
        modelId = latestElevenModel(rankElevenModels(await invoke<CloudModel[]>('elevenlabs_models').catch(() => [])))
      }
      for (const [index, item] of todo.entries()) {
        if (stop.current) { setStates((s) => ({ ...s, ...Object.fromEntries(todo.slice(index).map((i) => [i.id, { state: 'stopped' as RunState }])) })); break }
        setStates((s) => ({ ...s, [item.id]: { state: 'making' } }))
        try {
          if (tab === 'voice') {
            const v = item as (typeof voiceItems)[number]
            const asset = characters.find((a) => a.id === v.assetId)!
            const outputName = `${asset.id}_voice_batch_${index + 1}`
            let path: string
            if (providerId === 'windows') path = await invoke<string>('speak_local', { text: v.line, voice: v.voice, rate: 0, outputName })
            else if (provider.transport === 'http') {
              let base = provider.defaultBase
              try { base = localStorage.getItem('po.voice.base.' + providerId) || base } catch { /* storage unavailable */ }
              path = await invoke<string>('speak_http', { base, model: provider.defaultModel, voice: v.voice, text: v.line, speed: 1, extra: provider.languages ? { language: 'en', exaggeration: 0.5 } : undefined, outputName })
            } else if (providerId === 'elevenlabs') path = await invoke<string>('speak_elevenlabs', { voiceId: v.voice, modelId, text: v.line, stability: 0.5, speed: 1, outputName })
            else path = await invoke<string>('speak_voicekiller', { voiceName: v.voice, script: v.line, instructions: asset.soundDirection ?? '', outputName })
            const shown = provider.transport === 'cloud' ? (cloud.find((c) => (providerId === 'voicekiller' ? c.name : c.id) === v.voice)?.name ?? v.voice) : v.voice
            const label = provider.transport === 'windows' ? `Windows voice · ${v.voice || 'default'}` : `${provider.label} · ${shown || 'default voice'}`
            addClip(asset, label, path, voiceBrief(asset, v.line), v.line)
          } else {
            const m = item as (typeof musicItems)[number]
            const tracks = await invoke<Track[]>('make_music', { request: { title: m.title, style: m.style, instrumental: true, lyrics: '', negativeTags: '', model: 'V6_MINI', durationSeconds: 45, vocalGender: '', outputName: `${m.assetId}_${m.fileTag}_batch` } })
            for (const t of tracks) addClip({ id: m.assetId, name: m.assetName }, `Suno V6_MINI · ${m.label}`, t.path, m.style, t.title || m.title, Math.round(t.duration))
          }
          made += 1
          setStates((s) => ({ ...s, [item.id]: { state: 'done' } }))
        } catch (e) {
          setStates((s) => ({ ...s, [item.id]: { state: 'failed', note: failureText(e) } }))
          if (isStopper(e)) {
            setStates((s) => ({ ...s, ...Object.fromEntries(todo.slice(index + 1).map((i) => [i.id, { state: 'stopped' as RunState, note: 'Stopped: the same problem would repeat.' }])) }))
            setError(`Stopped after a key or credit problem: ${failureText(e)}`)
            if (/key/i.test(String(e))) openProviders(tab === 'music' ? 'kie' : providerId)
            break
          }
        }
      }
      notify(`${made} of ${todo.length} made. They are saved with the audio clips.`)
    } finally { setRunning(false) }
  }

  const stateLabel = (id: string) => ({ waiting: 'Waiting', making: 'Making…', done: 'Done', failed: 'Failed', stopped: 'Stopped' })[states[id]?.state ?? 'waiting']
  const canReview = desktop && !running && estimate.count > 0 && !estimate.overCap
  const needsCloudList = tab === 'voice' && provider.transport === 'cloud'

  return <details className="batch-audio">
    <summary><Volume2 size={14} /> Batch: cast several characters or score several scenes at once</summary>
    <div className="seg-tabs" role="tablist" aria-label="Batch kind">
      <button role="tab" aria-selected={tab === 'voice'} className={tab === 'voice' ? 'on' : ''} onClick={() => setTab('voice')}><Volume2 size={14} /> Voices</button>
      <button role="tab" aria-selected={tab === 'music'} className={tab === 'music' ? 'on' : ''} onClick={() => setTab('music')}><Music size={14} /> Music</button>
    </div>
    {!desktop && <p className="helper">Batches run in the Windows app. The browser shows the plan only.</p>}

    {tab === 'voice' ? <>
      <label className="settings-field"><span>Voice engine</span>
        <select value={providerId} onChange={(e) => chooseProvider(e.target.value as ProviderId)}>{batchProviders.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <p className="helper">Each ticked character speaks the first line the script gives them (or the line you type). Performance direction stays in the single audition.</p>
      {savedCount > 0 && <p className="helper" role="status">{savedCount} character{savedCount === 1 ? ' has' : 's have'} a saved voice for this engine. <button className="secondary" onClick={tickSaved}>Tick them</button></p>}
      {needsCloudList && cloud.length === 0 && <p className="helper"><button className="secondary" onClick={() => void loadCloud()}>Load my {provider.label.replace(' (cloud)', '')} voices</button> Choose a voice for each character from your account.</p>}
      <table className="batch-table"><caption className="sr-only">Characters to cast</caption>
        <thead><tr><th scope="col">Make</th><th scope="col">Character</th><th scope="col">Voice</th><th scope="col">Line</th></tr></thead>
        <tbody>{characters.map((a) => {
          const c = choice(a)
          const first = sampleLines(story, a.name, 1)[0]?.text ?? ''
          return <tr key={a.id}>
            <td><input type="checkbox" checked={c.include} onChange={(e) => patch(a, { include: e.target.checked })} aria-label={`Make a line for ${a.name}`} /></td>
            <th scope="row">{a.name}</th>
            <td>{provider.transport === 'windows'
              ? <select value={c.voice} onChange={(e) => patch(a, { voice: e.target.value })} aria-label={`Voice for ${a.name}`}><option value="">Choose…</option>{winVoices.map((v) => <option key={v.name} value={v.name}>{v.name} · {v.gender}</option>)}</select>
              : provider.transport === 'cloud'
                ? <select value={c.voice} onChange={(e) => patch(a, { voice: e.target.value })} aria-label={`Voice for ${a.name}`}><option value="">Choose…</option>{cloud.map((v) => <option key={v.id} value={providerId === 'voicekiller' ? v.name : v.id}>{v.name}</option>)}</select>
                : <input value={c.voice} onChange={(e) => patch(a, { voice: e.target.value })} placeholder="server default" aria-label={`Voice for ${a.name}`} />}</td>
            <td><input value={c.line ?? ''} onChange={(e) => patch(a, { line: e.target.value })} placeholder={first || 'type a line'} aria-label={`Line for ${a.name}`} /></td>
          </tr>
        })}</tbody></table>
      {characters.length === 0 && <p className="helper">No characters yet. Analyze a script, or add one in Design with Add to the bible.</p>}
      {onAssetChange && characters.length > 0 && <div className="sheet-actions-row"><button className="secondary" onClick={rememberChosen}>Remember the chosen voices</button></div>}
    </> : <>
      <p className="helper">Themes come from each character's stated personality and role; scene scores from the scene heading and a character in it. Instrumental, about 45 seconds, Suno V6 Mini through Kie.ai. Nothing is written for you that the script does not state.</p>
      <fieldset className="batch-targets"><legend>Themes</legend>{characters.map((a) => <label key={a.id}><input type="checkbox" checked={hasTarget({ kind: 'theme', assetId: a.id })} onChange={() => toggleTarget({ kind: 'theme', assetId: a.id })} /> {a.name}</label>)}</fieldset>
      <fieldset className="batch-targets"><legend>Scene scores</legend>{(story?.scenes ?? []).map((s) => <label key={s.id}><input type="checkbox" checked={hasTarget({ kind: 'scene', sceneId: s.id })} onChange={() => toggleTarget({ kind: 'scene', sceneId: s.id })} /> Scene {s.number}: {s.setting}</label>)}</fieldset>
      <label className="settings-field"><span>Idea for every item (optional)</span><input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. spare, no drums" /></label>
    </>}

    {items.some((i) => i.skip) && <ul className="batch-skips" aria-label="Skipped">{items.filter((i) => i.skip).map((i) => <li key={i.id}><AlertTriangle size={13} aria-hidden="true" /> <b>{'assetName' in i && tab === 'voice' ? (i as { assetName: string }).assetName : (i as { label: string }).label}</b>: {i.skip}</li>)}</ul>}

    {estimate.billing !== 'free' && <div className="batch-price"><label>{tab === 'voice' ? 'Your price per 1,000 characters (USD)' : 'Your price per music request (USD)'}
      <input inputMode="decimal" defaultValue={String((tab === 'voice' ? prices.perThousandCharacters : prices.perMusicRequest) ?? '')} onChange={(e) => tab === 'voice' ? setPrice('perThousandCharacters', 'po.price.chars', e.target.value) : setPrice('perMusicRequest', 'po.price.music', e.target.value)} aria-label={tab === 'voice' ? 'Price per 1,000 characters' : 'Price per music request'} /></label></div>}

    <p className="batch-summary" role="status">{estimate.summary}{estimate.skipped ? ` ${estimate.skipped} skipped.` : ''}{estimate.overCap ? ` That is more than ${20} paid items at once: tick fewer and run it in more than one confirmed batch.` : ''}</p>
    <div className="sheet-actions-row">
      <button className="primary" disabled={!canReview} onClick={() => setConfirming(true)}>Review and make {estimate.count || ''}</button>
    </div>

    {confirming && <div className="batch-confirm" role="dialog" aria-label="Confirm the batch">
      <h4>Confirm</h4>
      <p>{estimate.summary}</p>
      <ol>{items.filter((i) => !i.skip).map((i) => <li key={i.id}>{tab === 'voice' ? <><b>{(i as (typeof voiceItems)[number]).assetName}</b>: “{(i as (typeof voiceItems)[number]).line.slice(0, 70)}”</> : <b>{(i as (typeof musicItems)[number]).label}</b>}</li>)}</ol>
      <div className="sheet-actions-row">
        <button className="primary" onClick={() => void run()}><Check size={14} /> {estimate.billing === 'free' ? `Make ${estimate.count}` : `Spend credits and make ${estimate.count}`}</button>
        <button className="secondary" onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    </div>}

    {(running || Object.keys(states).length > 0) && <section className="batch-progress" aria-label="Progress">
      <ul>{items.filter((i) => states[i.id]).map((i) => <li key={i.id} className={states[i.id].state}><b>{'label' in i ? i.label : (i as (typeof voiceItems)[number]).assetName}</b><span>{stateLabel(i.id)}</span>{states[i.id].note && <small>{states[i.id].note}</small>}</li>)}</ul>
      {running && <button className="secondary" onClick={() => { stop.current = true }}><Square size={13} /> Stop after this one</button>}
    </section>}
    {error && <p className="helper warn" role="alert">{error}</p>}
  </details>
}
