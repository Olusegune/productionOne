import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { FileText, Wand2 } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { ParsedStory } from '../engine/story'
import { sampleLines } from '../domain/voiceAudition'
import { HELPER_SYSTEM, helperPrompt, parseHelperReply, scriptVoiceBrief } from '../domain/voiceDesign'
import { refreshLocal, useLocalAi } from '../data/localAi'

/**
 * Two ways to write a voice description without typing it from scratch: build it from the script and the character's confirmed fields, or ask
 * the local AI model to write it from the person's rough idea. The AI helper runs on the person's own computer (Ollama or LM Studio).
 */
export function VoiceBriefTools(props: {
  asset: ExtractedAsset
  story?: ParsedStory
  desktop: boolean
  /** Receives the description, and the sample text when the engine uses one. */
  onBrief: (brief: { description: string; sample: string }) => void
  notify: (message: string) => void
  setError: (message: string) => void
}) {
  const { asset, story, desktop, onBrief, notify, setError } = props
  const { config } = useLocalAi(desktop)
  const [idea, setIdea] = useState('')
  const [busy, setBusy] = useState(false)
  const [evidence, setEvidence] = useState<string[]>([])

  const fromScript = () => {
    setError('')
    const brief = scriptVoiceBrief(asset, story, idea)
    setEvidence(brief.evidence)
    if (!brief.description) { setError(`The script and ${asset.name}'s fields do not say enough yet. Add an age, gender or personality under Identity, or type an idea below. Missing: ${brief.missing.join(', ')}.`); onBrief({ description: '', sample: brief.sample }); return }
    onBrief({ description: brief.description, sample: brief.sample })
    notify(brief.missing.length ? `Filled from the script. To improve it: ${brief.missing.join(', ')}.` : 'Filled from the script.')
  }
  const askHelper = async () => {
    setBusy(true); setError('')
    try {
      const cfg = config.textModel ? config : (await refreshLocal()).config
      const kind = cfg.textProvider ?? 'ollama'
      const model = cfg.textModel
      if (!model) throw new Error('Choose a local model first (Local AI, then pick one under Ollama or LM Studio). "Fill from the script" works without one.')
      const base = kind === 'lmstudio' ? (cfg.lmstudioUrl ?? 'http://127.0.0.1:1234') : (cfg.ollamaUrl ?? 'http://127.0.0.1:11434')
      const lines = sampleLines(story, asset.name).map((l) => l.text)
      const reply = await invoke<string>('local_llm', { kind, base, model, system: HELPER_SYSTEM, prompt: helperPrompt(asset, lines, idea), jsonMode: true, images: [] })
      const description = parseHelperReply(reply)
      if (!description) throw new Error('The AI helper did not return a usable description. Try again, or use "Fill from the script".')
      setEvidence([`Written by ${model} on this computer from your idea, ${asset.name}'s confirmed fields and ${lines.length} script line${lines.length === 1 ? '' : 's'}`])
      onBrief({ description, sample: scriptVoiceBrief(asset, story).sample })
      notify('The AI helper wrote a description. Read it and edit anything that is wrong.')
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }

  return <div className="voice-brief-tools">
    <label className="settings-field"><span>Your idea (optional)</span><input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. weathered, dry humour, Lagos accent" /></label>
    <div className="sheet-actions-row">
      <button className="secondary" onClick={fromScript}><FileText size={14} /> Fill from the script</button>
      <button className="secondary" disabled={!desktop || busy} onClick={() => void askHelper()}><Wand2 size={14} /> {busy ? 'Writing…' : 'Ask the AI helper'}</button>
    </div>
    {evidence.length > 0 && <p className="helper">Built from: {evidence.join('; ')}.</p>}
  </div>
}
