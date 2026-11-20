import { useState } from 'react'
import { KeyRound, Sparkles, X } from 'lucide-react'
import { useModelChoice } from '../data/modelChoice'
import { costText, priceFor } from '../domain/pricing'
import { providerLabels } from '../domain/imageCatalog'

const KEY = 'po.quickstart.dismissed'
const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const write = () => { try { localStorage.setItem(KEY, '1') } catch { /* private window: it returns next time */ } }

export type FirstPicture = { kind: 'existing'; assetId: string } | { kind: 'new'; name: string; description: string }

interface Props {
  desktop: boolean
  providersVersion: number
  perImageUsd: number | null
  /** Characters already in the project, so the first picture can be one of them. */
  characters: Array<{ id: string; name: string }>
  styleName: string
  onMake: (what: FirstPicture) => void
  onKeys: () => void
  onOwnPicture: () => void
}

/**
 * "Make my first picture": the shortest path to seeing a result. One picture, with the model and the cost shown before you press the button. Pressing it is the only
 * thing that spends anything. It lives on the Projects screen until you have made a picture or dismiss it.
 */
export function QuickStart({ desktop, providersVersion, perImageUsd, characters, styleName, onMake, onKeys, onOwnPicture }: Props) {
  const [gone, setGone] = useState(read)
  const choice = useModelChoice(desktop, providersVersion)
  const [pick, setPick] = useState<string>(characters[0]?.id ?? 'new')
  const [name, setName] = useState('Mara')
  const [description, setDescription] = useState('')
  if (gone) return null
  const price = priceFor(choice.provider, choice.modelId, perImageUsd)
  const hasKey = choice.provider === 'comfyui' ? !!choice.configured.comfyui : !!choice.configured[choice.provider]
  const modelName = choice.catalog.find((m) => m.provider === choice.provider && m.id === choice.modelId)?.name ?? choice.modelId
  const newOne = pick === 'new'
  const canMake = desktop && choice.keysChecked && hasKey && (!newOne || (name.trim().length > 0 && description.trim().length > 0))
  const why = !desktop ? 'Making pictures needs the desktop app.' : !hasKey ? `There is no ${providerLabels[choice.provider] ?? choice.provider} key yet.` : newOne && !description.trim() ? 'Describe the character in a sentence first.' : ''
  const close = () => { write(); setGone(true) }
  return (
    <section className="qs panel" aria-label="Make your first picture">
      <header>
        <div><span className="eyebrow">Quick start</span><h3>Make your first picture</h3></div>
        <button className="icon-button" onClick={close} aria-label="Hide the quick start"><X size={16} /></button>
      </header>
      <p className="helper">One picture, so you can see what Production One makes before you plan a whole film. You approve or reject it yourself.</p>
      <label><span>Who is it of?</span>
        <select aria-label="First picture subject" value={pick} onChange={(e) => setPick(e.target.value)}>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name} (from this project)</option>)}
          <option value="new">Someone new: I will describe them</option>
        </select>
      </label>
      {newOne && (
        <div className="qs-new">
          <label><span>Name</span><input aria-label="New character name" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label><span>In a sentence (your words)</span><textarea aria-label="New character description" rows={2} placeholder="A weathered harbour pilot in a long navy coat, a short grey braid and a brass lantern." value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        </div>
      )}
      <ul className="qs-facts" aria-label="What will happen">
        <li><b>Style:</b> {styleName || 'the project style'}</li>
        <li><b>Model:</b> {modelName} ({providerLabels[choice.provider] ?? choice.provider})</li>
        <li><b>Cost:</b> <span data-testid="qs-cost">{costText(1, price)}</span></li>
      </ul>
      <div className="qs-actions">
        {hasKey || !desktop || !choice.keysChecked
          ? <button className="primary" disabled={!canMake} onClick={() => onMake(newOne ? { kind: 'new', name: name.trim(), description: description.trim() } : { kind: 'existing', assetId: pick })}><Sparkles size={15} aria-hidden="true" /> Make my first picture</button>
          : <button className="primary" onClick={onKeys}><KeyRound size={15} aria-hidden="true" /> Add a key first</button>}
        <button className="secondary" onClick={onOwnPicture}>Use my own picture instead</button>
      </div>
      {why && <small className="helper" role="status">{why}</small>}
      <small className="helper">Nothing is made or charged until you press the button. The cost shown is an estimate; the real charge is on your provider account.</small>
    </section>
  )
}
