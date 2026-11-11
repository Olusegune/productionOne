import { useState } from 'react'
import { Check, Clapperboard, Shirt, Smile, Sparkles, UserRound, Volume2 } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { SheetType } from '../domain/visualDevelopment'

type BibleTab = { id: string; label: string; sheet?: SheetType; icon: typeof UserRound }
const tabs: BibleTab[] = [
  { id: 'identity', label: 'Identity', sheet: 'Identity', icon: UserRound },
  { id: 'turnaround', label: 'Turnaround', sheet: 'Turnaround', icon: Sparkles },
  { id: 'poses', label: 'Poses', sheet: 'Poses', icon: Clapperboard },
  { id: 'expressions', label: 'Expressions', sheet: 'Expressions', icon: Smile },
  { id: 'wardrobe', label: 'Wardrobe', sheet: 'Wardrobe', icon: Shirt },
  { id: 'detail', label: 'Details', sheet: 'Detail', icon: Check },
  { id: 'motion', label: 'Motion video', icon: Clapperboard },
  { id: 'voice', label: 'Voice', icon: Volume2 },
]

export function CharacterBible({ asset, onSheet, notify }: { asset?: ExtractedAsset; onSheet: (sheet: SheetType) => void; notify: (message: string) => void }) {
  const [active, setActive] = useState('identity')
  if (!asset || asset.type !== 'character') return null
  const current = tabs.find(tab => tab.id === active) ?? tabs[0]
  const choose = (tab: BibleTab) => { setActive(tab.id); if (tab.sheet) onSheet(tab.sheet); else notify(`${tab.label} workspace selected for ${asset.name}.`) }
  return <section className="character-bible" aria-label="Character Bible">
    <div className="character-bible-head"><div><span className="eyebrow">CHARACTER BIBLE · CANONICAL PACKAGE</span><h3>{asset.name}</h3><p>One identity anchor shared across every sheet, costume, pose, expression, and motion test.</p></div><span className={`status ${asset.status}`}>{asset.status}</span></div>
    <nav className="character-bible-tabs" aria-label="Character Bible sections">{tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} className={active === tab.id ? 'on' : ''} onClick={() => choose(tab)}><Icon size={13} />{tab.label}</button> })}</nav>
    <div className="character-bible-next"><b>{current.label}</b><span>{current.sheet ? `Generate and approve the ${current.label.toLowerCase()} sheet separately.` : current.id === 'motion' ? 'Use approved identity, pose, costume and expression references for video tests.' : 'Keep voice identity linked to the same character and emotional arc.'}</span></div>
  </section>
}
